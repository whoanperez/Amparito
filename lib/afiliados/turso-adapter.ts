/**
 * Adaptador remoto del AffiliateGateway contra Turso (SQLite en la nube).
 * Se usa en el deploy cuando hay TURSO_DATABASE_URL. Consulta por nombre (+ ciudad) desde el
 * servidor — los nombres nunca llegan al navegador.
 *
 * Solo búsquedas POR ÍNDICE (~100 ms). Prohibido buscar por tokens (`LIKE '% x %'`): no usa el
 * índice, escanea 1,5M de filas y se pasó de 5 minutos en pruebas. El nombre corto se resuelve
 * PREGUNTANDO el nombre completo, no escaneando.
 */
import { createClient, type Client } from "@libsql/client";
import {
  AffiliateGateway,
  AfiliadoSegmento,
  Hallazgo,
  canonSegmento,
  norm,
  segmentoComun,
} from "./gateway";

let client: Client | null = null;
function db(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL as string,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

const str = (v: unknown): string | undefined => (v != null ? String(v) : undefined);

/** Cuántos homónimos se traen para desambiguar. El máximo real medido en la base es 5. */
const MAX_CANDIDATOS = 12;

export class TursoAffiliateAdapter implements AffiliateGateway {
  async buscar(nombre: string, ciudad?: string): Promise<Hallazgo> {
    const n = norm(nombre);
    if (!n) return { estado: "no_encontrado" };

    // Una sola consulta por índice; la desambiguación se hace en memoria sobre pocas filas.
    const rs = await db().execute({
      sql: `SELECT nombre, genero, rango_edad, categoria, grupo_familiar, poblacional, ciudad
            FROM afiliados
            WHERE nombre_norm = ?
            LIMIT ${MAX_CANDIDATOS}`,
      args: [n],
    });
    if (!rs.rows.length) return { estado: "no_encontrado" };

    let cands = rs.rows.map((row) =>
      canonSegmento({
        nombre: String(row.nombre ?? ""),
        genero: str(row.genero),
        rango_edad: str(row.rango_edad),
        categoria: str(row.categoria),
        grupo_familiar: str(row.grupo_familiar),
        poblacional: str(row.poblacional),
        ciudad: str(row.ciudad),
      })
    );

    // Filtro de ciudad TOLERANTE: el 58,2% de la base no tiene ciudad, así que un filtro estricto
    // excluiría justo a la persona que se está buscando.
    if (ciudad) {
      const c = norm(ciudad);
      const conCiudad = cands.filter((s) => !s.ciudad || norm(s.ciudad) === c);
      if (conCiudad.length) cands = conCiudad;
    }

    if (cands.length === 1) return { estado: "unico", segmento: cands[0] };

    // Si todos los homónimos comparten los 4 ejes, da lo mismo cuál sea.
    const todosIguales = (["genero", "rango_edad", "categoria", "grupo_familiar"] as const).every(
      (k) => cands.every((s) => s[k] === cands[0][k])
    );
    if (todosIguales) return { estado: "unico", segmento: cands[0] };

    return { estado: "ambiguo", n: cands.length, comun: segmentoComun(cands) };
  }

  async lookup(nombre: string, ciudad?: string): Promise<AfiliadoSegmento | null> {
    const h = await this.buscar(nombre, ciudad);
    return h.estado === "unico" ? h.segmento : null;
  }
}
