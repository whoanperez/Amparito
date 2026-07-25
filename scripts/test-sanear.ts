/**
 * Gate de la compuerta de entrada del motor (B3 · RNF-7).
 *   npx tsx scripts/test-sanear.ts
 *
 * Reproduce la conversación REAL que expuso el problema: la persona nunca dijo dónde vive, el
 * modelo mandó `vivienda:"propia"` (había contestado "propio" hablando de su carro, tras una
 * pregunta de doble cañón) y eso decidió la venta. Y mandó `CATEGORIA:"B"` para alguien que
 * acababa de decir que no tiene ingresos, apagando `prioriza_prima_baja`.
 */
import { sanearPerfil } from "../lib/engine/sanear";
import { calcularPropension } from "../lib/engine/scorecard";

let ok = true;
const check = (label: string, cond: boolean) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}`);
  if (!cond) ok = false;
};

/* ── 1 · la conversación real de Mauricio ────────────────────────────────── */
console.log("===== Conversación real (no identificado) =====");

// Textual: solo lo que ÉL escribió. La palabra "vivienda" solo apareció en el mensaje de Amparito.
const textoUsuario = [
  "soy Mauricio Cajamarca",
  "si busco un seguro para mi, no se que me puedes ofrecer",
  "tengo familia, y no tengo trabajo",
  "no tengo ingresos",
  "mi esposa",
  "si ella trabaja en una empresa",
  "si carro",
  "propio",
  "uso personal",
].join("\n");

// Exactamente lo que el modelo mandó al motor (reconstruido de la tarjeta que se mostró).
const loQueMandoElModelo = {
  GENERO: "M",
  RANGO_EDAD: "36 a 45 años",
  CATEGORIA: "B",
  SEGMENTO_GRUPO_FAMILIAR: "Pareja conyugal",
  enriquecido: { tiene_vehiculo: ["carro"], vivienda: "propia" },
};

const { perfil, descartes } = sanearPerfil(loQueMandoElModelo, { textoUsuario });
console.log("   perfil que llega al motor:", JSON.stringify(perfil));
console.log("   descartes:");
descartes.forEach((d) => console.log(`     · ${d}`));

check("CATEGORIA descartada (no vino de la base)", perfil.CATEGORIA === undefined);
check("RANGO_EDAD descartada (nunca dijo su edad)", perfil.RANGO_EDAD === undefined);
check("GENERO descartado (no lo declaró)", perfil.GENERO === undefined);
check("vivienda DESCARTADA (nunca habló de su vivienda)", perfil.enriquecido?.vivienda === undefined);
check("carro SÍ aceptado (dijo 'si carro')", perfil.enriquecido?.tiene_vehiculo?.includes("carro") === true);
check("grupo familiar aceptado como inferido ('mi esposa')", perfil.SEGMENTO_GRUPO_FAMILIAR === "Pareja conyugal");
check("origen del grupo familiar = inferido", perfil._origen?.SEGMENTO_GRUPO_FAMILIAR === "inferido");

const r = calcularPropension(perfil);
console.log("   recomendaciones:", r.recomendaciones.map((x) => `${x.nombre} (${x.score})`).join("  ·  ") || "—");
check("el top-1 ya NO es Hogar (era la venta decidida por el dato falso)", r.recomendaciones[0]?.nombre !== "Seguro de Hogar y Contenidos");
check("prueba social AUSENTE (los 4 ejes no están verificados)", r.peer === null);

/* ── 2 · afiliado reconocido: el segmento de la base SÍ manda ────────────── */
console.log("\n===== Afiliado reconocido (segmento de la base) =====");
const conBase = sanearPerfil(
  { CATEGORIA: "C", RANGO_EDAD: "Menor de 19 años" }, // el modelo propone basura
  {
    textoUsuario: "hola",
    segmentoBase: {
      GENERO: "F", RANGO_EDAD: "36 a 45 años", CATEGORIA: "A",
      SEGMENTO_GRUPO_FAMILIAR: "Monoparental", SEGMENTO_POBLACIONAL: "Medio",
    },
  }
);
console.log("   perfil:", JSON.stringify(conBase.perfil));
check("la base manda sobre lo que propone el modelo (CATEGORIA=A, no C)", conBase.perfil.CATEGORIA === "A");
check("origen marcado como base", conBase.perfil._origen?.CATEGORIA === "base");
const rBase = calcularPropension(conBase.perfil);
check("prueba social PRESENTE (4 ejes verificados)", rBase.peer !== null);
console.log(`   peer: ${rBase.peer ? `${rBase.peer.n.toLocaleString("es-CO")} — ${rBase.peer.descripcion}` : "—"}`);

/* ── 3 · casos sueltos ───────────────────────────────────────────────────── */
console.log("\n===== Casos sueltos =====");
check(
  "valor fuera del enum se cae",
  sanearPerfil({ CATEGORIA: "Z", SEGMENTO_GRUPO_FAMILIAR: "Inventado" }, { textoUsuario: "" }).perfil.SEGMENTO_GRUPO_FAMILIAR === undefined
);
check(
  "moto no se acepta si solo habló de carro",
  sanearPerfil({ enriquecido: { tiene_vehiculo: ["carro", "moto"] } }, { textoUsuario: "tengo carro" })
    .perfil.enriquecido?.tiene_vehiculo?.join() === "carro"
);
check(
  "vivienda SÍ se acepta cuando de verdad la mencionó",
  sanearPerfil({ enriquecido: { vivienda: "propia" } }, { textoUsuario: "mi casa es propia" })
    .perfil.enriquecido?.vivienda === "propia"
);
check(
  "edad declarada se acepta",
  sanearPerfil({ RANGO_EDAD: "36 a 45 años" }, { textoUsuario: "tengo 39 años" }).perfil.RANGO_EDAD === "36 a 45 años"
);
check(
  "marca.* no se acepta desde la conversación",
  sanearPerfil({ marca: { VIVIENDA: "SI" } }, { textoUsuario: "hola" }).perfil.marca === undefined
);

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
