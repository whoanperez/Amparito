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

/**
 * Último recurso cuando el turno no logra producir texto. Existe porque la alternativa real
 * observada era peor: el "escribiendo…" desaparecía y no llegaba nada, así que la persona no
 * sabía si Amparito se había caído o la estaba ignorando.
 */
export const SIN_RESPUESTA =
  "Me enredé procesando eso 😅. ¿Me lo cuentas de otra forma?";

/** Donde el LLM es insustituible: leer el clausulado y explicarlo en cristiano. */
export const PREGUNTAS_ASESOR = ["¿Qué cubre?", "¿Qué NO cubre?", "¿Cuánto cuesta?"];

/**
 * El primer mensaje.
 *
 * QUÉ TENÍA MAL, y por qué importa más de lo que parece:
 *
 * 1 · Hacía CUATRO trabajos en orden invertido: daba una orden ("Dime tu nombre") antes de
 *     presentarse. A quien acaba de abrir un chat se le pide algo antes de saber con quién habla.
 *
 * 2 · ANUNCIABA el anti-venta: "Y a veces te voy a decir que no". Ese es el activo diferencial
 *     del producto —el momento que la gente recuerda tres horas después— y anunciarlo lo destruye:
 *     cuando llegue el "hoy no te vendo nada" se leerá como GUION CUMPLIDO, no como honestidad.
 *     Una promesa cumplida impresiona; una promesa anunciada y luego cumplida solo confirma.
 *     Se gastaba en el primer frame, antes de existir.
 *
 * Ahora hace DOS, en orden: se presenta, y hace UNA sola invitación con su motivo. El anti-venta
 * no se anuncia — se hace, y por eso sorprende.
 */
export const SALUDO_INICIAL =
  "Soy Amparito, de amparar: protegerte. Si me dices tu nombre y estás afiliado a Colsubsidio " +
  "te reconozco, y nos saltamos el interrogatorio 💛";

/** Eventos que son ESTADO, no contenido: no pintan tarjeta. */
const NO_PINTAN = new Set(["form", "opciones"]);

/**
 * Cuánta énfasis se permite por mensaje.
 *
 * Es un TOPE EN SERVIDOR, no una petición al prompt. Si el modelo resalta seis cosas no resalta
 * ninguna: la jerarquía se destruye por exceso, no por defecto. Las que sobran se quedan sin
 * marcar, en vez de tirar el mensaje entero.
 */
export const MAX_ENFASIS = 2;

/**
 * Normaliza el texto que escribe Amparito.
 *
 * ── POR QUÉ CAMBIÓ ────────────────────────────────────────────────────────
 *
 * Esta función BORRABA las negritas, los títulos y las viñetas, y el prompt además le prohibía al
 * modelo usarlas. Entre las dos cosas, el resultado era inevitable: párrafos de cuatro líneas
 * donde todo pesa lo mismo, justo en los mensajes que más peso tienen — el que explica por qué un
 * seguro y no otro, el que dice qué NO cubre.
 *
 * La regla se puso por un motivo real: se colaban asteriscos crudos en pantalla. El arreglo fue
 * correcto y la consecuencia no se pensó. Se arregla al revés: en vez de BORRAR el markdown, se
 * admite un subconjunto corto y CONTROLADO —negrita y viñetas, nada más— y se renderiza.
 *
 * Lo que sigue fuera: títulos, cursivas, comillas de énfasis, backticks. Un chat de seguros no
 * necesita un `##`, y la cursiva se confunde con el asterisco suelto que empezó todo esto.
 */
export function limpiarTexto(raw: string): string {
  let t = (raw ?? "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`/g, "")
    // Cursiva fuera: un asterisco suelto es lo que se colaba antes. `(?<!\*)` y `(?!\*)` evitan
    // que este barrido se coma la negrita.
    .replace(/(?<!\*)\*(?!\*)([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/^\s*[•]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // El tope. Se quita la MARCA, no el texto: pasarse de énfasis no puede costarle una frase a nadie.
  let n = 0;
  t = t.replace(/\*\*(.+?)\*\*/g, (_, x) => (++n <= MAX_ENFASIS ? `**${x}**` : String(x)));
  return t;
}

/** Un trozo de línea, con o sin énfasis. La UI lo pinta; aquí se decide qué es qué. */
export interface Trozo {
  texto: string;
  fuerte?: boolean;
}

/**
 * Parte una línea en trozos con y sin énfasis.
 *
 * Vive aquí y no en el componente por lo de siempre: dentro del componente no lo cubre ningún
 * gate. Y devuelve datos, no HTML — el cliente construye nodos, así que no hace falta inyectar
 * marcado en el DOM.
 */
export function trozosDe(linea: string): Trozo[] {
  const out: Trozo[] = [];
  let resto = linea;
  const re = /\*\*(.+?)\*\*/;
  let m = re.exec(resto);
  while (m) {
    if (m.index > 0) out.push({ texto: resto.slice(0, m.index) });
    out.push({ texto: m[1], fuerte: true });
    resto = resto.slice(m.index + m[0].length);
    m = re.exec(resto);
  }
  if (resto) out.push({ texto: resto });
  return out;
}

/** ¿Esta línea es una viñeta? `limpiarTexto` ya normalizó `•` a `- `. */
export const esVinieta = (linea: string): boolean => /^\s*-\s+/.test(linea);

/** El contenido de la viñeta, sin el guion. */
export const textoDeVinieta = (linea: string): string => linea.replace(/^\s*-\s+/, "");

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
