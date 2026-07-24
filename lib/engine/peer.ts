/**
 * Prueba social peer-group (PeerProof) — honesta y trazable a la base.
 *
 * La base NO tiene etiqueta de compra, así que NUNCA afirmamos "X de cada 10 compraron…".
 * Lo que sí es real: el tamaño del segmento del afiliado. Devolvemos {n, pct, descripcion}
 * del peer-group (GENERO × RANGO_EDAD × SEGMENTO_GRUPO_FAMILIAR × CATEGORIA) para vencer la
 * autoexclusión con un dato verdadero ("hay N afiliadas como tú").
 */
import baseStats from "../../data/base_stats.json";
import { Perfil, Peer } from "./types";

interface Celda {
  grupo: Record<string, string>;
  n: number;
  pct: number;
}

const peerGroups = (baseStats as unknown as {
  peer_groups: { ejes: string[]; celdas: Celda[] };
}).peer_groups;

const EJES = peerGroups.ejes;
const CELDAS = peerGroups.celdas;

export function lookupPeer(perfil: Perfil): Peer | null {
  const clave: Record<string, string | undefined> = {
    GENERO: perfil.GENERO,
    RANGO_EDAD: perfil.RANGO_EDAD,
    SEGMENTO_GRUPO_FAMILIAR: perfil.SEGMENTO_GRUPO_FAMILIAR,
    CATEGORIA: perfil.CATEGORIA,
  };
  // Necesitamos los 4 ejes para ubicar la celda; si falta alguno, no afirmamos nada.
  if (EJES.some((e) => !clave[e])) return null;

  const celda = CELDAS.find((c) => EJES.every((e) => c.grupo[e] === clave[e]));
  if (!celda) return null;

  return { descripcion: describir(perfil), n: celda.n, pct: celda.pct };
}

function describir(perfil: Perfil): string {
  const genero = perfil.GENERO === "F" ? "mujeres" : perfil.GENERO === "M" ? "hombres" : "personas";
  const edad = perfil.RANGO_EDAD ? perfil.RANGO_EDAD.replace(" años", "") : "";
  const fam = (perfil.SEGMENTO_GRUPO_FAMILIAR ?? "").toLowerCase();
  const cat = perfil.CATEGORIA ? `categoría ${perfil.CATEGORIA}` : "";
  return [genero, edad, fam, cat].filter(Boolean).join(", ");
}
