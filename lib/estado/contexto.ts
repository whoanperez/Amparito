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
import { MAX_VERIFICACION } from "./tipos";
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
  // El saludo ya no se decide aquí: vive en CONFIRMANDO, que es el único turno que saluda.
  return (
    `## SEGMENTO VERIFICADO DE ESTE AFILIADO (viene de la base de Colsubsidio, no lo preguntes)\n` +
    /*
     * Ya NO ordena saludar. Este bloque solo llega DESPUÉS de CONFIRMANDO, que ya la saludó — y
     * antes de eso la verificación también. En un flujo real Carolina recibió tres saludos
     * seguidos: "¡Hola Carolina!", "Perfecto, Carolina" y "Bienvenida, Carolina 👋".
     */
    `Primer nombre: ${primerNombre} (ya la saludaste: NO vuelvas a saludarla).\n` +
    // Los 4 ejes del peer-group van COMPLETOS: `lookupPeer` los exige para ubicar la celda.
    `Género = ${seg.GENERO ?? "?"}; grupo familiar = ${seg.SEGMENTO_GRUPO_FAMILIAR ?? "?"}; ` +
    `rango de edad = ${seg.RANGO_EDAD ?? "?"}; categoría = ${seg.CATEGORIA ?? "?"}; ` +
    `segmento poblacional = ${seg.SEGMENTO_POBLACIONAL ?? "?"}; ciudad = ${e.identidad.ciudad ?? "?"}.\n` +
    `El servidor ya le pasa este segmento al motor: NO lo repitas en la llamada a la tool y no lo ` +
    `preguntes de nuevo. Si la persona te corrige, mandan sus palabras.`
  );
}

/**
 * El primer turno después de confirmar que es ella: se le devuelve lo que Colsubsidio tiene.
 *
 * En HUMANO y en tres líneas, no como ficha de datos. La diferencia importa: "sostienes sola tu
 * hogar" es algo que ella puede corregir; "mujer, 36 a 45, monoparental, categoría A" es un
 * expediente, y recitarlo es justo lo que el prompt prohíbe.
 */
function primerTurnoReconocida(e: EstadoConversacion): string {
  const seg = e.identidad.segmento ?? {};
  const primerNombre = (e.identidad.nombre ?? "").split(" ")[0];
  const saludo = seg.GENERO === "F" ? "Bienvenida" : seg.GENERO === "M" ? "Bienvenido" : "Bienvenido(a)";
  const lineas = [
    seg.SEGMENTO_GRUPO_FAMILIAR ? `su grupo familiar (${seg.SEGMENTO_GRUPO_FAMILIAR})` : null,
    seg.RANGO_EDAD ? `su rango de edad (${seg.RANGO_EDAD})` : null,
    seg.CATEGORIA ? `su categoría de afiliación (${seg.CATEGORIA})` : null,
  ].filter(Boolean);

  return (
    `## LO QUE TIENES QUE DEVOLVERLE\n` +
    `Saluda con "${saludo}, ${primerNombre}".\n` +
    `Esto es lo que Colsubsidio tiene de ella: ${lineas.join("; ")}.\n` +
    `Tradúcelo a cómo vive, no a cómo está clasificada: "sostienes sola tu hogar" en vez de ` +
    `"monoparental", "entre 36 y 45" en vez de "rango 36 a 45 años". NUNCA como ficha de datos.`
  );
}

function ambiguo(e: EstadoConversacion): string {
  const { n, comun } = e.identidad.ambiguo ?? { n: 0 };
  return (
    `## IDENTIFICACIÓN AMBIGUA\n` +
      `${YA_SE_BUSCO}\n` +
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

/**
 * El sello de la verificación se MUDÓ a `vista.ts`, donde vive la tarjeta que lo pinta.
 *
 * Mientras estuvo aquí era una instrucción: "cierra el mensaje con esta frase LITERAL". O sea que
 * la honestidad del paso dependía de que el modelo se acordara de copiarla. Ahora no la escribe
 * nadie más que el código, y por eso no puede faltar.
 *
 * Se reexporta porque el hecho sigue siendo del servidor: quien importe el aviso desde aquí no
 * tiene por qué enterarse de la mudanza.
 */
export { AVISO_VERIFICACION } from "./vista";

/**
 * Lo que TODO bloque de identidad tiene que dejar claro.
 *
 * En un flujo real Amparito escribió: "Déjame verificar si estás en la base de Colsubsidio.
 * Mientras tanto, cuéntame…". La búsqueda YA se había hecho antes de que el modelo escribiera esa
 * frase, y su resultado estaba en este mismo prompt. Anunció un trámite que ya había ocurrido, no
 * volvió a mencionarlo nunca, y la persona se quedó esperando una respuesta que no iba a llegar.
 *
 * No es un descuido de redacción: es afirmar algo sobre lo que el sistema está haciendo. Misma
 * familia que inventar cuántos homónimos hay.
 */
const YA_SE_BUSCO =
  "La búsqueda contra la base YA se hizo y su resultado es el de arriba. NUNCA digas que vas a " +
  "verificar, ni «déjame mirar», ni «ya te confirmo»: no hay nada pendiente que consultar y dejarías " +
  "a la persona esperando una respuesta que no va a llegar.";

function identidad(e: EstadoConversacion): string | null {
  const id = e.identidad;

  if (id.resultado === "reconocido") {
    /*
     * ── Aquí es donde se cierra la fuga ─────────────────────────────────────
     *
     * Antes bastaba con escribir un nombre para llevarse el género, el rango de edad, la categoría
     * de afiliación y la composición familiar de esa persona. No era un riesgo de suplantación:
     * era una consulta abierta sobre la base de afiliados de Colsubsidio.
     *
     * Y no se cierra pidiéndole discreción al modelo. Se cierra porque EL DATO NO VIAJA: mientras
     * no esté verificada, este bloque no lleva el segmento, y no se puede revelar lo que no se
     * recibe. Una regla de prompt es una petición probabilística; esto es ausencia de información.
     */
    if (!id.verificada) {
      const primerNombre = (id.nombre ?? "").split(" ")[0];
      if (id.intentosVerificacion >= MAX_VERIFICACION) {
        return (
          `## VERIFICACIÓN NO COMPLETADA — SIGUE SIN ARRANQUE CALIENTE\n` +
      `${YA_SE_BUSCO}\n` +
          `Aparece en la base, pero no pudo confirmar que es ella, así que NO tienes sus datos y no ` +
          `los vas a tener. No vuelvas a mencionar el tema: atiéndela completa como a cualquiera, ` +
          `preguntándole lo mínimo. No le hagas sentir que falló.`
        );
      }
      return (
        `## LA ENCONTRASTE, PERO TODAVÍA NO PUEDES HABLARLE DE LO SUYO\n` +
        `Hay coincidencia en la base para "${id.nombre}". NO tienes su segmento y no lo vas a tener ` +
        `hasta que confirme que es ella: no inventes ni insinúes su edad, su categoría, su ciudad ni ` +
        `su composición familiar.\n` +
        `${YA_SE_BUSCO}\n` +
        `Salúdala por su primer nombre (${primerNombre}) y di en UNA línea que lo que Colsubsidio ` +
        `tiene de ella no se lo enseñas a nadie más. Ahí paras.\n` +
        /*
         * La pregunta ya no la hace el modelo. Escrita en la prosa, se leía igual que cualquier otro
         * párrafo —nada decía que es un paso instrumental— y el aviso de que la validación es
         * simulada dependía de que se acordara de copiarlo. Ahora las dos cosas van en una tarjeta
         * enmarcada que pinta el servidor, y aquí solo hay que impedir que se dupliquen.
         */
        `LA PREGUNTA NO LA ESCRIBES TÚ: el sistema pinta, justo debajo de tu mensaje, una tarjeta ` +
        `que le pide la fecha de expedición de su documento y que acota qué hay de simulado. Tu ` +
        `mensaje va SIN pregunta y sin mencionar esa fecha: si la repites, la persona la ve dos ` +
        `veces y parece que algo se rompió.\n` +
        `Y no lo enmarques como algo "de la demostración": pedir un dato que solo ella sabría es ` +
        `del producto y se queda. Lo simulado es solo la comprobación.` +
        (id.intentosVerificacion > 0
          ? `\nYa lo intentó una vez y no salió. Dile en media línea que no pasa nada y que puede ` +
            `seguir sin eso si prefiere. La tarjeta se lo vuelve a pedir sola: no insistas tú.`
          : ``)
      );
    }
    /*
     * ── El turno que faltaba: devolverle lo que sabemos ─────────────────────
     *
     * Verificar no le devolvía nada. Le pedía un dato, ella lo daba, y lo siguiente que veía era
     * un panel de recomendaciones — con toda la información de golpe y sin que nadie le hubiera
     * confirmado que era ella.
     *
     * Confirmar NO es pedir permiso, y por eso convive con la regla de RECONOCIDO que prohíbe
     * "pedir confirmación antes de recomendar": aquello prohíbe pedir venia para avanzar; esto es
     * devolverle su información para que pueda corregirla. Son cosas distintas.
     */
    if (!e.dichoUnaVez.mostroSegmento) return primerTurnoReconocida(e);
    return reconocido(e);
  }

  if (id.resultado === "ambiguo") {
    if (id.esperando === "ciudad") return ambiguo(e);
    // Ya se pidió la ciudad una vez y no se resolvió. Se atiende igual, sin insistir — y sin
    // decirle que no aparece en la base, porque no es cierto: aparece varias veces.
    return (
      `## IDENTIFICACIÓN AMBIGUA, YA PREGUNTADA\n` +
      `${YA_SE_BUSCO}\n` +
      `Ya le pediste la ciudad una vez y no se pudo ubicar. NO se la vuelvas a pedir y no menciones ` +
      `más el tema de la identificación: atiéndela completa igual.`
    );
  }

  if (id.resultado === "no_encontrado") {
    if (id.esperando === "nombre_completo") {
      return (
        `## NO SE ENCONTRÓ (nombre corto)\n` +
      `${YA_SE_BUSCO}\n` +
        `No hay coincidencia con "${id.nombre}". Antes de descartarlo, pídele el nombre completo una ` +
        `sola vez: "Mucho gusto, [nombre] 😊 ¿Me das tu nombre completo, como aparece en tu documento? ` +
        `Con eso te ubico bien y arrancamos." Si tampoco aparece, sigue con normalidad y no vuelvas a insistir.`
      );
    }
    // El turno en que pasa hay que DECIRLO. Los siguientes, callarlo.
    if (id.avisadoEnTurno === e.turno) {
      return (
        `## NO SE ENCONTRÓ EN LA BASE\n` +
      `${YA_SE_BUSCO}\n` +
        `Dilo claro y sigue atendiendo, en el MISMO mensaje que hace la siguiente pregunta útil: ` +
        `"No apareces en la base de afiliados de Colsubsidio. Te atiendo completo igual, solo te hago ` +
        `un par de preguntas más." NUNCA digas "no eres afiliado": puede estar registrada con el nombre ` +
        `escrito distinto. No vuelvas a mencionar el tema de la identificación en el resto de la conversación.`
      );
    }
    return (
      `## IDENTIFICACIÓN YA RESUELTA (no apareció)\n` +
      `${YA_SE_BUSCO}\n` +
      `Ya le dijiste que no aparece en la base y ella siguió. NO vuelvas a mencionar el tema de la ` +
      `identificación ni le pidas el nombre otra vez: atiéndela completa igual.`
    );
  }

  if (id.resultado === "tope") {
    // Antes este estado no producía contexto: el prompt no se enteraba de que se había cortado.
    return (
      `## BÚSQUEDAS AGOTADAS\n` +
      `${YA_SE_BUSCO}\n` +
      `Ya se buscó varias veces y no se pudo ubicar. No le pidas el nombre de nuevo ni menciones ` +
      `el tema: atiéndela completa igual.`
    );
  }

  return null;
}
