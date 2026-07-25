/**
 * Ayudante compartido por los gates que ejercitan identidad.
 *
 * Existe para no copiar el mismo camino en tres archivos: `test-identidad`, `test-primer-toque` y
 * el eval hacían cada uno su versión, y con tres copias basta que una derive para que un gate
 * verde esté probando un flujo que ya nadie ejecuta.
 *
 * Y recorre el camino REAL: reducer → consulta → base → reducer. Antes los tests llamaban al
 * resolver directamente con el historial, que era un cuarto camino que solo existía en los tests.
 */
import { estadoInicial } from "../lib/estado/tipos";
import type { EstadoConversacion } from "../lib/estado/tipos";
import { iniciarTurno, aplicarIdentidad, type HallazgoIdentidad } from "../lib/estado/reducir";
import { ejecutarConsulta } from "../lib/afiliados/resolver";
import { contextoDeEstado } from "../lib/estado/contexto";

export interface ResueltaIdentidad {
  hallazgo: HallazgoIdentidad;
  estado: EstadoConversacion;
  /** El bloque que entraría al prompt este turno, o "" si no hay nada que decir. */
  contexto: string;
}

/** Un turno de identidad desde cero: lo que pasa cuando alguien escribe su primer mensaje. */
export async function identidadDe(
  texto: string,
  previo: EstadoConversacion = estadoInicial()
): Promise<ResueltaIdentidad> {
  const abierto = iniciarTurno(previo, texto);
  const hallazgo = await ejecutarConsulta(abierto.consulta);
  const estado = aplicarIdentidad(abierto.estado, hallazgo);
  return { hallazgo, estado, contexto: contextoDeEstado(estado) ?? "" };
}
