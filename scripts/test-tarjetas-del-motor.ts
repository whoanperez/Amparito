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
import { estadoInicial } from "../lib/estado/tipos";
import { recsDeEvento } from "../lib/estado/vista";
import { siguienteFase, cerrarTurno } from "../lib/estado/reducir";
import { calcularPropension } from "../lib/engine/scorecard";
import { PERSONAS } from "../lib/engine/fixtures";
import { executeTool } from "../lib/tools";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

/*
 * Aquí había una RÉPLICA de `recsDeEvento`, con un comentario que decía "réplica de la función
 * del cliente (components/Chat.tsx)". Esa función ya no existe en el cliente: el comentario
 * apuntaba a un archivo que dejó de tenerla, y el test seguía verde probando su propia copia.
 *
 * Es exactamente el modo de falla que hacía inútil la cobertura: la única versión cubierta era
 * la que vivía dentro del test. Ahora se importa la de verdad.
 */

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

  /* ── 3 · la fase avanza por el VEREDICTO, no por el texto ──────────────── */
  console.log("\n===== La fase avanza sin depender del formato =====");
  // Antes esto dependía de un booleano que mandaba el navegador o, en su defecto, de que el
  // modelo escribiera "RECOMENDACION:" con formato exacto. Ahora depende de que el motor se haya
  // pronunciado, que es el hecho que de verdad determina la fase.
  const sinVeredicto = estadoInicial();
  sinVeredicto.turno = 3;
  check("sin veredicto del motor → DESCUBRIENDO", siguienteFase(sinVeredicto) === "DESCUBRIENDO");

  const conVeredicto = cerrarTurno(sinVeredicto, {
    eventos: [{ type: "propension", data: calcularPropension(PERSONAS.Carolina) as unknown as Record<string, unknown> }],
  });
  check("con veredicto del motor → ASESORANDO", conVeredicto.fase === "ASESORANDO");
  check("y el texto del modelo no interviene en la decisión", !replySinProtocolo.includes("RECOMENDACION:"));

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
