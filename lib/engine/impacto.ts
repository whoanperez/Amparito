/**
 * Calculadora de impacto de ingreso (reframe "gasto → protección").
 *
 * En vez de vender un producto, hace tangible el ingreso que la familia dejaría de recibir.
 * Mueve el foco de la pérdida desde la prima (pérdida presente) hacia el ingreso familiar —
 * el mecanismo que la evidencia conductual señala para vencer la aversión a la prima. Se enmarca
 * en CUIDADO, no en miedo. El número es una REFERENCIA transparente (income replacement): el motor
 * calcula, el LLM lo comunica con calidez y honestidad.
 */
export interface ImpactoInput {
  ingreso_mensual: number;
  anos?: number;
  dependientes?: number;
}

export interface ImpactoResult {
  ingreso_mensual: number;
  anos: number;
  dependientes?: number;
  impacto_total: number; // ingreso que la familia necesitaría reponer en el horizonte
}

const ANOS_DEFECTO = 10;

export function calcularImpacto(input: ImpactoInput): ImpactoResult {
  const ingreso = Math.max(0, Math.round(input.ingreso_mensual || 0));
  const anos = input.anos && input.anos > 0 ? Math.round(input.anos) : ANOS_DEFECTO;
  const impacto_total = ingreso * 12 * anos;
  return { ingreso_mensual: ingreso, anos, dependientes: input.dependientes, impacto_total };
}
