/**
 * El turno de Amparito, extraído de `app/api/chat/route.ts`.
 *
 * POR QUÉ EXISTE. `route.ts` era el único archivo del sistema con CERO cobertura, y es donde
 * viven cuatro de los seis bugs que rompen el demo: el turno muerto cuando se agotan las rondas,
 * la excepción de una tool que se lleva por delante los eventos ya acumulados, la doble tarjeta
 * de propensión y el reintento que descarta lo que devuelve. No se pueden arreglar a ciegas: hay
 * que poderlos reproducir primero.
 *
 * Lo único que cambia respecto a `route.ts` es que el I/O entra por parámetro —el modelo, la
 * búsqueda de identidad y la ejecución de tools— para que un test pueda darle un modelo falso.
 * La lógica se mueve VERBATIM: este archivo no arregla nada todavía, a propósito. Los arreglos
 * son el bloque 2, y su diff debe verse contra una conducta ya capturada.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, contarPreguntas, esDobleCanon, detectarEstado } from "@/lib/prompts";
import { toolDefinitions, executeTool, type ToolCtx } from "@/lib/tools";
import type { UiEvent } from "@/lib/estado/tipos";
import { resolverIdentidad } from "@/lib/afiliados/resolver";
import type { Identidad } from "@/lib/afiliados/resolver";
import { resumenEvidencia } from "@/lib/engine/sanear";

export const MODELO_POR_DEFECTO = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
export const MAX_TOOL_ROUNDS = 8;

export interface Msg {
  role: "user" | "assistant";
  content: string;
}

export interface EntradaTurno {
  messages: Msg[];
  afiliado?: { nombre?: string; ciudad?: string };
  /** El cliente sabe qué pintó; el servidor es stateless. Desaparece en el paso 2e. */
  yaRecomendo?: boolean;
}

export interface SalidaTurno {
  reply: string;
  events: UiEvent[];
}

/** Lo mínimo del SDK que el turno necesita, para que un doble de prueba pueda cumplirlo. */
export interface ClienteModelo {
  crear(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
}

export interface DepsTurno {
  modelo: ClienteModelo;
  resolver: (messages: Msg[], afiliado?: { nombre?: string; ciudad?: string }) => Promise<Identidad>;
  ejecutarTool: (
    name: string,
    input: Record<string, unknown>,
    ctx?: ToolCtx
  ) => Promise<{ result: unknown; event?: UiEvent }>;
  modeloId?: string;
  maxRondas?: number;
}

/** Deps reales. `route.ts` las usa; el gate las sustituye. */
export function depsReales(client: Anthropic): DepsTurno {
  return {
    modelo: { crear: (params) => client.messages.create(params) },
    resolver: resolverIdentidad,
    ejecutarTool: executeTool,
  };
}

const textoDe = (r: Anthropic.Message) =>
  r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

export async function ejecutarTurno(entrada: EntradaTurno, deps: DepsTurno): Promise<SalidaTurno> {
  const { messages, afiliado, yaRecomendo } = entrada;
  const MODEL = deps.modeloId ?? MODELO_POR_DEFECTO;
  const maxRondas = deps.maxRondas ?? MAX_TOOL_ROUNDS;

  const events: UiEvent[] = [];

  // Arranque caliente. La detección del nombre y la búsqueda pasan EN CÓDIGO: la regla "cuando
  // aparece un nombre, busca" es determinista y no debe depender de que el modelo llame una tool
  // en el momento justo.
  const identidad = await deps.resolver(messages, afiliado);
  const afiliadoReconocido = identidad.estado === "reconocido";
  const contexto = identidad.contexto;
  const seg = identidad.segmento;
  // El segmento verificado va al motor por el SERVIDOR, no retranscrito por el modelo: así un
  // error de transcripción no puede producir una celda de peer-group falsa.
  const segmentoBase: ToolCtx["segmentoBase"] = seg
    ? {
        GENERO: seg.genero,
        RANGO_EDAD: seg.rango_edad,
        CATEGORIA: seg.categoria,
        SEGMENTO_GRUPO_FAMILIAR: seg.grupo_familiar,
        SEGMENTO_POBLACIONAL: seg.poblacional,
      }
    : undefined;

  if (identidad.persistir) {
    events.push({ type: "afiliado", data: identidad.persistir });
  }

  const estado = detectarEstado(messages, { afiliadoReconocido, yaRecomendo });
  const textoUsuario = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");

  const evidencia = estado === "DESCUBRIENDO" ? resumenEvidencia(textoUsuario) : null;
  const system = buildSystemPrompt(estado, [contexto, evidencia].filter(Boolean).join("\n\n"));

  const toolCtx: ToolCtx = { textoUsuario, segmentoBase };

  const convo: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let response = await deps.modelo.crear({
    model: MODEL,
    max_tokens: 1024,
    system,
    tools: toolDefinitions,
    messages: convo,
  });

  let rounds = 0;
  while (response.stop_reason === "tool_use" && rounds < maxRondas) {
    rounds++;
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        const { result, event } = await deps.ejecutarTool(
          block.name,
          (block.input ?? {}) as Record<string, unknown>,
          toolCtx
        );
        if (event) events.push(event);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    convo.push({ role: "assistant", content: response.content });
    convo.push({ role: "user", content: toolResults });

    response = await deps.modelo.crear({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools: toolDefinitions,
      messages: convo,
    });
  }

  let reply = textoDe(response);

  // Guarda de la pregunta de doble cañón. `prompts.ts` lo prohíbe, pero una regla de prompt es
  // una petición: se violó tres veces en una sola conversación.
  if (contarPreguntas(reply) > 1 || esDobleCanon(reply)) {
    const reintento = await deps.modelo.crear({
      model: MODEL,
      max_tokens: 1024,
      system:
        system +
        `\n\n## CORRECCIÓN INMEDIATA\nTu respuesta anterior traía más de una pregunta. Reescríbela ` +
        `con UNA SOLA pregunta, la más importante, y guarda el resto para los siguientes turnos. ` +
        `Prohibido unir dos temas con "o".`,
      tools: toolDefinitions,
      messages: [
        ...convo,
        { role: "assistant", content: reply },
        { role: "user", content: "Reescribe tu último mensaje con una sola pregunta." },
      ],
    });
    const corregido = textoDe(reintento);
    if (corregido && contarPreguntas(corregido) <= 1 && !esDobleCanon(corregido)) reply = corregido;
  }

  return { reply, events };
}
