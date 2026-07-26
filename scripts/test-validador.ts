/**
 * Gate del validador de afirmaciones sobre la base (#3).
 *   npx tsx scripts/test-validador.ts
 *
 * EL CASO REAL: el servidor encontró CERO coincidencias con "Carolina" y Amparito dijo "hay
 * varios Carolinas" — una afirmación fabricada sobre la base de Colsubsidio, dicha con la
 * autoridad de quien acaba de consultarla.
 *
 * LOS FALSOS POSITIVOS VAN PRIMERO, y son la mitad de este archivo. Un validador que dispara de
 * más cuesta un reintento y puede mutilar una frase buena; uno que dispara de menos deja pasar
 * justo lo que existe para impedir. De los dos errores, el primero se nota en cada conversación
 * y el segundo solo cuando ya hizo daño — así que el listón de "no dispares" tiene que ser alto.
 */
import { afirmacionesSinRespaldo, coberturasContradichas, quitarFrases } from "../lib/estado/validar";
import { executeTool } from "../lib/tools";
import { estadoInicial, type EstadoConversacion } from "../lib/estado/tipos";

let ok = true;
let total = 0;
const check = (label: string, cond: boolean, detalle?: string) => {
  total++;
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};
const titulo = (t: string) => console.log(`\n===== ${t} =====`);

/* Estados de referencia. */
const anonimo = (): EstadoConversacion => {
  const e = estadoInicial();
  e.turno = 2;
  return e;
};
const buscadoSinExito = (): EstadoConversacion => {
  const e = anonimo();
  e.identidad = { ...e.identidad, resultado: "no_encontrado", nombre: "Carolina Ramírez", intentos: 1 };
  return e;
};
const reconocida = (): EstadoConversacion => {
  const e = anonimo();
  e.identidad = { ...e.identidad, resultado: "reconocido", nombre: "Carolina Ramírez", intentos: 1 };
  return e;
};
const conHomonimos = (): EstadoConversacion => {
  const e = anonimo();
  e.identidad = { ...e.identidad, resultado: "ambiguo", nombre: "Carolina Ramírez", ambiguo: { n: 4 }, intentos: 1 };
  return e;
};
const conPeer = (): EstadoConversacion => {
  const e = reconocida();
  e.veredicto = {
    entregado: true,
    tipo: "recomendacion",
    recomendaciones: [],
    obligatorios: [],
    peer: { descripcion: "mujeres de 36 a 45 con hogar monoparental", n: 12400, pct: 0.8 },
  };
  return e;
};

const limpio = (texto: string, e: EstadoConversacion) => afirmacionesSinRespaldo(texto, e).length === 0;

/* ─────────────────────────────────────────────────────────────────────────── */

titulo("NO dispara con frases legítimas");
{
  const e = buscadoSinExito();
  check("cardinalidad sobre PRODUCTOS", limpio("Hay varios seguros que te podrían servir hoy.", e));
  check("cardinalidad sobre DEPENDIENTES", limpio("Si hay varias personas que dependen de tu ingreso, esto pesa más.", e));
  check("cardinalidad sobre COBERTURAS", limpio("Ese plan tiene muchas coberturas, te cuento las tres principales.", e));
  check("un precio con números", limpio("Son 23.500 al mes, menos que un tinto al día.", e));
  check("Colsubsidio con cantidad, pero de productos", limpio("En Colsubsidio tenemos varias opciones para tu moto.", e));
  check("una pregunta cualquiera", limpio("¿Tienes carro o moto?", e));
  check("hablar de la persona sin afirmar cardinalidad", limpio("Carolina, por lo que me cuentas lo que más te protege es tu ingreso.", e));
  check("decir que NO aparece cuando de verdad no apareció", limpio("No apareces en la base de afiliados de Colsubsidio, pero te atiendo igual.", e));
  check("prueba social cuando SÍ hay celda", limpio("12.400 personas como tú ya tienen algo parecido.", conPeer()));
  check("varios homónimos cuando de verdad los hay", limpio("Hay varias Carolinas en la base, por eso te pregunto la ciudad.", conHomonimos()));

  // Nombres cortos contenidos en palabras comunes. Con `includes` a secas, alguien llamado Ana
  // convertía "mañana" en una afirmación sobre la base — y nadie se habría enterado hasta que le
  // pasara a una Ana de verdad.
  const ana = anonimo();
  ana.identidad = { ...ana.identidad, resultado: "no_encontrado", nombre: "Ana Gómez", intentos: 1 };
  check("'mañana' no es un homónimo de Ana", limpio("Hay varias opciones para mañana.", ana));
  check("ni 'ganancia', ni 'manzana'", limpio("Son muchas ganancias y varias manzanas.", ana));
  check("pero SÍ dispara con el nombre como palabra", !limpio("Hay varias Anas en Colsubsidio.", ana));

  const luz = anonimo();
  luz.identidad = { ...luz.identidad, resultado: "no_encontrado", nombre: "Luz Marina", intentos: 1 };
  check("un nombre corto dentro de otra palabra tampoco", limpio("Tienes varias alternativas de luz solar.", luz));
}

titulo("SÍ dispara con afirmaciones fabricadas");
{
  // El caso literal de la conversación real.
  const real = afirmacionesSinRespaldo("Mucho gusto. Hay varios Carolinas en Colsubsidio 😅", buscadoSinExito());
  check("el caso real: 'hay varios Carolinas' sin homónimos", real.length === 1, `→ ${real[0]?.motivo ?? ""}`);

  const conRegistro = afirmacionesSinRespaldo("Encontré 3 personas registradas con ese nombre.", buscadoSinExito());
  check("un número de personas registradas sin respaldo", conRegistro.length === 1);

  const noAparece = afirmacionesSinRespaldo("No apareces en la base de afiliados.", reconocida());
  check("decir que no aparece a quien SÍ se reconoció", noAparece.length === 1, `→ ${noAparece[0]?.motivo ?? ""}`);

  const sinBuscar = afirmacionesSinRespaldo("No te encuentro en la base.", anonimo());
  check("decir que no aparece sin haber buscado", sinBuscar.length === 1);

  const peerInventado = afirmacionesSinRespaldo("Miles de personas como tú ya lo tienen.", reconocida());
  check("prueba social sin celda verificada", peerInventado.length === 1, `→ ${peerInventado[0]?.motivo ?? ""}`);

  const peerConNumero = afirmacionesSinRespaldo("Unos 8.000 afiliados como tú lo eligieron.", reconocida());
  check("prueba social con número inventado", peerConNumero.length === 1);
}

titulo("Se quita solo la frase que sobra");
{
  const texto =
    "Mucho gusto, Carolina. Hay varios Carolinas en Colsubsidio 😅 ¿En qué ciudad estás y te ubico bien?";
  const hallazgos = afirmacionesSinRespaldo(texto, buscadoSinExito());
  const podado = quitarFrases(texto, hallazgos);
  check("se cae la afirmación fabricada", !podado.includes("varios Carolinas"));
  check("y sobrevive el saludo", podado.includes("Mucho gusto"));
  check("y sobrevive la pregunta", podado.includes("¿En qué ciudad estás"));
}

/* ── coberturas afirmadas contra el clausulado (B14 · 5h) ─────────────────── */
/*
 * `lib/tools.ts` afirmaba en su cabecera que "el modelo nunca inventa precios, coberturas ni
 * razones". Los precios sí: salen de una tool y no hay otra vía. Las coberturas NO tenían nada —
 * el modelo podía decir "y además te cubre X" con una X que el clausulado excluye, y ningún gate
 * se enteraba. Es el terreno que regula el Art. 9 de la Ley 1328.
 */
async function coberturas() {
  console.log("\n===== Coberturas: no se afirma lo que el clausulado excluye =====");
  const { result } = await executeTool("get_product_details", { productId: "vida_panamerican" }, {});
  const d = result as { coberturas: string[]; exclusiones: string[] };
  const c = { coberturas: d.coberturas, exclusiones: d.exclusiones };

  check("hay clausulado real contra el que contrastar", c.coberturas.length > 0 && c.exclusiones.length > 0);

  for (const t of [
    "Y también te cubre si hay una guerra civil.",
    "Incluye contaminación radiactiva.",
    "Tranquila, la guerra también entra en la cobertura.",
  ]) {
    check(`atrapa: "${t}"`, coberturasContradichas(t, c).length > 0);
  }

  /*
   * Y lo que NO puede atrapar, que es donde una guarda mal hecha hace más daño que el bug.
   *
   * El primero es el importante: el clausulado de Vida SÍ cubre el suicidio sin carencia, y es de
   * las cosas que más valen decir — casi ningún seguro lo dice tan claro. Una guarda que lo
   * marcara obligaría a Amparito a callarse su mejor argumento.
   */
  for (const t of [
    "Te cubre fallecimiento por cualquier causa, incluso suicidio, sin periodos de carencia.",
    "Ojo: NO te cubre guerra ni contaminación radiactiva.",
    "Este seguro te protege si algo te pasa y tu familia queda respaldada.",
    "Queda fuera la guerra declarada o no.",
  ]) {
    check(`no se pasa de listo: "${t.slice(0, 52)}…"`, coberturasContradichas(t, c).length === 0);
  }

  check("y sin clausulado no inventa hallazgos",
    coberturasContradichas("te cubre la guerra", { coberturas: [], exclusiones: [] }).length === 0);

  const h = coberturasContradichas("Y también te cubre si hay una guerra civil.", c)[0];
  check("el hallazgo cita la exclusión concreta del clausulado", /EXCLUYE/.test(h?.motivo ?? ""));
  check("y la frase que hay que quitar",
    quitarFrases("Hola. Y también te cubre si hay una guerra civil.", [h]) === "Hola.");

  console.log(`\n${ok ? "✅" : "❌"} ${total} verificaciones · ${ok ? "todo en verde" : "HAY FALLOS"}`);
  process.exit(ok ? 0 : 1);
}

coberturas();
