/**
 * Gate del estado de la conversación (Bloque 1).
 *   npx tsx scripts/test-estado.ts
 *
 * POR QUÉ EXISTE. Siete de los bugs del inventario eran uno solo: el estado no tenía dueño y se
 * reconstruía cada turno desde dos booleanos que mandaba el navegador. Este gate cubre el
 * reducer que lo reemplaza — y como el reducer es puro, se puede ejercitar entero sin red, sin
 * base y sin modelo.
 *
 * CÓMO ESTÁ ESCRITO. Con aserciones de PRESENCIA, no de ausencia. El patrón que dejaba ~8 de 12
 * suites incapaces de dar rojo era afirmar que algo malo no aparecía (`!== "Hogar"`, `!tieneVida`,
 * `length === 0`): un check así nunca falla si desaparece TODO, y "desaparece todo" es justo el
 * modo de falla de un motor hecho de compuertas que descartan y early-returns que vacían.
 * Aquí se afirma el valor exacto que debe estar.
 */
import {
  iniciarTurno, aplicarIdentidad, cerrarTurno, siguienteFase, soloNombre, soloCiudad,
} from "../lib/estado/reducir";
import { estadoInicial } from "../lib/estado/tipos";
import type { EstadoConversacion, UiEvent } from "../lib/estado/tipos";
import { vistaDeEstado, limpiarTexto, SALUDO_INICIAL } from "../lib/estado/vista";
import { sellar, abrir, abrirOInicial } from "../lib/estado/sello";
import { contextoDeEstado } from "../lib/estado/contexto";
import { sanearPerfil } from "../lib/engine/sanear";
import { calcularPropension } from "../lib/engine/scorecard";
import { PERSONAS } from "../lib/engine/fixtures";

let ok = true;
let total = 0;

const check = (label: string, cond: boolean, detalle?: string) => {
  total++;
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

/** Igualdad estricta, imprimiendo lo que salió. Un `!==` contra un literal no distingue "otro
 *  valor" de "no hay ningún valor"; esto sí. */
const checkEq = <T>(label: string, actual: T, esperado: T) =>
  check(`${label} === ${JSON.stringify(esperado)}`, Object.is(actual, esperado), `→ ${JSON.stringify(actual)}`);

/** Exige que exista y no esté vacío. */
const checkPresente = (label: string, v: unknown) =>
  check(
    `${label} presente`,
    v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
    `→ ${JSON.stringify(v)}`
  );

const titulo = (t: string) => console.log(`\n===== ${t} =====`);

/** Un evento de propensión con el resultado REAL del motor, no un objeto escrito a mano. */
const eventoPropension = (data: unknown): UiEvent => ({
  type: "propension",
  data: data as Record<string, unknown>,
});

/* ─────────────────────────────────────────────────────────────────────────── */

/* 0 · Control del propio arnés. Si el comparador no discrimina, todo lo demás es decorado. */
titulo("El arnés discrimina");
check("checkEq distingue valores distintos", !Object.is("Hogar", "Vida"));
check("checkEq distingue un valor de la ausencia de valor", !Object.is(undefined, "Hogar"));
check("checkPresente rechaza la lista vacía", !((): boolean => {
  const v: unknown[] = [];
  return v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0);
})());

/* 1 · El anti-venta no vuelve a saludar ni a vender ─────────────────────────
   La escena de apertura del guion. `no_venta` devuelve `recomendaciones: []`, y el sistema leía
   la lista vacía como "todavía no he recomendado": volvía a RECONOCIDO, saludaba de nuevo e
   intentaba vender justo después de decir "hoy no te vendo nada". */
titulo("Tras el anti-venta no se re-saluda");
{
  let e = estadoInicial();
  const abierto = iniciarTurno(e, "Me quedé sin trabajo, no tengo ingresos");
  e = abierto.estado;
  e = aplicarIdentidad(e, { estado: "sin_intento" });

  const { perfil } = sanearPerfil({}, { textoUsuario: "Me quedé sin trabajo, no tengo ingresos" });
  const prop = calcularPropension(perfil);

  checkPresente("el motor produjo un no_venta real", prop.no_venta);
  checkEq("el motor devolvió cero recomendaciones de pago", prop.recomendaciones.length, 0);

  e = cerrarTurno(e, { eventos: [eventoPropension(prop)], perfilUsado: perfil });

  checkEq("el veredicto quedó entregado", e.veredicto?.entregado, true);
  checkEq("y es del tipo no_venta", e.veredicto?.tipo, "no_venta");
  checkEq("la fase pasó a ASESORANDO", e.fase, "ASESORANDO");

  // El turno siguiente: aquí es donde volvía a RECONOCIDO y saludaba otra vez.
  const siguiente = iniciarTurno(e, "¿y entonces qué hago?");
  const e2 = aplicarIdentidad(siguiente.estado, { estado: "sin_intento" });
  checkEq("el turno siguiente SIGUE en ASESORANDO", e2.fase, "ASESORANDO");
  checkEq("ASESORANDO es absorbente aunque se reconozca después", siguienteFase({
    ...e2,
    identidad: { ...e2.identidad, resultado: "reconocido" },
  }), "ASESORANDO");

  const vista = vistaDeEstado(e2, "Te cuento qué sí te sirve hoy.", []);
  checkEq("la vista no ofrece la grilla de proteger", vista.bloques.filter((b) => b.t === "elegir_proteccion").length, 0);
  checkEq("no se sugieren preguntas de asesor tras un no_venta", vista.sugerencias.length, 0);
}

/* 2 · Corregir el nombre tiene salida ────────────────────────────────────────
   Quien obedecía "dame tu nombre completo" nunca podía ser reconocido: el nombre persistido
   ganaba sobre el nuevo, y el nombre completo se leía como CIUDAD. */
titulo("Corregir el nombre tiene salida");
{
  checkEq("soloNombre respeta un nombre de cuatro palabras", soloNombre("Mauricio Cajamarca Rojas Peña"), "Mauricio Cajamarca Rojas Peña");
  checkEq("soloNombre quita el prefijo cortés", soloNombre("Mi nombre completo es Mauricio Cajamarca Rojas"), "Mauricio Cajamarca Rojas");
  checkEq("soloCiudad quita el prefijo", soloCiudad("Vivo en Soacha"), "Soacha");

  let e = estadoInicial();
  e = iniciarTurno(e, "Soy Mauricio").estado;
  e = aplicarIdentidad(e, { estado: "no_encontrado", nombre: "Mauricio" });

  checkEq("con un nombre corto se pide el completo", e.identidad.esperando, "nombre_completo");
  checkEq("y se marca para no repetirlo", e.dichoUnaVez.pidioNombreCompleto, true);

  const abierto = iniciarTurno(e, "Mauricio Cajamarca Rojas");
  checkEq("el mensaje siguiente se interpreta como NOMBRE", abierto.consulta.modo, "nombre");
  checkEq(
    "y se busca el nombre completo, no el viejo",
    abierto.consulta.modo === "nombre" ? abierto.consulta.nombre : null,
    "Mauricio Cajamarca Rojas"
  );
  checkEq("el nombre persistido queda REEMPLAZADO", abierto.estado.identidad.nombre, "Mauricio Cajamarca Rojas");
  checkEq("y no se coló como ciudad", abierto.estado.identidad.ciudad, undefined);

  // Si tampoco aparece, se atiende igual y no se vuelve a insistir.
  const e2 = aplicarIdentidad(abierto.estado, { estado: "no_encontrado", nombre: "Mauricio Cajamarca Rojas" });
  checkEq("ya no se espera nada más", e2.identidad.esperando, null);
  checkEq("queda constancia de en qué turno se le dijo", e2.identidad.avisadoEnTurno, 2);
  checkEq("y el estado RECUERDA que se intentó", e2.identidad.resultado, "no_encontrado");

  // Dejar de PREGUNTAR no es dejar de ESCUCHAR: si la persona corrige su nombre por su cuenta,
  // buscarlo es gratis. Lo que apaga la escucha es el tope de enumeración, no el aviso.
  const tercero = iniciarTurno(e2, "ah, es con tilde: Mauricio Cajamarcá Rojas");
  checkEq("se sigue escuchando una corrección espontánea", tercero.consulta.modo, "detectar");
  checkEq("pero no se vuelve a preguntar nada", tercero.estado.identidad.esperando, null);

  const e3 = aplicarIdentidad(tercero.estado, { estado: "no_encontrado", nombre: "Mauricio Cajamarcá Rojas" });
  checkEq("al tercer intento se alcanza el tope", e3.identidad.intentos, 3);
  checkEq("y ahí sí se deja de consultar la base", iniciarTurno(e3, "Mauricio Andrés Cajamarca").consulta.modo, "ninguna");
}

/* 3 · La ciudad se pide una sola vez, y solo cuando se preguntó ──────────────
   El fallback de `detectarCiudad` acepta cualquier mensaje de 1–4 tokens: sin un slot explícito,
   un "para trabajar" se convertía en ciudad. */
titulo("La ciudad se pide una vez, y solo si se preguntó");
{
  let e = estadoInicial();
  e = iniciarTurno(e, "Soy Carolina Ramírez López").estado;
  e = aplicarIdentidad(e, { estado: "ambiguo", nombre: "Carolina Ramírez López", n: 4 });

  checkEq("se pide la ciudad", e.identidad.esperando, "ciudad");
  checkEq("y se marca la pregunta", e.dichoUnaVez.pidioCiudad, true);

  const abierto = iniciarTurno(e, "Soacha");
  checkEq("el mensaje siguiente se interpreta como CIUDAD", abierto.consulta.modo, "ciudad");
  checkEq("con el nombre ya persistido", abierto.consulta.modo === "ciudad" ? abierto.consulta.nombre : null, "Carolina Ramírez López");
  checkEq("y la ciudad que escribió", abierto.consulta.modo === "ciudad" ? abierto.consulta.ciudad : null, "Soacha");

  // Sigue ambiguo: no se vuelve a preguntar.
  const e2 = aplicarIdentidad(abierto.estado, { estado: "ambiguo", nombre: "Carolina Ramírez López", n: 2 });
  checkEq("no se pregunta la ciudad por segunda vez", e2.identidad.esperando, null);
  // "Ambiguo" es que hay VARIAS personas con ese nombre. Decir "no apareces en la base" sería
  // afirmar algo falso sobre la base — la clase de error que este bloque cierra.
  checkEq("y NO se marca como que no aparece en la base", e2.identidad.avisadoEnTurno, undefined);
  checkEq("el estado sigue siendo ambiguo", e2.identidad.resultado, "ambiguo");

  // Un mensaje cualquiera cuando NO se preguntó nada nunca se lee como ciudad.
  let libre = estadoInicial();
  libre = iniciarTurno(libre, "Soy Andrés Gómez Ruiz").estado;
  libre = aplicarIdentidad(libre, { estado: "no_encontrado", nombre: "Andrés Gómez Ruiz" });
  checkEq("sin pregunta pendiente, el mensaje va al detector normal", iniciarTurno(libre, "para trabajar").consulta.modo, "detectar");
}

/* 4 · La identidad reconocida se congela ─────────────────────────────────────
   `resolverIdentidad` hacía un round-trip a Turso en CADA turno, aunque la persona ya estuviera
   reconocida. */
titulo("La identidad reconocida se congela");
{
  let e = estadoInicial();
  e = iniciarTurno(e, "Soy Carolina Ramírez López").estado;
  e = aplicarIdentidad(e, {
    estado: "reconocido",
    nombre: "Carolina Ramírez López",
    ciudad: "Soacha",
    segmento: { GENERO: "F", RANGO_EDAD: "36 a 45 años", CATEGORIA: "B", SEGMENTO_GRUPO_FAMILIAR: "Monoparental" },
  });

  checkEq("la fase es RECONOCIDO", e.fase, "RECONOCIDO");
  checkPresente("el segmento quedó guardado", e.identidad.segmento);
  checkEq("con la categoría verificada", e.identidad.segmento?.CATEGORIA, "B");
  checkEq("el turno siguiente NO vuelve a consultar la base", iniciarTurno(e, "tengo un carro").consulta.modo, "ninguna");
}

/* 5 · El perfil sobrevive a los turnos, con su procedencia ───────────────────
   El hallazgo más profundo: el perfil lo re-inferí­a el LLM en cada turno y `_origen` —del que
   depende la prueba social— nacía y moría dentro del mismo request. */
titulo("El perfil sobrevive a los turnos");
{
  let e = estadoInicial();
  e = iniciarTurno(e, "Soy Andrés").estado;
  e = aplicarIdentidad(e, { estado: "sin_intento" });

  const texto = "Soy Andrés. Tengo una moto y la uso para trabajar.";
  const { perfil, descartes } = sanearPerfil(
    { enriquecido: { tiene_vehiculo: ["moto"] } },
    { textoUsuario: texto }
  );
  checkPresente("la compuerta aceptó la moto", perfil.enriquecido?.tiene_vehiculo);
  e = cerrarTurno(e, { eventos: [], perfilUsado: perfil, descartes });

  checkEq("el perfil quedó en el estado", e.perfil.enriquecido?.tiene_vehiculo?.[0], "moto");
  checkEq("con su procedencia", e.perfil._origen?.["enriquecido.tiene_vehiculo"], "declarado");

  // Tres turnos después, sin que el modelo lo vuelva a teclear.
  for (const msg of ["¿y eso qué cubre?", "ajá", "cuéntame más"]) {
    e = iniciarTurno(e, msg).estado;
    e = aplicarIdentidad(e, { estado: "sin_intento" });
    e = cerrarTurno(e, { eventos: [] });
  }
  checkEq("el turno avanzó", e.turno, 4);
  checkEq("y la moto SIGUE ahí", e.perfil.enriquecido?.tiene_vehiculo?.[0], "moto");
  checkEq("con su procedencia intacta", e.perfil._origen?.["enriquecido.tiene_vehiculo"], "declarado");
}

/* 6 · La vista decide, el cliente obedece ────────────────────────────────────
   La grilla de seis tarjetas aparecía junto a una pregunta abierta: el cliente decidía contando
   burbujas, sin saber que el agente acababa de preguntar algo. */
titulo("La vista no compite con una pregunta abierta");
{
  let e = estadoInicial();
  e = iniciarTurno(e, "hola").estado;
  e = aplicarIdentidad(e, { estado: "sin_intento" });
  e = cerrarTurno(e, { eventos: [] });

  const conPregunta = vistaDeEstado(e, "Soy Amparito. ¿Qué es lo que más te preocuparía perder?", []);
  checkEq("con una pregunta abierta NO va la grilla", conPregunta.bloques.filter((b) => b.t === "elegir_proteccion").length, 0);

  const sinPregunta = vistaDeEstado(e, "Soy Amparito, de amparar.", []);
  checkEq("sin pregunta, la grilla sí va", sinPregunta.bloques.filter((b) => b.t === "elegir_proteccion").length, 1);

  // Quien llegó por un enlace profundo YA dijo qué quiere proteger. Preguntárselo otra vez es el
  // interrogatorio que el producto existe para evitar. El servidor no puede deducirlo del
  // mensaje —llega como texto normal—, así que el cliente lo declara y el estado lo recuerda.
  const porEnlace = vistaDeEstado({ ...e, origen: "interes" }, "Soy Amparito, de amparar.", []);
  checkEq("a quien llegó por un enlace NO se le pregunta", porEnlace.bloques.filter((b) => b.t === "elegir_proteccion").length, 0);
  const porEvento = vistaDeEstado({ ...e, origen: "evento" }, "Felicitaciones por ese bebé.", []);
  checkEq("ni a quien llegó por un evento de vida", porEvento.bloques.filter((b) => b.t === "elegir_proteccion").length, 0);

  // Un solo evento de propensión aunque el modelo llame la tool dos veces.
  const prop = calcularPropension(PERSONAS.Carolina);
  const dosLlamadas = vistaDeEstado(e, "Míralo abajo con calma.", [eventoPropension(prop), eventoPropension(prop)]);
  checkEq("una sola tarjeta de propensión", dosLlamadas.bloques.filter((b) => b.t === "evento").length, 1);
  checkEq("y un solo bloque de tarjetas", dosLlamadas.bloques.filter((b) => b.t === "tarjetas").length, 1);

  // El mismo objeto repetido. Un dedupe por identidad de referencia falla ABIERTO justo aquí, y
  // el caso anterior no lo distingue porque construye dos objetos distintos.
  const mismoObjeto = eventoPropension(prop);
  const repetido = vistaDeEstado(e, "Míralo abajo.", [mismoObjeto, mismoObjeto]);
  checkEq("también con la misma referencia repetida", repetido.bloques.filter((b) => b.t === "evento").length, 1);

  const tarjetas = dosLlamadas.bloques.find((b) => b.t === "tarjetas");
  checkPresente("las tarjetas vienen del motor", tarjetas && tarjetas.t === "tarjetas" ? tarjetas.recs : null);
  checkEq(
    "y el nombre es EXACTO el del motor",
    tarjetas && tarjetas.t === "tarjetas" ? tarjetas.recs[0]?.nombre : null,
    prop.recomendaciones[0]?.nombre ?? "(el motor no recomendó nada)"
  );

  // El orden lo decide el servidor: la tarjeta antes que el texto.
  const iTarjetas = dosLlamadas.bloques.findIndex((b) => b.t === "tarjetas");
  const iTexto = dosLlamadas.bloques.findIndex((b) => b.t === "texto");
  check("la tarjeta va antes que el texto", iTarjetas >= 0 && iTexto >= 0 && iTarjetas < iTexto, `→ tarjetas@${iTarjetas} texto@${iTexto}`);

  checkEq("el markdown se limpia", limpiarTexto("**Hola** y `esto`"), "Hola y esto");

  // Las sugerencias son del turno en que la recomendación aterriza, no permanentes: colgarlas del
  // veredicto —que no se limpia nunca— las dejaba fijas compitiendo con lo que se pregunte después.
  checkEq("el turno de la recomendación ofrece las preguntas de asesor", repetido.sugerencias.length, 3);
  const cerrado = cerrarTurno(e, { eventos: [mismoObjeto] });
  checkEq("el veredicto quedó guardado", cerrado.veredicto?.tipo, "recomendacion");
  checkEq("pero al turno siguiente ya no se repiten", vistaDeEstado(cerrado, "¿Te la explico?", []).sugerencias.length, 0);
}

/* 6b · El modelo sabe de qué producto habla ──────────────────────────────────
   Los `tool_result` no sobreviven entre turnos: el historial se reconstruye solo con los textos.
   Al asesorar, el modelo no sabía de qué producto hablaba —y el prompt le prohíbe haberlo
   nombrado sin que el motor lo dijera—, ni recordaba haberse negado a vender. */
titulo("El contexto le recuerda al modelo lo que el motor ya decidió");
{
  // Adverso primero: sin veredicto no se inventa un bloque.
  let e = estadoInicial();
  e.turno = 2;
  checkEq("sin veredicto no hay bloque de recomendación", contextoDeEstado(e), null);

  const prop = calcularPropension(PERSONAS.Carolina);
  const conReco = cerrarTurno(e, { eventos: [eventoPropension(prop)] });
  const ctxReco = contextoDeEstado(conReco) ?? "";
  check("se le recuerda qué recomendó", ctxReco.includes(prop.recomendaciones[0].nombre));
  check("y a qué se refiere un 'ese' de la persona", ctxReco.includes('Si dice "ese"'));
  check("con la instrucción de no re-calcular", ctxReco.includes("NO vuelvas a llamar calcular_propension"));

  // Tras el anti-venta, el bloque protege la negativa en vez de recordarle productos.
  const { perfil } = sanearPerfil({}, { textoUsuario: "me quedé sin trabajo, no tengo ingresos" });
  const sinVenta = cerrarTurno(e, { eventos: [eventoPropension(calcularPropension(perfil))] });
  const ctxNo = contextoDeEstado(sinVenta) ?? "";
  check("tras el anti-venta se le recuerda que dijo que no", ctxNo.includes("NO LE VENDES NADA"));
  check("con el motivo, para que no lo reinvente", ctxNo.includes("ingreso"));
  checkEq("y NO se le listan productos para ofrecer", ctxNo.includes("LO QUE YA LE RECOMENDASTE"), false);
}

/* 6c · El saludo ─────────────────────────────────────────────────────────────
   El copy también se puede verificar cuando la propiedad es estructural. Estas dos lo son, y
   ambas se habían roto en el saludo que había. */
titulo("El saludo no quema el anti-venta ni da órdenes antes de presentarse");
{
  const s = SALUDO_INICIAL;
  // El anti-venta es el momento que la gente recuerda. Anunciarlo lo convierte en guion cumplido
  // en vez de honestidad: cuando llegue, ya no sorprende.
  check("no anuncia el anti-venta",
    !/te voy a decir que no|no te vendo|a veces.*que no/i.test(s), `→ "${s}"`);
  // Presentarse antes de pedir. A quien abre un chat se le pide algo después de saber con quién
  // habla, no antes.
  const sePresenta = s.indexOf("Amparito");
  const pide = s.search(/dime|me dices|dame/i);
  check("se presenta ANTES de pedir nada", sePresenta >= 0 && pide > sePresenta,
    `→ presenta@${sePresenta} pide@${pide}`);
  check("una sola invitación, no un interrogatorio", (s.match(/\?/g) ?? []).length === 0);
  check("y sigue prometiendo el arranque caliente", /reconozco/i.test(s));
}

/* 7 · El sello ───────────────────────────────────────────────────────────────
   El estado viaja por el navegador y dentro va el segmento verificado: los cuatro ejes que
   habilitan la prueba social. Sin sello, un cliente manipulado fabrica una celda de peer-group
   falsa — en un producto cuya tesis es que sus afirmaciones se pueden auditar. */
titulo("El sello rechaza lo que no firmó el servidor");
{
  let e = estadoInicial();
  e = iniciarTurno(e, "Soy Carolina Ramírez López").estado;
  e = aplicarIdentidad(e, {
    estado: "reconocido",
    nombre: "Carolina Ramírez López",
    segmento: { GENERO: "F", RANGO_EDAD: "36 a 45 años", CATEGORIA: "B", SEGMENTO_GRUPO_FAMILIAR: "Monoparental" },
  });

  const cadena = sellar(e);
  const vuelta = abrir(cadena);
  checkPresente("un estado sellado se vuelve a abrir", vuelta);
  checkEq("y llega intacto", JSON.stringify(vuelta), JSON.stringify(e));
  checkEq("para el cliente es opaco (no es JSON legible)", cadena.trim().startsWith("{"), false);

  // El ataque concreto: cambiar el segmento para fabricar una celda de peer.
  const [payload, firma] = [cadena.slice(0, cadena.lastIndexOf(".")), cadena.slice(cadena.lastIndexOf(".") + 1)];
  const falsificado = { ...e, identidad: { ...e.identidad, segmento: { ...e.identidad.segmento, CATEGORIA: "A" } } };
  const payloadFalso = Buffer.from(JSON.stringify(falsificado), "utf8").toString("base64url");
  checkEq("un segmento manipulado se rechaza", abrir(`${payloadFalso}.${firma}`), null);

  checkEq("una firma inventada se rechaza", abrir(`${payload}.${"0".repeat(firma.length)}`), null);
  checkEq("una cadena cualquiera se rechaza", abrir("nada-de-esto-es-un-estado"), null);
  checkEq("un estado ausente se rechaza", abrir(undefined), null);
  checkEq("una versión desconocida del formato se rechaza", abrir(sellar({ ...e, v: 99 as 1 })), null);

  // Falla CERRADO pero sin excepción: el jurado nunca ve un error, ve un saludo.
  // El estado viaja en CADA request y respuesta. Medido con un perfil realista (afiliada
  // reconocida, perfil completo y veredicto con recomendaciones) da ~2,3 KB. La guarda existe
  // para que crecer no sea gratis y en silencio: si esto se dispara, el primer candidato a salir
  // es `descartes`, que hoy se guarda y nadie lee entre turnos.
  const gordo = { ...e, perfil: { enriquecido: { tiene_vehiculo: ["moto", "carro"], dependientes: 2, vivienda: "propia" as const } } };
  check("el estado sellado se mantiene por debajo de 8 KB", sellar(gordo).length < 8192, `→ ${sellar(gordo).length} bytes`);

  checkEq("ante un sello inválido se arranca en turno 0", abrirOInicial("basura").turno, 0);
  checkEq("y en fase SALUDO", abrirOInicial("basura").fase, "SALUDO");
  checkEq("sin segmento heredado de nadie", abrirOInicial("basura").identidad.segmento, undefined);
}

/* ─────────────────────────────────────────────────────────────────────────── */

console.log(`\n${ok ? "✅" : "❌"} ${total} verificaciones · ${ok ? "todo en verde" : "HAY FALLOS"}`);
process.exit(ok ? 0 : 1);
