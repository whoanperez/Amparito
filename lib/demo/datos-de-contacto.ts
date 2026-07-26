/**
 * Datos de contacto DE EJEMPLO para precargar el formulario en la demostración.
 *
 * ── POR QUÉ EXISTE, Y POR QUÉ VIVE EN `lib/demo/` ──────────────────────────
 *
 * La base de afiliados tiene nombre, género, rango de edad, categoría, grupo familiar y ciudad. NO
 * tiene documento, fecha de nacimiento, celular ni correo. Así que el momento completo —"no
 * escribiste nada"— no se puede montar con datos reales: hay que simularlos.
 *
 * Decisión tomada a propósito para la demo. Y como toda simulación en este producto, se sostiene
 * con dos reglas:
 *
 *   1 · SE DICE. El formulario etiqueta cada campo con su procedencia, y los de aquí llevan "dato
 *       de ejemplo". Nunca se presentan como venidos de Colsubsidio — eso sería exactamente la
 *       falsa atribución que este proyecto lleva media sesión persiguiendo.
 *   2 · SE BORRA FÁCIL. Todo vive en este archivo, dentro de `lib/demo/`, y solo se invoca cuando
 *       la identidad está verificada. El día que Colsubsidio exponga esos campos, se cambia la
 *       fuente y no hay nada que desenredar.
 *
 * ── POR QUÉ NO SON ALEATORIOS NI REALISTAS ─────────────────────────────────
 *
 * Los nombres de la base son de personas REALES. Poner un número de cédula verosímil al lado de un
 * nombre real es fabricar un dato personal de alguien que existe, aunque sea inventado — y en un
 * repo público.
 *
 * No se puede evitar el FORMATO: diez dígitos que empiezan en 10 es el formato de una cédula
 * colombiana moderna, y el formulario la valida como tal. Lo que sí se evita es que parezca
 * ESCOGIDA: 1.000.000.0xx es el primer número redondo del rango más dos dígitos, se lee como
 * relleno a simple vista, y la pantalla lo rotula "dato de ejemplo". El correo es `@ejemplo.com`
 * por lo mismo.
 *
 * Deterministas, además: la misma persona ve siempre lo mismo. Un dato que cambia entre recargas
 * delata la simulación por el lado tonto.
 */
import type { SegmentoBase } from "../engine/sanear";

export interface ContactoDeEjemplo {
  numeroDocumento: string;
  fechaNacimiento: string;
  celular: string;
  correo: string;
}

/** Suma estable de un texto. Para que la misma persona vea siempre los mismos dígitos. */
function semilla(texto: string): number {
  let n = 0;
  for (const c of texto) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n;
}

const sinTildes = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Un año de nacimiento COHERENTE con el rango verificado.
 *
 * No es un adorno: en un flujo real la persona dijo "35" y la base la situaba en "36 a 45", y esa
 * contradicción se coló hasta la cotización. Un dato de ejemplo que la contradiga desde el
 * formulario sería sembrarla nosotros.
 */
function anioDeNacimiento(rango: string | undefined, anioActual: number): number {
  const entre = rango?.match(/(\d{2})\s*a\s*(\d{2})/);
  if (entre) return anioActual - Math.floor((Number(entre[1]) + Number(entre[2])) / 2);
  if (/mayor de (\d{2})/i.test(rango ?? "")) {
    return anioActual - (Number(rango!.match(/mayor de (\d{2})/i)![1]) + 5);
  }
  if (/menor de (\d{2})/i.test(rango ?? "")) {
    return anioActual - (Number(rango!.match(/menor de (\d{2})/i)![1]) - 1);
  }
  return anioActual - 35;
}

export function contactoDeEjemplo(
  nombre: string,
  segmento: SegmentoBase | undefined,
  anioActual: number
): ContactoDeEjemplo {
  const s = semilla(sinTildes(nombre));
  const dia = String((s % 28) + 1).padStart(2, "0");
  const mes = String((Math.floor(s / 28) % 12) + 1).padStart(2, "0");
  const anio = anioDeNacimiento(segmento?.RANGO_EDAD, anioActual);

  const partes = sinTildes(nombre).split(/\s+/).filter(Boolean);
  const usuario = [partes[0], partes[1]].filter(Boolean).join(".") || "persona";

  return {
    // Número redondo a propósito: tiene formato de cédula, pero se lee como relleno.
    numeroDocumento: `10000000${String(s % 100).padStart(2, "0")}`,
    fechaNacimiento: `${dia}/${mes}/${anio}`,
    celular: `30${String(s % 100000000).padStart(8, "0")}`,
    correo: `${usuario}@ejemplo.com`,
  };
}
