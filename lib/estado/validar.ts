/**
 * Validador de afirmaciones sobre la base de afiliados.
 *
 * EL CASO REAL: el servidor encontró CERO coincidencias con "Carolina" y Amparito dijo "hay
 * varios Carolinas". Eso no es una alucinación cualquiera — es una afirmación fabricada sobre la
 * base de datos de Colsubsidio, dicha con la autoridad de quien acaba de consultarla.
 *
 * El prompt ya lo prohíbe, pero una regla de prompt es una petición probabilística. Los hechos
 * sobre la base los establece el SERVIDOR y viven en el estado; esto comprueba que el texto no
 * afirme ninguno que el estado no respalde.
 *
 * DISEÑADO PARA NO DISPARAR DE MÁS. Un falso positivo cuesta un reintento y puede mutilar una
 * frase buena, así que cada regla exige varias señales a la vez en vez de una palabra suelta.
 * "Hay varios seguros que te sirven" o "hay varias personas que dependen de ti" son frases
 * legítimas y NO se tocan.
 *
 * Función pura.
 */
import type { EstadoConversacion } from "./tipos";

export interface AfirmacionSinRespaldo {
  frase: string;
  motivo: string;
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => sinTildes(s).toLowerCase();

/** Cuantificadores: números o palabras de cantidad. */
const CANTIDAD = /\b(\d[\d.,]*|varios|varias|muchos|muchas|miles|cientos|algunos|algunas|otros|otras)\b/;

/** Frases hechas que dicen "no estás en la base". */
const NO_APARECE = /\bno\s+(apareces|estas|figuras|te\s+encuentro|te\s+encontre)\b|\bno\s+eres\s+afiliad/;

/** Referencias explícitas al REGISTRO, no a Colsubsidio en general (que también vende productos). */
const REGISTRO = /\b(en la base|de la base|registrad[oa]s?|homonim|con ese nombre|con tu nombre|con el mismo nombre)\b/;

/** Prueba social: "N personas como tú". */
const PEER = /\b(personas?|afiliad[oa]s?|gente|usuarios?)\b[^.?!]{0,30}\bcomo\s+(tu|vos|usted|tu?)\b/;

/**
 * Trocea en frases conservando el signo, para poder quitar solo la que sobra.
 *
 * Corta después de un cierre (`.?!` o salto) Y ANTES de una apertura española (`¿¡`). Lo segundo
 * es imprescindible aquí: Amparito termina muchas frases en emoji, no en punto, así que
 * "...en Colsubsidio 😅 ¿En qué ciudad estás?" era UNA sola frase — y podar la afirmación
 * fabricada se habría llevado por delante la pregunta legítima.
 */
export function frasesDe(texto: string): string[] {
  return texto
    .split(/(?<=[.?!\n])\s+|\s+(?=[¿¡])/)
    .map((f) => f.trim())
    .filter(Boolean);
}

export function afirmacionesSinRespaldo(
  texto: string,
  e: EstadoConversacion
): AfirmacionSinRespaldo[] {
  const hallazgos: AfirmacionSinRespaldo[] = [];

  /**
   * El primer nombre, como PALABRA y con MAYÚSCULA. Dos accidentes que hay que evitar:
   *
   *   · con `includes` a secas, alguien llamado Ana convertía "hay varias opciones para mañana"
   *     en una afirmación sobre la base — "manana" contiene "ana";
   *   · con solo límite de palabra, Luz, Rosa, Cruz, Paz, Sol o Mar son nombres propios Y
   *     sustantivos comunes, así que "varias alternativas de luz solar" disparaba.
   *
   * La mayúscula es la señal que los separa, y es la misma heurística que ya usa `detectarNombre`.
   * El límite por la izquierda deja pasar el plural, que es como aparece en el caso real:
   * "hay varios Carolinas".
   *
   * Coste asumido: si el modelo escribe el nombre en minúscula, se escapa. Es el lado correcto
   * en el que fallar — dejar pasar una frase rara es mejor que mutilar una buena.
   */
  const nombre = e.identidad.nombre?.trim().split(/\s+/)[0];
  const reNombre =
    nombre && nombre.length >= 3
      ? new RegExp(`\\b${sinTildes(nombre).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
      : null;

  for (const frase of frasesDe(texto)) {
    const f = norm(frase);
    // El nombre se busca sobre el texto con su CAPITALIZACIÓN intacta; todo lo demás, en
    // minúsculas.
    const conMayusculas = sinTildes(frase);

    // 1 · Cardinalidad de homónimos. Dos señales: cuantificador + o bien una referencia al
    //     registro, o bien el propio nombre de la persona ("hay varios Carolinas"), que es como
    //     apareció en la conversación real.
    const hablaDelRegistro = REGISTRO.test(f) || (reNombre !== null && reNombre.test(conMayusculas));
    if (CANTIDAD.test(f) && hablaDelRegistro && !e.identidad.ambiguo) {
      hallazgos.push({
        frase,
        motivo:
          "afirmas cuántas personas hay en la base de afiliados, y la búsqueda no devolvió " +
          "homónimos. No sabes ese número: no lo digas.",
      });
      continue;
    }

    // 2 · Decir que no aparece cuando la búsqueda dice otra cosa (o cuando no se buscó).
    if (NO_APARECE.test(f) && e.identidad.resultado !== "no_encontrado") {
      hallazgos.push({
        frase,
        motivo:
          e.identidad.resultado === "reconocido"
            ? "dices que no aparece en la base, y sí apareció: está identificada."
            : "dices que no aparece en la base, y esa búsqueda no se hizo o no dio ese resultado.",
      });
      continue;
    }

    // 3 · Prueba social sin celda verificada. Es la afirmación de más valor del producto y la que
    //     más daño hace si se inventa.
    if (CANTIDAD.test(f) && PEER.test(f) && !e.veredicto?.peer) {
      hallazgos.push({
        frase,
        motivo:
          "afirmas cuántos afiliados se parecen a esta persona, y el motor NO devolvió prueba " +
          "social para este perfil. Sin celda verificada no se afirma ni se aproxima.",
      });
    }
  }

  return hallazgos;
}

/** La instrucción de corrección que se le manda al modelo. */
export function instruccionDeCorreccion(hallazgos: AfirmacionSinRespaldo[]): string {
  return (
    "Tu respuesta afirma cosas sobre la base de afiliados de Colsubsidio que el sistema NO " +
    "verificó. Reescríbela quitando esas afirmaciones, sin sustituirlas por otras: si no lo " +
    "sabes, no lo digas. Mantén el resto igual y conserva UNA SOLA pregunta.\n" +
    hallazgos.map((h) => `- "${h.frase}" → ${h.motivo}`).join("\n")
  );
}

/** Último recurso: quita las frases que siguen sin respaldo, conservando el resto. */
export function quitarFrases(texto: string, hallazgos: AfirmacionSinRespaldo[]): string {
  const fuera = new Set(hallazgos.map((h) => h.frase));
  return frasesDe(texto)
    .filter((f) => !fuera.has(f))
    .join(" ")
    .trim();
}
