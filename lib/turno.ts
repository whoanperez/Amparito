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
import { buildSystemPrompt, contarPreguntas, esDobleCanon } from "@/lib/prompts";
import { toolDefinitions, executeTool, type ToolCtx } from "@/lib/tools";
import type { ConsultaIdentidad, EstadoConversacion, UiEvent } from "@/lib/estado/tipos";
import { estadoInicial } from "@/lib/estado/tipos";
import { iniciarTurno, aplicarIdentidad, cerrarTurno, type HallazgoIdentidad } from "@/lib/estado/reducir";
import { contextoDeEstado } from "@/lib/estado/contexto";
import { SALUDO_INICIAL } from "@/lib/estado/vista";
import { sellar, abrir } from "@/lib/estado/sello";
import { ejecutarConsulta } from "@/lib/afiliados/resolver";
import { resumenEvidencia } from "@/lib/engine/sanear";
import type { Perfil } from "@/lib/engine/types";

export const MODELO_POR_DEFECTO = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
export const MAX_TOOL_ROUNDS = 8;

export interface Msg {
  role: "user" | "assistant";
  content: string;
}

export interface EntradaTurno {
  messages: Msg[];
  /** Estado sellado del turno anterior. Opaco: el cliente lo guarda y lo reenvía sin leerlo. */
  estado?: string;
  /* ── Ventana de compatibilidad · muere en el paso 3, cuando el cliente obedezca la vista ── */
  afiliado?: { nombre?: string; ciudad?: string };
  yaRecomendo?: boolean;
}

export interface SalidaTurno {
  reply: string;
  events: UiEvent[];
  /** Sellado. El cliente lo devuelve tal cual en el turno siguiente. */
  estado: string;
}

/** Lo mínimo del SDK que el turno necesita, para que un doble de prueba pueda cumplirlo. */
export interface ClienteModelo {
  crear(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
}

export interface DepsTurno {
  modelo: ClienteModelo;
  resolver: (consulta: ConsultaIdentidad) => Promise<HallazgoIdentidad>;
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
    resolver: ejecutarConsulta,
    ejecutarTool: executeTool,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Ventana de compatibilidad · MUERE EN EL PASO 3

   El cliente todavía no guarda el estado: manda `afiliado` y `yaRecomendo` como antes. Sin esto,
   el estado se reconstruiría de cero en cada turno y el cliente actual PERDERÍA la identidad
   entre mensajes — una regresión introducida por un refactor, que es lo peor que puede pasar en
   un paso que promete ser aditivo.

   Reproduce a propósito la conducta vieja, round-trip a la base incluido: en modo compat no hay
   estado donde congelar el segmento.
   ────────────────────────────────────────────────────────────────────────── */
function estadoDeCompat(entrada: EntradaTurno): EstadoConversacion {
  const e = estadoInicial();
  // `iniciarTurno` suma uno, así que se deja en el turno anterior.
  e.turno = Math.max(0, entrada.messages.filter((m) => m.role === "user").length - 1);
  if (entrada.afiliado?.nombre) {
    e.identidad.nombre = entrada.afiliado.nombre;
    e.identidad.ciudad = entrada.afiliado.ciudad || undefined;
  }
  if (entrada.yaRecomendo) {
    e.veredicto = {
      entregado: true,
      tipo: "recomendacion",
      recomendaciones: [],
      obligatorios: [],
      peer: null,
    };
  }
  return e;
}

function consultaDeCompat(entrada: EntradaTurno): ConsultaIdentidad | null {
  const nombre = entrada.afiliado?.nombre?.trim();
  if (!nombre) return null;
  const ciudad = entrada.afiliado?.ciudad?.trim();
  return ciudad ? { modo: "ciudad", nombre, ciudad } : { modo: "nombre", nombre };
}

const textoDe = (r: Anthropic.Message) =>
  r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

export async function ejecutarTurno(entrada: EntradaTurno, deps: DepsTurno): Promise<SalidaTurno> {
  const { messages } = entrada;
  const MODEL = deps.modeloId ?? MODELO_POR_DEFECTO;
  const maxRondas = deps.maxRondas ?? MAX_TOOL_ROUNDS;

  const events: UiEvent[] = [];
  let perfilUsado: Perfil | undefined;
  let descartes: string[] | undefined;

  // Un sello inválido o ausente no es un error: se arranca de cero. El jurado ve un saludo, no
  // un 500.
  const previo = abrir(entrada.estado) ?? estadoDeCompat(entrada);

  // Turno 0: el saludo lo produce el SERVIDOR, sin llamar al modelo. Antes vivía en el componente
  // y se inyectaba como `messages[0]` con rol `assistant` — un turno que el modelo nunca escribió,
  // atribuido al modelo.
  //
  // Es idempotente y NO avanza el turno: pedirlo dos veces, o a mitad de conversación por un
  // error del cliente, devuelve lo mismo sin corromper el estado ni gastar una llamada.
  if (!messages.some((m) => m.role === "user" && m.content.trim())) {
    const saludado = { ...previo, dichoUnaVez: { ...previo.dichoUnaVez, saludo: true } };
    return { reply: SALUDO_INICIAL, events: [], estado: sellar(saludado) };
  }

  const ultimoDelUsuario = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";

  // Arranque caliente. La detección del nombre y la búsqueda pasan EN CÓDIGO: la regla "cuando
  // aparece un nombre, busca" es determinista y no debe depender de que el modelo llame una tool
  // en el momento justo. Ahora QUÉ se busca lo decide el reducer, que es quien sabe qué preguntó.
  const abierto = iniciarTurno(previo, ultimoDelUsuario);
  // En modo compat manda el nombre que trae el cliente; en el camino nuevo, lo que decidió el
  // reducer. Se escribe con un `if` a propósito: la versión en una línea con `&&` y `||` esconde
  // cuál de los dos caminos se está tomando.
  let consulta = abierto.consulta;
  if (!entrada.estado) {
    const deCompat = consultaDeCompat(entrada);
    if (deCompat) consulta = deCompat;
  }
  const hallazgo = await deps.resolver(consulta);
  let estado = aplicarIdentidad(abierto.estado, hallazgo);

  // Compat: el cliente actual guarda la identidad en un ref propio. Muere en el paso 3, cuando
  // el estado sellado sea el único portador.
  //
  // Solo `reconocido` y `ambiguo`, que es exactamente cuando el resolver viejo devolvía
  // `persistir`. Emitirlo también en `no_encontrado` haría que el cliente guardara un nombre que
  // no existe y lo reenviara cada turno, disparando una búsqueda inútil a la base para siempre.
  if ((hallazgo.estado === "reconocido" || hallazgo.estado === "ambiguo") && estado.identidad.nombre) {
    events.push({
      type: "afiliado",
      data: { nombre: estado.identidad.nombre, ciudad: estado.identidad.ciudad ?? "" },
    });
  }

  const textoUsuario = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");

  // Corre también en RECONOCIDO. Antes solo en DESCUBRIENDO, así que un afiliado reconocido no
  // tenía ninguna protección contra preguntas repetidas — y en la conversación real preguntó dos
  // veces por los dependientes y dos por el uso del carro, con las mismas palabras.
  const puedePreguntar = estado.fase === "DESCUBRIENDO" || estado.fase === "RECONOCIDO";
  const evidencia = puedePreguntar ? resumenEvidencia(textoUsuario, estado.perfil) : null;
  const system = buildSystemPrompt(
    estado.fase,
    [contextoDeEstado(estado), evidencia].filter(Boolean).join("\n\n")
  );

  // El segmento verificado va al motor por el SERVIDOR, no retranscrito por el modelo: así un
  // error de transcripción no puede producir una celda de peer-group falsa. Y el perfil acumulado
  // entra como piso, para que el motor deje de recibir lo que el LLM alcance a reteclear.
  const toolCtx: ToolCtx = {
    textoUsuario,
    segmentoBase: estado.identidad.segmento,
    perfilPrevio: estado.perfil,
  };

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
        // `calcular_propension` devuelve el perfil que la compuerta aceptó. Es lo que se guarda
        // en el estado para que el turno siguiente arranque desde ahí en vez de desde cero.
        // Se lee por el campo y no por el nombre de la tool: si mañana otra tool también sanea,
        // no hay que acordarse de añadirla a una lista.
        const conPerfil = result as { perfil_usado?: Perfil; descartado_por_falta_de_evidencia?: string[] };
        if (conPerfil?.perfil_usado) {
          perfilUsado = conPerfil.perfil_usado;
          descartes = conPerfil.descartado_por_falta_de_evidencia ?? [];
        }
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

  estado = cerrarTurno(estado, { eventos: events, perfilUsado, descartes });
  return { reply, events, estado: sellar(estado) };
}
