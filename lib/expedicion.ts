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

/**
 * El sello de simulación, en UN solo sitio.
 *
 * POR QUÉ EXISTE AQUÍ. El sello es la pieza que los tres revisores señalan como bien hecha —y era
 * la única que el producto se desmentía a sí mismo—: la tarjeta decía "no vas a recibir ningún
 * correo" y el video, dos centímetros más abajo, prometía "certificado digital a tu correo en pocas
 * horas". Eso no es un descuido de copy. Un producto que se contradice en la misma pantalla no daña
 * solo ese texto: daña TODO lo demás que afirma, incluida la traza que le pide al jurado que crea.
 *
 * El texto estaba escrito dos veces (aquí y dentro de la tarjeta) y las dos copias no tenían forma
 * de saber la una de la otra. Ahora hay una fuente, y un predicado que el gate puede correr sobre
 * cualquier superficie nueva.
 */
export const AVISO_SIMULACION =
  "Esto es una simulación del proceso completo. Hoy no se emitió ninguna póliza y no vas a " +
  "recibir ningún correo.";

/** Lo que una superficie promete cuando habla de la entrega. */
const PROMETE_ENTREGA = /correo|certificad|póliza (activa|emitida)|qued\w*\s+asegurad/i;

/** La marca del sello: decir que esto es simulado, en cualquiera de sus formas. */
const LLEVA_SELLO = /simulaci[óo]n|simulad|no se emiti[óo]|ning[úu]n correo/i;

/**
 * ¿Esta superficie promete algo de la entrega SIN cargar el sello?
 *
 * No prohíbe hablar del correo —el proceso real lo incluye y callarlo sería peor: es justo la
 * pregunta que la gente se hace—. Prohíbe prometerlo sin decir en la misma superficie que hoy no
 * pasa. El sello viaja con la promesa o la promesa no va.
 */
export function contradiceElSello(texto: string): boolean {
  if (LLEVA_SELLO.test(texto)) return false;
  // Una PREGUNTA no promete nada. "¿Te gustaría quedar asegurada?" es una oferta, y tratarla como
  // promesa incumplida obligaría a escribir peor para complacer al predicado. Apareció al correr
  // esto sobre los guiones del demo, que sí conversan; el copy estático no tenía preguntas.
  return texto
    .split(/(?<=[.?!\n])\s+|\s+(?=[¿¡])/)
    .some((o) => !/[¿?]/.test(o) && PROMETE_ENTREGA.test(o));
}

/**
 * ¿Esta superficie inventa un tiempo?
 *
 * Los SLA son dato y hoy son `null` (ver el aviso de arriba). El copy del cierre ya respetaba esa
 * regla; el video la rompía por su cuenta con un "en pocas horas" que nadie acordó con ninguna
 * aseguradora. Con el predicado aquí, la regla deja de vivir en un comentario.
 */
export function inventaTiempos(texto: string): boolean {
  if (PASOS_EXPEDICION.some((p) => p.sla)) return false; // ya hay SLA real: hablar de tiempos es legítimo
  return /\b(en|dentro de)\s+(pocas?|pocos?|unas?|unos?|\d+)\s*(horas?|minutos?|d[íi]as?|semanas?)/i.test(texto);
}

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
    `\n\nUna aclaración importante: ${AVISO_SIMULACION.charAt(0).toLowerCase()}${AVISO_SIMULACION.slice(1)}`
  );
}
