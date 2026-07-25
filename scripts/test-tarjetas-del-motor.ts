/**
 * Gate de la frontera LLM / servidor (B13).
 *   npx tsx scripts/test-tarjetas-del-motor.ts
 *
 * POR QUÉ EXISTE. La frontera estaba en el lugar equivocado: al modelo se le controlaba CÓMO
 * escribe, no solo qué puede afirmar. Para que aparecieran las tarjetas seleccionables tenía que
 * emitir un protocolo en medio de su prosa:
 *
 *     RECOMENDACION: Seguro de Vida | recomendado | Eres el sostén de un hogar monoparental
 *
 * Pero el evento del motor YA trae nombre, orden y reason codes. Le pedíamos al LLM que transcribiera
 * datos que el servidor tenía, y de eso dependían DOS cosas: que se pintaran las tarjetas y que la
 * máquina de estados avanzara. Una tilde en "RECOMENDACIÓN:" dejaba el sistema mudo y sin salida de
 * DESCUBRIENDO.
 *
 * Ahora el servidor serializa y el LLM conversa.
 */
import { detectarEstado } from "../lib/prompts";
import { calcularPropension } from "../lib/engine/scorecard";
import { PERSONAS } from "../lib/engine/fixtures";
import { executeTool } from "../lib/tools";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

/** Réplica de la función del cliente (components/Chat.tsx · recsDeEvento). */
function recsDeEvento(data: Record<string, unknown>) {
  const recs = (data?.recomendaciones ?? []) as Array<{ nombre: string; reason_codes?: string[] }>;
  return recs.map((r, i) => ({ nombre: r.nombre, recomendado: i === 0, razon: r.reason_codes?.[0] ?? "" }));
}

async function main() {
  /* ── 1 · las tarjetas salen del evento ─────────────────────────────────── */
  console.log("===== Las tarjetas salen del motor, no del texto =====");
  const { event } = await executeTool("calcular_propension", { perfil: PERSONAS.Carolina });
  const recs = recsDeEvento(event!.data);

  console.log("   tarjetas:", recs.map((r) => `${r.recomendado ? "★ " : ""}${r.nombre}`).join("  ·  "));
  check("hay tarjetas seleccionables", recs.length > 0);
  check("la primera está marcada como recomendada", recs[0]?.recomendado === true);
  check("cada una trae su razón del motor", recs.every((r) => r.razon.length > 0));

  // El nombre no puede diferir del catálogo: sale del motor, no de una transcripción.
  const delMotor = calcularPropension(PERSONAS.Carolina).recomendaciones.map((x) => x.nombre);
  check("los nombres coinciden EXACTO con el motor", recs.map((r) => r.nombre).join("|") === delMotor.join("|"),
    `→ ${delMotor.join(", ")}`);

  /* ── 2 · el modelo no necesita escribir nada ───────────────────────────── */
  console.log("\n===== Sin protocolo en el texto también funciona =====");
  // Antes, esta respuesta habría producido CERO tarjetas y la conversación se habría quedado
  // atascada en DESCUBRIENDO para siempre.
  const replySinProtocolo =
    "Carolina, por lo que me cuentas lo que más te protege hoy es tu propio ingreso: si te faltas, " +
    "nadie más lo cubre en tu casa. Míralo abajo con calma.";
  check("el texto del modelo no contiene el marcador", !replySinProtocolo.includes("RECOMENDACION:"));
  check("y las tarjetas igual existen (vienen del evento)", recs.length > 0);

  /* ── 3 · el estado avanza por la señal del cliente, no por el texto ────── */
  console.log("\n===== El estado avanza sin depender del formato =====");
  const hist = [
    { role: "user" as const, content: "Soy Carolina Ramírez López" },
    { role: "assistant" as const, content: replySinProtocolo },
    { role: "user" as const, content: "¿y eso qué cubre?" },
  ];
  check("con la señal del cliente → ASESORANDO",
    detectarEstado(hist, { yaRecomendo: true }) === "ASESORANDO");
  check("sin la señal y sin marcador se queda en DESCUBRIENDO (por eso hacía falta)",
    detectarEstado(hist) === "DESCUBRIENDO");
  // Respaldo: si el modelo escribe el marcador por costumbre, sigue sirviendo.
  const conMarcador = [...hist.slice(0, 1), { role: "assistant" as const, content: "RECOMENDACION: Seguro de Vida | recomendado | x" }];
  check("el marcador sigue funcionando como respaldo",
    detectarEstado(conMarcador) === "ASESORANDO");

  /* ── 4 · el prompt ya no le pide serializar ────────────────────────────── */
  console.log("\n===== El prompt liberó el formato =====");
  const { buildSystemPrompt } = await import("../lib/prompts");
  const p = buildSystemPrompt("DESCUBRIENDO");
  check("ya no exige el formato EXACTO de RECOMENDACION", !p.includes("formato EXACTO"));
  check("le dice que las tarjetas las pinta el sistema", p.includes("LAS TARJETAS LAS PINTA EL SISTEMA"));
  check("y que escriba libre", p.includes("escribe LIBRE"));
  // Lo que NO se soltó: la prohibición de inventar sigue intacta.
  check("sigue prohibido inventar razones", p.includes("nunca inventes una razón nueva"));
  check("y sigue prohibido inventar campos del perfil", p.includes("OMITE el campo"));

  console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
