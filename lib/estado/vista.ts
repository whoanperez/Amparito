/**
 * La capa de presentación que no existía.
 *
 * Antes la estructura interna del motor ERA el view-model, y el cliente decidía qué pintar
 * contando burbujas del array: por eso sacaba la grilla de seis tarjetas junto a una pregunta
 * abierta, sin saber que el agente acababa de preguntar algo. El servidor sí lo sabe.
 *
 * Función pura. `vistaDeEstado` no consulta nada: recibe el estado ya cerrado, el texto del
 * modelo y los eventos del turno, y devuelve lo único que el cliente renderiza.
 */
import type { Bloque, EstadoConversacion, Rec, UiEvent, UiVista } from "./tipos";

/** Donde el LLM es insustituible: leer el clausulado y explicarlo en cristiano. */
export const PREGUNTAS_ASESOR = ["¿Qué cubre?", "¿Qué NO cubre?", "¿Cuánto cuesta?"];

/**
 * El primer mensaje. Vivía en `components/Chat.tsx` y se inyectaba como `messages[0]` con rol
 * `assistant`: un turno que el modelo nunca escribió, atribuido al modelo. Ahora lo produce el
 * servidor, que es quien decide las fases, y queda en un solo sitio donde se puede versionar.
 *
 * MUDANZA LITERAL. El copy tiene dos problemas conocidos —hace cuatro trabajos en orden invertido
 * (da una orden antes de presentarse) y ANUNCIA el anti-venta, que es como se quema el momento
 * que la gente recuerda— pero arreglarlos es el bloque 4. Mezclar mudanza con reescritura es cómo
 * se pierde la trazabilidad de qué rompió qué.
 */
export const SALUDO_INICIAL =
  "Dime tu nombre: si estás afiliado a Colsubsidio te reconozco y nos saltamos el interrogatorio 💛 " +
  "Soy Amparito — de amparar, protegerte. Y a veces te voy a decir que no.";

/** Eventos que son ESTADO, no contenido: no pintan tarjeta. */
const NO_PINTAN = new Set(["form", "opciones"]);

/**
 * Quita el markdown que Amparito no debería estar escribiendo. Vive en el servidor porque el
 * servidor es quien produce el bloque de texto — y aquí sí lo cubre un gate, cosa que nunca pasó
 * mientras estuvo dentro del componente sin exportar.
 */
export function limpiarTexto(raw: string): string {
  return raw
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/`/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Construye las tarjetas seleccionables desde el evento del motor — nombre, orden y razón vienen
 * del scorecard. FUENTE ÚNICA: existía triplicada (cliente, player offline y test), y la única
 * versión cubierta era la copia que vivía dentro del test.
 */
export function recsDeEvento(data: Record<string, unknown>): Rec[] {
  const recs = (data?.recomendaciones ?? []) as Array<{ nombre: string; reason_codes?: string[] }>;
  return recs.map((r, i) => ({
    nombre: r.nombre,
    recomendado: i === 0,
    razon: r.reason_codes?.[0] ?? "",
  }));
}

/**
 * ¿Va la grilla de "¿qué quieres proteger?"?
 *
 * La condición que el cliente no podía evaluar es la última: si el agente acaba de hacer una
 * pregunta abierta, seis tarjetas al lado compiten con ella y la persona no sabe a cuál responder.
 */
function vaElegirProteccion(estado: EstadoConversacion, texto: string, eventos: UiEvent[]): boolean {
  return (
    estado.turno === 1 &&
    estado.identidad.resultado !== "reconocido" &&
    estado.veredicto === null &&
    eventos.length === 0 &&
    // Quien llegó por un enlace profundo YA dijo qué quiere proteger. Preguntárselo otra vez es
    // el interrogatorio que este producto existe para evitar.
    !estado.origen &&
    !texto.includes("?")
  );
}

/** Las quick-replies que el modelo eligió este turno, si llamó a `ofrecer_opciones`. */
export function opcionesDeEventos(eventos: UiEvent[]): string[] {
  const ev = eventos.filter((e) => e.type === "opciones").at(-1);
  const ops = ev?.data.opciones;
  return Array.isArray(ops) ? ops.map(String).slice(0, 4) : [];
}

export function vistaDeEstado(
  estado: EstadoConversacion,
  textoDelModelo: string,
  eventos: UiEvent[]
): UiVista {
  const texto = limpiarTexto(textoDelModelo ?? "");
  const bloques: Bloque[] = [];

  // GANA EL ÚLTIMO evento de propensión: si el modelo llamó la tool dos veces —cosa que el prompt
  // le pide hacer si lo corrigen— antes se pintaban dos tarjetas.
  //
  // Se compara por POSICIÓN, no por identidad de objeto: si los dos eventos resultan ser la misma
  // referencia, un `ev !== ultima` no descarta ninguno y el guard falla abierto justo en el caso
  // que dice cubrir.
  const iUltimaPropension = eventos.map((e) => e.type).lastIndexOf("propension");
  const ultimaPropension = iUltimaPropension >= 0 ? eventos[iUltimaPropension] : undefined;
  let formulario: Record<string, unknown> | undefined;

  for (let i = 0; i < eventos.length; i++) {
    const ev = eventos[i];
    if (ev.type === "form") { formulario = ev.data; continue; }
    if (NO_PINTAN.has(ev.type)) continue;
    if (ev.type === "propension" && i !== iUltimaPropension) continue;
    bloques.push({ t: "evento", evento: ev });
  }

  // La TARJETA va antes del texto: la frase suele comentar lo que la tarjeta muestra, y leerla
  // antes de ver el producto no tiene sentido. El orden lo decide el servidor, no el componente.
  if (ultimaPropension) {
    const recs = recsDeEvento(ultimaPropension.data);
    if (recs.length) bloques.push({ t: "tarjetas", recs });
  }

  if (texto) bloques.push({ t: "texto", contenido: texto });
  if (vaElegirProteccion(estado, texto, eventos)) bloques.push({ t: "elegir_proteccion" });

  // Se ofrecen el turno en que la recomendación ATERRIZA, no para siempre. Colgarlas de
  // `estado.veredicto` las dejaba fijas en todos los turnos posteriores —el veredicto no se
  // limpia nunca— y acabarían compitiendo con lo que el agente pregunte después.
  const opciones = opcionesDeEventos(eventos);
  const recomendoAhora = !!ultimaPropension && !ultimaPropension.data.no_venta;
  const sugerencias =
    opciones.length ? opciones
    : recomendoAhora ? PREGUNTAS_ASESOR
    : [];

  return {
    bloques,
    sugerencias,
    entrada: { habilitada: !formulario, formulario },
  };
}
