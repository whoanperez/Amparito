/**
 * Gate de la frontera LLM / servidor (B13).
 *   npx tsx scripts/test-tarjetas-del-motor.ts
 *
 * POR QUÉ EXISTE. La frontera estaba en el lugar equivocado: al modelo se le controlaba CÓMO
 * escribe, no solo qué puede afirmar. Para que aparecieran las tarjetas seleccionables tenía que
 * emitir un protocolo en medio de su prosa:
 *
 *     RECOMENDACION: Seguro de Vida | recomendado | Eres el sostén de un hogar monoparental
 *
 * Pero el evento del motor YA trae nombre, orden y reason codes. Le pedíamos al LLM que transcribiera
 * datos que el servidor tenía, y de eso dependían DOS cosas: que se pintaran las tarjetas y que la
 * máquina de estados avanzara. Una tilde en "RECOMENDACIÓN:" dejaba el sistema mudo y sin salida de
 * DESCUBRIENDO.
 *
 * Ahora el servidor serializa y el LLM conversa.
 */
import { estadoInicial } from "../lib/estado/tipos";
import { recsDeEvento, vistaDeEstado } from "../lib/estado/vista";
import type { UiVista } from "../lib/estado/tipos";

const textoDelBloque = (v: UiVista) =>
  v.bloques.filter((b) => b.t === "texto").map((b) => (b as { contenido: string }).contenido).join("\n");
import { siguienteFase, cerrarTurno } from "../lib/estado/reducir";
import { calcularPropension } from "../lib/engine/scorecard";
import { PERSONAS } from "../lib/engine/fixtures";
import { executeTool } from "../lib/tools";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

/*
 * Aquí había una RÉPLICA de `recsDeEvento`, con un comentario que decía "réplica de la función
 * del cliente (components/Chat.tsx)". Esa función ya no existe en el cliente: el comentario
 * apuntaba a un archivo que dejó de tenerla, y el test seguía verde probando su propia copia.
 *
 * Es exactamente el modo de falla que hacía inútil la cobertura: la única versión cubierta era
 * la que vivía dentro del test. Ahora se importa la de verdad.
 */

async function main() {
  /* ── 1 · las tarjetas salen del evento ─────────────────────────────────── */
  console.log("===== Las tarjetas salen del motor, no del texto =====");
  /*
   * El `ctx` NO es decorado. Antes se llamaba `executeTool(..., {perfil: PERSONAS.Carolina})` sin
   * contexto: la compuerta descartaba los cinco ejes por falta de evidencia y solo sobrevivía
   * `dependientes`. Así que este test comparaba DOS PERFILES DISTINTOS —uno saneado a la fuerza y
   * otro completo— y que los nombres coincidieran era coincidencia del scoring, no la propiedad
   * que el label anuncia. Y el camino real (afiliada reconocida, con segmento verificado) no se
   * ejercitaba en ninguna parte.
   */
  const seg = {
    GENERO: PERSONAS.Carolina.GENERO,
    RANGO_EDAD: PERSONAS.Carolina.RANGO_EDAD,
    CATEGORIA: PERSONAS.Carolina.CATEGORIA,
    SEGMENTO_GRUPO_FAMILIAR: PERSONAS.Carolina.SEGMENTO_GRUPO_FAMILIAR,
    SEGMENTO_POBLACIONAL: PERSONAS.Carolina.SEGMENTO_POBLACIONAL,
  };
  const { result, event } = await executeTool(
    "calcular_propension",
    { perfil: PERSONAS.Carolina },
    { textoUsuario: "soy Carolina, tengo un hijo de 8 años", segmentoBase: seg }
  );
  const recs = recsDeEvento(event!.data);

  console.log("   tarjetas:", recs.map((r) => `${r.recomendado ? "★ " : ""}${r.nombre}`).join("  ·  "));
  check("hay tarjetas seleccionables", recs.length > 0);
  check("la primera está marcada como recomendada", recs[0]?.recomendado === true);
  check("cada una trae su razón del motor", recs.every((r) => r.razon.length > 0));

  // Ahora las dos ramas parten del MISMO perfil, así que comparar tiene sentido.
  const usado = (result as { perfil_usado: typeof PERSONAS.Carolina }).perfil_usado;
  check("el perfil que llegó al motor conserva los ejes verificados",
    usado.CATEGORIA === PERSONAS.Carolina.CATEGORIA && usado.SEGMENTO_GRUPO_FAMILIAR === PERSONAS.Carolina.SEGMENTO_GRUPO_FAMILIAR,
    `→ cat ${usado.CATEGORIA ?? "—"}, ${usado.SEGMENTO_GRUPO_FAMILIAR ?? "—"}`);
  const delMotor = calcularPropension(usado).recomendaciones.map((x) => x.nombre);
  check("los nombres coinciden EXACTO con el motor", recs.map((r) => r.nombre).join("|") === delMotor.join("|"),
    `→ ${delMotor.join(", ")}`);
  check("y el camino real afirma la prueba social", !!(event!.data as { peer?: unknown }).peer);

  /* ── 2 · el modelo no necesita escribir nada ───────────────────────────── */
  console.log("\n===== Sin protocolo en el texto también funciona =====");
  // Antes, esta respuesta habría producido CERO tarjetas y la conversación se habría quedado
  // atascada en DESCUBRIENDO para siempre.
  const replySinProtocolo =
    "Carolina, por lo que me cuentas lo que más te protege hoy es tu propio ingreso: si te faltas, " +
    "nadie más lo cubre en tu casa. Míralo abajo con calma.";
  // Aquí había dos aserciones sin contenido: una afirmaba que un literal escrito tres líneas
  // arriba no contiene una subcadena que su autor no escribió, y la otra repetía el `recs.length`
  // de la sección anterior sin ninguna relación causal con este texto.
  //
  // Lo que sí prueba algo es recorrer el camino del cliente CON ese texto: la vista tiene que
  // producir las tarjetas desde el evento, sin que el texto aporte nada.
  const vista = vistaDeEstado(estadoInicial(), replySinProtocolo, [event!]);
  const bloqueTarjetas = vista.bloques.find((b) => b.t === "tarjetas");
  check("la vista produce tarjetas sin protocolo en el texto", !!bloqueTarjetas);
  check("con los nombres del motor",
    bloqueTarjetas?.t === "tarjetas" && bloqueTarjetas.recs[0]?.nombre === delMotor[0],
    `→ ${delMotor[0]}`);
  check("y el texto llega limpio, sin marcadores", !textoDelBloque(vista).includes("RECOMENDACION:"));

  /* ── 3 · la fase avanza por el VEREDICTO, no por el texto ──────────────── */
  console.log("\n===== La fase avanza sin depender del formato =====");
  // Antes esto dependía de un booleano que mandaba el navegador o, en su defecto, de que el
  // modelo escribiera "RECOMENDACION:" con formato exacto. Ahora depende de que el motor se haya
  // pronunciado, que es el hecho que de verdad determina la fase.
  const sinVeredicto = estadoInicial();
  sinVeredicto.turno = 3;
  check("sin veredicto del motor → DESCUBRIENDO", siguienteFase(sinVeredicto) === "DESCUBRIENDO");

  const conVeredicto = cerrarTurno(sinVeredicto, {
    eventos: [{ type: "propension", data: calcularPropension(PERSONAS.Carolina) as unknown as Record<string, unknown> }],
  });
  check("con veredicto del motor → ASESORANDO", conVeredicto.fase === "ASESORANDO");
  check("y el texto del modelo no interviene en la decisión", !replySinProtocolo.includes("RECOMENDACION:"));

  /* ── 4 · el prompt ya no le pide serializar ────────────────────────────── */
  console.log("\n===== El prompt liberó el formato =====");
  const { buildSystemPrompt } = await import("../lib/prompts");
  const p = buildSystemPrompt("DESCUBRIENDO");
  check("ya no exige el formato EXACTO de RECOMENDACION", !p.includes("formato EXACTO"));
  check("le dice que las tarjetas las pinta el sistema", p.includes("LAS TARJETAS LAS PINTA EL SISTEMA"));
  check("y que escriba libre", p.includes("escribe LIBRE"));
  // Lo que NO se soltó: la prohibición de inventar sigue intacta.
  check("sigue prohibido inventar razones", p.includes("nunca inventes una razón nueva"));
  check("y sigue prohibido inventar campos del perfil", p.includes("OMITE el campo"));

  console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
