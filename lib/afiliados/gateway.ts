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

/**
 * Resultado de una búsqueda. Distinguir "único" de "ambiguo" es lo que evita el bug de hoy:
 * `porNombre[0]` y `LIMIT 1` le atribuyen a una persona el segmento de OTRA, en silencio.
 *
 * Medido sobre la base real (1.551.282 nombres): el 99,55% es único; el 0,40% tiene homónimos con
 * segmentos distintos, y para esos la ciudad resuelve el 100%. Pero el 58,2% de los registros NO
 * tiene ciudad, así que el filtro debe ser tolerante o excluye justo a quien se está buscando.
 */
export type Hallazgo =
  | { estado: "unico"; segmento: AfiliadoSegmento }
  /** Varios homónimos con segmentos distintos. `comun` trae los ejes en los que TODOS coinciden. */
  | { estado: "ambiguo"; n: number; comun: AfiliadoSegmento | null }
  | { estado: "no_encontrado" };

export interface AffiliateGateway {
  /** Búsqueda con desambiguación. Es la que debe usar el flujo. */
  buscar(nombre: string, ciudad?: string): Promise<Hallazgo>;
  /** Atajo histórico: devuelve el primero. Se mantiene para no romper llamadores existentes. */
  lookup(nombre: string, ciudad?: string): Promise<AfiliadoSegmento | null>;
}

/**
 * Si varios homónimos comparten un eje, ese eje es cierto sin importar cuál sea la persona.
 * Los que difieren se dejan vacíos: el motor tolera perfiles parciales, y así NUNCA se le
 * atribuye a alguien el dato de otro.
 */
export function segmentoComun(cands: AfiliadoSegmento[]): AfiliadoSegmento | null {
  if (!cands.length) return null;
  const igual = (k: keyof AfiliadoSegmento) =>
    cands.every((c) => c[k] === cands[0][k]) ? cands[0][k] : undefined;
  const comun: AfiliadoSegmento = {
    nombre: cands[0].nombre,
    genero: igual("genero"),
    rango_edad: igual("rango_edad"),
    categoria: igual("categoria"),
    grupo_familiar: igual("grupo_familiar"),
    poblacional: igual("poblacional"),
    ciudad: igual("ciudad"),
  };
  const hayAlgo = (["genero", "rango_edad", "categoria", "grupo_familiar", "poblacional"] as const).some(
    (k) => comun[k] !== undefined
  );
  return hayAlgo ? comun : null;
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
