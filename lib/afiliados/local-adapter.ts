/**
 * Adaptador local del AffiliateGateway (dev/demo en la máquina).
 * Lee un sample SINTÉTICO (data/afiliados_muestra.json, sin PII real) y busca por nombre + ciudad.
 * En el deploy se cambia por el adaptador remoto (Turso/Postgres) — mismo contrato.
 */
import muestra from "../../data/afiliados_muestra.json";
import {
  AffiliateGateway,
  AfiliadoSegmento,
  Hallazgo,
  canonSegmento,
  norm,
  segmentoComun,
} from "./gateway";

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
  async buscar(nombre: string, ciudad?: string): Promise<Hallazgo> {
    const n = norm(nombre);
    if (!n) return { estado: "no_encontrado" };

    let cands = REGISTROS.filter((r) => norm(r.nombre) === n);
    if (!cands.length) return { estado: "no_encontrado" };

    // Filtro de ciudad TOLERANTE: coincide la ciudad o el registro no la tiene. Con un filtro
    // estricto, quien dijera "Bogotá" y tuviera la ciudad vacía en la base pasaría de
    // "encontrado ambiguo" a "no encontrado" — peor resultado que no preguntar.
    if (ciudad) {
      const c = norm(ciudad);
      const conCiudad = cands.filter((r) => !norm(r.ciudad ?? "") || norm(r.ciudad) === c);
      if (conCiudad.length) cands = conCiudad;
    }

    if (cands.length === 1) return { estado: "unico", segmento: toSegmento(cands[0]) };

    const segmentos = cands.map(toSegmento);
    const comun = segmentoComun(segmentos);
    // Si todos los homónimos comparten el segmento, da lo mismo cuál sea: se puede usar.
    const todosIguales = (["genero", "rango_edad", "categoria", "grupo_familiar"] as const).every(
      (k) => segmentos.every((s) => s[k] === segmentos[0][k])
    );
    if (todosIguales) return { estado: "unico", segmento: segmentos[0] };
    return { estado: "ambiguo", n: cands.length, comun };
  }

  async lookup(nombre: string, ciudad?: string): Promise<AfiliadoSegmento | null> {
    const h = await this.buscar(nombre, ciudad);
    return h.estado === "unico" ? h.segmento : null;
  }
}

function toSegmento(r: Registro): AfiliadoSegmento {
  // El sample ya viene canónico; canonizar igual mantiene un solo contrato entre adaptadores.
  return canonSegmento({
    nombre: r.nombre,
    genero: r.genero,
    rango_edad: r.rango_edad,
    categoria: r.categoria,
    grupo_familiar: r.grupo_familiar,
    poblacional: r.poblacional,
    ciudad: r.ciudad,
  });
}
