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

/**
 * El CSV crudo trae el grupo familiar en mayúsculas y con typos ("AFILLIADO SIN GRUPO_FAMILIAR").
 * El motor (`weights.json`) y el peer-group (`base_stats.json`) usan las etiquetas canónicas, y
 * `lookupPeer` compara por IGUALDAD ESTRICTA: sin este mapa, un afiliado real nunca encuentra su
 * celda y el PeerProof desaparece en silencio. Mismo mapa que `data/pipeline/profile_base.py`.
 */
const GRUPO_FAMILIAR_CANON: Record<string, string> = {
  "AFILLIADO SIN GRUPO_FAMILIAR": "Sin grupo familiar",
  "FAMILIA MONOPARENTAL": "Monoparental",
  "FAMILIA MONOPARENTAL AMPLIADA": "Monoparental ampliada",
  "FAMILIA NUCLEAR INTEGRAL": "Nuclear integral",
  "FAMILIA NUCLEAR AMPLIADA": "Nuclear ampliada",
  "PAREJA CONYUGAL SIN HIJOS": "Pareja conyugal",
  "PAREJA CONYUGAL": "Pareja conyugal",
};

/** Idempotente: un valor ya canónico (como el del sample local) pasa sin cambios. */
export function canonGrupoFamiliar(raw?: string): string | undefined {
  const s = (raw ?? "").trim();
  if (!s) return undefined;
  return GRUPO_FAMILIAR_CANON[s.toUpperCase()] ?? s;
}

/** Deja el segmento en el vocabulario del motor. Los vacíos se vuelven `undefined`. */
export function canonSegmento(seg: AfiliadoSegmento): AfiliadoSegmento {
  const limpio = (v?: string) => {
    const s = (v ?? "").trim();
    return s || undefined;
  };
  return {
    nombre: seg.nombre,
    genero: limpio(seg.genero),
    rango_edad: limpio(seg.rango_edad),
    categoria: limpio(seg.categoria),
    grupo_familiar: canonGrupoFamiliar(seg.grupo_familiar),
    poblacional: limpio(seg.poblacional),
    ciudad: limpio(seg.ciudad),
  };
}
