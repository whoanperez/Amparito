/**
 * Gate de la primera impresión (B12).
 *   npx tsx scripts/test-primer-toque.ts
 *
 * POR QUÉ EXISTE. Dos expertos, por separado, llegaron a la misma conclusión: el producto tiene
 * dos cosas que ningún otro equipo va a tener —una base que contesta en vivo y un sistema que se
 * niega a vender— y ninguna se alcanzaba sola desde la pantalla de entrada.
 *
 * Peor: el único camino que la pantalla ofrecía explícitamente al jurado (las pastillas de personas)
 * APAGABA el reconocimiento. Era una consecuencia de B5: al quitar el "soy Andrés" de los guiones
 * para que el detector no contaminara el nombre, los mensajes quedaron SIN nombre.
 *
 * Este gate protege el criterio de aceptación: desde la entrada, sin narrador y en UN toque, se
 * llega al reconocimiento en vivo y al "hoy no te vendo nada".
 */
import { detectarNombre } from "../lib/afiliados/deteccion";
import { identidadDe } from "./_identidad";
import { sanearPerfil } from "../lib/engine/sanear";
import { calcularPropension } from "../lib/engine/scorecard";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

// Se IMPORTAN de la pantalla, no se copian. Con dos listas sincronizadas a mano volvería a pasar
// lo de B5: alguien cambia el `msg`, el gate sigue verde probando un string que ya nadie usa, y el
// jurado toca un botón que no reconoce a nadie.
import { CHIPS_ENTRADA, PERSONAS_DEMO, chipDeOpcion, INVITACION_EJEMPLO } from "../components/Chat";

const PASTILLAS = PERSONAS_DEMO.map((p) => p.msg);
const CHIP_SIN_TRABAJO = CHIPS_ENTRADA.find((c) => /sin trabajo/i.test(c.texto))!;

// #26 · la regla de las afordancias, verificada: cuatro familias de botón tenían la misma pinta y
// dos comportamientos distintos, así que no se podía predecir qué hacía ninguno.
check("el chip de arranque anti-venta es una respuesta ENTERA (envía)", CHIP_SIN_TRABAJO.completa);
const chipNombre = CHIPS_ENTRADA.find((c) => /^Soy/.test(c.texto))!;
check("el chip del nombre está INCOMPLETO (prellena)", !chipNombre.completa);
check("y su etiqueta lo dice, en vez de mostrar una palabra suelta",
  chipNombre.etiqueta.endsWith("…") && chipNombre.etiqueta !== chipNombre.texto,
  `→ "${chipNombre.etiqueta}"`);
check("una opción del modelo abierta se marca como incompleta", !chipDeOpcion("Vivo en ").completa);
check("y una respuesta entera, como completa", chipDeOpcion("Sí, avancemos").completa);

/*
 * #27 · La invitación de las pastillas no puede confesar que esto es un demo. Y las pastillas
 * TIENEN que existir: son el único camino de un toque al arranque caliente para alguien que llega
 * solo con un enlace. Si teclea su propio nombre no aparece como afiliado, ve el camino genérico, y
 * nunca llega al diferencial — que es justo lo que este gate existe para proteger.
 */
check("hay un camino de un toque al reconocimiento", PERSONAS_DEMO.length > 0);
check("y la invitación no confiesa el demo",
  !/demo|de la base|prueba con|ficticio|ejemplo de prueba/i.test(INVITACION_EJEMPLO),
  `→ "${INVITACION_EJEMPLO}"`);

async function main() {
  /* ── 1 · un toque en una pastilla → reconocimiento ─────────────────────── */
  console.log("===== Un toque → reconocimiento en vivo =====");
  for (const msg of PASTILLAS) {
    const nombre = detectarNombre(msg, true);
    const id = await identidadDe(msg);
    check(
      `"${msg}" → reconocido`,
      nombre !== null && id.hallazgo.estado === "reconocido",
      `(detectó: ${nombre ?? "nada"})`
    );
  }

  // Y el momento completo: segmento verificado → motor → prueba social, sin una sola pregunta.
  const id0 = await identidadDe(PASTILLAS[0]);
  // El segmento ya viene con la forma que consume el motor: la conversión vive en el resolver,
  // en un solo sitio, en vez de repetida en cada llamador.
  const { perfil } = sanearPerfil({}, {
    textoUsuario: PASTILLAS[0],
    segmentoBase: id0.estado.identidad.segmento,
  });
  const r = calcularPropension(perfil);
  check("recomienda con CERO preguntas", r.recomendaciones.length > 0,
    `→ ${r.recomendaciones.map((x) => x.nombre).join(", ")}`);
  check("y afirma la prueba social (4 ejes verificados)", r.peer !== null,
    r.peer ? `→ ${r.peer.n.toLocaleString("es-CO")}` : "");
  check("el saludo dice cómo tratarla", (id0.contexto ?? "").includes("Bienvenida"));

  /* ── 2 · un toque en el chip → el anti-venta ───────────────────────────── */
  console.log("\n===== Un toque → \"hoy no te vendo nada\" =====");
  const s = sanearPerfil({}, { textoUsuario: CHIP_SIN_TRABAJO.texto });
  check("el servidor detecta la falta de ingreso SIN que el modelo mande el flag",
    s.perfil.enriquecido?.sin_ingresos === true);
  check("y la marca como declarada, no inferida",
    s.perfil._origen?.["enriquecido.sin_ingresos"] === "declarado");
  const nv = calcularPropension(s.perfil);
  check("el motor devuelve CERO productos de pago", nv.recomendaciones.length === 0);
  check("y ofrece los servicios de la caja",
    /subsidio al desempleo/i.test(nv.no_venta?.alternativa ?? ""));

  /* ── 3 · la detección no puede disparar por un falso positivo ──────────── */
  console.log("\n===== Negación: lo que NO debe disparar =====");
  const NO_DISPARA = [
    "mi esposa trabaja en una empresa",
    "trabajo en una empresa de mensajería",
    "tengo trabajo estable",
    "gano un millón ochocientos al mes",
    "quiero un seguro para mi moto",
  ];
  for (const t of NO_DISPARA) {
    const p = sanearPerfil({}, { textoUsuario: t }).perfil;
    check(`"${t}" NO dispara`, p.enriquecido?.sin_ingresos !== true);
  }
  const SI_DISPARA = [
    "Me quedé sin trabajo",
    "no tengo ingresos",
    "no tengo trabajo",
    "estoy desempleado",
    "perdí mi empleo el mes pasado",
    "tengo familia, y no tengo trabajo",
  ];
  for (const t of SI_DISPARA) {
    const p = sanearPerfil({}, { textoUsuario: t }).perfil;
    check(`"${t}" SÍ dispara`, p.enriquecido?.sin_ingresos === true);
  }

  /* ── 4 · el modelo no puede negar una venta por su cuenta ──────────────── */
  console.log("\n===== El modelo no decide, el servidor decide =====");
  const inventado = sanearPerfil(
    { enriquecido: { sin_ingresos: true } },
    { textoUsuario: "quiero un seguro para mi carro" }
  );
  check("si el modelo lo manda sin evidencia, se cae",
    inventado.perfil.enriquecido?.sin_ingresos !== true);
  check("y queda registrado el descarte",
    inventado.descartes.some((d) => d.includes("sin_ingresos")));

  console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
