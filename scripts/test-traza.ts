/**
 * Gate de la traza legible (B13 · #28).
 *   npx tsx scripts/test-traza.ts
 *
 * POR QUÉ EXISTE. La traza es la promesa central del producto: "inspeccionable en pantalla, no una
 * caja negra". Y no tenía capa de presentación — la estructura interna del motor ERA el
 * view-model, así que lo que se veía era `enriquecido.tiene_mascota`, `prior.prob_mascota_hogar` y
 * `categoría (vacío)`. Una traza que solo entiende quien escribió el motor no es una traza.
 *
 * ESTE GATE NO PRUEBA LA CAPA CONTRA UNA LISTA DE EJEMPLOS. Corre el MOTOR DE VERDAD sobre varios
 * perfiles y comprueba que TODO lo que ese motor emitió sale legible. Es la diferencia entre
 * "traduje los campos que se me ocurrieron" y "no queda ningún campo sin traducir": si mañana el
 * scorecard estrena una señal, este gate la ve — sin que nadie la agregue a mano.
 */
import { sanearPerfil } from "../lib/engine/sanear";
import { calcularPropension } from "../lib/engine/scorecard";
import {
  ETIQUETA_ORIGEN,
  ETIQUETA_RESULTADO,
  etiquetaDeCampo,
  explicaGate,
  cuadraElPuntaje,
  sumaDelPuntaje,
  valorLegible,
} from "../lib/ui/traza";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

/**
 * Lo que NUNCA puede llegar a la pantalla: espacios de nombres y guiones bajos del motor.
 *
 * No se prohíben las mayúsculas a secas: "Dato de contexto (DANE)" es una etiqueta legítima y una
 * regla que la rechace obliga a escribir peor español para complacer al gate. Lo que sí se exige,
 * abajo, es que la etiqueta NO SEA la clave — que es la forma real de este defecto.
 */
const RASTRO_INTERNO = /enriquecido\.|prior\.|marca\.|ya_cubierto\.|_|\(vacío\)/;

/** ¿La "etiqueta" es en realidad el identificador crudo, con otra ropa? */
const esLaClave = (etq: string, clave: string) =>
  etq === clave || etq.toUpperCase() === clave.toUpperCase();

/* ── Perfiles que ejercitan caminos distintos del motor ──────────────────── */
const CASOS: Array<{ nombre: string; propuesto: Record<string, unknown>; texto: string }> = [
  {
    nombre: "familia con moto, perro y arriendo",
    propuesto: {
      RANGO_EDAD: "20 a 35 años",
      SEGMENTO_GRUPO_FAMILIAR: "Nuclear integral",
      enriquecido: { dependientes: 2, tiene_mascota: ["perro"], tiene_vehiculo: ["moto"], vivienda: "arriendo" },
    },
    texto: "Tengo dos hijos que dependen de mí, un perro y una moto. Tengo 34 años y vivo en arriendo.",
  },
  {
    nombre: "persona que ya tiene coberturas",
    propuesto: {
      RANGO_EDAD: "36 a 45 años",
      ya_cubierto: ["vida", "exequial"],
      enriquecido: { tiene_credito: true, viaja: true },
    },
    texto: "Tengo 40 años, ya tengo un seguro de vida y uno exequial. Tengo un crédito y viajo seguido.",
  },
  {
    nombre: "sin datos",
    propuesto: {},
    texto: "Hola",
  },
];

console.log("===== Nada interno llega a la pantalla =====");
let camposVistos = 0;
let senalesVistas = 0;

for (const caso of CASOS) {
  const { perfil } = sanearPerfil(caso.propuesto, { textoUsuario: caso.texto });
  const r = calcularPropension(perfil);
  const tz = r.traza;
  if (!tz) { check(`${caso.nombre}: el motor devolvió traza`, false); continue; }

  // 1 · Los campos del perfil, tal cual los emite el motor.
  const claves = [
    ...Object.keys(tz.perfil).filter((k) => k !== "_origen" && k !== "enriquecido"),
    ...Object.keys((tz.perfil.enriquecido ?? {}) as Record<string, unknown>).map((k) => `enriquecido.${k}`),
  ];
  for (const k of claves) {
    camposVistos++;
    const etq = etiquetaDeCampo(k);
    check(`${caso.nombre} · "${k}" → "${etq}"`, !RASTRO_INTERNO.test(etq) && !esLaClave(etq, k));
  }

  // 2 · Las señales, que es donde vivían `prior.*` y compañía.
  for (const p of tz.productos) {
    for (const s of p.senales) {
      senalesVistas++;
      const etq = etiquetaDeCampo(s.feature);
      check(`${caso.nombre} · señal "${s.feature}" → "${etq}"`,
        !RASTRO_INTERNO.test(etq) && !esLaClave(etq, s.feature));
    }
    // 3 · El puntaje es la suma de lo que se muestra, o no se afirma nada.
    if (p.senales.length) {
      const suma = p.senales.reduce((a, s) => a + s.peso, 0);
      check(
        `${caso.nombre} · ${p.nombre}: la aritmética que se pinta es cierta`,
        cuadraElPuntaje(p) ? suma === p.score : sumaDelPuntaje(p) === null,
        `→ ${sumaDelPuntaje(p) ?? "no se afirma"}`
      );
    }
  }

  // 4 · El gate de asequibilidad, en español y sin "(vacío)".
  const frase = explicaGate(tz.gate_asequibilidad);
  check(`${caso.nombre} · el gate se explica en una frase`,
    !/\(vacío\)/.test(frase) && frase.length > 20, `→ "${frase}"`);
}

check("se ejercitaron campos de verdad (no pasó por vacío)", camposVistos >= 6, `→ ${camposVistos} campos`);
check("y señales de verdad", senalesVistas >= 6, `→ ${senalesVistas} señales`);

/*
 * 5 · El respaldo. Un campo que nadie tradujo tiene que salir legible IGUAL: el diccionario a mano
 *     es el atajo, no la garantía. Sin esto, la próxima señal del scorecard aparece en pantalla
 *     como `enriquecido.tiene_bici_electrica` y nadie se entera hasta que lo vea un jurado.
 */
console.log("\n===== Un campo que nadie tradujo también sale legible =====");
const inventado = etiquetaDeCampo("enriquecido.tiene_bici_electrica");
check("un campo nuevo cae al respaldo, no al identificador crudo",
  !RASTRO_INTERNO.test(inventado), `→ "${inventado}"`);
check("y el respaldo conserva el sentido", /bici/i.test(inventado));

/*
 * 6 · Los valores. `true`, `["perro"]` y `2` no son español.
 */
console.log("\n===== Los valores se leen =====");
check("true → sí", valorLegible(true) === "sí");
check("false → no", valorLegible(false) === "no");
check("lista → separada por comas", valorLegible(["perro", "gato"]) === "perro, gato");
check("lista vacía → sin dato", valorLegible([]) === "sin dato");
check("undefined → sin dato", valorLegible(undefined) === "sin dato");
check("un número se deja como está", valorLegible(2) === "2");

/*
 * 7 · Las etiquetas de procedencia y de resultado explican, no clasifican. "descartado" no le dice
 *     nada a quien lee; "no entró, y te dije por qué" sí.
 */
console.log("\n===== Procedencia y resultado, en español =====");
// La procedencia se pinta en una pastilla de 10.5px EN MAYÚSCULAS: una frase ahí no cabe, parte la
// fila y deja de leerse. La explicación larga va en la nota de abajo, una sola vez.
for (const [k, v] of Object.entries(ETIQUETA_ORIGEN)) {
  check(`origen "${k}" → "${v}"`, v.length > 3 && !RASTRO_INTERNO.test(v));
  check(`  …y cabe en la pastilla`, v.length <= 16, `→ ${v.length} caracteres`);
}
for (const [k, v] of Object.entries(ETIQUETA_RESULTADO)) {
  check(`resultado "${k}" → "${v}"`, v.length > 3 && !RASTRO_INTERNO.test(v));
}
check("el gate sin categoría dice qué consecuencia tuvo",
  /prima más baja/.test(explicaGate({ categoria: "(vacío)", prioriza_prima_baja: true })));

/*
 * ── Tres cosas que la traza decía y no eran ciertas (B15 · 5) ──────────────
 *
 * Salieron de un flujo real, y las tres duelen más aquí que en cualquier otra pantalla: esta es la
 * superficie que existe para que la persona pueda comprobar lo que se le dijo.
 */
console.log("\n===== La traza no afirma lo que no sabe =====");

// 1 · "no estás identificada" — a un hombre. Concordancia de género escrita a mano.
for (const g of [
  explicaGate({ categoria: "(vacío)", prioriza_prima_baja: true }),
  explicaGate({ categoria: "A", prioriza_prima_baja: false }),
]) {
  check(`"${g.slice(0, 46)}…" no presupone el género`, !/\b(identificad|afiliad|segur)[ao]\b/.test(g));
}

// 2 · "no entró, y te dije por qué" — la etiqueta no puede saber si se lo dijo. En el flujo real
//     el motivo estaba en la traza y en la conversación no se mencionó nunca.
check("la etiqueta del descarte no afirma lo que pasó en la conversación",
  !/te dije/i.test(ETIQUETA_RESULTADO.descartado), `→ "${ETIQUETA_RESULTADO.descartado}"`);
check("  …pero sigue diciendo dónde está el motivo",
  /motivo/i.test(ETIQUETA_RESULTADO.descartado));

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
