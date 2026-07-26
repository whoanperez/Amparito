/**
 * EstadoConversacion — la definición ÚNICA de lo que Amparito sabe de una conversación.
 *
 * POR QUÉ EXISTE. Hasta aquí el estado no tenía dueño: cinco actores lo reconstruían cada turno
 * por su cuenta (orquestador, resolutor de identidad, compuerta del motor, cliente y LLM) y se
 * comunicaban por dos booleanos. Cuando discrepaban, la persona veía las dos versiones en la
 * misma pantalla — y el peor caso era el mejor momento del producto: tras el "hoy no te vendo
 * nada", `recomendaciones: []` dejaba `yaRecomendo` en false, la conversación volvía a
 * RECONOCIDO y Amparito saludaba otra vez y volvía a intentar vender.
 *
 * La regla que restaura este módulo: EL SERVIDOR CALCULA EL ESTADO Y LO PUBLICA. El cliente lo
 * guarda sin interpretarlo y obedece una `UiVista`. Nadie re-deriva nada.
 *
 * Este archivo no importa nada del SDK de Anthropic ni del cliente de la base: lo comparten
 * servidor y navegador, y arrastrar cualquiera de los dos lo rompería.
 */
import type { Perfil, Recomendacion, Obligatorio, Peer, NoVenta } from "../engine/types";
import type { SegmentoBase } from "../engine/sanear";

/** Evento estructurado que la UI renderiza como tarjeta. Vive aquí —no en `lib/tools.ts`— porque
 *  es un contrato de presentación, no un detalle del loop de tools: `tools.ts` importa el SDK de
 *  Anthropic y el cliente no puede arrastrarlo. `lib/tools.ts` lo reexporta para no romper a nadie. */
export interface UiEvent {
  type:
    | "quote" | "policy" | "escalation" | "compliance" | "form"
    // "afiliado" vivía aquí: era el hallazgo de identidad que el cliente tenía que recordar y
    // reenviar. Murió con el estado sellado, que es ahora su único portador.
    | "propension" | "impacto" | "feedback"
    /** El paso que faltaba entre el formulario y la póliza. La emisión la dispara el pago. */
    | "pago"
    /** Quick-replies. Es ESTADO, no contenido: alimenta `ui.sugerencias`, no pinta tarjeta. */
    | "opciones";
  data: Record<string, unknown>;
}

/** Tarjeta seleccionable. Se deriva SIEMPRE del evento del motor, nunca del texto del modelo.
 *  Fuente única: antes existía triplicada en `Chat.tsx`, `demo/player.ts` y un test — y la única
 *  versión cubierta era la copia que vivía dentro del test. */
export interface Rec {
  nombre: string;
  recomendado: boolean;
  razon: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Identidad
   ────────────────────────────────────────────────────────────────────────── */

/** Espejo de `EstadoIdentidad` de `lib/afiliados/resolver.ts`. Se redeclara a propósito: importar
 *  del resolver arrastraría `@libsql/client` al bundle del navegador. La conversión vive en
 *  `reducir.ts`, en un solo sitio, y el gate la cubre. */
export type ResultadoIdentidad =
  | "sin_intento" | "reconocido" | "ambiguo" | "no_encontrado" | "tope";

/**
 * Qué está esperando el sistema del PRÓXIMO mensaje. El hueco que no existía.
 *
 * Sin esto, `detectarCiudad` corría sin que nadie hubiera preguntado por la ciudad: su fallback
 * acepta cualquier mensaje de 1–4 tokens que no sean todos stopwords, así que un "para trabajar"
 * o un "avancemos" se convertían en ciudad. Y quien obedecía "dame tu nombre completo" nunca
 * podía ser reconocido, porque el nombre persistido ganaba sobre el nuevo y el nombre completo se
 * leía como ciudad.
 *
 * El arreglo no es mejorar el detector: es que el sistema sepa qué preguntó.
 */
export type Esperando = null | "nombre_completo" | "ciudad" | "verificacion";

/**
 * Tope de búsquedas por conversación. Bloqueo real de enumeración, en código y no en prompt.
 * Vive aquí —y no en `lib/afiliados/resolver.ts`— porque lo aplican dos capas: el reducer decide
 * si vale la pena consultar y el resolver corta si igual se consulta. Con la constante duplicada,
 * cambiar una no cambiaba la otra.
 */
export const MAX_BUSQUEDAS = 3;

/**
 * Intentos de verificación antes de seguir sin arranque caliente.
 *
 * Dos, y después se sigue. Nunca un callejón sin salida: quien no recuerde la fecha de expedición
 * de su cédula tiene que poder seguir usando el producto — solo que por el camino genérico, como
 * cualquiera que no esté afiliado.
 */
export const MAX_VERIFICACION = 2;

export interface IdentidadEstado {
  resultado: ResultadoIdentidad;
  esperando: Esperando;
  /** Cuántos mensajes distintos trajeron un nombre. Tope de enumeración, en código. */
  intentos: number;
  nombre?: string;
  ciudad?: string;
  /** Segmento verificado. Se CONGELA al reconocer: se acabó el round-trip a Turso por turno. */
  segmento?: SegmentoBase;
  /**
   * ¿La persona probó que es ella?
   *
   * Sin esto, escribir un nombre bastaba para llevarse el género, el rango de edad, la categoría
   * de afiliación y la composición familiar de esa persona. No es un riesgo de suplantación: es
   * una consulta abierta sobre la base de afiliados de Colsubsidio, y cualquiera podía ir probando
   * nombres.
   *
   * Mientras sea `false`, `contextoDeEstado` NO le pasa el segmento al modelo. No es una regla de
   * prompt pidiéndole discreción: es que el dato no viaja. No se puede revelar lo que no se
   * recibe.
   */
  verificada: boolean;
  /** Intentos de verificación gastados. Se agota, y agotarse NO es un callejón sin salida. */
  intentosVerificacion: number;
  /**
   * Cuántos homónimos hay, y en qué coinciden todos. Son HECHOS sobre la base, así que viven en
   * el estado y el copy se genera desde aquí. Pasarle el número al modelo como prosa para que lo
   * parafrasee es exactamente cómo el servidor dijo "cero coincidencias" y Amparito dijo "hay
   * varios Carolinas".
   */
  ambiguo?: { n: number; comun?: SegmentoBase };
  /**
   * En qué turno se le dijo "no apareces en la base". Distingue el turno en que hay que DECIRLO
   * de los siguientes, en los que solo hay que no volver a mencionarlo. Sin esto, o el aviso se
   * repite en cada turno o desaparece y el modelo vuelve a insistir con la identificación.
   */
  avisadoEnTurno?: number;
}

/**
 * Qué consulta de identidad toca hacer este turno. La produce `iniciarTurno` y la consume el
 * orquestador: el reducer decide, el I/O obedece.
 */
export type ConsultaIdentidad =
  | { modo: "ninguna" }
  | { modo: "detectar"; texto: string; primerMensaje: boolean }
  | { modo: "nombre"; nombre: string }
  | { modo: "ciudad"; nombre: string; ciudad: string };

/* ─────────────────────────────────────────────────────────────────────────────
   El estado
   ────────────────────────────────────────────────────────────────────────── */

/**
 * `VERIFICANDO` es la fase entre encontrarla y poder hablarle de lo suyo. Es una fase propia y no
 * una bandera dentro de RECONOCIDO porque las reglas son incompatibles: RECONOCIDO ordena llamar
 * al motor con el segmento EN ESE MISMO TURNO, y aquí justamente no hay segmento que pasar.
 */
/**
 * `CONFIRMANDO` es el turno que le devuelve a la persona lo que Colsubsidio tiene de ella.
 *
 * Es una fase propia por lo mismo que `VERIFICANDO`: las reglas son INCOMPATIBLES con las de
 * RECONOCIDO. Esa fase ordena "en ESTE MISMO turno llama calcular_propension"; este turno ordena
 * justo lo contrario. Metido dentro de RECONOCIDO, el prompt se contradecía a sí mismo — que es
 * exactamente el problema que la reescritura v4 vino a eliminar.
 */
export type Fase =
  | "SALUDO" | "DESCUBRIENDO" | "VERIFICANDO" | "CONFIRMANDO" | "RECONOCIDO" | "ASESORANDO";

/**
 * El veredicto del motor. Reemplaza al booleano `yaRecomendo`, que preguntaba "¿pintamos
 * tarjetas?" cuando la fase necesitaba "¿el motor ya se pronunció?".
 *
 * `entregado` se pone en true CUANDO EL MOTOR RESPONDE, tenga o no tarjetas: decir que no
 * también es un veredicto. Ahí muere el bucle de re-saludo tras el anti-venta.
 */
export interface Veredicto {
  entregado: true;
  tipo: "recomendacion" | "no_venta";
  recomendaciones: Recomendacion[];
  obligatorios: Obligatorio[];
  peer: Peer | null;
  no_venta?: NoVenta;
}

export interface EstadoConversacion {
  /** Versión del formato. Un estado con otra `v` se descarta y se arranca de cero. */
  v: 1;
  turno: number;
  fase: Fase;
  identidad: IdentidadEstado;

  /**
   * Perfil ACUMULADO, con su `_origen`. Antes lo re-inferían el LLM y la compuerta en cada turno
   * y moría con el request: el motor —la pieza determinista y auditable del sistema— recibía
   * cada turno un input retecleado por el componente menos determinista, y `_origen`, del que
   * depende la prueba social, se re-ganaba o se re-perdía en cada llamada.
   *
   * Es un PISO, no un reemplazo: el modelo sigue proponiendo y la compuerta sigue verificando
   * contra el texto de la persona. Lo único que cambia es que lo ya ganado no se pierde porque
   * el modelo olvidó retranscribirlo.
   */
  perfil: Perfil;
  /** Lo que la compuerta rechazó, y por qué. Se le devuelve al modelo para que pueda preguntarlo. */
  descartes: string[];

  veredicto: Veredicto | null;
  /** De qué producto se está hablando. Sin esto, al asesorar el modelo no sabe de qué habla. */
  foco?: string;
  quoteId?: string;
  /**
   * Cómo entró la persona: por un enlace profundo con un interés (`?interes=hogar`) o por un
   * evento de vida (`?evento=bebe`). Importa porque quien llega DICIENDO qué quiere proteger no
   * debe recibir la grilla de "¿qué te gustaría proteger?".
   *
   * El servidor no puede deducirlo del mensaje —llega como texto normal— así que lo manda el
   * cliente en el primer turno y aquí se recuerda.
   */
  origen?: "interes" | "evento";

  /** Cosas que se dicen UNA vez. Cumplir esto en código y no pidiéndoselo al prompt. */
  dichoUnaVez: {
    saludo: boolean;
    pidioCiudad: boolean;
    pidioNombreCompleto: boolean;
    /**
     * ¿Ya le devolvió lo que Colsubsidio tiene de ella, para que lo confirme?
     *
     * Sin esto, verificar la identidad no le devuelve NADA: pide un dato, ella lo da, y lo
     * siguiente que ve es un panel de recomendaciones. El momento pide lo contrario — mostrarle lo
     * que se sabe de ella y darle la oportunidad de corregirlo.
     */
    mostroSegmento: boolean;
  };
}

export function estadoInicial(): EstadoConversacion {
  return {
    v: 1,
    turno: 0,
    fase: "SALUDO",
    identidad: { resultado: "sin_intento", esperando: null, intentos: 0, verificada: false, intentosVerificacion: 0 },
    perfil: {},
    descartes: [],
    veredicto: null,
    dichoUnaVez: { saludo: false, pidioCiudad: false, pidioNombreCompleto: false, mostroSegmento: false },
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   La vista — lo único que el cliente renderiza
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Un bloque de pantalla. La unión es CORTA a propósito: si crece, es señal de que lógica de
 * presentación se está colando al servidor.
 */
export type Bloque =
  | { t: "texto"; contenido: string }
  | { t: "tarjetas"; recs: Rec[] }
  | { t: "evento"; evento: UiEvent }
  /** La grilla de "¿qué quieres proteger?". La decide el SERVIDOR: el cliente la pintaba contando
   *  burbujas del array, así que la sacaba junto a una pregunta abierta sin saber que el agente
   *  acababa de preguntar algo. */
  | { t: "elegir_proteccion" };

export interface UiVista {
  /** ORDENADOS por el servidor. El orden estaba hardcodeado en el componente. */
  bloques: Bloque[];
  /** Quick-replies. Ya no se parsean de un `OPCIONES:` con regex. */
  sugerencias: string[];
  entrada: { habilitada: boolean; formulario?: Record<string, unknown> };
}
