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
import { ejecutarTurno, type DepsTurno, type Msg, type SalidaTurno } from "../lib/turno";
import type { ConsultaIdentidad, UiEvent } from "../lib/estado/tipos";
import type { HallazgoIdentidad } from "../lib/estado/reducir";
import { abrir, sellar } from "../lib/estado/sello";
import { estadoInicial } from "../lib/estado/tipos";
import { vistaDeEstado, opcionesDeEventos } from "../lib/estado/vista";
import { prellenado, ETIQUETA_PRELLENO } from "../components/Chat";
import { executeTool } from "../lib/tools";
import { sanearPerfil } from "../lib/engine/sanear";
import { SALUDO_INICIAL, SIN_RESPUESTA } from "../lib/estado/vista";
import type { ToolCtx } from "../lib/tools";

let ok = true;
let total = 0;
const check = (label: string, cond: boolean, detalle?: string) => {
  total++;
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};
const checkEq = <T>(label: string, actual: T, esperado: T) =>
  check(`${label} === ${JSON.stringify(esperado)}`, Object.is(actual, esperado), `→ ${JSON.stringify(actual)}`);
const checkPresente = (label: string, v: unknown) =>
  check(`${label} presente`, v !== undefined && v !== null, `→ ${JSON.stringify(v)}`);

/**
 * Lo que la persona REALMENTE ve. Antes estas aserciones leían `salida.reply` y `salida.events`,
 * campos de compatibilidad que ya no existen. Leer de la vista es además más honesto: `reply`
 * podía traer cosas que nunca se pintaban.
 */
const textoDe = (s: SalidaTurno) =>
  s.ui.bloques.filter((b) => b.t === "texto").map((b) => (b as { contenido: string }).contenido).join("\n");
const tarjetasDe = (s: SalidaTurno) =>
  s.ui.bloques.filter((b) => b.t === "evento").map((b) => (b as { evento: UiEvent }).evento);
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
    checkEq("devuelve el texto del modelo", textoDe(r), "Soy Amparito, de amparar.");
    checkEq("sin tarjetas", tarjetasDe(r).length, 0);
    checkEq("con una sola llamada al modelo", llamadas.length, 1);
    // El system viaja en BLOQUES desde el #39 (prefijo cacheable). Se comprueba lo que importa —que
    // llegue el prompt entero— sin volver a atarse a que sea un string.
    const textoSystem = (s: unknown) =>
      typeof s === "string" ? s : (s as Array<{ text: string }>).map((b) => b.text).join("\n\n");
    check("y el system prompt viaja", textoSystem(llamadas[0].system).length > 100);
    check("y va partido para que el prefijo se pueda cachear (#39)",
      Array.isArray(llamadas[0].system) &&
      (llamadas[0].system as Array<{ cache_control?: unknown }>).filter((b) => b.cache_control).length === 1);
  }

  titulo("El loop de tools");
  {
    const { d, llamadas } = deps([usaTool("calcular_propension"), dice("Míralo abajo con calma.")]);
    const r = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("la tool se ejecutó y su tarjeta llegó a la vista", tarjetasDe(r).length, 1);
    checkEq("la tarjeta es la del motor", tarjetasDe(r)[0].type, "propension");
    checkEq("el texto final es el de la segunda vuelta", textoDe(r), "Míralo abajo con calma.");
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
    // La identidad ya no viaja como evento para que el cliente la recuerde: vive en el estado
    // sellado, que es su único portador.
    checkEq("la identidad queda en el estado", abrir(r.estado)?.identidad.nombre, "Carolina Ramírez López");
    checkEq("con su segmento verificado", abrir(r.estado)?.identidad.segmento?.CATEGORIA, "B");
    checkEq("y no se pinta como tarjeta", tarjetasDe(r).length, 0);
    const junto = (llamadas[0].system as Array<{ text: string }>).map((b) => b.text).join("\n\n");
    /*
     * 5d: encontrarla no es reconocerla. En este turno el prompt NO puede llevar su segmento —
     * escribir un nombre no basta para llevarse los datos de esa persona— y sí tiene que pedirle
     * que confirme.
     */
    check("el segmento NO viaja antes de verificar", !junto.includes("## SEGMENTO VERIFICADO"));
    check("y el prompt le pide confirmar quién es", /fecha de expedición/i.test(junto));

    // Y con la verificación resuelta, ahí sí.
    const yaVerificado = abrir(r.estado)!;
    yaVerificado.identidad.verificada = true;
    const { d: dv, llamadas: lv } = deps([dice("Bienvenida, Carolina.")], { resolver });
    await ejecutarTurno({ messages: [{ role: "user", content: "12/03/2005" }], estado: sellar(yaVerificado) }, dv);
    const juntoV = (lv[0].system as Array<{ text: string }>).map((b) => b.text).join("\n\n");
    check("tras confirmar, el contexto verificado sí entra", juntoV.includes("## SEGMENTO VERIFICADO"));
  }

  titulo("El formulario nace con lo que ya se sabe (5e)");
  {
    /*
     * Nacía vacío por construcción, incluso para alguien a quien Amparito acababa de reconocer y
     * saludar por su nombre. El pitch dice que "lo acompaña hasta completar el proceso" y ahí le
     * entregaba una hoja en blanco.
     */
    const resolver = async (): Promise<HallazgoIdentidad> => ({
      estado: "reconocido",
      nombre: "Carolina Ramírez López",
      segmento: { GENERO: "F", CATEGORIA: "A" },
    });
    const base = abrir((await ejecutarTurno({ messages: [{ role: "user", content: "Soy Carolina Ramírez López" }] },
      deps([dice("Hola.")], { resolver }).d)).estado)!;
    base.identidad.verificada = true;

    // Con la tool REAL: el doble por defecto devuelve siempre un evento de propensión, así que
    // este bloque estaría midiendo el doble y no `collect_customer_data`.
    const { d } = deps(
      [usaTool("collect_customer_data", { productId: "vida_panamerican" }), dice("Ahí lo tienes.")],
      { resolver, ejecutarTool: executeTool }
    );
    const r = await ejecutarTurno(
      { messages: [{ role: "user", content: "Sí, avancemos" }], estado: sellar(base) },
      d
    );
    // El formulario no es un bloque del hilo: `vistaDeEstado` lo pone en `entrada`, porque
    // mientras está abierto la casilla de texto se deshabilita.
    check("el formulario se abre", !!r.ui.entrada.formulario);
    const conocido = r.ui.entrada.formulario?.conocido as
      | { nombre?: string; origen?: string }
      | undefined;
    check("y llega con el nombre ya escrito", conocido?.nombre === "Carolina Ramírez López");
    check("  …etiquetado como venido de la base, porque está verificada", conocido?.origen === "base");
    check("  …y el componente lo pinta en el campo", prellenado(conocido).nombre === "Carolina Ramírez López");

    /*
     * SOLO el nombre, y hay que decirlo sin adornos: la base tiene nombre, género, rango de edad,
     * categoría, grupo familiar y ciudad. NO tiene documento, fecha de nacimiento, celular ni
     * correo. Prellenar esos cuatro sería inventarse una capacidad que Colsubsidio no nos dio.
     */
    const campos = Object.keys(prellenado(conocido));
    check("y NO se inventa lo que la base no tiene", campos.join() === "nombre", `→ ${campos.join(", ") || "nada"}`);
  }

  titulo("Sin verificar, lo que se escribe es lo que ella dijo (5e)");
  {
    // Andrés no aparece en la base: su nombre también se prellena, pero no se le atribuye a
    // Colsubsidio un dato que puso él.
    const resolver = async (): Promise<HallazgoIdentidad> => ({ estado: "no_encontrado", nombre: "Andrés Gómez Ruiz" });
    // Con la tool REAL: el doble por defecto devuelve siempre un evento de propensión, así que
    // este bloque estaría midiendo el doble y no `collect_customer_data`.
    const { d } = deps(
      [usaTool("collect_customer_data", { productId: "vida_panamerican" }), dice("Ahí lo tienes.")],
      { resolver, ejecutarTool: executeTool }
    );
    const r = await ejecutarTurno({ messages: [{ role: "user", content: "Soy Andrés Gómez Ruiz" }] }, d);
    const conocido = r.ui.entrada.formulario?.conocido as { origen?: string } | undefined;
    check("el origen dice que lo dijo él, no la base", conocido?.origen === "declarado");
    check("y la etiqueta que se pinta lo refleja", ETIQUETA_PRELLENO["declarado"] === "lo dijiste tú");
  }

  titulo("Sin verificar, NO se escribe el nombre de la base (5e · repaso)");
  {
    /*
     * Este es el agujero que 5e abrió en 5d y que encontró la revisión. La primera versión usaba
     * `identidad.nombre` siempre, etiquetándolo "declarado" mientras no estuviera verificada:
     *
     *     ella escribe   "soy carolina ramirez"
     *     la base tiene  "CAROLINA RAMÍREZ LÓPEZ"
     *     el formulario  recibía el apellido que nunca tecleó, sin verificar, y encima
     *                    atribuido a ella
     *
     * Dos faltas a la vez: revela un dato de la base antes de tiempo, y le atribuye a la persona
     * algo que no dijo.
     */
    const resolver = async (): Promise<HallazgoIdentidad> => ({
      estado: "reconocido",
      nombre: "CAROLINA RAMÍREZ LÓPEZ",
      segmento: { GENERO: "F" },
    });
    const { d } = deps(
      [usaTool("collect_customer_data", { productId: "vida_panamerican" }), dice("Ahí lo tienes.")],
      { resolver, ejecutarTool: executeTool }
    );
    const r = await ejecutarTurno({ messages: [{ role: "user", content: "soy carolina ramirez" }] }, d);
    check("encontrada sin verificar: el formulario NO trae nada escrito",
      !r.ui.entrada.formulario?.conocido);
    check("y el apellido de la base no aparece por ningún lado",
      !JSON.stringify(r.ui).includes("LÓPEZ"));
  }

  titulo("Lo verificado llega también a la fase que cotiza (5b)");
  {
    /*
     * El bug que se veía en producción: a Carolina, reconocida, Amparito le preguntaba la edad, los
     * dependientes y el ingreso. La causa no era el prompt — era que el bloque de "lo que ya sabes"
     * se apagaba en ASESORANDO, justo la fase donde cotiza. La regla vivía en una fase y el
     * conocimiento en el estado.
     *
     * Se comprueba de punta a punta: por el turno real, con el estado sellado de vuelta.
     */
    const resolver = async (): Promise<HallazgoIdentidad> => ({
      estado: "reconocido",
      nombre: "Carolina Ramírez López",
      segmento: { GENERO: "F", CATEGORIA: "A", RANGO_EDAD: "36 a 45 años", SEGMENTO_GRUPO_FAMILIAR: "Monoparental" },
    });
    const { d: d1 } = deps([dice("Bienvenida, Carolina.")], { resolver });
    const t1 = await ejecutarTurno({ messages: [{ role: "user", content: "Soy Carolina Ramírez López" }] }, d1);

    // Turno 2: ya hay veredicto, así que la fase es ASESORANDO — donde antes no llegaba nada.
    const conVeredicto = abrir(t1.estado)!;
    conVeredicto.veredicto = { entregado: true, tipo: "recomendacion", recomendaciones: [], obligatorios: [], peer: null };
    const { d: d2, llamadas: l2 } = deps([dice("Claro.")], { resolver });
    const t2 = await ejecutarTurno(
      {
        messages: [
          { role: "user", content: "Soy Carolina Ramírez López" },
          { role: "assistant", content: "Bienvenida." },
          { role: "user", content: "Quiero el Seguro de Vida" },
        ],
        estado: sellar(conVeredicto),
      },
      d2
    );
    checkEq("la fase del turno es ASESORANDO", abrir(t2.estado)?.fase, "ASESORANDO");
    const sys2 = (l2[0].system as Array<{ text: string }>).map((b) => b.text).join("\n\n");
    check("y el prompt SÍ le dice lo que ya sabe de ella", sys2.includes("LO QUE YA SABES DE ESTA PERSONA"));
    check("  …incluida la edad verificada", /Verificado por Colsubsidio[^\n]*36 a 45/.test(sys2));
    check("  …y que la edad exacta se pide solo al cotizar", /únicamente cuando vayas a cotizar/.test(sys2));
    check("  …y que aquí NO abra preguntas de perfilamiento", /NO abras preguntas de perfilamiento/.test(sys2));
  }

  titulo("La guarda del doble cañón");
  {
    const { d, llamadas } = deps([
      dice("¿Tienes vehículo, o tu vivienda es propia?"),
      dice("¿Tienes vehículo?"),
    ]);
    const r = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("se reintenta y gana la versión corregida", textoDe(r), "¿Tienes vehículo?");
    checkEq("costó una llamada extra", llamadas.length, 2);
  }

  titulo("El turno publica la vista");
  {
    // La vista es lo ÚNICO que sale del turno: no hay ya un `reply` paralelo por el que se pueda
    // colar el protocolo viejo. Se comprueba que el texto sale limpio y las sugerencias aparte.
    const { d } = deps([usaTool("ofrecer_opciones", { opciones: ["Sí", "No"] }), dice("¿Avanzamos?")], {
      ejecutarTool: executeTool,
    });
    const conOpciones = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("el texto sale limpio de protocolo", textoDe(conOpciones).includes("OPCIONES:"), false);
    checkEq("y las sugerencias vienen del evento, no del texto", conOpciones.ui.sugerencias.join("|"), "Sí|No");

    // El turno 0 también publica vista.
    const t0 = await ejecutarTurno({ messages: [] }, deps([dice("no se usa")]).d);
    checkEq("el saludo viaja como un bloque de texto", t0.ui.bloques.length, 1);
    checkEq("con el copy del servidor", (t0.ui.bloques[0] as { contenido: string }).contenido, SALUDO_INICIAL);
    checkEq("y la casilla queda habilitada", t0.ui.entrada.habilitada, true);

    // Un formulario bloquea la casilla: es estado de la entrada, no una tarjeta más.
    const conForm = await ejecutarTurno(
      { messages: HOLA, estado: sellar(estadoInicial()) },
      deps([usaTool("collect_customer_data", { productId: "vida_panamerican" }), dice("Llena esto.")], {
        ejecutarTool: executeTool,
      }).d
    );
    checkEq("con formulario la casilla se bloquea", conForm.ui.entrada.habilitada, false);
    checkPresente("y el formulario viaja en la vista", conForm.ui.entrada.formulario);
    checkEq("sin pintarse como tarjeta", conForm.ui.bloques.filter((b) => b.t === "evento").length, 0);
  }

  titulo("Las quick-replies dejan de ser un protocolo de texto");
  {
    // Adversos primero. La lista vacía es el que importa: un evento sin opciones pintaría una
    // fila de botones fantasma.
    const vacio = await executeTool("ofrecer_opciones", { opciones: [] });
    checkEq("sin opciones válidas no se emite evento", vacio.event, undefined);
    const sucio = await executeTool("ofrecer_opciones", { opciones: ["  ", "Sí", "", "No", "Tal vez", "Otra", "Sexta"] });
    checkEq("se limpian los vacíos y se topa en 4", (sucio.event?.data.opciones as string[]).join("|"), "Sí|No|Tal vez|Otra");
    const noEsArray = await executeTool("ofrecer_opciones", { opciones: "Sí" });
    checkEq("un valor que no es lista no rompe nada", noEsArray.event, undefined);

    // Y el camino feliz, de punta a punta.
    const { d } = deps([usaTool("ofrecer_opciones", { opciones: ["Para el diario", "Para trabajar"] }), dice("¿Para qué la usas?")], {
      ejecutarTool: executeTool,
    });
    const r = await ejecutarTurno({ messages: [{ role: "user", content: "Tengo una moto" }], estado: sellar(estadoInicial()) }, d);
    checkEq("las opciones llegan a la vista", r.ui.sugerencias.join("|"), "Para el diario|Para trabajar");
    checkEq("y NO pintan tarjeta: son estado, no contenido", tarjetasDe(r).length, 0);
    checkEq("el texto del modelo queda limpio de protocolo", textoDe(r).includes("OPCIONES:"), false);
  }

  /* 1b · El estado va y vuelve ───────────────────────────────────────────── */

  titulo("El turno 0 lo produce el servidor");
  {
    // Casos adversos primero: pedirlo dos veces y pedirlo a mitad de conversación por un error del
    // cliente. Ninguno puede corromper el estado ni gastar una llamada al modelo.
    const { d, llamadas } = deps([dice("esto no debería usarse")]);
    const t0 = await ejecutarTurno({ messages: [] }, d);
    checkEq("devuelve el saludo", textoDe(t0), SALUDO_INICIAL);
    checkEq("sin llamar al modelo", llamadas.length, 0);
    checkEq("sin tarjetas", tarjetasDe(t0).length, 0);
    checkEq("y sin avanzar el turno", abrir(t0.estado)?.turno, 0);
    checkEq("deja constancia de que ya saludó", abrir(t0.estado)?.dichoUnaVez.saludo, true);

    const repetido = await ejecutarTurno({ messages: [], estado: t0.estado }, d);
    checkEq("pedirlo dos veces devuelve lo mismo", textoDe(repetido), SALUDO_INICIAL);
    checkEq("y sigue sin avanzar el turno", abrir(repetido.estado)?.turno, 0);

    // A mitad de conversación (cliente mal portado): no debe borrar lo acumulado.
    const enMarcha = await ejecutarTurno(
      { messages: [{ role: "assistant", content: "algo" }], estado: t0.estado },
      d
    );
    checkEq("con solo mensajes del asistente tampoco llama al modelo", llamadas.length, 0);
    checkEq("y el estado sobrevive intacto", abrir(enMarcha.estado)?.turno, 0);
  }

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

  titulo("Perder el estado a mitad no devuelve a la persona al saludo");
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
    // Estado perdido a mitad de conversación: sello inválido, o un lambda con otro secreto. No es
    // compatibilidad, es RECUPERACIÓN — y lo que no puede pasar es que la persona vuelva a la
    // fase SALUDO y Amparito se presente de nuevo en el mensaje seis.
    const r = await ejecutarTurno(
      {
        messages: [
          { role: "user", content: "Soy Carolina Ramírez López" },
          { role: "assistant", content: "Bienvenida." },
          { role: "user", content: "tengo un carro" },
        ],
        estado: "sello-invalido.deadbeef",
      },
      deps([dice("Cuéntame más.")], { resolver }).d
    );
    // Dos mensajes de la persona en el historial → este es su turno 2, no el 1.
    checkEq("se recupera el número de turno del historial", abrir(r.estado)?.turno, 2);
    /*
     * La aserción es que NO se vuelve al saludo —que es lo que este bloque protege—, no un valor
     * concreto. Al perderse el sello también se pierde la verificación, así que vuelve a pedirla:
     * es el lado correcto en el que fallar. Un estado que no se puede autenticar no debería dar por
     * buena una verificación que nadie puede comprobar que ocurrió.
     */
    check("así que NO se vuelve a la fase SALUDO", abrir(r.estado)?.fase !== "SALUDO");
    checkEq("y la verificación se vuelve a exigir", abrir(r.estado)?.fase, "VERIFICANDO");
    checkEq("y se vuelve a resolver la identidad desde el mensaje", consultas[0]?.modo, "detectar");
  }

  titulo("Un nombre que no aparece se recuerda, pero no se pinta");
  {
    const resolver = async (): Promise<HallazgoIdentidad> => ({
      estado: "no_encontrado",
      nombre: "Zulema Trastamara Quispe Vergara",
    });
    const r = await ejecutarTurno(
      { messages: [{ role: "user", content: "Soy Zulema Trastamara Quispe Vergara" }] },
      deps([dice("No apareces en la base, pero te atiendo igual.")], { resolver }).d
    );
    checkEq("no se pinta ninguna tarjeta de identidad", tarjetasDe(r).length, 0);
    // El ESTADO sí lo recuerda: es lo que permite no volver a insistir con el tema.
    checkEq("pero el estado lo recuerda", abrir(r.estado)?.identidad.resultado, "no_encontrado");
    checkPresente("con el turno en que se le dijo", abrir(r.estado)?.identidad.avisadoEnTurno);
  }

  titulo("El perfil sobrevive aunque el modelo no lo retranscriba");
  {
    const ctxVistos: ToolCtx[] = [];
    // La tool falsa usa la compuerta REAL: así el test ejercita el saneamiento de verdad, no una
    // imitación que podría divergir de él.
    const ejecutarTool = async (_n: string, input: Record<string, unknown>, ctx?: ToolCtx) => {
      ctxVistos.push(ctx ?? {});
      const { perfil, descartes } = sanearPerfil(input.perfil, ctx);
      return {
        result: { perfil_usado: perfil, descartado_por_falta_de_evidencia: descartes },
        event: { type: "propension" as const, data: { recomendaciones: [] } },
      };
    };

    const t1 = await ejecutarTurno(
      { messages: [{ role: "user", content: "Tengo una moto y la uso para trabajar" }] },
      deps([usaTool("calcular_propension", { perfil: { enriquecido: { tiene_vehiculo: ["moto"] } } }), dice("Listo.")], { ejecutarTool }).d
    );
    checkEq("turno 1 · la moto queda en el estado", abrir(t1.estado)?.perfil.enriquecido?.tiene_vehiculo?.[0], "moto");
    checkEq("turno 1 · con su procedencia", abrir(t1.estado)?.perfil._origen?.["enriquecido.tiene_vehiculo"], "declarado");

    // Turno 2: el modelo NO retranscribe el perfil. Antes, aquí el motor lo perdía entero.
    const t2 = await ejecutarTurno(
      {
        messages: [
          { role: "user", content: "Tengo una moto y la uso para trabajar" },
          { role: "assistant", content: "Listo." },
          { role: "user", content: "¿y eso qué cubre?" },
        ],
        estado: t1.estado,
      },
      deps([usaTool("calcular_propension", { perfil: {} }), dice("Te cuento.")], { ejecutarTool }).d
    );
    checkEq("la tool recibió el perfil previo como piso", ctxVistos[1]?.perfilPrevio?.enriquecido?.tiene_vehiculo?.[0], "moto");
    checkEq("turno 2 · la moto SIGUE en el estado", abrir(t2.estado)?.perfil.enriquecido?.tiene_vehiculo?.[0], "moto");
    checkEq("y su procedencia intacta", abrir(t2.estado)?.perfil._origen?.["enriquecido.tiene_vehiculo"], "declarado");
  }

  /* 2 · Caracterización de los defectos que arregla el bloque 2 ──────────── */

  titulo("El texto que acompaña a una tool se rescata");
  {
    // El modelo suele escribir la pregunta Y llamar la tool en el MISMO mensaje. Como `reply` sale
    // de la respuesta FINAL del loop, ese texto se perdía y el turno salía mudo. Pasaba con
    // cualquier tool desde siempre, pero con `ofrecer_opciones` dejó de ser raro para ser el
    // patrón natural — así que se rescata.
    const conTextoYTool = msg(
      [
        { type: "text", text: "¿Para qué usas la moto?" },
        { type: "tool_use", id: "toolu_x", name: "ofrecer_opciones", input: { opciones: ["Trabajo", "Diario"] } },
      ],
      "tool_use"
    );
    const { d } = deps([conTextoYTool, dice("")], { ejecutarTool: executeTool });
    const r = await ejecutarTurno({ messages: HOLA, estado: sellar(estadoInicial()) }, d);
    checkEq("el texto escrito junto a la tool SÍ llega a la persona", textoDe(r), "¿Para qué usas la moto?");
    checkEq("y las opciones también", r.ui.sugerencias.length, 2);

    // Es un RESCATE, no una acumulación: si la ronda final trae texto, manda ella. Acumular
    // duplicaría el mensaje cuando el modelo se repite.
    const { d: d2 } = deps([conTextoYTool, dice("Cuéntame para qué la usas.")], { ejecutarTool: executeTool });
    const r2 = await ejecutarTurno({ messages: HOLA, estado: sellar(estadoInicial()) }, d2);
    checkEq("si la ronda final habla, manda ella", textoDe(r2), "Cuéntame para qué la usas.");
    checkEq("y no se duplica con la intermedia", textoDe(r2).includes("¿Para qué usas la moto?"), false);
  }

  titulo("Defecto #6 — un turno nunca sale mudo");
  {
    // El modelo se queda pidiendo tools para siempre: se agotan las 8 rondas y la última
    // respuesta solo trae tool_use. Antes el turno salía sin una sola frase.
    const { d, llamadas } = deps([usaTool("get_catalog")]);
    const r = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("al agotar las rondas se fuerza una salida de texto", llamadas.length, 10);
    check("y la persona recibe algo", textoDe(r).length > 0, `→ "${textoDe(r)}"`);
    checkEq("la tarjeta del motor sigue ahí", tarjetasDe(r).length, 1);
    // El guion falso responde siempre con tool_use, así que ni con `tool_choice: none` produce
    // texto: se cae al copy de último recurso. Un modelo real casi siempre habla en esa llamada.
    checkEq("si ni así habla, hay copy de último recurso", textoDe(r), SIN_RESPUESTA);

    // Adverso: si la llamada de cierre TAMBIÉN falla, sigue sin poder salir mudo.
    let n = 0;
    const modeloQueMuere = {
      crear: async (p: Parameters<typeof d.modelo.crear>[0]) => {
        n++;
        if (n > 9) throw new Error("la API no responde");
        return usaTool("get_catalog");
      },
    };
    const rr = await ejecutarTurno({ messages: HOLA }, { ...d, modelo: modeloQueMuere });
    checkEq("si la llamada de cierre falla, igual se dice algo", textoDe(rr), SIN_RESPUESTA);
  }

  titulo("Defecto #7 — una tool que falla no se lleva el turno");
  {
    let llamadasTool = 0;
    const ejecutarTool = async () => {
      llamadasTool++;
      if (llamadasTool === 1) return { result: { ok: true }, event: eventoPropension };
      throw new Error("la aseguradora no respondió");
    };
    // Dos tools con input DISTINTO: dos trabajos distintos, y el segundo falla. Con inputs
    // iguales el dedupe las colapsa en una —que es lo correcto— y el escenario no existiría.
    const dosDistintas = msg(
      [
        { type: "tool_use", id: "a", name: "calcular_propension", input: { perfil: { GENERO: "F" } } },
        { type: "tool_use", id: "b", name: "quote_product", input: { productId: "vida_panamerican" } },
      ],
      "tool_use"
    );
    const { d, llamadas } = deps([dosDistintas, dice("Se me cayó una consulta.")], { ejecutarTool });

    let lanzo = false;
    let recibido: SalidaTurno | null = null;
    try {
      recibido = await ejecutarTurno({ messages: HOLA }, d);
    } catch {
      lanzo = true;
    }
    checkEq("la excepción NO sale del turno", lanzo, false);
    checkEq("las dos tools se intentaron", llamadasTool, 2);
    checkPresente("el llamador recibe su turno", recibido);
    checkEq("y el evento que ya se había acumulado SOBREVIVE", tarjetasDe(recibido!).length, 1);
    checkEq("con el texto del modelo", textoDe(recibido!), "Se me cayó una consulta.");

    // El fallo se le devuelve al modelo por el canal que la API tiene para eso. Antes los errores
    // se serializaban como éxitos y era el PROMPT quien le explicaba cómo reconocerlos.
    const ultima = llamadas[1].messages.at(-1);
    const bloques = (ultima?.content ?? []) as Array<{ type: string; is_error?: boolean; content?: string }>;
    checkEq("el tool_result del fallo va marcado con is_error", bloques[1]?.is_error, true);
    checkEq("y el que sí funcionó no", bloques[0]?.is_error, undefined);
    check("el error le dice al modelo qué NO hacer", String(bloques[1]?.content).includes("No inventes"));
  }

  titulo("Un fallo se marca; una compuerta que dice que no, NO");
  {
    // El caso COMÚN no es que la tool lance: ocho sitios devuelven `{error: ...}` sin lanzar, y
    // el modelo no tenía cómo distinguirlos de un éxito.
    const { d, llamadas } = deps([usaTool("get_product_details", { productId: "no_existe" }), dice("No encontré ese.")], {
      ejecutarTool: executeTool,
    });
    await ejecutarTurno({ messages: HOLA, estado: sellar(estadoInicial()) }, d);
    const b1 = (llamadas[1].messages.at(-1)?.content ?? []) as Array<{ is_error?: boolean }>;
    checkEq("un producto inexistente se marca como fallo", b1[0]?.is_error, true);

    // Y el que importa de verdad: una compuerta de cumplimiento NO es una avería. Marcarla
    // invitaría al modelo a reintentarla, que es exactamente lo que la compuerta impide.
    const { d: d2, llamadas: l2 } = deps(
      [usaTool("issue_policy", { quoteId: "q1", consentimiento: false, contacto: {} }), dice("Necesito tu autorización.")],
      { ejecutarTool: executeTool }
    );
    await ejecutarTurno({ messages: HOLA, estado: sellar(estadoInicial()) }, d2);
    const b2 = (l2[1].messages.at(-1)?.content ?? []) as Array<{ is_error?: boolean; content?: string }>;
    check("la compuerta de consentimiento se disparó", String(b2[0]?.content).includes("CONSENTIMIENTO_REQUERIDO"));
    checkEq("y NO se marca como fallo", b2[0]?.is_error, undefined);
  }

  titulo("Defecto #8 — el motor no corre dos veces por la misma llamada");
  {
    let corridas = 0;
    const ejecutarTool = async () => {
      corridas++;
      return { result: { ok: true }, event: eventoPropension };
    };
    const { d } = deps([usaDosTools("calcular_propension"), dice("Míralo abajo.")], { ejecutarTool });
    const r = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("dos tool_use idénticos ejecutan el motor UNA vez", corridas, 1);
    checkEq("y la persona ve una sola tarjeta", tarjetasDe(r).length, 1);

    // Adverso: dos llamadas a la MISMA tool con input distinto sí son dos trabajos distintos.
    let corridas2 = 0;
    const contar = async () => {
      corridas2++;
      return { result: { ok: true } };
    };
    const dosDistintas = msg(
      [
        { type: "tool_use", id: "a", name: "get_product_details", input: { productId: "uno" } },
        { type: "tool_use", id: "b", name: "get_product_details", input: { productId: "dos" } },
      ],
      "tool_use"
    );
    const { d: d2 } = deps([dosDistintas, dice("Listo.")], { ejecutarTool: contar });
    await ejecutarTurno({ messages: HOLA }, d2);
    checkEq("con input distinto SÍ se ejecutan las dos", corridas2, 2);

    // Y se ejecutan EN PARALELO. Estaban en serie, así que dos tools sumaban sus latencias: con
    // el motor local da igual, pero `quote_product` e `issue_policy` van por el gateway de la
    // aseguradora y eran round-trips de red encadenados sin motivo.
    let enCurso = 0;
    let simultaneasMax = 0;
    const lenta = async () => {
      enCurso++;
      simultaneasMax = Math.max(simultaneasMax, enCurso);
      await new Promise((r) => setTimeout(r, 30));
      enCurso--;
      return { result: { ok: true } };
    };
    const { d: d3 } = deps([dosDistintas, dice("Listo.")], { ejecutarTool: lenta });
    const t0 = Date.now();
    await ejecutarTurno({ messages: HOLA }, d3);
    const transcurrido = Date.now() - t0;
    checkEq("las dos estuvieron en vuelo a la vez", simultaneasMax, 2);
    check("y el turno no sumó las dos esperas", transcurrido < 55, `→ ${transcurrido} ms para 2×30 ms`);
  }

  titulo("Defecto #9 — el reintento del doble cañón produce texto");
  {
    const { d, llamadas } = deps([
      dice("¿Tienes vehículo, o tu vivienda es propia?"),
      dice("¿Tienes vehículo?"),
    ]);
    const r = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("gana la versión corregida", textoDe(r), "¿Tienes vehículo?");
    // Antes el reintento pasaba las tools sin restricción: si el modelo respondía con tool_use,
    // no se ejecutaba nada, `corregido` quedaba vacío y la llamada se descartaba entera.
    checkEq("el reintento prohíbe usar tools", (llamadas[1].tool_choice as { type: string })?.type, "none");
    // Y la corrección va en el TURNO, no concatenada al system: editar el system a mitad de
    // conversación rompe cualquier prefijo cacheable.
    // Se compara como booleano: `checkEq` imprime los valores, y aquí son dos prompts enteros.
    // Por CONTENIDO, no por referencia: hoy es el mismo objeto y un `===` pasaría siempre, incluso
    // el día que alguien vuelva a concatenar algo al system del reintento.
    check("el system del reintento es idéntico al del turno",
      JSON.stringify(llamadas[1].system) === JSON.stringify(llamadas[0].system));
    check("la corrección viaja como mensaje", String((llamadas[1].messages.at(-1) as { content: string }).content).includes("UNA SOLA pregunta"));
  }

  titulo("Defecto #3 — no se publican afirmaciones sobre la base sin respaldo");
  {
    const resolver = async (): Promise<HallazgoIdentidad> => ({
      estado: "no_encontrado",
      nombre: "Carolina Ramírez",
    });
    const fabricada = "Mucho gusto. Hay varios Carolinas en Colsubsidio 😅 ¿En qué ciudad estás?";

    // El modelo se corrige al primer aviso: es el camino esperado.
    const { d, llamadas } = deps([dice(fabricada), dice("Mucho gusto. ¿En qué ciudad estás?")], { resolver });
    const r = await ejecutarTurno({ messages: HOLA }, d);
    checkEq("la afirmación fabricada no se publica", textoDe(r).includes("varios Carolinas"), false);
    checkEq("gana la versión corregida", textoDe(r), "Mucho gusto. ¿En qué ciudad estás?");
    check("la corrección le dice exactamente qué afirmó de más",
      String((llamadas[1].messages.at(-1) as { content: string }).content).includes("no devolvió homónimos"));

    // Y el adverso que importa: si INSISTE, se poda la frase en vez de publicarla.
    const { d: d2 } = deps([dice(fabricada), dice(fabricada)], { resolver });
    const r2 = await ejecutarTurno({ messages: HOLA }, d2);
    checkEq("si insiste, la frase se poda", textoDe(r2).includes("varios Carolinas"), false);
    check("y sobrevive el resto del mensaje", textoDe(r2).includes("¿En qué ciudad estás?"), `→ "${textoDe(r2)}"`);
  }

  console.log(`\n${ok ? "✅" : "❌"} ${total} verificaciones · ${ok ? "todo en verde" : "HAY FALLOS"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
