/**
 * Gate de la traza auditable (B11 · RNF-6).
 *   npx tsx scripts/test-auditoria.ts
 *
 * Cierra el único no-negociable del PRD que estaba sin implementar:
 *   "toda recomendación persiste {perfil, reglas, pesos, reason codes, cita de fuente};
 *    inspeccionable en pantalla (no caja negra)."
 *
 * Lo que verifica y por qué importa: que los pesos SUMEN el score (una traza que no cuadra no
 * explica nada), que la procedencia de cada campo esté completa (es lo que distingue un dato de la
 * base de una suposición), que se explique también lo que NO se recomendó, y que la traza no
 * contenga PII — audita decisiones, no personas.
 */
import { calcularPropension } from "../lib/engine/scorecard";
import { sanearPerfil } from "../lib/engine/sanear";
import { PERSONAS } from "../lib/engine/fixtures";
import { executeTool } from "../lib/tools";
import { decisiones, limpiarHistorial, registrar, sinPII, suscribir } from "../lib/auditoria";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

async function main() {
  /* ── 1 · la traza existe y los pesos cuadran ───────────────────────────── */
  console.log("===== La traza explica el score =====");
  const r = calcularPropension(PERSONAS.Carolina);
  const t = r.traza!;
  check("la traza viene en el resultado", !!t);
  check("dice con qué versión de reglas se decidió", !!t.version_reglas && t.version_reglas !== "?",
    `→ v${t.version_reglas}`);

  // Si los pesos no suman el score, la traza es decorativa.
  const descuadres = t.productos.filter(
    (p) => p.senales.reduce((a, s) => a + s.peso, 0) !== p.score
  );
  check("los pesos SUMAN el score en todos los productos", descuadres.length === 0,
    descuadres.length ? `→ descuadra: ${descuadres.map((d) => d.id).join(", ")}` : `→ ${t.productos.length} productos`);

  // `.every()` sobre un array vacío es TRUE. Sin la guarda de abajo, una traza sin productos —o
  // con productos pero sin señales— pasaría este check sin haber mirado una sola señal, que es
  // justo el modo de falla de un motor hecho de compuertas que descartan.
  const senales = t.productos.flatMap((p) => p.senales);
  check("hay señales que auditar", senales.length > 0, `→ ${senales.length} señales en ${t.productos.length} productos`);
  check("cada señal dice QUÉ campo la disparó", senales.every((s) => !!s.feature));
  check("se explica también lo que NO se recomendó",
    t.productos.some((p) => p.resultado !== "recomendado"));
  check("registra la decisión del gate de asequibilidad", typeof t.gate_asequibilidad.prioriza_prima_baja === "boolean");
  check("y por qué se afirmó o no la prueba social", !!t.peer.motivo, `→ ${t.peer.motivo}`);

  /* ── 2 · la procedencia de cada campo viaja en la traza ─────────────────── */
  console.log("\n===== Procedencia (base / declarado / inferido) =====");
  const { perfil } = sanearPerfil(
    { CATEGORIA: "B", SEGMENTO_GRUPO_FAMILIAR: "Pareja conyugal", enriquecido: { tiene_vehiculo: ["carro"], vivienda: "propia" } },
    {
      textoUsuario: "mi esposa\nsi carro\npropio",
      segmentoBase: { GENERO: "F", RANGO_EDAD: "36 a 45 años", CATEGORIA: "A" },
    }
  );
  const t2 = calcularPropension(perfil).traza!;
  const org = t2.perfil._origen ?? {};
  console.log("   origen:", JSON.stringify(org));
  check("lo que vino de la base se marca base", org.CATEGORIA === "base");
  check("lo verificado contra el texto se marca declarado", org["enriquecido.tiene_vehiculo"] === "declarado");
  check("lo supuesto se marca inferido", org.SEGMENTO_GRUPO_FAMILIAR === "inferido");
  check("y lo fabricado no aparece", org["enriquecido.vivienda"] === undefined);

  /* ── 3 · el registro no guarda PII ─────────────────────────────────────── */
  console.log("\n===== El registro audita decisiones, no personas =====");
  const conPII = sinPII({
    contacto: { nombre: "Carolina Ramírez", numeroDocumento: "52123456", correo: "c@e.com" },
    perfil: { CATEGORIA: "A" },
  }) as Record<string, any>;
  const serializado = JSON.stringify(conPII);
  check("no queda el nombre", !serializado.includes("Carolina"));
  check("no queda el documento", !serializado.includes("52123456"));
  check("no queda el correo", !serializado.includes("c@e.com"));
  check("y lo que sí importa sobrevive", conPII.perfil.CATEGORIA === "A");

  /* ── 4 · cada ejecución de tool queda registrada, y se notifica ─────────── */
  console.log("\n===== Command + Observer =====");
  limpiarHistorial();
  const vistos: string[] = [];
  const desuscribir = suscribir((d) => vistos.push(d.tool));

  await executeTool("calcular_propension", { perfil: PERSONAS.Carolina });
  const q = await executeTool("quote_product", { productId: "vida_panamerican", perfil: { edad: 39 } });
  await executeTool("issue_policy", {
    quoteId: String((q.event?.data as Record<string, unknown>).quoteId),
    consentimiento: true,
    contacto: { nombre: "Carolina Ramírez", tipoDocumento: "CC", numeroDocumento: "52123456", fechaNacimiento: "22/07/1987", celular: "3000000000", correo: "c@e.com" },
  });

  check("las 3 ejecuciones quedaron registradas", decisiones().length === 3, `→ ${decisiones().length}`);
  check("el suscriptor fue notificado de las 3", vistos.length === 3, `→ ${vistos.join(", ")}`);
  const hist = JSON.stringify(decisiones());
  check("el historial NO contiene el nombre del titular", !hist.includes("Carolina Ramírez"));
  check("ni su documento", !hist.includes("52123456"));
  check("la traza del motor sí quedó en el registro", hist.includes("version_reglas"));

  desuscribir();
  registrar("get_catalog", {}, { ok: true });
  check("al desuscribirse deja de recibir", vistos.length === 3);
  check("pero el historial sigue creciendo", decisiones().length === 4);

  /* ── 5 · la auditoría nunca puede tumbar el flujo ──────────────────────── */
  console.log("\n===== Robustez =====");
  const quitar = suscribir(() => { throw new Error("suscriptor roto"); });
  let exploto = false;
  try {
    registrar("get_catalog", {}, { ok: true });
  } catch {
    exploto = true;
  }
  quitar();
  check("un suscriptor que falla no rompe nada", !exploto);

  console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
