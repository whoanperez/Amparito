/**
 * La política de espera, fuera del componente y con gate.
 *
 * QUÉ TENÍA MAL (#32). Había un piso duro de 2.200 ms en TODOS los turnos. Se puso para cubrir la
 * latencia con los pasos del motor —y para eso funciona—, pero cobra en el turno equivocado:
 *
 * 1 · Un turno donde Amparito solo pregunta "¿en qué ciudad estás?" no ejecuta el motor. Ahí los
 *     pasos ("viendo qué te protege de verdad…", "ordenando por lo que más te cuida…") narran un
 *     trabajo que no ocurrió, y encima cuestan 2,2 s. Es la misma falta del video: contar en
 *     presente algo que no pasó, solo que aquí además se paga en segundos.
 *
 * 2 · Si la respuesta llegaba en 700 ms, el producto se hacía el lento a propósito. Pagar latencia
 *     real para PARECER una máquina que trabaja es exactamente al revés de lo que este producto
 *     dice de sí mismo.
 *
 * LA REGLA NUEVA: la espera no se decreta, se descubre. Los pasos aparecen solo si el turno de
 * verdad se está demorando; si aparecieron, se quedan lo justo para no parpadear. Un turno rápido
 * es rápido y no muestra teatro; uno lento —que en este sistema es justo el que llama tools y corre
 * el motor— lo muestra completo.
 *
 * LO QUE ESTO NO ARREGLA, dicho de frente: un turno lento que NO ejecuta el motor sigue mostrando
 * los pasos del motor. El cliente no puede saberlo antes de que llegue la respuesta, y saberlo
 * después no sirve. Lo que sí cambia es cuántas veces pasa: antes era en todos los turnos por
 * definición, ahora solo en los que de verdad se demoran — que en esta arquitectura son los que
 * corren el loop de tools. Cerrarlo del todo pide que el servidor anuncie por adelantado qué va a
 * hacer, y eso es otro contrato.
 *
 * Funciones puras: el reloj entra por parámetro para que el gate no dependa del reloj de nadie.
 */

/** Antes de esto no se muestran los pasos: un turno rápido no necesita explicar que está pensando. */
export const UMBRAL_PASOS = 900;

/** Si los pasos ya aparecieron, se quedan al menos esto. Un destello es peor que un momento. */
export const MIN_PASOS = 700;

/**
 * Cuánto falta esperar cuando ya llegó la respuesta.
 *
 * `desde` = instante en que aparecieron los pasos, o `null` si nunca aparecieron.
 * Devuelve 0 —no un piso— cuando no hay nada que evitar.
 */
export function esperaRestante(desde: number | null, ahora: number): number {
  if (desde === null) return 0;
  return Math.max(0, MIN_PASOS - (ahora - desde));
}

/**
 * Qué indicador se pinta. Uno, o ninguno.
 *
 * Antes `busy` y `processing` eran verdaderos a la vez y se veían SIMULTÁNEAMENTE la tarjeta de
 * pasos y el "Amparito está escribiendo…". Dos indicadores de la misma espera se leen como dos
 * esperas — o como un defecto, que es lo que era.
 */
export function indicadorDeEspera(
  busy: boolean,
  procesando: boolean
): "pasos" | "escribiendo" | null {
  if (procesando) return "pasos";
  return busy ? "escribiendo" : null;
}
