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
import { bloquesDeSystem, contarPreguntas, esDobleCanon } from "@/lib/prompts";
import { toolDefinitions, executeTool, type ToolCtx } from "@/lib/tools";
import type { ConsultaIdentidad, EstadoConversacion, UiEvent, UiVista } from "@/lib/estado/tipos";
import { estadoInicial } from "@/lib/estado/tipos";
import { iniciarTurno, aplicarIdentidad, cerrarTurno, type HallazgoIdentidad } from "@/lib/estado/reducir";
import { contextoDeEstado } from "@/lib/estado/contexto";
import { afirmacionesSinRespaldo, instruccionDeCorreccion, quitarFrases } from "@/lib/estado/validar";
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
  // La compuerta del anti-venta: marcarla como error invitaría al modelo a reintentar hasta
  // saltársela, que es justo lo contrario de lo que hace.
  "SIN_INGRESO_HOY",
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

/**
 * Qué nombre puede traer ya escrito el formulario, y a quién atribuirlo.
 *
 * La primera versión de esto usaba `identidad.nombre` siempre, etiquetándolo "declarado" mientras
 * no estuviera verificada. Eso abría por la puerta de atrás justo lo que cierra 5d:
 *
 *     ella escribe   "soy carolina ramirez"
 *     la base tiene  "CAROLINA RAMÍREZ LÓPEZ"
 *     el formulario  recibía el apellido que nunca tecleó, sin verificar,
 *                    y encima etiquetado como algo que ella había dicho
 *
 * Son dos faltas a la vez: revela un dato de la base antes de la verificación, y le atribuye a la
 * persona algo que no dijo. Las tres ramas de abajo son explícitas para que el caso del medio no
 * pueda volver a colarse por descuido.
 */
function nombreQueSePuedeEscribir(
  estado: EstadoConversacion
): { nombre: string; origen: "base" | "declarado" } | undefined {
  const id = estado.identidad;
  if (!id.nombre) return undefined;
  // Verificada: el nombre canónico de Colsubsidio, y se dice de dónde viene.
  if (id.resultado === "reconocido" && id.verificada) return { nombre: id.nombre, origen: "base" };
  // Encontrada pero SIN verificar: lo que tenemos es el nombre de la base. No se escribe.
  if (id.resultado === "reconocido") return undefined;
  // No está en la base: lo que tenemos es lo que ella escribió, y es suyo.
  return { nombre: id.nombre, origen: "declarado" };
}

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
  //
  // Y CORRE SIEMPRE, incluida ASESORANDO. Antes se apagaba justo ahí — que es la fase donde
  // cotiza, es decir donde de verdad preguntaba de más: a Carolina le pedía la edad, los
  // dependientes y el ingreso teniendo su segmento verificado en la mano. El bloque sabe adaptarse
  // (`puedePreguntar`): en ASESORANDO deja de invitar a preguntar y pasa a frenarlo.
  const puedePreguntar = estado.fase === "DESCUBRIENDO" || estado.fase === "RECONOCIDO";
  const evidencia = resumenEvidencia(textoUsuario, estado.perfil, {
    puedePreguntar,
    // El segmento verificado se resuelve al decir el nombre; el perfil solo lo recibe cuando el
    // motor corre. Entre esos dos momentos está el tramo donde antes preguntaba de más.
    segmentoBase: estado.identidad.segmento,
  });
  // Dos bloques en vez de un string: el primero es invariable y lleva el punto de corte de caché
  // (#39). El texto que ve el modelo es el mismo de siempre — ver `bloquesDeSystem`.
  const system = bloquesDeSystem(
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
    conocido: nombreQueSePuedeEscribir(estado),
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
    const pedidas = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    // EN PARALELO. Estaban en serie —un `await` dentro del bucle—, así que dos tools en un mismo
    // mensaje sumaban sus latencias. Con el motor local da igual; `quote_product` e `issue_policy`
    // van por el gateway de la aseguradora, y ahí eran round-trips de red encadenados sin motivo.
    // Es seguro por construcción: dentro de un mismo mensaje el modelo todavía no tiene ningún
    // resultado, así que ninguna llamada puede depender de otra.
    //
    // Dos bloques IDÉNTICOS comparten UNA sola ejecución. El prompt le pide al modelo volver a
    // llamar `calcular_propension` si lo corrigen, y a veces lo hacía dos veces de una: el motor
    // corría dos veces y emitía dos eventos. Se comparte la PROMESA, no el resultado, para que
    // lanzarlas a la vez no vuelva a duplicar el trabajo.
    //
    // Solo dentro del MISMO mensaje: entre rondas una repetición puede ser un reintento legítimo
    // tras un fallo, y reutilizar aquel resultado sería devolverle el error viejo.
    const enVuelo = new Map<string, Promise<{ result: unknown; event?: UiEvent }>>();

    const resueltas = await Promise.all(
      pedidas.map(async (block) => {
        const input = (block.input ?? {}) as Record<string, unknown>;
        const huella = `${block.name}:${JSON.stringify(input)}`;
        const yaLanzada = enVuelo.get(huella);
        // El evento se emite solo con la PRIMERA: dos idénticos pintarían dos tarjetas.
        const emitirEvento = !yaLanzada;
        const promesa = yaLanzada ?? deps.ejecutarTool(block.name, input, toolCtx);
        if (!yaLanzada) enVuelo.set(huella, promesa);

        try {
          const { result, event } = await promesa;
          return { block, result, event: emitirEvento ? event : undefined, fallo: false };
        } catch (err) {
          // Una tool que LANZA no puede llevarse el turno por delante. Antes la excepción subía
          // hasta el catch global y se perdía todo, incluidos los eventos ya acumulados en este
          // mismo turno: la persona veía desaparecer el "escribiendo…" y nada más.
          return {
            block,
            event: undefined as UiEvent | undefined,
            fallo: true,
            result: {
              error: `La herramienta ${block.name} falló: ${err instanceof Error ? err.message : "error desconocido"}`,
              instruccion:
                "No inventes el dato que ibas a obtener. Reintenta una vez si tiene sentido; si no, " +
                "dilo con honestidad y ofrece un asesor.",
            } as unknown,
          };
        }
      })
    );

    // Los efectos se aplican DESPUÉS y EN ORDEN: paralelizar la espera no puede volver aleatorio
    // el orden en que se acumulan los eventos ni cuál perfil termina ganando.
    const toolResults: Anthropic.ToolResultBlockParam[] = resueltas.map(({ block, result, event, fallo }) => {
      if (event) events.push(event);
      // `calcular_propension` devuelve el perfil que la compuerta aceptó. Es lo que se guarda en
      // el estado para que el turno siguiente arranque desde ahí en vez de desde cero. Se lee por
      // el campo y no por el nombre de la tool: si mañana otra tool también sanea, no hay que
      // acordarse de añadirla a una lista.
      const conPerfil = result as { perfil_usado?: Perfil; descartado_por_falta_de_evidencia?: string[] };
      if (conPerfil?.perfil_usado) {
        perfilUsado = conPerfil.perfil_usado;
        descartes = conPerfil.descartado_por_falta_de_evidencia ?? [];
      }
      return {
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: JSON.stringify(result),
        // Se marca tanto la tool que LANZÓ como la que devolvió un error sin lanzar — el caso
        // común aquí: ocho sitios devuelven `{error: ...}` como si fuera un resultado normal, y
        // el modelo no tenía cómo distinguirlos de un éxito.
        ...(fallo || esFallo(result) ? { is_error: true } : {}),
      };
    });

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
      system,
      tools: toolDefinitions,
      // El reintento tiene que producir TEXTO. Antes se pasaban las tools sin restricción: si el
      // modelo respondía con `tool_use`, no se ejecutaba nada, `corregido` quedaba vacío y la
      // llamada se descartaba entera — un turno de modelo y 1-2 s tirados en silencio.
      tool_choice: { type: "none" } as unknown as Anthropic.MessageCreateParams["tool_choice"],
      // La corrección va en el TURNO, no concatenada al `system`. Editar el system a mitad de
      // conversación rompe cualquier prefijo cacheable, y además era redundante: la instrucción
      // ya viajaba en el mensaje de usuario.
      messages: [
        ...convo,
        { role: "assistant", content: reply },
        {
          role: "user",
          content:
            "Tu respuesta anterior traía más de una pregunta. Reescríbela con UNA SOLA pregunta, " +
            'la más importante, y guarda el resto para los siguientes turnos. Prohibido unir dos temas con "o".',
        },
      ],
    });
    const corregido = textoDe(reintento);
    if (corregido && contarPreguntas(corregido) <= 1 && !esDobleCanon(corregido)) reply = corregido;
  }

  // GUARDA DE AFIRMACIONES SOBRE LA BASE (#3). El servidor dijo "cero coincidencias con Carolina"
  // y Amparito dijo "hay varios Carolinas": una afirmación fabricada sobre la base de datos de
  // Colsubsidio, dicha con la autoridad de quien acaba de consultarla. El prompt ya lo prohíbe,
  // pero una regla de prompt es una petición probabilística.
  let sinRespaldo = afirmacionesSinRespaldo(reply, estado);
  if (sinRespaldo.length) {
    try {
      const corregida = await deps.modelo.crear({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: toolDefinitions,
        tool_choice: { type: "none" } as unknown as Anthropic.MessageCreateParams["tool_choice"],
        messages: [
          ...convo,
          { role: "assistant", content: reply },
          { role: "user", content: instruccionDeCorreccion(sinRespaldo) },
        ],
      });
      const texto = textoDe(corregida);
      if (texto) {
        reply = texto;
        sinRespaldo = afirmacionesSinRespaldo(reply, estado);
      }
    } catch {
      /* si el reintento falla, queda la poda de abajo */
    }

    // Si INSISTE, se poda la frase. Es cirugía y puede dejar el mensaje algo cojo, pero de los
    // dos males el otro es peor: publicar una cifra inventada sobre la base de afiliados de
    // Colsubsidio es exactamente el daño que este producto no se puede permitir.
    if (sinRespaldo.length) {
      const podado = quitarFrases(reply, sinRespaldo);
      reply = podado || SIN_RESPUESTA;
    }
  }

  estado = cerrarTurno(estado, { eventos: events, perfilUsado, descartes });

  // Aquí se reescribía `OPCIONES: a | b` sobre el texto, para el cliente que las sacaba con una
  // regex. Ese cliente ya no existe: las quick-replies llegan en `ui.sugerencias`.
  return { ui: vistaDeEstado(estado, reply, events), estado: sellar(estado) };
}
