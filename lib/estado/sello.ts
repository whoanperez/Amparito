/**
 * Sello del estado — HMAC-SHA256.
 *
 * POR QUÉ. El estado viaja por el navegador, y dentro va `identidad.segmento`: los cuatro ejes
 * verificados que habilitan la PRUEBA SOCIAL. Un cliente manipulado podría fabricar un segmento
 * y con él una celda de peer-group falsa — en un producto cuya tesis es que sus afirmaciones se
 * pueden auditar. El sello cierra eso sin renunciar a tener el segmento congelado en el estado
 * (que es lo que evita volver a consultar la base en cada turno).
 *
 * Para el cliente el resultado es una CADENA OPACA, y eso es deliberado: si no puede leerla, no
 * puede empezar a derivar de ella y reintroducir justo el problema que este módulo elimina.
 *
 * Solo servidor: importa `node:crypto`.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { EstadoConversacion } from "./tipos";
import { estadoInicial } from "./tipos";

/**
 * Nunca un secreto por defecto hardcodeado: uno en el repo es lo mismo que no tener ninguno.
 * Si falta la variable, se genera uno aleatorio POR PROCESO — el dev local sigue funcionando y
 * un reinicio simplemente invalida las conversaciones en vuelo, que es el fallo correcto.
 */
const SECRETO: string = (() => {
  const v = process.env.AMPARITO_ESTADO_SECRET?.trim();
  if (v) return v;
  console.warn(
    "[amparito] AMPARITO_ESTADO_SECRET no está definida: se usa un secreto aleatorio por " +
      "proceso. Las conversaciones en vuelo se invalidan al reiniciar. Defínela en el deploy."
  );
  return randomBytes(32).toString("hex");
})();

const firmar = (payload: string) => createHmac("sha256", SECRETO).update(payload).digest("hex");

/** Estado → cadena opaca `"<base64url(json)>.<hmac>"`. */
export function sellar(estado: EstadoConversacion): string {
  const payload = Buffer.from(JSON.stringify(estado), "utf8").toString("base64url");
  return `${payload}.${firmar(payload)}`;
}

/**
 * Cadena → estado, o `null` si el sello no cuadra.
 *
 * Falla CERRADO pero sin excepción: el llamador arranca en turno 0. El jurado nunca ve un error,
 * ve un saludo — que es la degradación correcta para una pantalla en vivo.
 */
export function abrir(sellado: unknown): EstadoConversacion | null {
  if (typeof sellado !== "string" || !sellado.includes(".")) return null;
  const corte = sellado.lastIndexOf(".");
  const payload = sellado.slice(0, corte);
  const firma = sellado.slice(corte + 1);

  const esperada = firmar(payload);
  // Comparación en tiempo constante. Longitudes distintas no llegan a `timingSafeEqual`, que
  // lanza si no coinciden.
  if (firma.length !== esperada.length) return null;
  if (!timingSafeEqual(Buffer.from(firma, "utf8"), Buffer.from(esperada, "utf8"))) return null;

  try {
    const estado = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    // Un estado de otra versión del formato se descarta: es preferible reempezar a razonar sobre
    // una forma que ya no existe.
    if (!estado || estado.v !== 1) return null;
    return estado as EstadoConversacion;
  } catch {
    return null;
  }
}

/** Abre lo que venga; si no cuadra (ausente, manipulado, de otra versión), arranca de cero. */
export function abrirOInicial(sellado: unknown): EstadoConversacion {
  return abrir(sellado) ?? estadoInicial();
}
