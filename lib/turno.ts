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
import type { ConsultaIdentidad, EstadoConversacion, UiEvent, UiVista } from "@/lib/estado/tipos";
import { estadoInicial } from "@/lib/estado/tipos";
import { iniciarTurno, aplicarIdentidad, cerrarTurno, type HallazgoIdentidad } from "@/lib/estado/reducir";
import { contextoDeEstado } from "@/lib/estado/contexto";
import { SALUDO_INICIAL, SIN_RESPUESTA, vistaDeEstado } from "@/lib/estado/vista";
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
  /** Cómo entró la persona, si fue por un enlace profundo. Solo se lee en el primer turno. */
  origen?: "interes" | "evento";
}

export interface SalidaTurno {
  /**
   * Lo único que el cliente renderiza: bloques ya ORDENADOS por el servidor, sugerencias y
   * estado de la casilla. El componente pinta; no decide.
   */
  ui: UiVista;
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

/**
 * Estado de arranque cuando no llega ninguno válido: primer turno, sello manipulado, o un
 * secreto distinto (un lambda sin `AMPARITO_ESTADO_SECRET` firma con uno aleatorio por proceso).
 *
 * No es compatibilidad, es RECUPERACIÓN, y por eso sobrevive al borrado de las ventanas: sin el
 * relleno del turno, perder el estado a mitad de conversación devolvería a la persona a la fase
 * SALUDO en el mensaje seis, y Amparito volvería a presentarse.
 */
function estadoRecuperado(messages: Msg[]): EstadoConversacion {
  const e = estadoInicial();
  // `iniciarTurno` suma uno, así que se deja en el turno anterior.
  e.turno = Math.max(0, messages.filter((m) => m.role === "user").length - 1);
  return e;
}

/**
 * Códigos que viajan en `result.error` pero NO son fallos: son compuertas de cumplimiento
 * funcionando. Distinguirlos importa mucho más de lo que parece — `is_error` le dice al modelo
 * "esto se rompió, puedes reintentar", y marcar así una compuerta de CONSENTIMIENTO sería
 * invitarlo a saltársela a base de insistir. Una tool que dice que no es una respuesta, no una
 * avería.
 */
const DECISIONES_NO_FALLOS = new Set([
  "PRODUCTO_REQUIERE_ASESORIA",
  "PRIMA_NO_COTIZABLE",
  "CONSENTIMIENTO_REQUERIDO",
  "DATOS_INCOMPLETOS",
]);

/** Un fallo de verdad: la tool no pudo hacer su trabajo. */
function esFallo(result: unknown): boolean {
  const e = (result as { error?: unknown } | null)?.error;
  return typeof e === "string" && !DECISIONES_NO_FALLOS.has(e);
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
  const previo = abrir(entrada.estado) ?? estadoRecuperado(messages);

  // Turno 0: el saludo lo produce el SERVIDOR, sin llamar al modelo. Antes vivía en el componente
  // y se inyectaba como `messages[0]` con rol `assistant` — un turno que el modelo nunca escribió,
  // atribuido al modelo.
  //
  // Es idempotente y NO avanza el turno: pedirlo dos veces, o a mitad de conversación por un
  // error del cliente, devuelve lo mismo sin corromper el estado ni gastar una llamada.
  if (!messages.some((m) => m.role === "user" && m.content.trim())) {
    const saludado = { ...previo, dichoUnaVez: { ...previo.dichoUnaVez, saludo: true } };
    return { ui: vistaDeEstado(saludado, SALUDO_INICIAL, []), estado: sellar(saludado) };
  }

  const ultimoDelUsuario = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";

  // Arranque caliente. La detección del nombre y la búsqueda pasan EN CÓDIGO: la regla "cuando
  // aparece un nombre, busca" es determinista y no debe depender de que el modelo llame una tool
  // en el momento justo. Ahora QUÉ se busca lo decide el reducer, que es quien sabe qué preguntó.
  const abierto = iniciarTurno(previo, ultimoDelUsuario);
  const hallazgo = await deps.resolver(abierto.consulta);
  let estado = aplicarIdentidad(abierto.estado, hallazgo);
  // Se recuerda una sola vez, en el turno en que entra: después el cliente ya no lo manda.
  if (entrada.origen && !estado.origen) estado = { ...estado, origen: entrada.origen };

  // Aquí se emitía el evento `afiliado`, con el que el cliente guardaba la identidad en un ref
  // propio. Ya no hace falta: la identidad vive en el estado sellado, que es su único portador.

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

  // El modelo suele escribir la pregunta Y llamar la tool en el MISMO mensaje. Como `reply` sale
  // de la respuesta FINAL del loop, ese texto se perdía y el turno salía mudo. Con
  // `ofrecer_opciones` eso pasó de ser raro a ser el patrón natural, así que se guarda el último
  // texto intermedio como RESCATE.
  //
  // Es un rescate, no una acumulación: solo entra si al final no hay texto. Acumular todas las
  // rondas duplicaría el mensaje cuando el modelo se repite, y eso es trabajo del bloque 2.
  let textoDeRescate = "";
  let rounds = 0;
  while (response.stop_reason === "tool_use" && rounds < maxRondas) {
    rounds++;
    const intermedio = textoDe(response);
    if (intermedio) textoDeRescate = intermedio;
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        // Una tool que LANZA no puede llevarse el turno por delante. Antes la excepción subía
        // hasta el catch global y se perdía todo, incluidos los eventos ya acumulados en este
        // mismo turno: la persona veía desaparecer el "escribiendo…" y nada más.
        //
        // Y el fallo se le devuelve al modelo con `is_error`, que es el canal que la API tiene
        // para eso. Hasta ahora los errores se serializaban como si fueran éxitos y era el
        // PROMPT quien le explicaba al modelo cómo reconocerlos — enseñarle a leer errores en
        // prosa en vez de decírselos.
        let result: unknown;
        let event: UiEvent | undefined;
        let fallo = false;
        try {
          ({ result, event } = await deps.ejecutarTool(
            block.name,
            (block.input ?? {}) as Record<string, unknown>,
            toolCtx
          ));
        } catch (err) {
          fallo = true;
          result = {
            error: `La herramienta ${block.name} falló: ${err instanceof Error ? err.message : "error desconocido"}`,
            instruccion:
              "No inventes el dato que ibas a obtener. Reintenta una vez si tiene sentido; si no, " +
              "dilo con honestidad y ofrece un asesor.",
          };
        }
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
        // Se marca tanto la tool que LANZÓ como la que devolvió un error sin lanzar — que es el
        // caso común en este código: ocho sitios devuelven `{error: ...}` como si fuera un
        // resultado normal, y el modelo no tenía cómo distinguirlos de un éxito.
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
          ...(fallo || esFallo(result) ? { is_error: true } : {}),
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

  let reply = textoDe(response) || textoDeRescate;

  // UN TURNO NUNCA SALE MUDO. Si se agotaron las 8 rondas, o la última respuesta solo trae
  // tool_use, `reply` queda vacío: el "escribiendo…" desaparecía y no llegaba nada, así que la
  // persona no sabía si Amparito se había caído o la estaba ignorando.
  //
  // Se fuerza una salida de TEXTO con tool_choice "none". Cuesta una llamada, y solo ocurre en el
  // camino que hoy termina en silencio — un turno lento es mejor que uno mudo.
  if (!reply) {
    try {
      const cierre = await deps.modelo.crear({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: toolDefinitions,
        // `tool_choice: none` existe en la API pero no en los tipos de este SDK (^0.32.1, que
        // se quedó atrás). Se manda igual: el cast es sobre el TIPO, no sobre la conducta.
        // Quitar `tools` no sirve de sustituto — una conversación con bloques `tool_use` exige
        // que las tools sigan declaradas.
        tool_choice: { type: "none" } as unknown as Anthropic.MessageCreateParams["tool_choice"],
        messages: convo,
      });
      reply = textoDe(cierre);
    } catch {
      /* si también falla, queda el copy de abajo: lo que no puede pasar es no decir nada */
    }
    if (!reply) reply = SIN_RESPUESTA;
  }

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

  // Aquí se reescribía `OPCIONES: a | b` sobre el texto, para el cliente que las sacaba con una
  // regex. Ese cliente ya no existe: las quick-replies llegan en `ui.sugerencias`.
  return { ui: vistaDeEstado(estado, reply, events), estado: sellar(estado) };
}
