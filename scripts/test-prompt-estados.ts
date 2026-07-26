/**
 * Gate de la máquina de estados del prompt (B0).
 *   npx tsx scripts/test-prompt-estados.ts
 *
 * Lo que protege: en v3 todo el prompt viajaba en cada turno y las secciones competían — el
 * arranque caliente perdía contra el ESTADO 2 ("haz 1 a 3 micro-preguntas"). Este gate verifica
 * que cada turno reciba SOLO su bloque, y en particular que un turno RECONOCIDO no lleve encima
 * las instrucciones de descubrimiento.
 */
import { buildSystemPrompt, bloquesDeSystem, PIEZAS, SYSTEM_PROMPT, type Estado } from "../lib/prompts";
import { toolDefinitions } from "../lib/tools";
import { estadoInicial, type EstadoConversacion } from "../lib/estado/tipos";
import { siguienteFase } from "../lib/estado/reducir";

let ok = true;
const check = (label: string, cond: boolean) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}`);
  if (!cond) ok = false;
};

/* ── 1 · la fase sale del ESTADO, no del historial ────────────────────────
   `detectarEstado` derivaba la fase de `messages.length` y de dos booleanos del navegador. Ahora
   la lleva el reducer, donde puede depender del veredicto real del motor. Los mismos casos,
   expresados sobre lo que de verdad los determina. */
console.log("===== La fase sale del estado =====");

const conEstado = (parcial: {
  turno?: number;
  reconocido?: boolean;
  veredicto?: boolean;
}): EstadoConversacion => {
  const e = estadoInicial();
  e.turno = parcial.turno ?? 1;
  if (parcial.reconocido) e.identidad.resultado = "reconocido";
  if (parcial.veredicto) {
    e.veredicto = { entregado: true, tipo: "recomendacion", recomendaciones: [], obligatorios: [], peer: null };
  }
  return e;
};

const casos: Array<[string, Estado, Parameters<typeof conEstado>[0]]> = [
  ["primer turno, sin identificar", "SALUDO", { turno: 1 }],
  ["primer turno, afiliado reconocido", "RECONOCIDO", { turno: 1, reconocido: true }],
  ["varios turnos, sin identificar", "DESCUBRIENDO", { turno: 2 }],
  ["afiliado reconocido en el turno 3", "RECONOCIDO", { turno: 3, reconocido: true }],
  // Una vez el motor se pronunció manda ASESORANDO, aunque sea afiliado. Y da igual si hubo
  // tarjetas: decir que no también es pronunciarse.
  ["tras recomendar, siendo afiliado", "ASESORANDO", { turno: 3, reconocido: true, veredicto: true }],
];
for (const [label, esperado, parcial] of casos) {
  check(`${label} → ${esperado}`, siguienteFase(conEstado(parcial)) === esperado);
}

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

/* ── 6 · el prefijo cacheable (#39) ──────────────────────────────────────── */
/*
 * Partir el system en bloques es una optimización, y una optimización que cambia lo que el modelo
 * lee no es una optimización: es un cambio de producto disfrazado. Se afirma lo contrario —que el
 * texto es IDÉNTICO— comparándolo, no prometiéndolo en un comentario.
 *
 * Y se afirma la propiedad que hace que el caching sirva de algo: el bloque marcado no puede
 * contener nada del turno. Un prefijo que cambia cada turno no se cachea nunca, por grande que sea,
 * y `cache_control` no avisa: devuelve cache_creation_input_tokens = 0 y se queda callado.
 */
console.log("\n===== El prefijo cacheable =====");
const CTX = "## SEGMENTO VERIFICADO\nGénero = F; categoría = A.";
for (const e of ESTADOS_TODOS) {
  const bloques = bloquesDeSystem(e, CTX);
  /*
   * El ORDEN, no la identidad. Comparar los bloques contra `buildSystemPrompt` sería tautológico
   * desde que ese string se DERIVA de estos bloques: pasaría siempre, incluso reordenándolo todo.
   * Lo que hay que poder afirmar es que el modelo lee las piezas en la secuencia de siempre.
   */
  const texto = bloques.map((b) => b.text).join("\n\n");
  const pos = [PIEZAS.BASE, PIEZAS.ESTADOS[e], CTX, PIEZAS.CIERRE].map((x) => texto.indexOf(x.trim()));
  check(`${e}: el modelo lee las piezas en el orden de siempre (${pos.join(" < ")})`,
    pos.every((x) => x >= 0) && pos.every((x, i) => i === 0 || x > pos[i - 1]));
  const cacheado = bloques.filter((b) => b.cache_control);
  check(`${e}: hay exactamente un punto de corte`, cacheado.length === 1);
  check(`${e}: lo cacheado NO trae nada del turno`, !cacheado[0]?.text.includes("SEGMENTO VERIFICADO"));
  // El mínimo de haiku-4-5 son 4.096 tokens. A 4 caracteres por token —el extremo conservador para
  // español— hacen falta ~16.400 caracteres SUMANDO las tools, que van antes en el prefijo.
  const chars = cacheado[0]!.text.length + JSON.stringify(toolDefinitions).length;
  check(`${e}: el prefijo supera el mínimo (${chars} chars ≈ ${Math.round(chars / 4)}–${Math.round(chars / 3)} tokens)`,
    chars >= 16_400);
}

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
