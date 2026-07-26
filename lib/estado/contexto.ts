/**
 * El bloque de contexto de identidad que entra al prompt, generado DESDE EL ESTADO.
 *
 * POR QUÉ SE MUDA AQUÍ. Antes esta prosa la devolvía `resolverIdentidad` pegada al hallazgo del
 * turno, y por eso vivía un solo turno: el copy de "no apareces en la base" se emitía una vez y
 * al turno siguiente el resolver devolvía `sin_intento` y el contexto desaparecía. El sistema no
 * podía recordar "ya intentamos identificarte y falló", así que tampoco podía respetar el "no
 * vuelvas a insistir" más allá de ese turno.
 *
 * Al derivarse del estado, el hecho persiste y lo que cambia es la INSTRUCCIÓN: el turno en que
 * pasa hay que decirlo; los siguientes, callarlo.
 *
 * El texto se movió literal. Arreglar el copy es el bloque 4, no este.
 *
 * Función pura.
 */
import type { EstadoConversacion } from "./tipos";
import type { SegmentoBase } from "../engine/sanear";

function describirComun(s: SegmentoBase): string {
  const partes = [
    s.GENERO === "F" ? "es mujer" : s.GENERO === "M" ? "es hombre" : null,
    s.RANGO_EDAD ? `está en el rango ${s.RANGO_EDAD}` : null,
    s.CATEGORIA ? `es categoría ${s.CATEGORIA}` : null,
    s.SEGMENTO_GRUPO_FAMILIAR ? `su grupo familiar es ${s.SEGMENTO_GRUPO_FAMILIAR}` : null,
  ].filter(Boolean);
  return partes.join(", ");
}

function reconocido(e: EstadoConversacion): string {
  const seg = e.identidad.segmento ?? {};
  const primerNombre = (e.identidad.nombre ?? "").split(" ")[0];
  const saludo =
    seg.GENERO === "F" ? "Bienvenida" : seg.GENERO === "M" ? "Bienvenido" : "Bienvenido(a)";
  return (
    `## SEGMENTO VERIFICADO DE ESTE AFILIADO (viene de la base de Colsubsidio, no lo preguntes)\n` +
    `Primer nombre: ${primerNombre}. Saluda con "${saludo}, ${primerNombre}".\n` +
    // Los 4 ejes del peer-group van COMPLETOS: `lookupPeer` los exige para ubicar la celda.
    `Género = ${seg.GENERO ?? "?"}; grupo familiar = ${seg.SEGMENTO_GRUPO_FAMILIAR ?? "?"}; ` +
    `rango de edad = ${seg.RANGO_EDAD ?? "?"}; categoría = ${seg.CATEGORIA ?? "?"}; ` +
    `segmento poblacional = ${seg.SEGMENTO_POBLACIONAL ?? "?"}; ciudad = ${e.identidad.ciudad ?? "?"}.\n` +
    `El servidor ya le pasa este segmento al motor: NO lo repitas en la llamada a la tool y no lo ` +
    `preguntes de nuevo. Si la persona te corrige, mandan sus palabras.`
  );
}

function ambiguo(e: EstadoConversacion): string {
  const { n, comun } = e.identidad.ambiguo ?? { n: 0 };
  return (
    `## IDENTIFICACIÓN AMBIGUA\n` +
    `Hay ${n} personas registradas con ese nombre y su situación es distinta, así que no se ` +
    `puede saber cuál es. Pídele SOLO la ciudad, con calidez y UNA sola vez, por ejemplo: ` +
    `"Mucho gusto, [primer nombre]. Hay varios [nombre] en Colsubsidio 😅 ¿En qué ciudad estás y te ubico bien?"\n` +
    `NUNCA le ofrezcas ciudades para escoger: que ella la escriba. No listes personas ni datos de nadie.\n` +
    (comun && describirComun(comun)
      ? `Lo único cierto sin importar cuál sea: ${describirComun(comun)}. Puedes usar esos campos y nada más.`
      : `No hay ningún dato común entre esas personas, así que no asumas nada de su segmento.`)
  );
}

/**
 * Lo que el motor YA decidió, para que el modelo no tenga que adivinarlo.
 *
 * Los `tool_result` no sobreviven entre turnos: el historial se reconstruye solo con los textos.
 * Así que al asesorar el modelo no sabía de qué producto estaba hablando —y el prompt le prohíbe
 * haberlo nombrado sin que el motor lo dijera—, ni recordaba haberse negado a vender.
 *
 * Los nombres salen del motor, nunca de una transcripción del modelo.
 */
function veredicto(e: EstadoConversacion): string | null {
  const v = e.veredicto;
  if (!v) return null;

  if (v.tipo === "no_venta") {
    return (
      `## YA LE DIJISTE QUE HOY NO LE VENDES NADA\n` +
      `Motivo: ${v.no_venta?.motivo ?? "no hay ingreso con qué sostener una póliza"}\n` +
      `NO te retractes ni vuelvas a ofrecer productos de pago, aunque insista. Si pregunta, ` +
      `sostenlo con calidez y ofrécele lo que sí le sirve hoy. Tampoco vuelvas a llamar ` +
      `calcular_propension salvo que te diga algo que cambie su situación de ingreso.` +
      (v.obligatorios.length
        ? `\nLo único que sí debes seguir señalando es lo obligatorio por ley: ${v.obligatorios.map((o) => o.nombre).join(", ")}.`
        : "")
    );
  }

  const nombres = v.recomendaciones.map((r) => r.nombre);
  if (!nombres.length) return null;
  return (
    `## LO QUE YA LE RECOMENDASTE (dicho por el motor, no lo cambies)\n` +
    `En pantalla ya tiene: ${nombres.join(", ")}.\n` +
    `Si dice "ese", "el seguro" o "eso" sin más, se refiere a ${nombres[0]}.\n` +
    `NO vuelvas a llamar calcular_propension salvo que te dé información nueva que cambie su ` +
    `perfil. Ya puedes hablar de estos productos por su nombre: el motor los respaldó.` +
    (v.peer ? `\nPrueba social disponible: ${v.peer.descripcion} (${v.peer.n} personas).` : "")
  );
}

/**
 * Devuelve el bloque del turno, o `null` si no hay nada que decirle al modelo sobre lo que el
 * servidor ya sabe.
 *
 * Es una función del ESTADO, no del hallazgo del turno: por eso el mismo `resultado` produce
 * instrucciones distintas según en qué turno se esté.
 */
export function contextoDeEstado(e: EstadoConversacion): string | null {
  const bloques = [identidad(e), veredicto(e)].filter(Boolean);
  return bloques.length ? bloques.join("\n\n") : null;
}

function identidad(e: EstadoConversacion): string | null {
  const id = e.identidad;

  if (id.resultado === "reconocido") return reconocido(e);

  if (id.resultado === "ambiguo") {
    if (id.esperando === "ciudad") return ambiguo(e);
    // Ya se pidió la ciudad una vez y no se resolvió. Se atiende igual, sin insistir — y sin
    // decirle que no aparece en la base, porque no es cierto: aparece varias veces.
    return (
      `## IDENTIFICACIÓN AMBIGUA, YA PREGUNTADA\n` +
      `Ya le pediste la ciudad una vez y no se pudo ubicar. NO se la vuelvas a pedir y no menciones ` +
      `más el tema de la identificación: atiéndela completa igual.`
    );
  }

  if (id.resultado === "no_encontrado") {
    if (id.esperando === "nombre_completo") {
      return (
        `## NO SE ENCONTRÓ (nombre corto)\n` +
        `No hay coincidencia con "${id.nombre}". Antes de descartarlo, pídele el nombre completo una ` +
        `sola vez: "Mucho gusto, [nombre] 😊 ¿Me das tu nombre completo, como aparece en tu documento? ` +
        `Con eso te ubico bien y arrancamos." Si tampoco aparece, sigue con normalidad y no vuelvas a insistir.`
      );
    }
    // El turno en que pasa hay que DECIRLO. Los siguientes, callarlo.
    if (id.avisadoEnTurno === e.turno) {
      return (
        `## NO SE ENCONTRÓ EN LA BASE\n` +
        `Dilo claro y sigue atendiendo, en el MISMO mensaje que hace la siguiente pregunta útil: ` +
        `"No apareces en la base de afiliados de Colsubsidio. Te atiendo completo igual, solo te hago ` +
        `un par de preguntas más." NUNCA digas "no eres afiliado": puede estar registrada con el nombre ` +
        `escrito distinto. No vuelvas a mencionar el tema de la identificación en el resto de la conversación.`
      );
    }
    return (
      `## IDENTIFICACIÓN YA RESUELTA (no apareció)\n` +
      `Ya le dijiste que no aparece en la base y ella siguió. NO vuelvas a mencionar el tema de la ` +
      `identificación ni le pidas el nombre otra vez: atiéndela completa igual.`
    );
  }

  if (id.resultado === "tope") {
    // Antes este estado no producía contexto: el prompt no se enteraba de que se había cortado.
    return (
      `## BÚSQUEDAS AGOTADAS\n` +
      `Ya se buscó varias veces y no se pudo ubicar. No le pidas el nombre de nuevo ni menciones ` +
      `el tema: atiéndela completa igual.`
    );
  }

  return null;
}
