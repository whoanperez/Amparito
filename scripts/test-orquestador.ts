/**
 * Gate del orquestador del turno (Bloque 1 · paso 2a).
 *   npx tsx scripts/test-orquestador.ts
 *
 * POR QUÉ EXISTE. `app/api/chat/route.ts` era el ÚNICO archivo del sistema con cero cobertura, y
 * es donde viven cuatro de los seis bugs que rompen el demo. No se pueden arreglar a ciegas: hay
 * que poder reproducirlos. Con el modelo inyectable, el turno entero se ejercita sin red y sin
 * gastar un token.
 *
 * QUÉ SON LOS BLOQUES "HOY (defecto #N)". Son tests de CARACTERIZACIÓN: afirman la conducta que
 * el sistema tiene hoy, no la que debería tener. No son aspiraciones ni deuda disfrazada de
 * verde: están para que, cuando el bloque 2 arregle cada defecto, el gate falle y obligue a
 * cambiar la aserción — y el diff muestre exactamente qué conducta cambió. Un refactor que dice
 * "no cambio nada" solo es creíble si "nada" está escrito en algún sitio.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { ejecutarTurno, type DepsTurno, type Msg } from "../lib/turno";
import type { ConsultaIdentidad, UiEvent } from "../lib/estado/tipos";
import type { HallazgoIdentidad } from "../lib/estado/reducir";
import { abrir } from "../lib/estado/sello";

let ok = true;
let total = 0;
const check = (label: string, cond: boolean, detalle?: string) => {
  total++;
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};
const checkEq = <T>(label: string, actual: T, esperado: T) =>
  check(`${label} === ${JSON.stringify(esperado)}`, Object.is(actual, esperado), `→ ${JSON.stringify(actual)}`);
const titulo = (t: string) => console.log(`\n===== ${t} =====`);

/* ── El doble del modelo ──────────────────────────────────────────────────── */

const msg = (content: unknown[], stop_reason: string): Anthropic.Message =>
  ({
    id: "msg_falso", type: "message", role: "assistant", model: "falso",
    content, stop_reason, stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  } as unknown as Anthropic.Message);

const dice = (t: string) => msg([{ type: "text", text: t }], "end_turn");
const usaTool = (name: string, input: unknown = {}, id = "toolu_1") =>
  msg([{ type: "tool_use", id, name, input }], "tool_use");
/** Un solo mensaje con DOS tool_use: es lo que el modelo hace si lo corrigen a mitad de turno. */
const usaDosTools = (name: string) =>
  msg(
    [
      { type: "tool_use", id: "toolu_a", name, input: {} },
      { type: "tool_use", id: "toolu_b", name, input: {} },
    ],
    "tool_use"
  );

/** Devuelve el guion en orden; si se acaba, repite el último (así se agotan las rondas). */
function modeloGuionado(guion: Anthropic.Message[]) {
  const llamadas: Anthropic.MessageCreateParamsNonStreaming[] = [];
  let i = 0;
  return {
    llamadas,
    cliente: {
      crear: async (p: Anthropic.MessageCreateParamsNonStreaming) => {
        llamadas.push(p);
        return guion[Math.min(i++, guion.length - 1)];
      },
    },
  };
}

const sinIdentidad = async (): Promise<HallazgoIdentidad> => ({ estado: "sin_intento" });
const eventoPropension: UiEvent = { type: "propension", data: { recomendaciones: [{ nombre: "Seguro de Vida" }] } };
const toolNormal = async () => ({ result: { ok: true }, event: eventoPropension });

const deps = (guion: Anthropic.Message[], extra: Partial<DepsTurno> = {}) => {
  const m = modeloGuionado(guion);
  return {
    d: { modelo: m.cliente, resolver: sinIdentidad, ejecutarTool: toolNormal, ...extra } as DepsTurno,
    llamadas: m.llamadas,
  };
};

const HOLA: Msg[] = [{ role: "user", content: "Hola" }];

/* ─────────────────────────────────────────────────────────────────────────── */

async function main() {
  /* 1 · Lo que debe funcionar y funciona ─────────────────────────────────── */
  titulo("El turno normal");
  {
    const { d, llamadas } = deps([dice("Soy Amparito, de amparar.")]);
    const r = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("devuelve el texto del modelo", r.reply, "Soy Amparito, de amparar.");
    checkEq("sin eventos", r.events.length, 0);
    checkEq("con una sola llamada al modelo", llamadas.length, 1);
    check("y el system prompt viaja", typeof llamadas[0].system === "string" && llamadas[0].system.length > 100);
  }

  titulo("El loop de tools");
  {
    const { d, llamadas } = deps([usaTool("calcular_propension"), dice("Míralo abajo con calma.")]);
    const r = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("la tool se ejecutó y su evento se acumuló", r.events.length, 1);
    checkEq("el evento es el del motor", r.events[0].type, "propension");
    checkEq("el texto final es el de la segunda vuelta", r.reply, "Míralo abajo con calma.");
    checkEq("se llamó al modelo dos veces", llamadas.length, 2);

    const ultimo = llamadas[1].messages.at(-1);
    const bloques = (ultimo?.content ?? []) as Array<{ type: string }>;
    checkEq("y la segunda llamada lleva el tool_result", bloques[0]?.type, "tool_result");
  }

  titulo("La identidad entra por código, no por tool");
  {
    const resolver = async (): Promise<HallazgoIdentidad> => ({
      estado: "reconocido",
      nombre: "Carolina Ramírez López",
      ciudad: "Soacha",
      segmento: { GENERO: "F", CATEGORIA: "B" },
    });
    const { d, llamadas } = deps([dice("Bienvenida, Carolina.")], { resolver });
    const r = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("se emite el evento de afiliado", r.events[0]?.type, "afiliado");
    checkEq("con el nombre que se persiste", (r.events[0]?.data as { nombre: string }).nombre, "Carolina Ramírez López");
    check("y el contexto verificado entra al prompt", String(llamadas[0].system).includes("## SEGMENTO VERIFICADO"));
  }

  titulo("La guarda del doble cañón");
  {
    const { d, llamadas } = deps([
      dice("¿Tienes vehículo, o tu vivienda es propia?"),
      dice("¿Tienes vehículo?"),
    ]);
    const r = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("se reintenta y gana la versión corregida", r.reply, "¿Tienes vehículo?");
    checkEq("costó una llamada extra", llamadas.length, 2);
    check("el reintento lleva la corrección en el system", String(llamadas[1].system).includes("CORRECCIÓN INMEDIATA"));
  }

  /* 1b · El estado va y vuelve ───────────────────────────────────────────── */

  titulo("El estado va y vuelve, y congela la identidad");
  {
    const consultas: ConsultaIdentidad[] = [];
    const resolver = async (c: ConsultaIdentidad): Promise<HallazgoIdentidad> => {
      consultas.push(c);
      if (c.modo === "ninguna") return { estado: "sin_intento" };
      return {
        estado: "reconocido",
        nombre: "Carolina Ramírez López",
        ciudad: "Soacha",
        segmento: { GENERO: "F", CATEGORIA: "B" },
      };
    };

    const t1 = await ejecutarTurno(
      { messages: [{ role: "user", content: "Soy Carolina Ramírez López" }] },
      deps([dice("Bienvenida, Carolina.")], { resolver }).d
    );
    check("el turno devuelve un estado sellado", t1.estado.includes("."));
    checkEq("el primer turno busca por detección", consultas[0]?.modo, "detectar");

    const abiertoT1 = abrir(t1.estado);
    checkEq("el estado trae la identidad reconocida", abiertoT1?.identidad.resultado, "reconocido");
    checkEq("con el segmento congelado", abiertoT1?.identidad.segmento?.CATEGORIA, "B");
    checkEq("y el nombre canónico de la base", abiertoT1?.identidad.nombre, "Carolina Ramírez López");

    // Turno 2: con el estado en la mano, NO se vuelve a consultar la base.
    const t2 = await ejecutarTurno(
      {
        messages: [
          { role: "user", content: "Soy Carolina Ramírez López" },
          { role: "assistant", content: "Bienvenida, Carolina." },
          { role: "user", content: "tengo un carro" },
        ],
        estado: t1.estado,
      },
      deps([dice("Cuéntame más.")], { resolver }).d
    );
    checkEq("el segundo turno NO consulta la base", consultas[1]?.modo, "ninguna");
    checkEq("y el segmento sigue ahí", abrir(t2.estado)?.identidad.segmento?.CATEGORIA, "B");
    checkEq("el turno avanzó", abrir(t2.estado)?.turno, 2);
  }

  titulo("La ventana de compatibilidad no pierde la identidad");
  {
    const consultas: ConsultaIdentidad[] = [];
    const resolver = async (c: ConsultaIdentidad): Promise<HallazgoIdentidad> => {
      consultas.push(c);
      return {
        estado: "reconocido",
        nombre: "Carolina Ramírez López",
        segmento: { GENERO: "F", CATEGORIA: "B" },
      };
    };
    // El cliente viejo: manda `afiliado`, no manda `estado`.
    const r = await ejecutarTurno(
      {
        messages: [
          { role: "user", content: "Soy Carolina Ramírez López" },
          { role: "assistant", content: "Bienvenida." },
          { role: "user", content: "tengo un carro" },
        ],
        afiliado: { nombre: "Carolina Ramírez López", ciudad: "Soacha" },
      },
      deps([dice("Cuéntame más.")], { resolver }).d
    );
    // Reproduce la conducta vieja a propósito: sin estado no hay dónde congelar, así que se
    // vuelve a buscar. Lo que NO puede pasar es perder la identidad — eso sería una regresión
    // metida por un refactor que promete ser aditivo.
    checkEq("se busca por el nombre persistido", consultas[0]?.modo, "ciudad");
    checkEq("y la persona sigue reconocida", r.events[0]?.type, "afiliado");
    checkEq("con su nombre", (r.events[0]?.data as { nombre: string }).nombre, "Carolina Ramírez López");
  }

  titulo("Un nombre que no aparece NO se persiste");
  {
    const resolver = async (): Promise<HallazgoIdentidad> => ({
      estado: "no_encontrado",
      nombre: "Zulema Trastamara Quispe Vergara",
    });
    const r = await ejecutarTurno(
      { messages: [{ role: "user", content: "Soy Zulema Trastamara Quispe Vergara" }] },
      deps([dice("No apareces en la base, pero te atiendo igual.")], { resolver }).d
    );
    // Si se persistiera, el cliente lo reenviaría cada turno y la base se consultaría en vano
    // para siempre. El resolver viejo solo persistía `reconocido` y `ambiguo`.
    checkEq("no se emite evento de afiliado", r.events.filter((e) => e.type === "afiliado").length, 0);
    // Pero el ESTADO sí lo recuerda: es lo que permite no volver a insistir con el tema.
    checkEq("y aun así el estado lo recuerda", abrir(r.estado)?.identidad.resultado, "no_encontrado");
  }

  /* 2 · Caracterización de los defectos que arregla el bloque 2 ──────────── */

  titulo("HOY · defecto #6 — el turno muerto silencioso");
  {
    // El modelo se queda pidiendo tools para siempre: se agotan las 8 rondas.
    const { d, llamadas } = deps([usaTool("get_catalog")]);
    const r = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("HOY: al agotar las rondas el reply queda VACÍO", r.reply, "");
    // Los eventos SÍ vuelven —uno por ronda—; lo que deja el turno mudo es el texto vacío.
    checkEq("HOY: y sin embargo se acumularon 8 eventos, uno por ronda", r.events.length, 8);
    checkEq("se gastaron las 8 rondas + la inicial", llamadas.length, 9);
    console.log("      ↑ el usuario ve desaparecer el 'escribiendo…' y nada más. Bloque 2.");
  }

  titulo("HOY · defecto #7 — una excepción se lleva el turno y los eventos");
  {
    let llamadasTool = 0;
    const ejecutarTool = async () => {
      llamadasTool++;
      if (llamadasTool === 1) return { result: { ok: true }, event: eventoPropension };
      throw new Error("la aseguradora no respondió");
    };
    const { d } = deps([usaDosTools("calcular_propension"), dice("listo")], { ejecutarTool });

    let lanzo = false;
    let recibido: Awaited<ReturnType<typeof ejecutarTurno>> | null = null;
    try {
      recibido = await ejecutarTurno({ messages: HOLA }, d);
    } catch {
      lanzo = true;
    }
    checkEq("HOY: la excepción sale del turno entero", lanzo, true);
    // La primera tool completó y devolvió su evento; la segunda lanzó. Que el llamador reciba
    // `null` ES la pérdida — no queda ningún camino por el que recuperar lo ya acumulado.
    checkEq("la primera tool alcanzó a completar y emitir su evento", llamadasTool, 2);
    checkEq("HOY: y aun así el llamador no recibe NADA", recibido, null);
    console.log("      ↑ se pierde también el evento de identidad del turno. Sin is_error, el");
    console.log("        modelo tampoco ve el fallo para recuperarse. Bloque 2.");
  }

  titulo("HOY · defecto #8 — doble tarjeta de propensión");
  {
    const { d } = deps([usaDosTools("calcular_propension"), dice("Míralo abajo.")]);
    const r = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("HOY: dos llamadas en un turno producen DOS eventos", r.events.length, 2);
    console.log("      ↑ `vistaDeEstado` ya lo dedupe en el cliente, pero el orquestador");
    console.log("        sigue emitiendo los dos. Bloque 2.");
  }

  titulo("HOY · defecto #9 — el reintento pasa tools y tira lo que reciba");
  {
    const { d, llamadas } = deps([
      dice("¿Tienes vehículo, o tu vivienda es propia?"),
      usaTool("get_catalog"), // el reintento responde con tool_use
    ]);
    const r = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("HOY: se conserva la respuesta de doble cañón sin corregir", r.reply, "¿Tienes vehículo, o tu vivienda es propia?");
    checkEq("HOY: y la llamada del reintento se pagó igual", llamadas.length, 2);
    check("el reintento sí llevaba tools", Array.isArray(llamadas[1].tools) && llamadas[1].tools!.length > 0);
    console.log("      ↑ 1-2 s y un turno de modelo tirados en silencio. Bloque 2.");
  }

  console.log(`\n${ok ? "✅" : "❌"} ${total} verificaciones · ${ok ? "todo en verde" : "HAY FALLOS"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
