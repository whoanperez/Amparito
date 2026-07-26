/**
 * Gate de la política de espera (B13 · #32).
 *   npx tsx scripts/test-espera.ts
 *
 * POR QUÉ EXISTE. Había un piso duro de 2.200 ms en todos los turnos. Un piso no se ve en una
 * revisión de código —parece una constante inofensiva— y no se nota en una demo ensayada, porque
 * quien la ensaya ya sabe qué va a pasar. Se nota cuando alguien pregunta algo simple y espera dos
 * segundos y medio a que le contesten la ciudad.
 *
 * La política es ahora una función pura, y esto la prueba con relojes de mentira: qué pasa cuando
 * la respuesta llega rápido, cuando llega justo en el umbral y cuando llega tardísimo.
 */
import { UMBRAL_PASOS, MIN_PASOS, esperaRestante, indicadorDeEspera } from "../lib/ui/espera";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

/*
 * 1 · Un turno rápido es rápido. Esta es LA aserción: es la que da rojo si alguien vuelve a poner
 *     un piso, y es la que el código anterior no podía pasar.
 */
console.log("===== Un turno rápido no paga teatro =====");
check("respuesta a los 300 ms → 0 ms de espera añadida", esperaRestante(null, 300) === 0);
check("respuesta a los 899 ms → 0 ms (los pasos ni aparecieron)", esperaRestante(null, 899) === 0);
check("el umbral es menor que el piso viejo de 2.200 ms", UMBRAL_PASOS < 2200,
  `→ umbral ${UMBRAL_PASOS} ms`);
check("y el turno total nunca se estira a 2.200 por decreto",
  UMBRAL_PASOS + MIN_PASOS < 2200, `→ peor caso añadido: ${MIN_PASOS} ms`);

/*
 * 2 · Si los pasos alcanzaron a aparecer, no parpadean. El destello es el defecto contrario y
 *     también hay que atajarlo, o el arreglo se convierte en el bug siguiente.
 */
console.log("\n===== Si aparecieron, se leen =====");
const salieron = 1000; // el temporizador disparó a los 1000 ms
check("respuesta 100 ms después de los pasos → se completa la lectura",
  esperaRestante(salieron, salieron + 100) === MIN_PASOS - 100,
  `→ ${esperaRestante(salieron, salieron + 100)} ms`);
check("respuesta justo al cumplirse el mínimo → 0",
  esperaRestante(salieron, salieron + MIN_PASOS) === 0);
check("un turno lento no suma NADA (la espera ya se consumió sola)",
  esperaRestante(salieron, salieron + 9000) === 0);

/*
 * 3 · Un indicador, nunca dos. `busy` y `processing` eran verdaderos a la vez y se pintaban la
 *     tarjeta de pasos y el "Amparito está escribiendo…" al mismo tiempo. Se afirma que la función
 *     devuelve UNO, que es más fuerte que afirmar que no se ven los dos.
 */
console.log("\n===== Un solo indicador =====");
check("esperando sin pasos → 'escribiendo'", indicadorDeEspera(true, false) === "escribiendo");
check("con pasos → 'pasos' y nada más", indicadorDeEspera(true, true) === "pasos");
check("en reposo → ninguno", indicadorDeEspera(false, false) === null);

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
