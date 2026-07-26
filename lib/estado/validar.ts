/**
 * Validador de afirmaciones sobre la base de afiliados.
 *
 * EL CASO REAL: el servidor encontró CERO coincidencias con "Carolina" y Amparito dijo "hay
 * varios Carolinas". Eso no es una alucinación cualquiera — es una afirmación fabricada sobre la
 * base de datos de Colsubsidio, dicha con la autoridad de quien acaba de consultarla.
 *
 * El prompt ya lo prohíbe, pero una regla de prompt es una petición probabilística. Los hechos
 * sobre la base los establece el SERVIDOR y viven en el estado; esto comprueba que el texto no
 * afirme ninguno que el estado no respalde.
 *
 * DISEÑADO PARA NO DISPARAR DE MÁS. Un falso positivo cuesta un reintento y puede mutilar una
 * frase buena, así que cada regla exige varias señales a la vez en vez de una palabra suelta.
 * "Hay varios seguros que te sirven" o "hay varias personas que dependen de ti" son frases
 * legítimas y NO se tocan.
 *
 * Función pura.
 */
import type { EstadoConversacion } from "./tipos";

export interface AfirmacionSinRespaldo {
  frase: string;
  motivo: string;
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => sinTildes(s).toLowerCase();

/** Cuantificadores: números o palabras de cantidad. */
const CANTIDAD = /\b(\d[\d.,]*|varios|varias|muchos|muchas|miles|cientos|algunos|algunas|otros|otras)\b/;

/** Frases hechas que dicen "no estás en la base". */
const NO_APARECE = /\bno\s+(apareces|estas|figuras|te\s+encuentro|te\s+encontre)\b|\bno\s+eres\s+afiliad/;

/** Referencias explícitas al REGISTRO, no a Colsubsidio en general (que también vende productos). */
const REGISTRO = /\b(en la base|de la base|registrad[oa]s?|homonim|con ese nombre|con tu nombre|con el mismo nombre)\b/;

/** Prueba social: "N personas como tú". */
const PEER = /\b(personas?|afiliad[oa]s?|gente|usuarios?)\b[^.?!]{0,30}\bcomo\s+(tu|vos|usted|tu?)\b/;

/**
 * Trocea en frases conservando el signo, para poder quitar solo la que sobra.
 *
 * Corta después de un cierre (`.?!` o salto) Y ANTES de una apertura española (`¿¡`). Lo segundo
 * es imprescindible aquí: Amparito termina muchas frases en emoji, no en punto, así que
 * "...en Colsubsidio 😅 ¿En qué ciudad estás?" era UNA sola frase — y podar la afirmación
 * fabricada se habría llevado por delante la pregunta legítima.
 */
export function frasesDe(texto: string): string[] {
  return texto
    .split(/(?<=[.?!\n])\s+|\s+(?=[¿¡])/)
    .map((f) => f.trim())
    .filter(Boolean);
}

export function afirmacionesSinRespaldo(
  texto: string,
  e: EstadoConversacion
): AfirmacionSinRespaldo[] {
  const hallazgos: AfirmacionSinRespaldo[] = [];

  /**
   * El primer nombre, como PALABRA y con MAYÚSCULA. Dos accidentes que hay que evitar:
   *
   *   · con `includes` a secas, alguien llamado Ana convertía "hay varias opciones para mañana"
   *     en una afirmación sobre la base — "manana" contiene "ana";
   *   · con solo límite de palabra, Luz, Rosa, Cruz, Paz, Sol o Mar son nombres propios Y
   *     sustantivos comunes, así que "varias alternativas de luz solar" disparaba.
   *
   * La mayúscula es la señal que los separa, y es la misma heurística que ya usa `detectarNombre`.
   * El límite por la izquierda deja pasar el plural, que es como aparece en el caso real:
   * "hay varios Carolinas".
   *
   * Coste asumido: si el modelo escribe el nombre en minúscula, se escapa. Es el lado correcto
   * en el que fallar — dejar pasar una frase rara es mejor que mutilar una buena.
   */
  const nombre = e.identidad.nombre?.trim().split(/\s+/)[0];
  const reNombre =
    nombre && nombre.length >= 3
      ? new RegExp(`\\b${sinTildes(nombre).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
      : null;

  for (const frase of frasesDe(texto)) {
    const f = norm(frase);
    // El nombre se busca sobre el texto con su CAPITALIZACIÓN intacta; todo lo demás, en
    // minúsculas.
    const conMayusculas = sinTildes(frase);

    // 1 · Cardinalidad de homónimos. Dos señales: cuantificador + o bien una referencia al
    //     registro, o bien el propio nombre de la persona ("hay varios Carolinas"), que es como
    //     apareció en la conversación real.
    const hablaDelRegistro = REGISTRO.test(f) || (reNombre !== null && reNombre.test(conMayusculas));
    if (CANTIDAD.test(f) && hablaDelRegistro && !e.identidad.ambiguo) {
      hallazgos.push({
        frase,
        motivo:
          "afirmas cuántas personas hay en la base de afiliados, y la búsqueda no devolvió " +
          "homónimos. No sabes ese número: no lo digas.",
      });
      continue;
    }

    // 2 · Decir que no aparece cuando la búsqueda dice otra cosa (o cuando no se buscó).
    if (NO_APARECE.test(f) && e.identidad.resultado !== "no_encontrado") {
      hallazgos.push({
        frase,
        motivo:
          e.identidad.resultado === "reconocido"
            ? "dices que no aparece en la base, y sí apareció: está identificada."
            : "dices que no aparece en la base, y esa búsqueda no se hizo o no dio ese resultado.",
      });
      continue;
    }

    // 3 · Prueba social sin celda verificada. Es la afirmación de más valor del producto y la que
    //     más daño hace si se inventa.
    if (CANTIDAD.test(f) && PEER.test(f) && !e.veredicto?.peer) {
      hallazgos.push({
        frase,
        motivo:
          "afirmas cuántos afiliados se parecen a esta persona, y el motor NO devolvió prueba " +
          "social para este perfil. Sin celda verificada no se afirma ni se aproxima.",
      });
    }
  }

  return hallazgos;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Coberturas afirmadas contra el clausulado
   ────────────────────────────────────────────────────────────────────────── */

/**
 * `lib/tools.ts` afirma en su cabecera que "el modelo nunca inventa precios, coberturas ni
 * razones". Los precios sí: salen de una tool y no hay otra vía. Las coberturas NO tenían nada — el
 * modelo podía decir "y además te cubre X" con una X que el clausulado excluye, y ningún gate se
 * enteraba. Es el terreno que regula el Art. 9 de la Ley 1328, o sea el de más consecuencias.
 *
 * ── QUÉ COMPRUEBA, Y QUÉ NO ────────────────────────────────────────────────
 *
 * NO comprueba que todo lo que diga esté en la lista: eso es imposible sin mutilar el lenguaje —
 * "te protege si te pasa algo" no está literalmente en ningún clausulado y es una frase correcta.
 *
 * Comprueba la CONTRADICCIÓN, que es precisa y es la que hace daño: afirmar como cubierto algo que
 * el clausulado EXCLUYE. Las exclusiones son una lista finita y conocida del producto, así que aquí
 * no hay ambigüedad ni margen de interpretación.
 *
 * Solo corre cuando el turno trae clausulado de verdad (una tool lo devolvió). Sin él no hay contra
 * qué contrastar, y adivinar sería peor que no mirar.
 */
export interface Clausulado {
  coberturas: string[];
  exclusiones: string[];
}

/** Afirmar que algo está cubierto. Con negación explícita fuera: "NO te cubre X" es correcto. */
const AFIRMA_COBERTURA = /\b(te\s+)?(cubre|cubren|ampara|amparan|incluye|incluyen|protege|protegen|entra|entran)\b/;
const NIEGA = /\bno\b|\bnunca\b|\btampoco\b|\bexcluy|\bqueda\s+fuera\b|\bsin\s+cobertura\b/;

/** Palabras con peso de una exclusión: las que la identifican sin ser conectores. */
function terminosDe(frase: string): string[] {
  const VACIAS = new Set([
    "declarada", "cualquier", "durante", "mediante", "cuando", "donde", "sobre", "entre", "entre",
    "entrega", "estado", "riesgo", "causa", "otros", "otras", "misma", "mismo", "desde", "hasta",
    "articulo", "arts", "comercio", "codigo", "junta", "dictamen",
  ]);
  return Array.from(
    new Set(
      sinTildes(frase)
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 6 && !VACIAS.has(w))
    )
  );
}

export function coberturasContradichas(texto: string, c: Clausulado): AfirmacionSinRespaldo[] {
  if (!c.exclusiones.length) return [];
  // Lo que el clausulado SÍ cubre gana: si una palabra aparece en las dos listas, no es una
  // contradicción — es un matiz del propio contrato, y el modelo puede estar explicándolo.
  const cubiertas = new Set(c.coberturas.flatMap(terminosDe));
  const hallazgos: AfirmacionSinRespaldo[] = [];

  for (const frase of frasesDe(texto)) {
    const f = norm(frase);
    if (!AFIRMA_COBERTURA.test(f) || NIEGA.test(f)) continue;
    for (const exc of c.exclusiones) {
      const choca = terminosDe(exc).filter((t) => !cubiertas.has(t) && new RegExp(`\\b${t}`).test(f));
      if (choca.length) {
        hallazgos.push({
          frase,
          motivo:
            `afirmas que cubre "${choca[0]}", y el clausulado lo EXCLUYE: "${exc}". No lo digas, ` +
            `y si te preguntan por eso, di que no está cubierto.`,
        });
        break;
      }
    }
  }
  return hallazgos;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Describir una pantalla que no existe
   ────────────────────────────────────────────────────────────────────────── */

/**
 * En un flujo real Amparito escribió: *"Las tarjetas que ves abajo te muestran ambos, **con los
 * precios exactos**"*. Las tarjetas de recomendación llevan nombre y razón; **no llevan precio**.
 *
 * Es la misma falta del video que desmentía al sello de simulación —un texto afirmando algo sobre
 * otra superficie que no es cierto— pero peor, porque la persona baja la vista a buscar un número
 * que no está y concluye que algo se rompió.
 *
 * Se comprueba solo la contradicción concreta y verificable: decir que en pantalla hay PRECIOS
 * cuando este turno no produjo ninguna cotización. No se mira nada más: describir la pantalla en
 * general ("mira la tarjeta de abajo") es correcto y útil.
 */
const SEÑALA_LA_PANTALLA = /\b(abajo|arriba|aqu[ií]|en pantalla|las?\s+tarjetas?|ah[ií]\s+(mismo|abajo))\b/;
/*
 * "prima" NO va aquí, y es de las cosas que solo se ven probando: en español también es una
 * familiar, y el prompt le PROHÍBE a Amparito usar esa palabra para el precio ("di lo que pagas al
 * mes, no prima"). O sea que el patrón no podía acertar en el significado que buscaba y sí en el
 * otro: "aquí abajo está lo que te contó tu prima" se marcaba como promesa falsa.
 */
const DICE_PRECIO = /\b(precio|precios|cu[aá]nto\s+(cuesta|vale|te\s+sale)|valor\s+mensual)\b/;

export function describePantallaQueNoExiste(texto: string, hayCotizacion: boolean): AfirmacionSinRespaldo[] {
  if (hayCotizacion) return [];
  return frasesDe(texto)
    .filter((f) => {
      const n = norm(f);
      return SEÑALA_LA_PANTALLA.test(n) && DICE_PRECIO.test(n);
    })
    .map((frase) => ({
      frase,
      motivo:
        "dices que en pantalla hay precios, y las tarjetas de recomendación NO los llevan: solo " +
        "nombre y razón. La persona va a bajar la vista a buscar un número que no está. Ofrécele " +
        "cotizar el que le interese en vez de anunciar un precio que no aparece.",
    }));
}

/* ─────────────────────────────────────────────────────────────────────────────
   Anunciar un formulario que no está en pantalla
   ────────────────────────────────────────────────────────────────────────── */

/**
 * EL CASO REAL, y se sabe con certeza que pasó: Amparito escribió *"Ya está, abre el formulario y
 * llena tus datos"*, y la persona contestó *"no lo veo"*. Que pudiera CONTESTAR es la prueba —
 * cuando el formulario está abierto, el cliente esconde la barra de entrada, así que no habría
 * tenido dónde escribir. El modelo redactó el paso sin llamar `collect_customer_data`. Al turno
 * siguiente insistió: *"Ya está abierto en pantalla"*.
 *
 * Es la misma familia que `describePantallaQueNoExiste` y que el "déjame verificar" de un trámite
 * que ya había ocurrido: afirmar algo sobre otra superficie que no es cierto. Y aquí duele más que
 * en un precio, porque deja a la persona buscando una pantalla que no existe justo en el paso donde
 * decidió comprar — el más caro de todos para abandonar.
 *
 * SE MIRA EL MENSAJE, SE REPORTA LA FRASE. En el caso real la afirmación va repartida en dos, y la
 * segunda ni siquiera dice "formulario":
 *
 *     "Ya está, abre el formulario y llena tus datos"     ← nombra la cosa
 *     "Ya está abierto en pantalla. Solo falta que confirmes tu número de documento…"
 *
 * Pedir las dos señales dentro de una sola frase habría dejado pasar la segunda, que es la peor —
 * es la que le insiste a alguien que acaba de decir que no lo ve.
 */

/**
 * Órdenes y anuncios que SOLO pueden ir del formulario: se anclan solos.
 *
 * "Llénalo", "llena tus datos", "te lo abro" — no hay otra cosa en pantalla que se llene, así que
 * si no se abrió ninguno, la frase es falsa y punto.
 */
const ABRIR_O_LLENAR =
  /\b([aá]brelo|abre\s+el\s+formulario|ll[eé]nalo|compl[eé]talo|llena\s+(tus|el|los)|completa\s+(tus|el|los)|te\s+(lo\s+)?abr[oíi]|se\s+(te\s+)?abri[oó])\b/;

/**
 * "Abierto" a secas NO dice qué está abierto, y ahí es donde una guarda se pasa de lista.
 *
 * Estas dos son ciertas y no se pueden tocar: "tu solicitud ya está abierta con la aseguradora" y
 * "el detalle de coberturas queda abierto bajo la tarjeta" —el desplegable existe y el prompt manda
 * hablar de él—. La que sí es falsa dice ADEMÁS dónde: "ya está abierto EN PANTALLA".
 *
 * Ojo con "debajo": no contiene "abajo" como palabra, así que no dispara.
 */
const ABIERTO = /\babiert[oa]s?\b/;
const PUNTO_EN_PANTALLA = /\b(en pantalla|aqu[ií]|abajo|arriba)\b/;

/**
 * De qué va el mensaje, para no meterse donde no la llaman.
 *
 * Los campos van en la lista porque la frase que más daño hizo no menciona el formulario: los
 * enumera ("confirmes tu número de documento, fecha de nacimiento, celular y correo").
 */
const ES_EL_PASO_DE_LOS_DATOS =
  /\bformulario\b|\btus datos\b|\bn[uú]mero de documento\b|\bfecha de nacimiento\b|\bcelular y correo\b/;

/**
 * ¿El texto da por abierto un formulario que este turno no abrió?
 *
 * `hayFormulario` es el evento `form` del turno, no una suposición: el formulario se abre por una
 * tool y no hay otra vía, así que si no hubo evento, no hay pantalla.
 *
 * Las PREGUNTAS quedan fuera, por lo mismo que en `contradiceElSello`: "¿te abro el formulario?" es
 * una oferta, y tratarla como promesa incumplida obligaría a escribir peor para complacer a un
 * predicado.
 *
 * El mensaje tiene que ir del paso de los datos, y la frase tiene que decir algo que solo pueda ser
 * del formulario. "Abierto" a secas no basta nunca: necesita además señalar la pantalla. Una guarda
 * que poda texto falla hacia NO marcar.
 */
export function formularioQueNoExiste(texto: string, hayFormulario: boolean): AfirmacionSinRespaldo[] {
  if (hayFormulario) return [];
  if (!ES_EL_PASO_DE_LOS_DATOS.test(norm(texto))) return [];
  return frasesDe(texto)
    .filter((f) => {
      if (/[¿?]/.test(f)) return false;
      const n = norm(f);
      return ABRIR_O_LLENAR.test(n) || (ABIERTO.test(n) && PUNTO_EN_PANTALLA.test(n));
    })
    .map((frase) => ({
      frase,
      motivo:
        "das por hecho que el formulario está en pantalla, y en este turno no se abrió ninguno: " +
        "lo abre collect_customer_data y no la llamaste. La persona va a buscar algo que no " +
        "está. Si toca abrirlo, llama la tool en este mismo mensaje; y nunca le digas a ella que " +
        "lo ABRA, porque no lo abre ella.",
    }));
}

/** La instrucción de corrección que se le manda al modelo. */
export function instruccionDeCorreccion(hallazgos: AfirmacionSinRespaldo[]): string {
  // Habla de "cosas que el sistema no respalda" y no solo de la base: por aquí pasan también las
  // coberturas contradichas y las pantallas que no existen, y decirle que el problema está en la
  // base cuando está en el formulario es mandarlo a corregir el sitio equivocado.
  return (
    "Tu respuesta afirma cosas que el sistema NO respalda. Reescríbela quitando esas " +
    "afirmaciones, sin sustituirlas por otras: si no lo sabes, no lo digas. Mantén el resto igual " +
    "y conserva UNA SOLA pregunta.\n" +
    hallazgos.map((h) => `- "${h.frase}" → ${h.motivo}`).join("\n")
  );
}

/** Último recurso: quita las frases que siguen sin respaldo, conservando el resto. */
export function quitarFrases(texto: string, hallazgos: AfirmacionSinRespaldo[]): string {
  const fuera = new Set(hallazgos.map((h) => h.frase));
  return frasesDe(texto)
    .filter((f) => !fuera.has(f))
    .join(" ")
    .trim();
}
