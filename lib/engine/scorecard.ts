/**
 * Motor de propensión (scorecard aditivo, determinista y explicable).
 *
 * Regla de oro: el MOTOR calcula, el LLM redacta. Aquí no hay LLM ni aleatoriedad:
 * dado un `Perfil`, sumamos los pesos de las señales que aplican (data/weights.json),
 * aplicamos redundancia (lo que ya tiene → anti-venta) y el gate de asequibilidad por
 * categoría, y devolvemos ranking + reason codes + descartados con razón + ledger + peer.
 */
import weightsData from "../../data/weights.json";
import { getProduct } from "../catalog";
import { lookupPeer } from "./peer";
import {
  Perfil,
  PropensionResult,
  Senal,
  ProductoWeights,
  WeightsFile,
  Recomendacion,
  Descartado,
  YaCubierto,
} from "./types";

const weights = weightsData as unknown as WeightsFile;

const MAX_RECOMENDACIONES = 2;
const MAX_DESCARTADOS = 4;
const MAX_REASON_CODES = 4;

/** Marcador interno: las señales `prior.*` (tasas base citadas) siempre aplican. */
const PRIOR = Symbol("prior");

function resolveFeature(perfil: Perfil, feature: string): unknown {
  if (feature.startsWith("enriquecido.")) {
    const k = feature.slice("enriquecido.".length);
    return perfil.enriquecido ? (perfil.enriquecido as Record<string, unknown>)[k] : undefined;
  }
  if (feature.startsWith("marca.")) {
    const k = feature.slice("marca.".length);
    return perfil.marca ? perfil.marca[k] : undefined;
  }
  if (feature.startsWith("prior.")) return PRIOR;
  return (perfil as Record<string, unknown>)[feature];
}

function senalAplica(perfil: Perfil, s: Senal): boolean {
  const val = resolveFeature(perfil, s.feature);
  if (val === PRIOR) return true;
  if (val === undefined || val === null) return false;

  if (s.en) {
    if (Array.isArray(val)) return val.some((v) => s.en!.includes(String(v)));
    return s.en.includes(String(val));
  }
  if (s.op && s.valor !== undefined) {
    const n = Number(val);
    if (Number.isNaN(n)) return false;
    switch (s.op) {
      case ">=":
        return n >= s.valor;
      case ">":
        return n > s.valor;
      case "<=":
        return n <= s.valor;
      case "<":
        return n < s.valor;
      case "==":
        return n === s.valor;
    }
  }
  if (s.es !== undefined) return val === s.es;
  return false;
}

interface Scored {
  id: string;
  w: ProductoWeights;
  score: number;
  reasons: Array<{ razon: string; peso: number }>;
  yaCubierto?: { razon: string };
}

export function calcularPropension(perfil: Perfil): PropensionResult {
  const cat = perfil.CATEGORIA ?? "";
  const gate = weights.gate_affordability[cat] ?? weights.gate_affordability["(vacío)"];
  const primaBajaPrimero = Boolean(gate?.prioriza_prima_baja);

  const scored: Scored[] = Object.entries(weights.productos).map(([id, w]) => {
    let score = 0;
    const reasons: Array<{ razon: string; peso: number }> = [];
    for (const s of w["señales"]) {
      if (senalAplica(perfil, s)) {
        score += s.peso;
        reasons.push({ razon: s.razon, peso: s.peso });
      }
    }
    let yaCubierto: { razon: string } | undefined;
    for (const r of w.redundancia ?? []) {
      if ((perfil.ya_cubierto ?? []).includes(r.si_tiene)) {
        score += r.peso;
        yaCubierto = { razon: r.razon };
      }
    }
    reasons.sort((a, b) => b.peso - a.peso);
    return { id, w, score, reasons, yaCubierto };
  });

  // Anti-venta: productos cuya redundancia disparó → salen del ranking, van al ledger.
  const yaCubiertoList: YaCubierto[] = scored
    .filter((x) => x.yaCubierto)
    .map((x) => ({ producto: getProduct(x.id)?.nombre ?? x.id, razon: x.yaCubierto!.razon }));

  const primaBase = (id: string) => getProduct(id)?.prima_regla.base ?? Number.MAX_SAFE_INTEGER;

  const ordenar = (a: Scored, b: Scored) => {
    if (b.score !== a.score) return b.score - a.score;
    // Desempate: cat A prioriza prima baja (gate de asequibilidad).
    if (primaBajaPrimero) return primaBase(a.id) - primaBase(b.id);
    return 0;
  };

  // Recomendaciones: con señal, no ya-cubierto, que cierran solas (no requieren asesoría).
  const recomendaciones: Recomendacion[] = scored
    .filter((x) => !x.yaCubierto && x.score > 0 && !x.w.requiere_asesoria)
    .sort(ordenar)
    .slice(0, MAX_RECOMENDACIONES)
    .map((x) => {
      const p = getProduct(x.id)!;
      return {
        id: x.id,
        nombre: p.nombre,
        aseguradora: p.aseguradora,
        linea: x.w.linea,
        score: x.score,
        requiere_asesoria: x.w.requiere_asesoria,
        reason_codes: x.reasons.map((r) => r.razon).slice(0, MAX_REASON_CODES),
      };
    });

  const recIds = new Set(recomendaciones.map((r) => r.id));
  const topNombre = recomendaciones[0]?.nombre;

  // Descartados: tuvieron señal pero no entraron al top → con motivo honesto.
  const descartados: Descartado[] = scored
    .filter((x) => !x.yaCubierto && x.score > 0 && !recIds.has(x.id))
    .sort(ordenar)
    .slice(0, MAX_DESCARTADOS)
    .map((x) => ({ id: x.id, nombre: getProduct(x.id)!.nombre, motivo: motivoDescarte(x, topNombre) }));

  const riesgos_hoy = recomendaciones[0]?.reason_codes ?? [];

  return {
    recomendaciones,
    descartados,
    ledger: { riesgos_hoy, ya_cubierto: yaCubiertoList },
    peer: lookupPeer(perfil),
  };
}

function motivoDescarte(x: Scored, topNombre?: string): string {
  if (x.w.requiere_asesoria) {
    return "Requiere asesoría personalizada; te conecto con un asesor si te interesa.";
  }
  if (topNombre) {
    return `Hoy tu prioridad es ${topNombre.toLowerCase()}; esto lo puedes sumar más adelante.`;
  }
  return "Menor prioridad para tu situación de hoy.";
}
