/**
 * Runner de los gates.
 *   npm run gates
 *
 * POR QUÉ EXISTE. Antes eran catorce `npx tsx` encadenados con `&&`, y eso tenía tres problemas
 * que se tapaban entre sí:
 *
 *   1 · `.env.local` NUNCA se cargaba. No hay dotenv en el repo y los scripts no lo leen, así que
 *       las cuatro suites que tocan la base corrían siempre contra el sample sintético de seis
 *       registros. El camino de PRODUCCIÓN —canonización de etiquetas crudas, homónimos, filtro
 *       tolerante de ciudad— tenía cero cobertura, y nada lo decía.
 *   2 · El `&&` CORTA en el primer fallo. Un rojo en la primera suite escondía el estado de las
 *       otras trece, así que arreglar cosas era un juego de destapar una a una.
 *   3 · Cada `npx` resuelve `tsx` desde la caché o lo descarga: en una máquina limpia, los gates
 *       dependen de la red. Ahora `tsx` es una devDependency de verdad.
 *
 * Y dice EN QUÉ MODO corrió. Un gate verde contra seis registros sintéticos no significa lo mismo
 * que uno verde contra la base; callarlo era la mitad del problema.
 */
import { execFileSync } from "node:child_process";
import { cargarEnvLocal } from "./_env";

const SUITES = [
  "test-estado.ts",
  "test-orquestador.ts",
  "test-validador.ts",
  "test-sanear.ts",
  "test-propension.ts",
  "test-prompt-estados.ts",
  "test-preguntas.ts",
  "test-no-venta.ts",
  "test-los-cuatro-no.ts",
  "test-auditoria.ts",
  "test-tarjetas-del-motor.ts",
  "test-primer-toque.ts",
  "test-sello.ts",
  "test-pago.ts",
  "test-espera.ts",
  "test-traza.ts",
  "test-vocabulario.ts",
  "test-offline.ts",
  "test-identidad.ts",
  "check-afiliados.ts",
  "eval-conversacion.ts",
];

const hayEnv = cargarEnvLocal();
const conBase = !!process.env.TURSO_DATABASE_URL;

console.log(`Gates de Amparito`);
console.log(`  .env.local ....... ${hayEnv ? "cargado" : "no existe"}`);
console.log(`  base ............. ${conBase ? "TURSO (base completa)" : "sample sintético de 6"}`);
if (!conBase) {
  console.log(`  ⚠️  Las suites de identidad corren DEGRADADAS: el camino de producción`);
  console.log(`      (canonización, homónimos, filtro de ciudad) no se está ejercitando.`);
}
console.log();

/*
 * PRIMERO los tipos. `tsx` borra los tipos sin comprobarlos, así que hasta ahora un error de
 * TypeScript pasaba por los gates en verde: lo único que lo detectaba era `npx tsc` a mano o el
 * `next build`, y ninguno de los dos está en este camino. Un gate que no ve una clase entera de
 * error da una confianza que no corresponde.
 */
let tiposOk = true;
try {
  execFileSync("npx", ["tsc", "--noEmit"], { encoding: "utf8", env: process.env });
  console.log("✅ tipos (tsc --noEmit)");
} catch (err) {
  tiposOk = false;
  const e = err as { stdout?: string };
  console.log("❌ tipos (tsc --noEmit)");
  console.log((e.stdout ?? "").split("\n").slice(0, 12).join("\n"));
}

interface Resultado {
  suite: string;
  ok: boolean;
  checks: number;
  fallos: number;
  salida: string;
}

const resultados: Resultado[] = [];

for (const suite of SUITES) {
  let salida = "";
  let ok = true;
  try {
    // Con timeout: una suite COLGADA es peor que una que falla, porque no da ninguna señal —
    // se queda esperando para siempre y quien mira la consola no sabe si avanza o murió. Las
    // suites que tocan la base pueden quedarse esperando una conexión que no llega.
    salida = execFileSync("npx", ["tsx", `scripts/${suite}`], {
      encoding: "utf8",
      env: process.env,
      timeout: 120_000,
    });
  } catch (err) {
    ok = false;
    const e = err as { stdout?: string; stderr?: string; signal?: string };
    salida = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    if (e.signal === "SIGTERM") salida += "\n   ❌ la suite se colgó (más de 120 s)";
  }
  // Solo las líneas de ASERCIÓN (van indentadas). Las de resumen —"❌ GATE FALLÓ"— también
  // llevan el símbolo, y contarlas inflaba el número de fallos: un gate que informa mal de
  // cuántas cosas se rompieron es un gate en el que no se confía.
  const lineas = salida.split("\n").filter((l) => /^\s+[✅❌]/.test(l));
  const checks = lineas.filter((l) => l.includes("✅")).length;
  const fallos = lineas.filter((l) => l.includes("❌")).length;
  resultados.push({ suite, ok: ok && fallos === 0, checks, fallos, salida });
  const marca = ok && fallos === 0 ? "✅" : "❌";
  console.log(`${marca} ${suite.padEnd(28)} ${String(checks).padStart(4)} checks${fallos ? `  ${fallos} FALLOS` : ""}`);
}

// El detalle solo de lo que falló: el resto ya se resumió arriba. NO se corta en el primero.
const rotas = resultados.filter((r) => !r.ok);
for (const r of rotas) {
  console.log(`\n${"─".repeat(70)}\n### ${r.suite}\n`);
  console.log(
    r.salida
      .split("\n")
      .filter((l) => l.includes("❌") || l.includes("=====") || l.startsWith("ERROR"))
      .join("\n")
  );
}

const checks = resultados.reduce((a, r) => a + r.checks, 0);
const fallos = resultados.reduce((a, r) => a + r.fallos, 0);
console.log(`\n${"─".repeat(70)}`);
console.log(
  `${rotas.length || !tiposOk ? "❌" : "✅"} ${resultados.length} suites · ${checks} checks · ${fallos} fallos` +
    `${tiposOk ? "" : " · TIPOS ROTOS"}` +
    `${rotas.length ? ` · rotas: ${rotas.map((r) => r.suite).join(", ")}` : ""}`
);
console.log(`   base: ${conBase ? "TURSO" : "sample sintético"}`);

/*
 * LO QUE ESTOS GATES NO CUBREN, dicho aquí y no en un aviso enterrado a mitad del log.
 *
 * El eval imprimía una advertencia sobre la redacción del modelo como su penúltima línea, entre
 * cientos de ✅, y salía con código 0. Quien lo leía deprisa se llevaba la impresión contraria a
 * la verdad: que el gate había cubierto algo que ni siquiera intenta.
 *
 * Un hueco conocido y visible es deuda; uno escondido bajo un verde es una trampa.
 */
console.log(`\nNO cubierto por estos gates:`);
console.log(`   · La REDACCIÓN del modelo. Todo esto es determinista: que respete el copy, que no`);
console.log(`     invente coberturas y que suene humano solo se ve corriendo el demo con la key.`);
if (!process.env.ANTHROPIC_API_KEY) {
  console.log(`     (ANTHROPIC_API_KEY no está definida en este entorno.)`);
}
console.log(`   · La conversación de punta a punta contra el modelo real.`);

process.exit(rotas.length || !tiposOk ? 1 : 0);
