/**
 * Detección del nombre en lenguaje natural, EN CÓDIGO.
 *
 * Por qué en código y no como tool: la regla es "cuando aparece un nombre, busca". Eso es
 * determinista, así que no debe depender de que el modelo decida llamar una tool en el momento
 * justo. En la conversación real la persona escribió "soy Mauricio Cajamarca" en su primer
 * mensaje y no pasó absolutamente nada, porque no existía ningún camino del chat al gateway.
 *
 * Un falso positivo cuesta cero: la búsqueda no encuentra nada y el flujo sigue igual. Por eso el
 * detector puede ser generoso.
 */

/** Fórmulas con las que la gente se presenta. */
const PREFIJOS = [
  "soy",
  "me llamo",
  "mi nombre es",
  "mi nombre completo es",
  "aqui habla",
  "habla",
];

/** Palabras que NO son parte de un nombre (evitan "soy afiliado", "soy de Bogotá"). */
const STOP = new Set([
  "afiliado", "afiliada", "cliente", "usuario", "nuevo", "nueva", "de", "del", "la", "el", "los",
  "las", "un", "una", "yo", "mi", "tu", "su", "y", "e", "o", "que", "para", "por", "con", "en",
  "hombre", "mujer", "senor", "senora", "joven", "papa", "mama", "madre", "padre", "casado",
  "casada", "soltero", "soltera", "independiente", "empleado", "empleada", "pensionado",
  "estudiante", "conductor", "domiciliario", "mensajero", "moto", "carro", "bici", "hola",
  "buenas", "buenos", "dias", "tardes", "noches", "gracias", "si", "no", "ok", "listo",
  // Continuaciones típicas cuando alguien se presenta y sigue contando su vida:
  // "soy Andrés, tengo 28 años, soltero y sin hijos..." — sin esto el nombre se contamina.
  "tengo", "tiene", "anos", "ano", "edad", "vivo", "vive", "trabajo", "trabaja", "busco", "quiero",
  "necesito", "acabo", "acaba", "compre", "compro", "comprar", "sin", "hijos", "hija", "hijo",
  "esposa", "esposo", "pareja", "familia", "hogar", "casa", "apartamento", "ciudad", "aqui",
]);

const limpio = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-zñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const esTokenDeNombre = (t: string) => t.length >= 2 && !STOP.has(t);

/**
 * Extrae un nombre candidato del mensaje. Devuelve `null` si no parece haber uno.
 * `primerMensaje` afloja el criterio: la pantalla de entrada pide el nombre, así que un mensaje
 * corto de 2 a 4 palabras alfabéticas es casi seguro un nombre.
 */
export function detectarNombre(texto: string, primerMensaje = false): string | null {
  const t = limpio(texto);
  if (!t) return null;

  // Las mayúsculas del texto ORIGINAL son la mejor señal de nombre propio en español: en
  // "soy Andrés, tengo 28 años" solo "Andrés" va en mayúscula. Si la persona escribe todo en
  // minúscula, se cae al criterio de stoplist.
  const original = texto.split(/[\s,.;:()]+/).filter(Boolean);
  const hayMayusculas = original.some((w) => /^[A-ZÁÉÍÓÚÑ]/.test(w) && w.length > 1);

  for (const p of PREFIJOS) {
    const i = t.indexOf(p + " ");
    if (i === -1) continue;
    const resto = t.slice(i + p.length + 1).split(" ");
    // Índice donde arranca el nombre dentro del texto original (para leer sus mayúsculas).
    const desde = original.findIndex((w) => limpio(w) === p.split(" ")[0]) + p.split(" ").length;
    const toks: string[] = [];
    for (let k = 0; k < resto.length && toks.length < 5; k++) {
      const tok = resto[k];
      if (!esTokenDeNombre(tok)) break;
      // Con mayúsculas disponibles, exigirlas: corta limpio en "tengo", "soltero", etc.
      if (hayMayusculas) {
        const orig = original[desde + k];
        if (!orig || !/^[A-ZÁÉÍÓÚÑ]/.test(orig)) break;
      }
      toks.push(tok);
    }
    if (toks.length >= 1) return toks.join(" ");
  }

  // Mensaje que es solo un nombre ("Carolina Ramírez López").
  const toks = t.split(" ");
  if (toks.length >= 2 && toks.length <= 4 && toks.every(esTokenDeNombre)) return toks.join(" ");
  if (primerMensaje && toks.length === 1 && esTokenDeNombre(toks[0])) return toks[0];

  return null;
}

/** Prefijos con los que la gente responde una ciudad ("vivo en Bogotá", "en Cali", "de Soacha"). */
const PREF_CIUDAD = ["vivo en", "estoy en", "soy de", "en", "de", "ciudad"];

/** Extrae la ciudad de una respuesta corta. Devuelve `null` si no parece una ciudad. */
export function detectarCiudad(texto: string): string | null {
  const t = limpio(texto);
  if (!t) return null;
  for (const p of PREF_CIUDAD) {
    if (t.startsWith(p + " ")) {
      const resto = t.slice(p.length + 1).trim();
      if (resto && resto.split(" ").length <= 4) return resto;
    }
  }
  // Respuesta pelada: "Bogotá", "Bogotá D.C.", "Santa Marta".
  const toks = t.split(" ").filter((x) => !STOP.has(x));
  if (toks.length >= 1 && toks.length <= 4) return toks.join(" ");
  return null;
}
