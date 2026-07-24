/**
 * Adaptador remoto del AffiliateGateway contra Turso (SQLite en la nube, free tier ~5 GB).
 * Se usa en el deploy cuando hay TURSO_DATABASE_URL. Consulta por nombre (+ ciudad) desde el
 * servidor — los nombres nunca llegan al navegador. NO validado en vivo hasta configurar Turso.
 */
import { createClient, type Client } from "@libsql/client";
import { AffiliateGateway, AfiliadoSegmento, norm } from "./gateway";

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

export class TursoAffiliateAdapter implements AffiliateGateway {
  async lookup(nombre: string, ciudad?: string): Promise<AfiliadoSegmento | null> {
    const n = norm(nombre);
    if (!n) return null;
    const c = ciudad ? norm(ciudad) : null;
    const rs = await db().execute({
      sql: `SELECT nombre, genero, rango_edad, categoria, grupo_familiar, poblacional, ciudad
            FROM afiliados
            WHERE nombre_norm = ? AND (? IS NULL OR ciudad_norm = ?)
            LIMIT 1`,
      args: [n, c, c],
    });
    const row = rs.rows[0];
    if (!row) return null;
    return {
      nombre: String(row.nombre ?? ""),
      genero: str(row.genero),
      rango_edad: str(row.rango_edad),
      categoria: str(row.categoria),
      grupo_familiar: str(row.grupo_familiar),
      poblacional: str(row.poblacional),
      ciudad: str(row.ciudad),
    };
  }
}
