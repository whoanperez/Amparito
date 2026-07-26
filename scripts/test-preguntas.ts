/**
 * Gate del presupuesto de preguntas (B6).
 *   npx tsx scripts/test-preguntas.ts
 *
 * Dos piezas deterministas, porque la regla del prompt ya existía y se violó tres veces en una
 * sola conversación real:
 *  1) `contarPreguntas` — alimenta la guarda del route, que reintenta si la respuesta trae dos.
 *     El daño era real: "¿tienes vehículo, o tu vivienda es propia?" produjo un "propio" que se
 *     registró como vivienda propia y decidió la venta.
 *  2) `resumenEvidencia` — le dice al modelo qué ya le contaron, para que no repita preguntas.
 *     En la conversación real preguntó dos veces por los dependientes y dos por el uso del carro.
 */
import { contarPreguntas, esDobleCanon } from "../lib/prompts";
import { resumenEvidencia } from "../lib/engine/sanear";

let ok = true;
const check = (label: string, cond: boolean) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}`);
  if (!cond) ok = false;
};

/* ── 1 · contador de preguntas ───────────────────────────────────────────── */
console.log("===== Contador de preguntas =====");
const casos: Array<[string, number]> = [
  ["¿Tienes carro o moto?", 1],
  ["Perfecto. ¿La usas para trabajar?", 1],
  ["¿es propio o en arriendo? Además, ¿lo usas para trabajar?", 2],
  ["Listo, gracias.", 0],
  // La línea OPCIONES no cuenta: son respuestas, no preguntas
  ["¿La usas para trabajar?\nOPCIONES: Para el diario | Para trabajar | ¿De vez en cuando?", 1],
];
for (const [texto, esperado] of casos) {
  const got = contarPreguntas(texto);
  check(`${got} en "${texto.slice(0, 58)}${texto.length > 58 ? "…" : ""}"`, got === esperado);
}

/* ── 1b · doble cañón con UN solo signo ──────────────────────────────────── */
// Hallazgo de la revisión: el caso real que rompió la conversación tiene UN solo "?", así que
// contar signos no lo atrapaba. Hay que detectar el patrón: dos TEMAS en una misma pregunta.
console.log("\n===== Doble cañón (un solo signo) =====");
const dobles: Array<[string, boolean]> = [
  ["¿tienes algún vehículo (carro, moto o bici), o tu vivienda es propia o en arriendo?", true],
  ["¿tienes mascota o hijos que dependan de ti?", true],
  // Válidas: una sola pregunta, aunque tenga varias opciones o varios "o"
  ["¿Tienes carro o moto?", false],
  ["¿La usas para el diario, para trabajar, o de vez en cuando?", false],
  ["¿Y la casa donde vives es tuya o arrendada?", false],
  ["¿Alguien depende de tu ingreso?", false],
];
for (const [texto, esperado] of dobles) {
  const got = esDobleCanon(texto);
  check(`${got ? "DOBLE " : "simple"} · "${texto.slice(0, 56)}${texto.length > 56 ? "…" : ""}"`, got === esperado);
}
check(
  "la guarda SÍ se dispara con el caso real que decidió la venta",
  esDobleCanon("¿tienes algún vehículo, o tu vivienda es propia o en arriendo?")
);

/* ── 2 · resumen de evidencia (mata las preguntas repetidas) ─────────────── */
console.log("\n===== Lo que ya te contó =====");
// Textual de la conversación real, hasta el turno donde repitió la pregunta del carro.
const real = ["tengo familia, y no tengo trabajo", "no tengo ingresos", "mi esposa", "si carro"].join("\n");
const r = resumenEvidencia(real) ?? "";
console.log(r.split("\n").map((l) => "   " + l).join("\n"));
check("reconoce que ya habló del carro", r.includes("vehículo = carro"));
// Por PROPIEDAD, no por la frase: lo que importa es que el dato quede del lado de lo sabido y
// NO del lado de lo que falta. Estas dos aserciones estaban atadas a la redacción ("Ya sabes")
// y se pusieron rojas al reescribir el bloque, con la conducta intacta — que es exactamente el
// tipo de gate que este proyecto viene quitando.
check("reconoce que ya habló de quién depende de él",
  /depende de su ingreso/.test(r) && !/Falta por saber[^\n]*depende de su ingreso/.test(r));
check("sabe que falta la vivienda", r.includes("Falta por saber") && r.includes("vivienda"));
check("no da por sabida la vivienda", /Falta por saber[^\n]*vivienda/.test(r));

const vacio = resumenEvidencia("hola") ?? "";
check("con una conversación vacía dice que no sabe nada",
  /no sabes nada|no te ha contado nada/i.test(vacio));
check("sin texto no devuelve nada", resumenEvidencia("") === null);

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
