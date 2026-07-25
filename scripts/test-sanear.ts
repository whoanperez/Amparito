/**
 * Gate de la compuerta de entrada del motor (B3 · RNF-7).
 *   npx tsx scripts/test-sanear.ts
 *
 * Reproduce la conversación REAL que expuso el problema: la persona nunca dijo dónde vive, el
 * modelo mandó `vivienda:"propia"` (había contestado "propio" hablando de su carro, tras una
 * pregunta de doble cañón) y eso decidió la venta. Y mandó `CATEGORIA:"B"` para alguien que
 * acababa de decir que no tiene ingresos, apagando `prioriza_prima_baja`.
 */
import { sanearPerfil, resumenEvidencia } from "../lib/engine/sanear";
import { calcularPropension } from "../lib/engine/scorecard";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
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
/*
 * Aquí había `r.recomendaciones[0]?.nombre !== "Seguro de Hogar y Contenidos"`. Con este perfil
 * el texto contiene "no tengo ingresos", así que el motor devuelve `no_venta` y la lista viene
 * VACÍA: `undefined !== "Hogar"` es siempre cierto. Pasaba igual si el motor se hubiera roto
 * entero, y afirmar la AUSENCIA de algo sobre una lista vacía no prueba nada.
 */
check("el motor se pronuncia: hoy no se vende", !!r.no_venta);
check("y por tanto no hay recomendaciones de pago", r.recomendaciones.length === 0);
check("prueba social AUSENTE (los 4 ejes no están verificados)", r.peer === null);

/*
 * Lo que de verdad prueba que la compuerta CAMBIA el resultado es un diferencial: el mismo perfil
 * del modelo, con y sin saneamiento, sobre un texto donde la persona sí tiene ingresos (para que
 * el `no_venta` no tape el efecto). Sin compuerta, el `vivienda:"propia"` inventado mete Hogar en
 * el ranking — que es la venta que se decidió en la conversación real por un dato falso.
 */
const textoConIngresos = textoUsuario
  .replace("tengo familia, y no tengo trabajo\n", "tengo familia\n")
  .replace("no tengo ingresos\n", "");
const conCompuerta = calcularPropension(sanearPerfil(loQueMandoElModelo, { textoUsuario: textoConIngresos }).perfil);
const sinCompuerta = calcularPropension(loQueMandoElModelo as Parameters<typeof calcularPropension>[0]);
const hayHogar = (x: { recomendaciones: { nombre: string }[] }) =>
  x.recomendaciones.some((p) => /Hogar/i.test(p.nombre));
check("SIN compuerta, el dato falso mete Hogar en el ranking", hayHogar(sinCompuerta),
  `→ ${sinCompuerta.recomendaciones.map((x) => x.nombre).join(", ") || "—"}`);
check("CON compuerta, Hogar desaparece", !hayHogar(conCompuerta),
  `→ ${conCompuerta.recomendaciones.map((x) => x.nombre).join(", ") || "—"}`);

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

/* ── 4 · el perfil acumulado es un PISO, no un reemplazo ─────────────────────
   El hallazgo más profundo del sistema: el perfil lo re-inferí­a el LLM en cada turno y `_origen`
   —del que depende la prueba social— nacía y moría dentro del mismo request. El motor, la pieza
   determinista y auditable, recibía cada turno un input retecleado por el componente menos
   determinista.

   El piso es de fiar porque el perfil previo llega dentro del estado SELLADO: ya pasó por esta
   misma compuerta en su turno, y el HMAC impide que el navegador lo edite por el camino. */
console.log("\n===== El perfil acumulado (piso, no reemplazo) =====");

const turno1 = sanearPerfil(
  { enriquecido: { tiene_vehiculo: ["moto"] } },
  { textoUsuario: "tengo una moto y la uso para trabajar" }
);
check("turno 1 · la compuerta acepta la moto", turno1.perfil.enriquecido?.tiene_vehiculo?.join() === "moto");
check("turno 1 · con su procedencia", turno1.perfil._origen?.["enriquecido.tiene_vehiculo"] === "declarado");

// Turno 2: el modelo NO retranscribe nada. Antes, aquí se perdía todo.
const turno2 = sanearPerfil(
  {},
  { textoUsuario: "tengo una moto y la uso para trabajar\n¿y eso qué cubre?", perfilPrevio: turno1.perfil }
);
check("turno 2 · la moto sigue ahí aunque el modelo no la mande",
  turno2.perfil.enriquecido?.tiene_vehiculo?.join() === "moto");
check("turno 2 · y su procedencia también", turno2.perfil._origen?.["enriquecido.tiene_vehiculo"] === "declarado");

// Y el caso que de verdad importa: el modelo manda algo DISTINTO, no nada. Con una asignación
// en vez de una unión, la moto desaparecía — justo lo contrario de lo que el piso promete. El
// test anterior no lo distinguía porque solo probaba el caso fácil (el modelo no manda nada).
const turno2b = sanearPerfil(
  { enriquecido: { tiene_vehiculo: ["carro"] } },
  { textoUsuario: "tengo una moto y también un carro", perfilPrevio: turno1.perfil }
);
check("un vehículo nuevo se SUMA al ya conocido",
  (turno2b.perfil.enriquecido?.tiene_vehiculo ?? []).slice().sort().join() === "carro,moto");

const yaCubierto1 = sanearPerfil({ ya_cubierto: ["exequial"] }, { textoUsuario: "tengo exequial" });
const yaCubierto2 = sanearPerfil(
  { ya_cubierto: ["vida"] },
  { textoUsuario: "tengo exequial y vida", perfilPrevio: yaCubierto1.perfil }
);
check("una cobertura nueva se SUMA a la ya conocida",
  (yaCubierto2.perfil.ya_cubierto ?? []).slice().sort().join() === "exequial,vida");

// El piso no relaja la compuerta: lo que el modelo propone AHORA sigue verificándose.
const turno3 = sanearPerfil(
  { enriquecido: { vivienda: "propia" } },
  { textoUsuario: "tengo una moto y la uso para trabajar", perfilPrevio: turno2.perfil }
);
check("el piso NO relaja la compuerta: vivienda sin evidencia se sigue cayendo",
  turno3.perfil.enriquecido?.vivienda === undefined);
check("y se explica por qué", turno3.descartes.some((d) => d.includes("vivienda")));
check("mientras lo ya ganado se conserva", turno3.perfil.enriquecido?.tiene_vehiculo?.join() === "moto");

// El segmento de la base sigue mandando por encima del piso.
const conBaseNueva = sanearPerfil(
  {},
  { textoUsuario: "hola", perfilPrevio: { CATEGORIA: "C", _origen: { CATEGORIA: "base" } }, segmentoBase: { CATEGORIA: "A" } }
);
check("la base manda sobre el piso", conBaseNueva.perfil.CATEGORIA === "A");

/* ── 5 · el resumen de evidencia usa texto Y perfil ────────────────────────── */
console.log("\n===== Lo que ya te contó =====");
const soloTexto = resumenEvidencia("tengo una moto") ?? "";
check("el texto solo ya reconoce la moto", soloTexto.includes("moto"));
// Un campo confirmado en un turno anterior cuenta como sabido aunque el texto de ESTE turno no
// lo mencione: es lo que impide repreguntar lo mismo tres turnos después.
const conPerfil = resumenEvidencia("¿y eso qué cubre?", turno2.perfil) ?? "";
check("un campo ya confirmado cuenta como sabido", conPerfil.includes("moto"));
check("y por tanto no aparece como pendiente", !/Falta por saber:[^\n]*vehículo/.test(conPerfil));

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
