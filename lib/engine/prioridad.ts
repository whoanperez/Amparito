/**
 * Qué preguntas mueven el motor, y cuáles no deciden nada.
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
 *
 * En un flujo real, Amparito gastó la primera de sus dos preguntas en esto:
 *
 *     "¿la bici la usas para pasear, para ir al trabajo, o para competir?"
 *
 * Medido contra el motor: los cuatro casos —incluido no preguntar— dan exactamente el mismo
 * resultado. Un turno entero gastado en una pregunta que no decidió nada, con un presupuesto de
 * dos.
 *
 * El prompt le pide "pregunta lo de MAYOR VALOR", pero el modelo NO TIENE FORMA DE SABER cuál es:
 * eso vive en `data/weights.json`, que él no ve. Se le estaba pidiendo una decisión sin darle el
 * dato con el que se toma.
 *
 * Aquí sale de los pesos reales, así que se mantiene solo: si mañana una señal cambia de peso, el
 * orden de las preguntas cambia con ella. Nada que sincronizar a mano — que es exactamente como se
 * rompieron el vocabulario, las tres listas de términos y los guiones del demo.
 */
import weightsData from "../../data/weights.json";

interface SenalPeso {
  feature: string;
  peso?: number;
}

/**
 * El peso máximo que puede aportar cada campo, en cualquier producto del catálogo.
 *
 * Se usa el MÁXIMO y no la suma: la pregunta se hace una vez, y lo que importa es cuánto puede
 * cambiar el ranking en el mejor caso — no a cuántos productos toca de refilón.
 */
function calcularImpactos(): Record<string, number> {
  const productos =
    (weightsData as unknown as { productos?: Record<string, { señales?: SenalPeso[] }> }).productos ?? {};
  const m: Record<string, number> = {};
  for (const p of Object.values(productos)) {
    for (const s of p.señales ?? []) {
      const peso = Math.abs(s.peso ?? 0);
      if (peso > (m[s.feature] ?? 0)) m[s.feature] = peso;
    }
  }
  return m;
}

const IMPACTOS = calcularImpactos();

/** Cuánto puede mover este campo. Cero si no aparece en ninguna regla: no decide nada. */
export function impactoDe(feature: string): number {
  return IMPACTOS[feature] ?? 0;
}

/**
 * Ordena campos pendientes de más a menos decisivo.
 *
 * Estable: a igual impacto se conserva el orden de entrada, para que la lista no baile entre
 * turnos y el modelo no vea un orden distinto cada vez sin motivo.
 */
export function ordenarPorImpacto<T>(items: T[], featureDe: (x: T) => string): T[] {
  return items
    .map((x, i) => ({ x, i, p: impactoDe(featureDe(x)) }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map((e) => e.x);
}
