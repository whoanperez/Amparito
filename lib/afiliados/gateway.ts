/**
 * AffiliateGateway — arranque caliente por identificación del afiliado.
 *
 * Contrato único: la app consulta el SEGMENTO del afiliado por nombre (+ ciudad para desempatar),
 * sin importar DÓNDE viva la base — sample local en dev, base administrada (Turso/Postgres) en el
 * deploy, o la base viva de Colsubsidio en producción. Mismo patrón que InsurerGateway.
 *
 * Nota PII: el índice contiene nombres → vive LOCAL (sample sintético) o en la base administrada
 * (con acceso solo-backend). Nunca se sube al repo público, nunca llega al navegador.
 */
export interface AfiliadoSegmento {
  nombre: string;
  genero?: string;
  rango_edad?: string;
  categoria?: string;
  grupo_familiar?: string;
  poblacional?: string;
  ciudad?: string;
}

export interface AffiliateGateway {
  lookup(nombre: string, ciudad?: string): Promise<AfiliadoSegmento | null>;
}

/** Normaliza para comparar nombres/ciudades: minúsculas, sin tildes, espacios colapsados. */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
