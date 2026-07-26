/**
 * Los NO honestos que el sistema puede ofrecer en este turno.
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
 *
 * El prompt dice, y es la frase que mejor describe al producto: *"En toda conversación debe
 * aparecer al menos un NO honesto"*. Es la regla que más lo define — y era la ÚNICA de las
 * propiedades del sistema que nadie verificaba. Las otras cinco tienen compuerta o gate: no
 * afirmar sin respaldo, no preguntar lo que ya se sabe, no insistir tras un no, una sola pregunta
 * por turno, no cotizar sin ingreso. Esta vivía solo en la prosa.
 *
 * ── QUÉ SE PUEDE GARANTIZAR, Y QUÉ NO ──────────────────────────────────────
 *
 * Que el modelo lo DIGA no se puede garantizar desde el servidor: son sus palabras. Lo que sí se
 * puede —y es lo que de verdad falla cuando falla— es garantizar que SIEMPRE TENGA UNO QUE DECIR.
 * Un NO honesto no se improvisa: sale de un hecho del motor. Si el sistema no le entrega ninguno,
 * el modelo solo puede callarse o inventárselo, y las dos son peores que no tener la regla.
 *
 * Así que esto enumera el material, el gate comprueba que nunca esté vacío en los tres escenarios
 * de referencia, y las palabras siguen siendo del modelo.
 */
import type { PropensionResult } from "./types";

export type TipoNo = "ya_lo_tienes" | "hoy_no_te_sirve" | "no_lo_se" | "no_te_lo_puedo_vender";

export interface NoHonesto {
  tipo: TipoNo;
  /** El hecho del motor que lo respalda. No es copy: es la razón, para que el modelo la redacte. */
  porque: string;
}

/**
 * Los cuatro NO del prompt, traducidos a hechos comprobables del resultado del motor.
 *
 * El orden importa: se listan de más fuerte a más débil, porque si hay varios el modelo debería
 * decir el que más confianza gana. "Ya lo tienes" pesa más que "no lo sé".
 */
export function nosHonestos(r: PropensionResult): NoHonesto[] {
  const nos: NoHonesto[] = [];

  // 1 · Ya lo tienes. El más fuerte: se le está quitando algo del carrito.
  for (const y of r.ledger?.ya_cubierto ?? []) {
    nos.push({ tipo: "ya_lo_tienes", porque: `${y.producto}: ${y.razon}` });
  }

  // 2 · Hoy no te sirve. La negativa completa, con su motivo.
  if (r.no_venta) {
    nos.push({ tipo: "hoy_no_te_sirve", porque: r.no_venta.motivo });
  }

  // 3 · No te lo puedo vender por aquí. Un producto con señal real que el chat no puede cerrar:
  //     es un NO concreto sobre algo que ella podría querer, no una excusa general.
  for (const d of r.descartados ?? []) {
    if (/asesor|declaraci[óo]n|estudio/i.test(d.motivo)) {
      nos.push({ tipo: "no_te_lo_puedo_vender", porque: `${d.nombre}: ${d.motivo}` });
    }
  }

  // 4 · No lo sé. El más débil pero el único disponible en el camino frío, y de los que más
  //     confianza ganan: sin los cuatro ejes verificados no hay prueba social que afirmar.
  if (!r.peer) {
    nos.push({
      tipo: "no_lo_se",
      porque:
        "no hay prueba social verificada para este perfil: no puedes afirmar cuántas personas " +
        "parecidas hay, y decir que no lo sabes es mejor que aproximarlo",
    });
  }

  return nos;
}

/** La instrucción que acompaña al material. Pide que lo diga, no le dicta cómo. */
export function instruccionDeNos(nos: NoHonesto[]): string | undefined {
  if (!nos.length) return undefined;
  return (
    "En toda conversación tiene que aparecer al menos un NO honesto, y aquí tienes de dónde " +
    "sacarlo. Dilo con TUS palabras y en el momento en que encaje — no lo recites ni lo sueltes " +
    "todo junto. Si hay varios, el primero es el que más confianza gana."
  );
}
