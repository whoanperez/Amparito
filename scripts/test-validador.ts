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
import { afirmacionesSinRespaldo, quitarFrases } from "../lib/estado/validar";
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

console.log(`\n${ok ? "✅" : "❌"} ${total} verificaciones · ${ok ? "todo en verde" : "HAY FALLOS"}`);
process.exit(ok ? 0 : 1);
