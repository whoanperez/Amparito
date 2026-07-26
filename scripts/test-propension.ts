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
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

type Resultado = ReturnType<typeof calcularPropension>;
type Contexto = { tieneVida: boolean; oblig: Set<string> };

/** Qué debe cumplir cada persona del fixture. Fuera del bucle para que no se pueda saltar. */
const EXPECTATIVAS: Record<string, (r: Resultado, c: Contexto) => void> = {
  Andres: (r, c) => {
    check("Andrés · Vida NO recomendada", !c.tieneVida);
    check("Andrés · SOAT en obligatorios (tiene moto y no lo declara cubierto)", c.oblig.has("soat_mundial"));
  },
  Carolina: (r) => {
    check("Carolina · Vida es #1", r.recomendaciones[0]?.nombre === "Seguro de Vida");
    check("Carolina · peer real presente", !!r.peer && r.peer.n > 0);
  },
  Jaime: (r, c) => {
    check("Jaime · Exequial en ya_cubierto", r.ledger.ya_cubierto.some((x) => /exequial/i.test(x.producto)));
    check("Jaime · Vida recomendada", c.tieneVida);
  },
};
const ejercitadas = new Set<string>();

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

  /*
   * Las expectativas de cada persona estaban dentro de `if (nombre === "Andres")`. Renombrar una
   * clave del fixture —o borrarla— saltaba el bloque entero en SILENCIO y el gate salía verde sin
   * haber comprobado nada de esa persona. Si `PERSONAS` quedara vacío, el bucle no ejecutaba ni
   * una aserción.
   *
   * Ahora las expectativas son una tabla, y abajo se verifica que las TRES se hayan ejercitado.
   */
  const esperado = EXPECTATIVAS[nombre];
  check(`hay expectativas definidas para ${nombre}`, !!esperado);
  if (esperado) {
    esperado(r, { tieneVida, oblig });
    ejercitadas.add(nombre);
  }
}

check(
  `se ejercitaron las ${Object.keys(EXPECTATIVAS).length} personas del fixture`,
  ejercitadas.size === Object.keys(EXPECTATIVAS).length,
  `→ ${Array.from(ejercitadas).join(", ") || "ninguna"}`
);

// Jerarquía de protección: quien sostiene a otros no puede recibir un seguro de mascotas por
// encima del de vida, aunque el score de Mascotas sea mayor. Y a quien NO sostiene a nadie, la
// jerarquía no le debe aplicar (si no, Vida volvería a colarse y rompería el anti-venta 1).
console.log("\n===== Jerarquía de protección =====");
{
  const conPerro = calcularPropension({ ...PERSONAS.Carolina, enriquecido: { ...PERSONAS.Carolina.enriquecido, tiene_mascota: ["perro"] } });
  console.log("Carolina + perro:", conPerro.recomendaciones.map((x) => `${x.nombre} (${x.score})`).join("  ·  "));
  check("Vida sigue siendo #1 con mascota declarada", conPerro.recomendaciones[0]?.nombre === "Seguro de Vida");
  check("Mascotas se sigue ofreciendo (no se elimina)", conPerro.recomendaciones.some((x) => /mascotas/i.test(x.nombre)));

  // Explicabilidad (B8): cuando la jerarquía mueve el orden contra el puntaje, se dice en pantalla.
  // Con el fixture completo Vida gana por puntaje (80) y la nota NO debe aparecer; con solo los
  // ejes de la base, Vida (55) queda sobre Mascotas (57) y entonces SÍ hay que explicarlo.
  const soloBase = calcularPropension({
    GENERO: "F", RANGO_EDAD: "36 a 45 años", CATEGORIA: "A",
    SEGMENTO_GRUPO_FAMILIAR: "Monoparental", SEGMENTO_POBLACIONAL: "Medio",
    enriquecido: { tiene_mascota: ["perro"] },
  } as never);
  console.log("Carolina solo-base + perro:", soloBase.recomendaciones.map((x) => `${x.nombre} (${x.score})`).join("  ·  "));
  check("se explica el orden cuando contradice el puntaje", !!soloBase.jerarquia);
  check("NO se explica cuando el puntaje ya manda", conPerro.jerarquia === undefined);

  const andresPerro = calcularPropension({ ...PERSONAS.Andres, enriquecido: { ...PERSONAS.Andres.enriquecido, tiene_mascota: ["perro"] } });
  console.log("Andrés + perro:", andresPerro.recomendaciones.map((x) => `${x.nombre} (${x.score})`).join("  ·  "));
  check("sin dependientes la jerarquía NO aplica (Vida ausente)", !andresPerro.recomendaciones.some((x) => x.nombre === "Seguro de Vida"));
}

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
