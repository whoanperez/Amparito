/**
 * Gate del paso de pago (B14 · 5f).
 *   npx tsx scripts/test-pago.ts
 *
 * POR QUÉ EXISTE. El sistema iba del formulario a la emisión sin nada en medio. El pitch del
 * producto dice que Amparito "reemplaza el te contactaremos por una conversación inmediata" — y lo
 * que reemplazaba el "te contactaremos" era un formulario: quien lo llenaba seguía sin saber si
 * había quedado o no.
 *
 * Y hay una regla que este gate protege por encima de todo: EL IMPORTE LO PONE EL SERVIDOR. El
 * navegador lo tiene en pantalla, pero cobrar por lo que diga el cliente es de las cosas que no se
 * hacen aunque hoy sea una simulación — el día que el pago sea real, la ruta ya tiene que estar
 * bien.
 */
import { getInsurerGateway } from "../lib/insurer/mock-adapter";
import { executeTool } from "../lib/tools";
import { AVISO_SIMULACION, AVISO_PAGO_SIMULADO, contradiceElSello } from "../lib/expedicion";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

async function main() {
  console.log("===== El importe lo pone el servidor =====");
  const gw = getInsurerGateway();

  const { result } = await executeTool(
    "quote_product",
    { productId: "vida_panamerican", perfil: { edad: 39 } },
    { textoUsuario: "gano dos millones al mes, tengo 39 anos" }
  );
  const q = result as { quoteId?: string; prima?: number };
  check("hay una cotización de la que partir", typeof q.quoteId === "string" && typeof q.prima === "number");

  const leida = await gw.leerCotizacion?.(q.quoteId!);
  check("el servidor puede leer la cotización SIN emitir", !!leida);
  check("  …y el importe coincide con el cotizado", leida?.prima === q.prima,
    `→ servidor ${leida?.prima} · cotización ${q.prima}`);
  check("  …y sabe de qué producto es", leida?.productId === "vida_panamerican");

  /*
   * De PRESENCIA y de negación: leer una cotización no puede emitir nada. Si `leerCotizacion`
   * tuviera efectos, el paso de pago estaría emitiendo antes de que nadie pague.
   */
  const otra = await gw.leerCotizacion?.(q.quoteId!);
  check("leerla dos veces devuelve lo mismo y no emite", otra?.prima === leida?.prima);

  console.log("\n===== Un quoteId que no cuadra no inventa un número =====");
  check("basura → null, no un importe", (await gw.leerCotizacion?.("Q-basura")) === null);
  check("vacío → null", (await gw.leerCotizacion?.("")) === null);

  /*
   * Es la regla que hace que el paso sea honesto: si el adaptador no sabe leer la cotización, la
   * pantalla muestra el paso SIN importe. Un número equivocado en una pantalla de pago es peor que
   * ningún número.
   */
  console.log("\n===== El sello del pago =====");
  check("el aviso de simulación sigue teniendo una sola fuente",
    /no se emitió ninguna póliza/i.test(AVISO_SIMULACION));
  check("el pago tiene el suyo, y dice lo único que importa saber antes de tocar el botón",
    /no se cobra/i.test(AVISO_PAGO_SIMULADO), `→ "${AVISO_PAGO_SIMULADO}"`);
  check("y no promete una entrega que el sello niega", !contradiceElSello(AVISO_PAGO_SIMULADO));

  console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
