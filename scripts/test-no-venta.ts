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
import { sanearPerfil, declaroSinIngresos, normalizar } from "../lib/engine/sanear";
import { executeTool } from "../lib/tools";
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

/* ── no vender no es dejarla sin nada (B14 · 5c) ─────────────────────────── */
/*
 * `no_venta` significaba "no hay nada para ti": el motor devolvía cero y el prompt prohibía
 * mencionar cualquier producto. Para quien llega pidiendo algo concreto —"quiero dejar algo para
 * que mis hijos no carguen con el entierro"— eso es despedirla con cortesía, sabiendo el sistema
 * perfectamente qué le servía.
 *
 * Lo que NO se relaja: cero recomendaciones de pago, y la cotización cerrada por compuerta.
 */
console.log("\n===== No vender no es dejarla sin nada =====");
{
  const rosa = sanearPerfil(
    { RANGO_EDAD: "Mayor de 55 años", enriquecido: { sin_ingresos: true } },
    { textoUsuario: "tengo 62 anos, no tengo ingresos, quiero dejar algo para que mis hijos no carguen con el entierro" }
  ).perfil;
  const r = calcularPropension(rosa);

  check("la garantía sigue en pie: cero recomendaciones de pago", r.recomendaciones.length === 0);
  check("y el motor se pronuncia", !!r.no_venta);
  // De PRESENCIA: no basta con que no venda, tiene que responder a lo que pidió.
  check("pero SÍ dice qué existe para lo que pidió", !!r.informativo,
    r.informativo ? `→ ${r.informativo.nombre}` : "→ nada");
  check("  …con la razón del motor, no una inventada por el modelo",
    (r.informativo?.razon ?? "").length > 10);
  check("  …y sin precio ni quoteId: es información, no una oferta",
    !("prima" in (r.informativo ?? {})) && !("quoteId" in (r.informativo ?? {})));

  // La alternativa dejaba de ser cierta para la mitad de la gente que llega.
  const alt = r.no_venta?.alternativa ?? "";
  check("la alternativa distingue lo que aplica a cualquiera de lo que exige afiliación",
    /est[eé]s afiliado o no/i.test(alt) && /si est[aá]s afiliado/i.test(alt));
  check("y ya no le afirma a un no afiliado que le corresponde el subsidio",
    !/^como afiliado/i.test(alt.trim()));
}

/* ── la garantía dejó de ser una frase del prompt ─────────────────────────── */
/*
 * LO MÁS IMPORTANTE DE ESTE PASO. Hasta ahora, lo único que impedía ponerle un precio en pantalla
 * a alguien que acababa de decir que no tiene ingreso era UNA FRASE DEL PROMPT. El motor devolvía
 * `no_venta`, sí, pero nada impedía que el modelo llamara igual a `quote_product`.
 *
 * Una regla de prompt es una petición probabilística sobre la decisión más delicada del producto.
 * Ahora es una compuerta, y por eso la conversación se pudo abrir: el modelo puede hablar de lo que
 * existe sin que eso pueda convertirse en una venta por descuido.
 */
/* ── el anti-venta se dispara contra la persona correcta ──────────────────── */
/*
 * Encontrado al revisar la compuerta de precio: el predicado no miraba de QUIÉN se habla, así que
 * el anti-venta se disparaba contra gente que sí puede pagar y viene a proteger a otro. Es el mismo
 * defecto que la dirección de la dependencia (5a): el sujeto importa.
 *
 * Y aquí duele el doble, porque desde 5c además les cierra el precio por compuerta.
 */
console.log("\n===== El anti-venta apunta a quien no tiene ingreso, no a quien habla de otro =====");
{
  const SI: Array<string> = [
    "me quede sin trabajo",
    "no tengo ingresos",
    "estoy desempleado",
    "me quede sin trabajo, mi hijo me ayuda",
    "tengo familia, y no tengo trabajo",
  ];
  const NO: Array<string> = [
    "mi hijo se quedo sin trabajo y quiero ayudarlo",
    "mi hermana esta sin empleo, yo la mantengo",
    "quiero un seguro para mi esposa que esta desempleada",
    "mi esposa trabaja en una empresa",
    "trabajo en una empresa de seguros",
  ];
  for (const t of SI) check(`"${t}" → sí es ella`, declaroSinIngresos(normalizar(t)));
  for (const t of NO) check(`"${t}" → habla de otro, no dispara`, !declaroSinIngresos(normalizar(t)));

  // Y la consecuencia real: quien viene a comprarle a otro no se topa con una puerta cerrada.
  const paraOtro = sanearPerfil({}, { textoUsuario: "quiero un seguro para mi esposa que esta desempleada" });
  check("a quien compra para otro NO se le fija sin_ingresos",
    paraOtro.perfil.enriquecido?.sin_ingresos !== true);
  check("y por tanto el motor no le niega la venta",
    !calcularPropension(paraOtro.perfil).no_venta);
}

async function compuertaDePrecio() {
  console.log("\n===== El precio está cerrado por compuerta, no por prosa =====");
  const sinIngreso = { textoUsuario: "me quede sin trabajo, no tengo ingresos" };
  const conIngreso = { textoUsuario: "gano dos millones al mes" };

  const bloqueada = await executeTool("quote_product", { productId: "exequial_gea", perfil: { edad: 62 } }, sinIngreso);
  check("con la persona sin ingreso, la cotización se niega",
    (bloqueada.result as { error?: string }).error === "SIN_INGRESO_HOY");
  check("  …y no viaja ninguna cifra",
    !JSON.stringify(bloqueada.result).match(/"prima"/));
  check("  …y se le dice al modelo qué SÍ puede hacer, para que no se quede mudo",
    /puedes explicar qué es el producto/i.test(String((bloqueada.result as { instruccion?: string }).instruccion)));

  // El otro lado: si no dijo eso, el precio sale. Una compuerta que bloquea siempre no sirve.
  const abierta = await executeTool("quote_product", { productId: "exequial_gea", perfil: { edad: 62 } }, conIngreso);
  check("y con ingreso, cotiza normal", typeof (abierta.result as { prima?: number }).prima === "number");

  // También vale lo que ya se sabía de turnos anteriores, no solo lo de este mensaje.
  const porPerfil = await executeTool(
    "quote_product",
    { productId: "exequial_gea", perfil: { edad: 62 } },
    { textoUsuario: "cuánto cuesta", perfilPrevio: { enriquecido: { sin_ingresos: true } } }
  );
  check("y se respeta lo declarado en un turno anterior",
    (porPerfil.result as { error?: string }).error === "SIN_INGRESO_HOY");
}

compuertaDePrecio().then(() => {
  console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
  process.exit(ok ? 0 : 1);
});
