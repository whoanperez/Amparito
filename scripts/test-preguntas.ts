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
import { impactoDe } from "../lib/engine/prioridad";
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

/* ── las preguntas se ordenan por lo que deciden (B15 · 6) ────────────────── */
/*
 * En un flujo real Amparito gastó una de sus dos preguntas en "¿la bici es para pasear o para
 * competir?". Medido contra el motor: los cuatro casos, incluido no preguntar, dan el mismo
 * resultado. El prompt le pide "pregunta lo de MAYOR VALOR" y el modelo no tenía con qué saberlo:
 * los pesos viven en un JSON que él no ve.
 */
console.log("\n===== Lo que falta va ordenado por lo que decide =====");

// Sale de los pesos reales, así que no hay nada que sincronizar a mano.
check(`el vehículo es lo que más mueve el motor (${impactoDe("enriquecido.tiene_vehiculo")})`,
  impactoDe("enriquecido.tiene_vehiculo") === 50);
check("y los dependientes mueven menos que la vivienda",
  impactoDe("enriquecido.dependientes") < impactoDe("enriquecido.vivienda"));
// Lo importante: un campo que no está en ninguna regla NO decide nada, y así lo dice.
check("un campo que no aparece en ninguna regla vale cero",
  impactoDe("enriquecido.uso_de_la_bici") === 0);

const r6 = resumenEvidencia("me compré una bicicleta de montaña", undefined, { puedePreguntar: true }) ?? "";
check("el bloque dice que la lista está ordenada", /MÁS A MENOS DECISIVO/.test(r6));
const lista = (r6.match(/DECISIVO para el motor: ([^\n]+)\./) ?? [])[1] ?? "";
const pos = (t: string) => lista.indexOf(t);
check(`y la vivienda va antes que los dependientes, como dicen los pesos (${lista})`,
  pos("vivienda") >= 0 && pos("vivienda") < pos("depende"));
// De PRESENCIA: no basta con que el orden sea correcto, tiene que decirle que no pregunte fuera
// de ahí — que es lo que gastó el turno.
check("y le prohíbe preguntar lo que no está en la lista",
  /nada que no esté en esa lista/.test(r6));

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
