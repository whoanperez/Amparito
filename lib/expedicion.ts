/**
 * Qué pasa después del "Confirmar", y cuánto tarda.
 *
 * Pedido del equipo de seguros de Colsubsidio: *"justo cuando se va a expedir se va a la
 * aseguradora principal. Ser claro en tiempos."* Hay un handoff real, con demora real, y hasta
 * ahora el producto lo resolvía con una frase de relleno ("tu certificado llegará al correo en las
 * próximas horas") que además no era cierta. Es el momento de mayor ansiedad de toda la venta.
 *
 * ⚠️ LOS TIEMPOS SON DATO, NO CÓDIGO. Los SLA reales los tiene Colsubsidio con cada aseguradora;
 * aquí no se inventan. Mientras no lleguen, se describe el PROCESO (qué pasa, quién lo hace, en qué
 * orden y qué hacer si no llega) sin afirmar horas, que ya es mucho más claro que hoy — y cuando
 * lleguen, se rellena `sla` y el copy los usa solo.
 */

export interface PasoExpedicion {
  /** "colsubsidio" o "aseguradora": el nombre real se resuelve al armar el copy. */
  quien: "colsubsidio" | "aseguradora";
  que: string;
  /** SLA real acordado con la aseguradora. `null` = todavía no lo tenemos; no se inventa. */
  sla: string | null;
}

export const PASOS_EXPEDICION: PasoExpedicion[] = [
  { quien: "colsubsidio", que: "recibe tu solicitud y valida tus datos", sla: null },
  { quien: "aseguradora", que: "estudia el riesgo y expide la póliza", sla: null },
  { quien: "aseguradora", que: "envía el certificado a tu correo", sla: null },
];

/** Frase del paso: usa el SLA si existe, y si no lo omite en vez de inventarlo. */
function frasePaso(p: PasoExpedicion, aseguradora: string): string {
  const quien = p.quien === "colsubsidio" ? "Colsubsidio" : aseguradora;
  return p.sla ? `${quien} ${p.que} (${p.sla})` : `${quien} ${p.que}`;
}

/**
 * Copy del cierre. Explícito en el proceso, honesto en que hoy es una simulación, y con la salida
 * si algo no llega — que es la pregunta que la gente de verdad se hace.
 */
export function copyCierre(aseguradora: string): string {
  const pasos = PASOS_EXPEDICION.map((p, i) => `${i + 1}) ${frasePaso(p, aseguradora)}`).join("; ");
  const conSla = PASOS_EXPEDICION.some((p) => p.sla);
  return (
    `Con esto tu solicitud queda completa 🎉\n\n` +
    `Qué pasa de aquí en adelante, para que no te quedes esperando sin saber: ${pasos}. ` +
    (conSla
      ? `Si pasado ese tiempo no te llega nada, escríbeme y lo rastreo, o te comunico con un asesor.`
      : `Si no te llega el certificado, escríbeme y lo rastreo, o te comunico con un asesor: no tienes que perseguirlo tú.`) +
    `\n\nUna aclaración importante: esto es una simulación del proceso. Hoy no se emitió ninguna ` +
    `póliza y no vas a recibir ningún correo.`
  );
}
