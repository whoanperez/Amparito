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
import { iniciarTurno, aplicarIdentidad, cerrarTurno, type HallazgoIdentidad } from "../lib/estado/reducir";
import { ejecutarConsulta } from "../lib/afiliados/resolver";
import { getAffiliateGateway } from "../lib/afiliados";
import { contextoDeEstado } from "../lib/estado/contexto";

/**
 * Un afiliado real cualquiera para las pruebas, ELEGIDO EN CALIENTE.
 *
 * Antes había dos nombres reales hardcodeados, repetidos en dos gates, en un repo que declara
 * (`lib/afiliados/gateway.ts`) que el índice de nombres "nunca se sube al repo público". Eran
 * cadenas muertas mientras `.env.local` no se cargaba; en cuanto los gates empezaron a ver la
 * base de verdad, pasaron a ser consultas vivas contra dos personas concretas.
 *
 * Preguntarle a la base cuál usar no cuesta nada y saca los nombres del código. Se piden varios
 * porque hace falta uno SIN homónimos: con un nombre ambiguo la prueba mediría otra cosa.
 */
export async function nombreDePrueba(): Promise<string | null> {
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

  if (!process.env.TURSO_DATABASE_URL) return "carolina ramirez lopez"; // sample sintético

  const { createClient } = await import("@libsql/client");
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const r = await db.execute(
    `SELECT nombre FROM afiliados
      WHERE ciudad <> '' AND genero <> '' AND categoria <> '' AND grupo_familiar <> ''
      LIMIT 25`
  );
  for (const fila of r.rows) {
    const n = norm(String(fila.nombre));
    if ((await getAffiliateGateway().buscar(n)).estado === "unico") return n;
  }
  return null;
}

export interface ResueltaIdentidad {
  hallazgo: HallazgoIdentidad;
  estado: EstadoConversacion;
  /** El bloque que entraría al prompt este turno, o "" si no hay nada que decir. */
  contexto: string;
}

/**
 * El camino caliente COMPLETO: encontrarla, y que confirme que es ella.
 *
 * Existe desde 5d, cuando reconocer dejó de ser un solo paso. Los gates que quieren probar el
 * arranque caliente tienen que recorrer los DOS turnos, porque eso es lo que pasa de verdad — si
 * se quedaran en el primero estarían midiendo un estado intermedio y llamándolo "reconocido".
 */
export async function identidadVerificada(
  texto: string,
  respuesta = "12/03/2005"
): Promise<ResueltaIdentidad> {
  const primera = await identidadDe(texto);
  if (primera.estado.identidad.resultado !== "reconocido") return primera;
  const abierto = iniciarTurno(primera.estado, respuesta);
  const hallazgo = await ejecutarConsulta(abierto.consulta);
  const estado = aplicarIdentidad(abierto.estado, hallazgo);
  return { hallazgo: primera.hallazgo, estado, contexto: contextoDeEstado(estado) ?? "" };
}

/**
 * El camino caliente COMPLETO, hasta poder recomendar: verificar Y confirmar.
 *
 * Desde B15·8 hay un turno más — el que le devuelve lo que Colsubsidio tiene de ella para que lo
 * corrija. Los gates que quieren probar la RECOMENDACIÓN tienen que llegar hasta aquí; si se
 * quedaran en el anterior estarían midiendo el turno de la confirmación y llamándolo "reconocida".
 */
export async function identidadConfirmada(
  texto: string,
  respuesta = "12/03/2005"
): Promise<ResueltaIdentidad> {
  const v = await identidadVerificada(texto, respuesta);
  if (!v.estado.identidad.verificada) return v;
  const cerrado = cerrarTurno(v.estado, { eventos: [] });
  return { hallazgo: v.hallazgo, estado: cerrado, contexto: contextoDeEstado(cerrado) ?? "" };
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
