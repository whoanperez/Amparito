/**
 * Gate de la máquina de estados del prompt (B0).
 *   npx tsx scripts/test-prompt-estados.ts
 *
 * Lo que protege: en v3 todo el prompt viajaba en cada turno y las secciones competían — el
 * arranque caliente perdía contra el ESTADO 2 ("haz 1 a 3 micro-preguntas"). Este gate verifica
 * que cada turno reciba SOLO su bloque, y en particular que un turno RECONOCIDO no lleve encima
 * las instrucciones de descubrimiento.
 */
import { buildSystemPrompt, detectarEstado, SYSTEM_PROMPT, type Estado } from "../lib/prompts";

let ok = true;
const check = (label: string, cond: boolean) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}`);
  if (!cond) ok = false;
};

type Msg = { role: "user" | "assistant"; content: string };
const u = (content: string): Msg => ({ role: "user", content });
const a = (content: string): Msg => ({ role: "assistant", content });

/* ── 1 · detección de estado ─────────────────────────────────────────────── */
console.log("===== Detección de estado =====");
const casos: Array<[string, Estado, Msg[], boolean]> = [
  ["primer mensaje, sin identificar", "SALUDO", [u("hola")], false],
  ["primer mensaje, afiliado reconocido", "RECONOCIDO", [u("soy Carolina Ramírez")], true],
  ["varios turnos, sin identificar", "DESCUBRIENDO", [u("hola"), a("¿qué te trae?"), u("compré una moto")], false],
  ["afiliado reconocido en turno 3", "RECONOCIDO", [u("hola"), a("¿y tú?"), u("soy Carolina")], true],
];
for (const [label, esperado, msgs, afil] of casos) {
  const got = detectarEstado(msgs, { afiliadoReconocido: afil });
  check(`${label} → ${esperado}`, got === esperado);
}
// Una vez recomendó, manda ASESORANDO aunque sea afiliado
const trasReco = [u("hola"), a("RECOMENDACION: Seguro de Vida | recomendado | eres el sostén"), u("¿cuánto cuesta?")];
check("tras recomendar → ASESORANDO (incluso siendo afiliado)", detectarEstado(trasReco, { afiliadoReconocido: true }) === "ASESORANDO");

/* ── 2 · aislamiento entre estados (el criterio de aceptación) ───────────── */
console.log("\n===== Aislamiento de bloques =====");
const p = (e: Estado) => buildSystemPrompt(e);

check(
  "RECONOCIDO no trae el presupuesto de preguntas de DESCUBRIENDO",
  !p("RECONOCIDO").includes("PRESUPUESTO DE DOS PREGUNTAS")
);
check(
  "RECONOCIDO sí trae la prohibición de perfilar",
  p("RECONOCIDO").includes("PROHIBIDO hacerle preguntas de perfilamiento")
);
check(
  "DESCUBRIENDO no trae la prohibición de perfilar",
  !p("DESCUBRIENDO").includes("PROHIBIDO hacerle preguntas de perfilamiento")
);
// Ojo: la LISTA de herramientas sí vive en la base (el modelo debe saber qué tiene). Lo que no
// debe viajar es la instrucción de CUÁNDO usarlas, que es lo que competía entre estados.
check(
  "SALUDO no trae las instrucciones de cotizar ni de abrir el formulario",
  !p("SALUDO").includes("COTIZAR:") && !p("SALUDO").includes("DATOS POR FORMULARIO:")
);
check(
  "ASESORANDO sí trae cotizar, responder por el producto y formulario",
  ["COTIZAR:", "RESPONDER POR EL PRODUCTO:", "DATOS POR FORMULARIO:"].every((s) => p("ASESORANDO").includes(s))
);

/* ── 3 · lo que debe estar SIEMPRE ───────────────────────────────────────── */
console.log("\n===== Base presente en todos los estados =====");
const SIEMPRE: Array<[string, string]> = [
  ["compuerta de entrada", "COMPUERTA DE ENTRADA"],
  ["identidad", "Eres Amparito"],
  ["una sola pregunta por turno", "UNA SOLA PREGUNTA POR TURNO"],
  ["prohibición de inventar campos del perfil", "OMITE el campo"],
  ["escalamiento transversal", "ESCALAMIENTO (transversal"],
  ["casos límite", "CASOS LÍMITE"],
];
const ESTADOS_TODOS: Estado[] = ["SALUDO", "RECONOCIDO", "DESCUBRIENDO", "ASESORANDO"];
for (const [label, needle] of SIEMPRE) {
  check(label, ESTADOS_TODOS.every((e) => p(e).includes(needle)));
}

/* ── 4 · el contexto del servidor se inyecta ─────────────────────────────── */
console.log("\n===== Contexto del servidor =====");
const conCtx = buildSystemPrompt("RECONOCIDO", "## SEGMENTO VERIFICADO\nGénero = F; categoría = A.");
check("el segmento verificado entra al prompt", conCtx.includes("SEGMENTO VERIFICADO"));
check("sin contexto no aparece basura", !buildSystemPrompt("RECONOCIDO").includes("SEGMENTO VERIFICADO"));

/* ── 5 · tamaño: el objetivo era dejar de mandar todo en cada turno ──────── */
console.log("\n===== Tamaño del prompt por turno =====");
const full = SYSTEM_PROMPT.length;
for (const e of ESTADOS_TODOS) {
  const n = p(e).length;
  console.log(`   ${e.padEnd(14)} ${String(n).padStart(6)} chars  (${Math.round((n / full) * 100)}% del completo)`);
}
console.log(`   ${"completo (voz)".padEnd(14)} ${String(full).padStart(6)} chars`);
check("todos los estados pesan menos que el prompt completo", ESTADOS_TODOS.every((e) => p(e).length < full));

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
