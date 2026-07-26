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
import { frasesDe } from "./validar";

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

/* ─────────────────────────────────────────────────────────────────────────────
   La verificación, enmarcada

   ── LA LÍNEA QUE HAY QUE TRAZAR, Y DÓNDE ──────────────────────────────────

   La primera versión de esta tarjeta la envolvía entera en `.demo`, o sea bajo el rótulo "Solo
   para la demo". Y eso dice algo FALSO: que pedir un dato de identidad es parte del montaje y que
   en producción no va a estar. Sí va a estar — sin ese dato no se puede enseñar lo que Colsubsidio
   tiene de una persona, y ese es justo el motivo por el que el paso existe.

   Lo simulado es OTRA cosa, y es una sola: hoy el valor que se escribe no se contrasta contra
   nada. La pregunta es de verdad; la comprobación es la que no.

   Por eso la tarjeta se estructura como el formulario de datos, que ya resolvió este mismo
   problema: la tarjeta es de PRODUCTO y solo el aviso lleva el rótulo de demo. Envolverlo todo en
   amarillo discontinuo es lo que hacía leer "esto no va a quedar así".

   Las frases viven aquí y no en `contexto.ts` porque dejaron de ser una instrucción para el
   modelo: antes se le PEDÍA copiar el aviso literal, así que la honestidad del paso dependía de
   que se acordara. Ahora no escribe ninguna y no puede olvidarse de ninguna.
   ────────────────────────────────────────────────────────────────────────── */

/** El rótulo de la tarjeta. Nombra el paso por lo que es, no por dónde corre. */
export const TITULO_VERIFICACION = "Verificación de identidad";

/** Lo único que se le pide, y se le pide UNA vez. */
export const PREGUNTA_VERIFICACION = "¿Cuál es la fecha de expedición de tu documento?";

/**
 * Lo que NO es del montaje, dicho antes que lo que sí.
 *
 * Va primero a propósito: quien lea solo la línea grande y una más tiene que quedarse con que el
 * paso es real. Si lo primero que lee es "simulado", ya concluyó que todo esto es de mentira y no
 * sigue leyendo.
 */
export const VERIFICACION_ES_REAL =
  "Este paso se queda: pedirte un dato que solo tú sabrías es parte del producto, no del montaje.";

/**
 * El sello de la verificación, propiedad del SERVIDOR.
 *
 * Delimita la simulación con precisión —"la comprobación, no la pregunta"— porque el sello anterior
 * no la delimitaba: decía "esta validación es simulada" y se leía como que el paso entero era
 * decorado. Un sello que exagera cuánto hay de mentira hace el mismo daño que uno que lo esconde;
 * en los dos casos la pantalla afirma algo que no es.
 *
 * Cuando la verificación sea real, esta constante desaparece y con ella el aviso.
 */
export const AVISO_VERIFICACION =
  "Lo simulado es la comprobación, no la pregunta: hoy el valor que escribas no se contrasta " +
  "contra los sistemas de Colsubsidio, así que cualquier fecha sirve —23/04/2004, por ejemplo— y " +
  "seguimos. En producción este mismo dato sí se valida.";

/**
 * ¿Toca pedir la fecha de expedición?
 *
 * Se lee del estado, que es quien sabe qué preguntó. Cuando se agotan los intentos, `esperando`
 * queda en `null` y la tarjeta desaparece sola: nunca un callejón sin salida.
 */
const pideVerificacion = (e: EstadoConversacion): boolean => e.identidad.esperando === "verificacion";

/**
 * Lo que la tarjeta ya dice. Si el modelo lo escribe igual, sale dos veces.
 *
 * Hay una marca por cada cosa que la tarjeta afirma —la pregunta, la simulación, el "cualquier
 * fecha" y el "en producción"— y no una sola por el aviso entero: el aviso son tres frases, y
 * `frasesDe` corta por frases, así que un patrón que solo pegue con la primera deja las otras
 * dentro del texto. Pasó: se colaba "En producción este mismo dato sí se valida."
 *
 * Que "en producción" pode aquí no es un accidente: Amparito hablándole a alguien de en qué entorno
 * corre está fuera de su voz, esté o no duplicado.
 */
const YA_LO_DICE_LA_TARJETA =
  /fecha de expedici[oó]n|validaci[oó]n[^.?!]{0,20}simulada|no se contrasta|cualquier fecha|en producci[oó]n/i;

/**
 * Quita del texto lo que la tarjeta ya pone.
 *
 * El prompt se lo pide al modelo; esto lo garantiza. Es la regla de siempre —el prompt pide, el
 * servidor garantiza— y aquí importa el doble: una pregunta duplicada en dos superficies distintas
 * se lee como que algo se rompió.
 */
function sinLoQueDiceLaTarjeta(texto: string): string {
  if (!YA_LO_DICE_LA_TARJETA.test(texto)) return texto;
  // Solo se reconstruye si de verdad sobra algo. `frasesDe` une con espacio, así que reconstruir
  // siempre aplastaría los saltos de línea de un mensaje que no tenía nada malo — y el caso normal,
  // el modelo obedeciendo, es justo ese.
  return frasesDe(texto)
    .filter((f) => !YA_LO_DICE_LA_TARJETA.test(f))
    .join(" ")
    .trim();
}

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
/**
 * Dónde NO puede caer el énfasis.
 *
 * El prompt ya lo pedía y el modelo hizo justo lo contrario: en un flujo real las SEIS marcas
 * cayeron sobre lo prohibido — dos preguntas ("¿cuántos años tienes?"), tres nombres de producto
 * y un precio. Cero aciertos.
 *
 * Y el efecto es peor que no tener énfasis: subraya lo que ya está en las tarjetas y deja sin
 * marcar lo único que importa —"si algo te pasara, tu familia se queda sin ingreso"—, así que la
 * jerarquía queda al revés.
 *
 * Igual que el tope: el prompt pide, el servidor garantiza.
 */
function enfasisProhibido(texto: string, oracion: string, productos: readonly string[]): boolean {
  const t = texto.trim();

  /*
   * Una pregunta no es lo que hay que recordar: es lo que hay que contestar.
   *
   * Se mira la ORACIÓN, no solo el trozo marcado. Con solo el trozo, "¿**cuántos años tienes**?"
   * se colaba: los signos quedaban fuera de la marca y la guarda no veía la pregunta.
   */
  if (/[¿?]/.test(oracion)) return true;

  // Una cifra suelta. El precio ya va en su tarjeta, con su rótulo y su letra grande.
  if (/\d/.test(t) && /\b(pesos|mil|millon|\$|mensual|al mes)\b/i.test(t)) return true;

  /*
   * El nombre de un producto, cuando el énfasis es ESO y poco más: ya está en la tarjeta, a dos
   * centímetros. Se mide por proporción y no por `includes`, porque con `includes` se caía
   * "**sin SOAT te pueden inmovilizar la moto**" — que es una advertencia legal y de las frases
   * que más valen. Ahí el nombre es parte de la idea, no la idea.
   */
  const n = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const limpio = n(t).replace(/^(el|la|los|las|un|una|tu|su)\s+/, "");
  return productos.some((prod) => {
    if (!prod) return false;
    const i = limpio.indexOf(n(prod));
    return i >= 0 && n(prod).length / limpio.length >= 0.6;
  });
}

export interface OpcionesTexto {
  /** Nombres de los productos que YA están en pantalla, para no resaltarlos otra vez. */
  productos?: readonly string[];
}

export function limpiarTexto(raw: string, opciones: OpcionesTexto = {}): string {
  let t = (raw ?? "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`/g, "")
    // Cursiva fuera: un asterisco suelto es lo que se colaba antes. `(?<!\*)` y `(?!\*)` evitan
    // que este barrido se coma la negrita.
    .replace(/(?<!\*)\*(?!\*)([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/^\s*[•]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Primero se cae lo que NO puede llevar énfasis, y solo después se aplica el tope: si no, dos
  // marcas prohibidas gastarían el cupo y la buena se quedaría fuera.
  const productos = opciones.productos ?? [];
  t = t.replace(/\*\*(.+?)\*\*/g, (m, x, desplazamiento: number) => {
    // La oración que rodea a la marca, para poder ver un "¿…?" que quede fuera de ella.
    const antes = t.slice(0, desplazamiento);
    const despues = t.slice(desplazamiento + m.length);
    // Se corta por el CIERRE de oración, nunca por la apertura: partir también por "¿" borraba el
    // signo que se está buscando, así que "¿**cuántos años tienes**?" se colaba entera.
    const oracion =
      (antes.split(/[.!?\n]/).pop() ?? "") + String(x) + (despues.split(/[.!?\n]/)[0] ?? "");
    return enfasisProhibido(String(x), oracion, productos) ? String(x) : `**${x}**`;
  });

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
  /*
   * Los nombres que YA están en pantalla salen del veredicto y de los eventos del turno — no de una
   * lista escrita a mano ni del catálogo, que arrastraría el JSON entero al bundle del cliente.
   */
  const productosEnPantalla = [
    ...(estado.veredicto?.recomendaciones ?? []).map((r) => r.nombre),
    ...eventos.flatMap((ev) =>
      ((ev.data?.recomendaciones ?? []) as Array<{ nombre?: string }>).map((r) => r?.nombre ?? "")
    ),
  ].filter(Boolean);

  const limpio = limpiarTexto(textoDelModelo ?? "", { productos: productosEnPantalla });
  // La pregunta y su aviso los pone la tarjeta. Si el modelo los escribió igual, se podan: mejor un
  // mensaje corto que la misma pregunta dos veces en dos superficies distintas.
  const texto = pideVerificacion(estado) ? sinLoQueDiceLaTarjeta(limpio) : limpio;
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
  // DESPUÉS del texto: el saludo y el motivo van primero, y la pregunta cierra. Al revés se le
  // pide un dato de identidad a alguien antes de decirle para qué.
  if (pideVerificacion(estado)) bloques.push({ t: "verificacion" });
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
