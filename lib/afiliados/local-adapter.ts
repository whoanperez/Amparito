/**
 * Adaptador local del AffiliateGateway (dev/demo en la máquina).
 * Lee un sample SINTÉTICO (data/afiliados_muestra.json, sin PII real) y busca por nombre + ciudad.
 * En el deploy se cambia por el adaptador remoto (Turso/Postgres) — mismo contrato.
 */
import muestra from "../../data/afiliados_muestra.json";
import { AffiliateGateway, AfiliadoSegmento, norm } from "./gateway";

interface Registro {
  nombre: string;
  ciudad: string;
  genero?: string;
  rango_edad?: string;
  categoria?: string;
  grupo_familiar?: string;
  poblacional?: string;
}

const REGISTROS = muestra as Registro[];

export class LocalAffiliateAdapter implements AffiliateGateway {
  async lookup(nombre: string, ciudad?: string): Promise<AfiliadoSegmento | null> {
    const n = norm(nombre);
    if (!n) return null;
    const c = ciudad ? norm(ciudad) : undefined;
    // Coincidencia exacta por nombre; si hay ciudad, desempata (los nombres se repiten).
    const porNombre = REGISTROS.filter((r) => norm(r.nombre) === n);
    const elegido = (c ? porNombre.find((r) => norm(r.ciudad) === c) : undefined) ?? porNombre[0] ?? null;
    return elegido ? toSegmento(elegido) : null;
  }
}

function toSegmento(r: Registro): AfiliadoSegmento {
  return {
    nombre: r.nombre,
    genero: r.genero,
    rango_edad: r.rango_edad,
    categoria: r.categoria,
    grupo_familiar: r.grupo_familiar,
    poblacional: r.poblacional,
    ciudad: r.ciudad,
  };
}
