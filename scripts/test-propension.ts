/**
 * Gate de validación del motor de propensión (Bloque 1).
 * Corre las 3 personas del guion e imprime el resultado.
 *   npx tsx scripts/test-propension.ts
 *
 * Criterios (ver docs/reto/12-build-tracker.md §Gates):
 *  - Andrés  → Vida NO recomendada (anti-venta 1); SOAT en obligatorios, NO en descartados (B4).
 *  - Carolina→ Vida #1 + peer real (F, 36-45, monoparental, A).
 *  - Jaime   → Exequial en ya_cubierto (anti-venta 2); Vida recomendada.
 *  - Todos   → ningún obligatorio puede aparecer en descartados.
 */
import { calcularPropension } from "../lib/engine/scorecard";
import { PERSONAS } from "../lib/engine/fixtures";

let ok = true;
const check = (label: string, cond: boolean) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}`);
  if (!cond) ok = false;
};

for (const [nombre, perfil] of Object.entries(PERSONAS)) {
  const r = calcularPropension(perfil);
  console.log(`\n===== ${nombre} =====`);
  console.log(
    "Recomendaciones:",
    r.recomendaciones.map((x) => `${x.nombre} (${x.score})`).join("  ·  ") || "—"
  );
  console.log("  #1 reason codes:", r.recomendaciones[0]?.reason_codes.join(" | ") || "—");
  console.log(
    "Obligatorios (ley):",
    r.obligatorios.map((x) => `${x.nombre} → ${x.consecuencia}`).join("\n                    ") || "—"
  );
  console.log("Descartados:", r.descartados.map((x) => `${x.nombre} → ${x.motivo}`).join("\n            ") || "—");
  console.log("Ya cubierto (anti-venta):", r.ledger.ya_cubierto.map((x) => `${x.producto} (${x.razon})`).join(" · ") || "—");
  console.log("Riesgos hoy:", r.ledger.riesgos_hoy.join(" | ") || "—");
  console.log(
    "Peer:",
    r.peer ? `${r.peer.n.toLocaleString("es-CO")} afiliados (${r.peer.pct}%) — ${r.peer.descripcion}` : "— (sin celda)"
  );

  const nombres = r.recomendaciones.map((x) => x.nombre);
  const tieneVida = nombres.some((n) => n === "Seguro de Vida");

  // B4 · un obligatorio por ley nunca es "menor prioridad": no puede caer en descartados
  // ni competir por un cupo del ranking.
  const oblig = new Set(r.obligatorios.map((o) => o.id));
  check(
    "ningún obligatorio en descartados ni en recomendaciones",
    !r.descartados.some((d) => oblig.has(d.id)) && !r.recomendaciones.some((x) => oblig.has(x.id))
  );

  if (nombre === "Andres") {
    check("Vida NO recomendada", !tieneVida);
    check("SOAT en obligatorios (tiene moto y no lo declara cubierto)", oblig.has("soat_mundial"));
  }
  if (nombre === "Carolina") {
    check("Vida es #1", r.recomendaciones[0]?.nombre === "Seguro de Vida");
    check("Peer real presente", !!r.peer && r.peer.n > 0);
  }
  if (nombre === "Jaime") {
    check("Exequial en ya_cubierto", r.ledger.ya_cubierto.some((x) => /exequial/i.test(x.producto)));
    check("Vida recomendada", tieneVida);
  }
}

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
