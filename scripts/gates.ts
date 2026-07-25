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
  "test-auditoria.ts",
  "test-tarjetas-del-motor.ts",
  "test-primer-toque.ts",
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
    salida = execFileSync("npx", ["tsx", `scripts/${suite}`], { encoding: "utf8", env: process.env });
  } catch (err) {
    ok = false;
    const e = err as { stdout?: string; stderr?: string };
    salida = `${e.stdout ?? ""}${e.stderr ?? ""}`;
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
  `${rotas.length ? "❌" : "✅"} ${resultados.length} suites · ${checks} checks · ${fallos} fallos` +
    `${rotas.length ? ` · rotas: ${rotas.map((r) => r.suite).join(", ")}` : ""}`
);
console.log(`   base: ${conBase ? "TURSO" : "sample sintético"}`);
process.exit(rotas.length ? 1 : 0);
