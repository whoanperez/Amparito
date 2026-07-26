/**
 * Gate de los cuatro NO (B14 · 5g).
 *   npx tsx scripts/test-los-cuatro-no.ts
 *
 * POR QUÉ EXISTE. El prompt dice la frase que mejor describe a este producto: *"En toda
 * conversación debe aparecer al menos un NO honesto"*. Y era la ÚNICA de sus propiedades que nadie
 * verificaba. Las otras cinco tienen compuerta o gate —no afirmar sin respaldo, no preguntar lo
 * que ya se sabe, no insistir tras un no, una sola pregunta por turno, no cotizar sin ingreso—;
 * esta vivía solo en la prosa.
 *
 * QUÉ SE PUEDE GARANTIZAR. Que el modelo lo DIGA no se puede garantizar desde el servidor: son sus
 * palabras. Lo que sí —y es lo que de verdad falla cuando falla— es que SIEMPRE TENGA UNO QUE
 * DECIR. Un NO honesto no se improvisa: sale de un hecho del motor. Si el sistema no le entrega
 * ninguno, el modelo solo puede callarse o inventárselo, y las dos son peores que no tener la regla.
 */
import { sanearPerfil } from "../lib/engine/sanear";
import { calcularPropension } from "../lib/engine/scorecard";
import { nosHonestos, instruccionDeNos } from "../lib/engine/nos";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

const SEG_CAROLINA = {
  GENERO: "F", RANGO_EDAD: "36 a 45 años", CATEGORIA: "A",
  SEGMENTO_GRUPO_FAMILIAR: "Monoparental", SEGMENTO_POBLACIONAL: "Medio",
};

/* ── 1 · los tres escenarios de referencia ────────────────────────────────── */
console.log("===== Los tres escenarios tienen un NO que decir =====");

const ESCENARIOS: Array<[string, Parameters<typeof sanearPerfil>[0], Parameters<typeof sanearPerfil>[1]]> = [
  ["Carolina · afiliada verificada", {}, { textoUsuario: "hola", segmentoBase: SEG_CAROLINA }],
  ["Andrés · no afiliado, moto, vive solo",
    { enriquecido: { tiene_vehiculo: ["moto"] } },
    { textoUsuario: "tengo una moto y vivo solo, nadie depende de mi" }],
  ["Rosa · sin ingresos, quiere exequial",
    { RANGO_EDAD: "Mayor de 55 años", enriquecido: { sin_ingresos: true } },
    { textoUsuario: "tengo 62 anos, no tengo ingresos, quiero dejar algo para el entierro" }],
];

for (const [nombre, propuesto, ctx] of ESCENARIOS) {
  const r = calcularPropension(sanearPerfil(propuesto, ctx).perfil);
  const nos = nosHonestos(r);
  check(`${nombre}: tiene al menos un NO honesto`, nos.length > 0,
    `→ ${nos.map((n) => n.tipo).join(", ") || "NINGUNO"}`);
  // De PRESENCIA: no basta con que exista el tipo, tiene que traer el HECHO que lo respalda, que
  // es lo que el modelo redacta. Un NO sin razón es una excusa.
  check(`  …y cada uno trae el hecho del motor que lo sostiene`,
    nos.every((n) => n.porque.trim().length > 20));
  check(`  …con instrucción para decirlo con sus palabras`, !!instruccionDeNos(nos));
}

/* ── 2 · el barrido: nadie se queda sin uno ───────────────────────────────── */
/*
 * Tres escenarios elegidos por mí no prueban una propiedad universal: los elegí sabiendo qué
 * quería que salieran. El barrido cubre las 96 combinaciones del segmento verificado.
 */
console.log("\n===== Ningún perfil se queda sin NO =====");
const GEN = ["F", "M"];
const EDAD = ["20 a 35 años", "36 a 45 años", "46 a 55 años", "Mayor de 55 años"];
const FAM = ["Sin grupo familiar", "Monoparental", "Nuclear integral", "Pareja conyugal"];
const CAT = ["A", "B", "C"];

let sinNinguno = 0;
let soloElDebil = 0;
let total = 0;
const reparto: Record<string, number> = {};

for (const g of GEN) for (const e of EDAD) for (const f of FAM) for (const c of CAT) {
  const seg = { GENERO: g, RANGO_EDAD: e, SEGMENTO_GRUPO_FAMILIAR: f, CATEGORIA: c, SEGMENTO_POBLACIONAL: "Medio" };
  const { perfil } = sanearPerfil(
    { enriquecido: { tiene_vehiculo: ["carro"] } },
    { textoUsuario: "tengo un carro y gano tres millones", segmentoBase: seg }
  );
  const nos = nosHonestos(calcularPropension(perfil));
  total++;
  if (!nos.length) sinNinguno++;
  if (nos.length === 1 && nos[0].tipo === "no_lo_se") soloElDebil++;
  for (const n of nos) reparto[n.tipo] = (reparto[n.tipo] ?? 0) + 1;
}

check(`las ${total} combinaciones del segmento tienen al menos un NO`, sinNinguno === 0,
  `→ ${sinNinguno} sin ninguno`);
/*
 * Y que se cumpla NO TRIVIALMENTE. "No lo sé" es el más débil de los cuatro: si todos los perfiles
 * dependieran solo de él, la regla estaría satisfecha de boquilla. Hoy 156 de los NO son
 * sustantivos y 11 son el débil, y ningún perfil depende únicamente de ese.
 */
check("y ninguno depende SOLO del más débil", soloElDebil === 0,
  `→ reparto ${JSON.stringify(reparto)}`);

/* ── 3 · el material sale del motor, no de una plantilla ──────────────────── */
console.log("\n===== El NO sale de un hecho, no de una frase hecha =====");
{
  const conCubierto = calcularPropension(
    sanearPerfil({ ya_cubierto: ["exequial"] }, { textoUsuario: "ya tengo un seguro exequial" }).perfil
  );
  const nos = nosHonestos(conCubierto);
  check("quien ya tiene algo recibe el NO más fuerte primero",
    nos[0]?.tipo === "ya_lo_tienes", `→ ${nos.map((n) => n.tipo).join(", ")}`);
  check("  …nombrando el producto concreto", /exequial/i.test(nos[0]?.porque ?? ""));
}
{
  const r = calcularPropension(sanearPerfil({}, { textoUsuario: "hola", segmentoBase: SEG_CAROLINA }).perfil);
  const nos = nosHonestos(r);
  check("con prueba social verificada, el NO ya no es 'no lo sé'",
    !!r.peer && !nos.some((n) => n.tipo === "no_lo_se"));

  /*
   * Y el NO no puede depender de cómo esté REDACTADO el motivo. La primera versión miraba si el
   * texto decía "asesor" o "declaración": bastaba reescribir ese copy para que el NO desapareciera
   * en silencio. Ahora se decide por el hecho estructural del catálogo, así que reescribir la
   * prosa no lo apaga.
   */
  const conOtraProsa: typeof r = {
    ...r,
    descartados: (r.descartados ?? []).map((d) => ({ ...d, motivo: "Este texto se reescribió por completo." })),
  };
  check("y sobrevive a que alguien reescriba el motivo",
    nosHonestos(conOtraProsa).some((n) => n.tipo === "no_te_lo_puedo_vender"),
    `→ ${nosHonestos(conOtraProsa).map((n) => n.tipo).join(", ")}`);
}

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
