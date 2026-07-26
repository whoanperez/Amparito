/**
 * Gate de los cuatro NO (B7).
 *   npx tsx scripts/test-no-venta.ts
 *
 * El caso que lo motivó: en la conversación real la persona dijo "no tengo trabajo" y luego "no
 * tengo ingresos". Amparito respondió "Entiendo" y "Está bien" —dos acuses vacíos de dos palabras—
 * siguió el cuestionario, y terminó ofreciéndole productos por ~$343.300 al año.
 *
 * La decisión de no vender la toma el MOTOR, no el modelo: misma regla de oro que el resto
 * (el motor calcula, el modelo redacta).
 */
import { calcularPropension } from "../lib/engine/scorecard";
import { sanearPerfil } from "../lib/engine/sanear";
import { SYSTEM_PROMPT, buildSystemPrompt, type Estado } from "../lib/prompts";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

/* ── 1 · el motor decide no vender ───────────────────────────────────────── */
console.log("===== Sin ingreso hoy =====");
const r = calcularPropension({
  SEGMENTO_GRUPO_FAMILIAR: "Pareja conyugal",
  enriquecido: { sin_ingresos: true, tiene_vehiculo: ["carro"], dependientes: 1 },
} as never);

console.log(`   recomendaciones: ${r.recomendaciones.length}  ·  obligatorios: ${r.obligatorios.length}`);
console.log(`   no_venta: ${r.no_venta ? "sí" : "no"}`);
if (r.no_venta) {
  console.log(`     motivo: ${r.no_venta.motivo}`);
  console.log(`     alternativa: ${r.no_venta.alternativa}`);
}

// El ANCLA de toda esta sección: sin esto, las dos listas vacías de abajo pasarían igual si el
// motor se hubiera roto entero. `no_venta` presente es lo que distingue "decidió no vender" de
// "no decidió nada".
check("el motor se pronunció: hay un no_venta", !!r.no_venta, `→ ${r.no_venta?.motivo ?? "—"}`);
check("CERO productos de pago recomendados", r.recomendaciones.length === 0);
check("nada en descartados (no hay ranking que mostrar)", r.descartados.length === 0);
// La obligación legal SÍ sobrevive al "no te vendo nada", y es criterio, no inconsistencia: no
// mencionarle el SOAT a alguien que trabaja en su moto lo deja expuesto a que se la inmovilicen —
// y eso le cuesta el ingreso del día, más que la prima. Advertir es INFORMACIÓN, no vender.
console.log(`     obligatorios: ${r.obligatorios.map((o) => o.nombre).join(", ") || "—"}`);
check("la obligación legal SÍ se advierte (tiene carro y no declara SOAT)",
  r.obligatorios.some((o) => o.id === "soat_mundial"));
check("y viene con su consecuencia real", /inmoviliz/i.test(r.obligatorios[0]?.consecuencia ?? ""));
check("el motor devuelve no_venta con motivo", !!r.no_venta?.motivo);
check("ofrece lo que la CAJA sí tiene",
  /subsidio al desempleo/i.test(r.no_venta?.alternativa ?? "") &&
  /agencia de empleo/i.test(r.no_venta?.alternativa ?? ""));
check("sin prueba social", r.peer === null);

/* ── 2 · sin la señal, el flujo es el normal ─────────────────────────────── */
console.log("\n===== Con ingreso (control) =====");
const c = calcularPropension({
  SEGMENTO_GRUPO_FAMILIAR: "Pareja conyugal",
  enriquecido: { tiene_vehiculo: ["carro"], dependientes: 1 },
} as never);
check("sí recomienda cuando no hay señal de falta de ingreso", c.recomendaciones.length > 0);
check("no aparece no_venta", c.no_venta === undefined);

/* ── 3 · la señal pasa la compuerta de entrada ───────────────────────────── */
console.log("\n===== sin_ingresos atraviesa sanearPerfil =====");
const s = sanearPerfil(
  { enriquecido: { sin_ingresos: true } },
  { textoUsuario: "tengo familia, y no tengo trabajo\nno tengo ingresos" }
);
check("la señal sobrevive el saneamiento", s.perfil.enriquecido?.sin_ingresos === true);
check("y el motor la honra", calcularPropension(s.perfil).no_venta !== undefined);
check("sin vehículo declarado no hay obligación que advertir",
  calcularPropension(s.perfil).obligatorios.length === 0);

/* ── 4 · las reglas viven en el prompt, en todos los estados ─────────────── */
console.log("\n===== Reglas presentes en el prompt =====");
const ESTADOS: Estado[] = ["SALUDO", "RECONOCIDO", "DESCUBRIENDO", "ASESORANDO"];
const enTodos = (needle: string) => ESTADOS.every((e) => buildSystemPrompt(e).includes(needle));
check("empatía recuperada de v2 (parar el cuestionario)", enTodos("PARA el cuestionario"));
check('"Entiendo" no cuenta como reconocer', enTodos("son despachar"));
check("los cuatro NO están enumerados", enTodos("LOS CUATRO NO"));
check("el caso sin ingreso está en casos límite", enTodos("SIN INGRESO HOY"));
check("el NO legal (asegurar a un tercero)", enTodos("ASEGURAR A OTRA PERSONA"));
check("la voz también los lleva", SYSTEM_PROMPT.includes("LOS CUATRO NO"));

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
