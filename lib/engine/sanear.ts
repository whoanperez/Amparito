/**
 * sanearPerfil — compuerta de ENTRADA del motor (RNF-7).
 *
 * El motor es determinista y acierta. Lo que fallaba es lo que entra: `lib/tools.ts` hacía
 * `input.perfil as Perfil`, un cast de TypeScript que no verifica NADA en runtime. El LLM podía
 * mandar lo que quisiera y el motor lo creía.
 *
 * Daño real observado en una conversación de verdad: la persona nunca dijo dónde vive, el modelo
 * mandó `vivienda:"propia"` (había respondido "propio" hablando de su carro, tras una pregunta de
 * doble cañón) y eso **decidió la venta** — Hogar pasó a ser la recomendación #1. Y mandó
 * `CATEGORIA:"B"` para alguien que acababa de decir que no tiene ingresos, lo que **apagó**
 * `prioriza_prima_baja`, la salvaguarda de asequibilidad.
 *
 * La garantía tiene que ser una compuerta en servidor, no una instrucción de prompt: una regla en
 * el prompt es una petición probabilística, y ya falló dos veces en silencio.
 *
 * Estrategia: no le pedimos al modelo que "cite" (eso sería otra petición). El servidor verifica
 * contra lo que la persona REALMENTE escribió. En el caso real, la palabra "vivienda" aparecía en
 * el mensaje de Amparito, no en el del usuario — así que el chequeo lo rechaza correctamente.
 */
import type { Perfil } from "./types";
import { MASCOTAS, VEHICULOS, VIVIENDA, menciona as mencionaTermino } from "../vocabulario";

export type Origen = "base" | "declarado" | "inferido";

export interface SegmentoBase {
  GENERO?: string;
  RANGO_EDAD?: string;
  CATEGORIA?: string;
  SEGMENTO_GRUPO_FAMILIAR?: string;
  SEGMENTO_POBLACIONAL?: string;
}

export interface SanearCtx {
  /** Todo lo que la PERSONA escribió (no lo que escribió Amparito), concatenado. */
  textoUsuario?: string;
  /** Segmento que vino verificado de la base de afiliados. Manda sobre lo que proponga el LLM. */
  segmentoBase?: SegmentoBase;
  /**
   * Lo que ya se sabía al empezar el turno. Es un PISO, no un reemplazo: el modelo sigue
   * proponiendo y esta compuerta sigue verificando contra el texto de la persona.
   *
   * Sin esto, el perfil lo re-inferí­a el LLM en CADA turno y `_origen` —del que depende la
   * prueba social— nacía y moría dentro del mismo request. El motor, que es la pieza
   * determinista y auditable del sistema, recibía cada turno un input retecleado por el
   * componente menos determinista. Lo único que cambia es que lo ya ganado no se pierde porque
   * el modelo olvidó retranscribirlo.
   */
  perfilPrevio?: Perfil;
}

export interface Saneado {
  perfil: Perfil;
  /** Qué se descartó y por qué. Se le devuelve al LLM para que pueda preguntarlo si hace falta. */
  descartes: string[];
}

/* Mismos valores que el esquema de la tool: cualquier cosa fuera de aquí se cae.
 * Se EXPORTA para que los gates comprueben el contrato real en vez de una copia suya. */
export const ENUM: Record<string, readonly string[]> = {
  GENERO: ["F", "M"],
  RANGO_EDAD: ["Menor de 19 años", "20 a 35 años", "36 a 45 años", "46 a 55 años", "Mayor de 55 años"],
  CATEGORIA: ["A", "B", "C"],
  SEGMENTO_GRUPO_FAMILIAR: [
    "Sin grupo familiar", "Monoparental", "Monoparental ampliada",
    "Nuclear integral", "Nuclear ampliada", "Pareja conyugal",
  ],
  SEGMENTO_POBLACIONAL: ["Básico", "Medio", "Joven", "Alto"],
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/*
 * El vocabulario ya no vive aquí: `lib/vocabulario.ts` lo comparte con `prompts.ts` (temas de
 * pregunta) y `deteccion.ts` (palabras que no son un nombre). Eran tres listas que ya habían
 * divergido — y las tres comparaban con `includes` a secas, así que "sí, autorizo" probaba que la
 * persona tiene carro. Ver el encabezado de ese archivo.
 */
const TERMINOS_VIVIENDA = VIVIENDA;
const TERMINOS_VEHICULO = VEHICULOS;

/**
 * Falta de ingreso HOY. Van con negación explícita a propósito: "trabajo en una empresa" y
 * "mi esposa trabaja" NO pueden disparar el "hoy no te vendo nada". El texto llega normalizado
 * (sin tildes, minúsculas), así que los patrones se escriben así.
 */
const SIN_INGRESOS: RegExp[] = [
  /\bno tengo (trabajo|empleo|ingreso|ingresos|entrada|entradas|plata|con que|como pagar)\b/,
  /\bno cuento con (ingresos?|trabajo|empleo)\b/,
  /\b(estoy|ando|me quede|quede) (sin|desemplead)/,
  /\bme dejaron sin (trabajo|empleo)\b/,
  /\bsin (trabajo|empleo|ingresos)\b/,
  /\bdesemplead[oa]\b/,
  /\bcesante\b/,
  /\bperdi (el|mi) (trabajo|empleo)\b/,
  /\bme sacaron del trabajo\b/,
];

const TERMINOS_MASCOTA = MASCOTAS;

/**
 * ── La dependencia tiene DIRECCIÓN ─────────────────────────────────────────
 *
 * "Tengo dos hijos que dependen de mí" y "yo dependo de mi hija" comparten casi todas las
 * palabras y significan lo contrario. Hasta ahora `dependientes` entraba sin mirar ninguna de las
 * dos: era un número que el modelo infería y el servidor solo comprobaba que estuviera entre 0 y
 * 20. Comprobado contra el código:
 *
 *     "yo dependo de mi hija, ella me mantiene"  →  dependientes = 1
 *
 * No es un matiz. `dependientes` vale +25 hacia el Seguro de Vida y enciende la jerarquía de
 * protección del ingreso, así que invertirlo hace que el motor recomiende exactamente lo
 * contrario de lo que la persona necesita: le ofrece proteger un ingreso que no tiene, a alguien
 * a quien su familia mantiene.
 *
 * LA FORMA DEL ARREGLO. No se exige evidencia positiva: que el modelo infiera "dos" de "tengo dos
 * hijos" está bien y es lo que debe hacer. Lo que se añade es un VETO — si la persona dijo que es
 * ELLA la sostenida, el campo se cae. Es la asimetría barata: cero falsos negativos en el camino
 * normal, y atrapa el caso que hace daño.
 *
 * El objeto tiene que ser una PERSONA. "Dependo de mi trabajo" y "dependo de mi pensión" hablan de
 * su ingreso, no de quién lo sostiene, y no pueden vetar nada.
 *
 * COSTE ACEPTADO. `textoUsuario` es el join de TODOS los mensajes, así que el veto no caduca: si
 * alguien dice "dependo de mi hija" en el turno 2 y en el turno 9 cuenta que ahora mantiene a un
 * nieto, el campo sigue cayéndose. Es el mismo comportamiento que `sin_ingresos`, y falla del lado
 * correcto — dejar de recomendar Vida es recuperable en la conversación; recomendársela a quien
 * mantienen sus hijos, no.
 */
const DEPENDENCIA_INVERTIDA: RegExp[] = [
  /\b(yo\s+)?dependo\s+(economicamente\s+)?de\s+(mi|mis|la|el|los|las)?\s*(hij|espos|pareja|mam|pap|madre|padre|famili|herman|nieto|sobrin|suegr|cunad)/,
  /\b(yo\s+)?dependo\s+de\s+(ella|el|ellos|ellas)\b/,
  /\bme\s+(mantiene|mantienen|sostiene|sostienen)\b/,
  /\bme\s+(cubre|cubren)\s+(los\s+|el\s+)?(gasto|todo)/,
  /\bresponden?\s+por\s+mi\b/,
  /\bvivo\s+de\s+(lo\s+que\s+)?(me\s+dan?|mi\s+hij)/,
];

/** ¿La persona dijo que es ELLA quien depende de otros? */
export function invierteLaDependencia(textoNormalizado: string): boolean {
  return DEPENDENCIA_INVERTIDA.some((re) => re.test(textoNormalizado));
}

/**
 * ── `ya_cubierto`: la compuerta que faltaba ────────────────────────────────
 *
 * Era el ÚNICO campo del perfil que se aceptaba sin verificar contra el texto de la persona y sin
 * registrar procedencia. Y es el de más consecuencia: el scorecard le resta 100 puntos al producto
 * marcado, así que un modelo que escriba `ya_cubierto: ["vida"]` por su cuenta SUPRIME una
 * recomendación — en silencio, sin que la persona vea nunca el producto que se le quitó. Es la
 * imagen espejo del defecto que ya se cerró con `sin_ingresos`, donde el modelo podía inventar una
 * no-venta; aquí puede inventar una supresión.
 *
 * EL RIESGO DE LA COMPUERTA INGENUA. Buscar la palabra "vida" en el texto sería peor que no tener
 * compuerta: "quiero un seguro de vida" contiene "vida", y aceptarlo apagaría el producto que la
 * persona acaba de pedir. Por eso se exige POSESIÓN y se descarta la INTENCIÓN, en la misma
 * oración — la intención de comprar y el hecho de tener se escriben con las mismas palabras y solo
 * las separa el verbo.
 *
 * DE QUÉ LADO FALLA. Si la compuerta no reconoce una forma de decirlo, Amparito recomienda algo que
 * la persona ya tiene: incómodo, visible y corregible en la conversación siguiente. Al revés —lo de
 * hoy— se le quita un producto sin que nadie se entere. Se prefiere el error que se ve.
 */
const COBERTURAS = ["exequial", "vida", "soat", "hogar", "accidentes", "mascota"];

/** Tener, en las formas en que la gente lo dice. */
const POSEE =
  /\b(ya\s+)?(tengo|tenemos|tiene|cuento con|contamos con|contrat[eo]|adquiri|maneja|pago|estoy (asegurad|cubiert)|estamos (asegurad|cubiert)|me cubre|nos cubre|cubierto por|viene con|me lo da|me lo dio)\b/;

/**
 * Querer, buscar o NO tener. Manda sobre `POSEE` dentro de la misma oración: "no tengo exequial" y
 * "quiero tener un seguro de vida" contienen ambos un verbo de posesión.
 */
const NO_POSEE =
  /\b(no|quiero|queria|quisiera|necesito|busco|buscando|me interesa|me gustaria|cotizar|cotiza|averiguar|pensando en|deberia|deber[ií]a|me falta|sin)\b/;

/** Cómo se nombra cada cobertura. Solo términos que no se confunden con otra cosa. */
const TERMINOS_COBERTURA: Record<string, string[]> = {
  exequial: ["exequial", "exequias", "funerario", "funeraria", "plan funerario"],
  vida: ["seguro de vida", "poliza de vida", "de vida", "vida"],
  soat: ["soat"],
  hogar: ["seguro de hogar", "poliza de hogar", "hogar asegurad", "seguro para la casa", "asegurada la casa", "asegurado el apartamento", "contenidos"],
  accidentes: ["accidentes personales", "accidentes"],
  mascota: ["seguro de mascota", "seguro para el perro", "seguro para el gato", "poliza de mascota", "prepagada de mascota", "prepagada para el perro", "mascota asegurad"],
};

/** Trocea por oración: la posesión y la intención tienen que competir en el mismo tramo. */
const oraciones = (t: string) => t.split(/[.?!;,\n]+/).map((s) => s.trim()).filter(Boolean);

/**
 * ¿La persona DIJO que ya tiene esta cobertura?
 *
 * Exige, en una misma oración: un término de la cobertura + un verbo de posesión + ninguna marca de
 * intención o negación.
 */
export function declaroQueTiene(textoNormalizado: string, cobertura: string): boolean {
  const terminos = TERMINOS_COBERTURA[cobertura];
  if (!terminos) return false;
  return oraciones(textoNormalizado).some(
    (o) => terminos.some((t) => o.includes(t)) && POSEE.test(o) && !NO_POSEE.test(o)
  );
}

export function sanearPerfil(bruto: unknown, ctx: SanearCtx = {}): Saneado {
  const src = (bruto ?? {}) as Record<string, unknown>;
  const texto = norm(ctx.textoUsuario ?? "");
  const base = ctx.segmentoBase ?? {};
  const descartes: string[] = [];

  // El PISO: lo ya ganado en turnos anteriores entra con su procedencia intacta. `_origen` se
  // reescribe al final, y `enriquecido` se copia aparte porque es el único campo anidado.
  const { _origen: origenPrevio, enriquecido: enrPrevio, ...restoPrevio } = ctx.perfilPrevio ?? {};
  const origen: Record<string, Origen> = { ...(origenPrevio ?? {}) };
  const perfil: Record<string, unknown> = { ...restoPrevio };

  const menciona = (terminos: readonly string[]) => mencionaTermino(texto, terminos);
  const enEnum = (campo: string, v: unknown) =>
    typeof v === "string" && ENUM[campo].includes(v);

  /* ── Ejes de segmento ──────────────────────────────────────────────────── */

  // Lo que vino de la base MANDA y entra siempre (ya está verificado).
  for (const campo of Object.keys(ENUM)) {
    const deBase = (base as Record<string, unknown>)[campo];
    if (enEnum(campo, deBase)) {
      perfil[campo] = deBase;
      origen[campo] = "base";
    }
  }

  const propuesto = (campo: string) => {
    const v = src[campo];
    if (v === undefined || v === null || v === "") return undefined;
    if (!enEnum(campo, v)) {
      descartes.push(`${campo}: valor fuera del enum permitido, descartado`);
      return undefined;
    }
    return v as string;
  };

  // CATEGORIA · dato ADMINISTRATIVO de Colsubsidio. Un modelo no puede deducirlo y nadie dice
  // "soy categoría B". Si no vino de la base, no existe — y eso es lo correcto: con categoría
  // desconocida el gate de asequibilidad activa `prioriza_prima_baja`, que protege a quien
  // menos tiene. Inventarla la apagaba.
  if (!origen.CATEGORIA) {
    const v = propuesto("CATEGORIA");
    if (v) descartes.push("CATEGORIA: no vino de la base de afiliados; un modelo no puede deducirla");
  }

  // SEGMENTO_POBLACIONAL · igual, es administrativo.
  if (!origen.SEGMENTO_POBLACIONAL) {
    const v = propuesto("SEGMENTO_POBLACIONAL");
    if (v) descartes.push("SEGMENTO_POBLACIONAL: es un segmento administrativo; solo vale si vino de la base");
  }

  // RANGO_EDAD · se acepta si la persona mencionó una edad (hay un número plausible en SU texto).
  if (!origen.RANGO_EDAD) {
    const v = propuesto("RANGO_EDAD");
    if (v) {
      if (/\b(1[89]|[2-9]\d)\b/.test(texto)) {
        perfil.RANGO_EDAD = v;
        origen.RANGO_EDAD = "declarado";
      } else {
        descartes.push("RANGO_EDAD: la persona no mencionó su edad, descartado");
      }
    }
  }

  // GENERO · no es feature de scoring (solo lo usa el peer-group), así que descartarlo cuando no
  // está verificado no cuesta nada y evita afirmar una celda con un eje supuesto.
  if (!origen.GENERO) {
    const v = propuesto("GENERO");
    if (v) {
      if (/\b(hombre|mujer|masculino|femenino|soy el|soy la|señor|senora|señora)\b/.test(texto)) {
        perfil.GENERO = v;
        origen.GENERO = "declarado";
      } else {
        descartes.push("GENERO: no fue declarado ni vino de la base, descartado");
      }
    }
  }

  // SEGMENTO_GRUPO_FAMILIAR · sí se admite inferido: sale de lo que la persona contó ("mi esposa",
  // "mi hijo"). Alimenta el scoring, pero al quedar marcado como `inferido` NO habilita la prueba
  // social, que exige los 4 ejes verificados.
  //
  // CON UNA EXCEPCIÓN, encontrada al revisar el veto de `dependientes`: los valores de este enum no
  // son etiquetas neutras, IMPLICAN quién sostiene a quién. "Monoparental" hace que el scorecard
  // diga, literal, "eres el sostén de un hogar monoparental: si te faltas, nadie más cubre el
  // ingreso" — y vale +35. Vetar solo `dependientes` dejaba el agujero abierto por aquí: Vida
  // volvía con score 45, recomendado, a quien acababa de decir que la mantienen.
  //
  // Lo que vino de la BASE no se toca: es dato verificado y manda. Lo que se veta es que el modelo
  // lo PROPONGA contradiciendo lo que la persona acaba de declarar.
  if (!origen.SEGMENTO_GRUPO_FAMILIAR) {
    const v = propuesto("SEGMENTO_GRUPO_FAMILIAR");
    if (v) {
      perfil.SEGMENTO_GRUPO_FAMILIAR = v;
      origen.SEGMENTO_GRUPO_FAMILIAR = "inferido";
    }
  }

  /* ── enriquecido ───────────────────────────────────────────────────────── */

  const enrBruto = (src.enriquecido ?? {}) as Record<string, unknown>;
  const enr: Record<string, unknown> = { ...(enrPrevio ?? {}) };

  // Campos con GATE de posesión: habilitan un producto entero, así que exigen que la persona
  // haya hablado de eso. Aquí es donde se colaba `vivienda:"propia"`.
  if (enrBruto.vivienda === "propia" || enrBruto.vivienda === "arriendo") {
    if (menciona(TERMINOS_VIVIENDA)) {
      enr.vivienda = enrBruto.vivienda;
      origen["enriquecido.vivienda"] = "declarado";
    } else {
      descartes.push(
        "enriquecido.vivienda: la persona nunca habló de su vivienda (¿respondiste a otra pregunta?). " +
          "Descartado: sin esto no se puede ofrecer seguro de hogar. Pregúntaselo directamente."
      );
    }
  }

  /**
   * Los campos de LISTA se unen con lo ya ganado, no lo reemplazan.
   *
   * Asignar directamente parecía inofensivo mientras el perfil se re-inferí­a entero cada turno,
   * porque no había nada que perder. Con el piso sí lo hay: si en el turno 2 mencionó la moto y
   * en el 5 el modelo manda solo ["carro"], una asignación borraba la moto — justo lo contrario
   * de lo que el piso promete.
   */
  const unir = (previas: string[] | undefined, nuevas: string[]) =>
    Array.from(new Set([...(previas ?? []), ...nuevas]));

  if (Array.isArray(enrBruto.tiene_vehiculo)) {
    const validos = (enrBruto.tiene_vehiculo as unknown[])
      .map(String)
      .filter((t) => TERMINOS_VEHICULO[t] && menciona(TERMINOS_VEHICULO[t]));
    const rechazados = (enrBruto.tiene_vehiculo as unknown[]).map(String).filter((t) => !validos.includes(t));
    if (validos.length) {
      enr.tiene_vehiculo = unir(enrPrevio?.tiene_vehiculo, validos);
      origen["enriquecido.tiene_vehiculo"] = "declarado";
    }
    if (rechazados.length) {
      descartes.push(`enriquecido.tiene_vehiculo: la persona no mencionó ${rechazados.join(", ")}, descartado`);
    }
  }

  if (Array.isArray(enrBruto.tiene_mascota)) {
    const validos = (enrBruto.tiene_mascota as unknown[])
      .map(String)
      .filter((t) => TERMINOS_MASCOTA[t] && menciona(TERMINOS_MASCOTA[t]));
    if (validos.length) {
      enr.tiene_mascota = unir(enrPrevio?.tiene_mascota, validos);
      origen["enriquecido.tiene_mascota"] = "declarado";
    } else if ((enrBruto.tiene_mascota as unknown[]).length) {
      descartes.push("enriquecido.tiene_mascota: la persona no mencionó mascotas, descartado");
    }
  }

  // Campos conversacionales sin gate: se aceptan como inferidos (no habilitan productos que la
  // persona no pueda tener, solo mueven el score).
  //
  // `dependientes` es la excepción y tiene VETO por dirección: ver `DEPENDENCIA_INVERTIDA`. El
  // argumento de "solo mueve el score" no le aplica — mueve +25 hacia Vida Y enciende la jerarquía
  // de protección del ingreso, así que invertido recomienda lo contrario de lo que hace falta.
  const NUM = ["dependientes"] as const;
  for (const k of NUM) {
    const v = enrBruto[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 20) {
      enr[k] = Math.floor(v);
      origen[`enriquecido.${k}`] = "inferido";
    }
  }
  const BOOL = ["necesidad_salud", "viaja", "tiene_credito", "mascota_veterinario_frecuente"] as const;
  for (const k of BOOL) {
    if (typeof enrBruto[k] === "boolean") {
      enr[k] = enrBruto[k];
      origen[`enriquecido.${k}`] = "inferido";
    }
  }

  // ASIMETRÍA DELIBERADA: el servidor solo AÑADE lo que protege, y solo VALIDA lo que habilita
  // una venta. `tiene_vehiculo` o `vivienda` se verifican pero nunca se originan aquí (originarlos
  // podría habilitar un producto que la persona no pidió). `sin_ingresos` sí se origina, porque su
  // fallo silencioso —venderle a quien no puede pagar— es el que hace daño.
  //
  // `sin_ingresos` NO puede quedar a criterio del modelo: dispara el "hoy no te vendo nada", que
  // es el momento de mayor confianza del producto. Aquí la asimetría importa — un falso positivo
  // mata una venta y se VE; un falso negativo (venderle a quien no puede pagar) es SILENCIOSO, y
  // es el que hace daño. Así que el servidor decide, en las dos direcciones:
  //   · si el modelo lo manda sin evidencia → se cae
  //   · si hay evidencia y el modelo no lo mandó → se FIJA
  const evidenciaSinIngresos = SIN_INGRESOS.some((re) => re.test(texto));
  if (evidenciaSinIngresos) {
    enr.sin_ingresos = true;
    origen["enriquecido.sin_ingresos"] = "declarado";
  } else if (enrBruto.sin_ingresos === true) {
    descartes.push(
      "enriquecido.sin_ingresos: la persona no dijo que no tuviera ingresos. Descartado — no se le " +
        "puede negar una venta por una suposición, igual que no se le puede vender por una."
    );
  } else if (enrBruto.sin_ingresos === false) {
    enr.sin_ingresos = false;
    origen["enriquecido.sin_ingresos"] = "inferido";
  }

  /*
   * ── La corrección por DIRECCIÓN, en un solo sitio y al final ──────────────
   *
   * Va aquí, después de armar el perfil entero, y no como filtro de entrada. La primera versión
   * de esto vetaba solo lo que el modelo proponía en el turno, y eso dejaba pasar el caso REAL:
   *
   *     turno 1  "vivo con mi hija y mi nieto"   → Monoparental, dependientes 2  (razonable)
   *     turno 2  "…yo dependo de mi hija"        → el piso los conservaba intactos
   *                                              → y el motor recomendaba Seguro de Vida
   *
   * Nadie abre diciendo "yo dependo de mi hija": lo aclara después. Así que la inversión no es un
   * filtro de entrada, es una CORRECCIÓN DEL EXPEDIENTE — alcanza a lo que ya estaba.
   *
   * Lo verificado por la base no se toca: el servidor no sobrescribe a Colsubsidio, solo impide
   * que el modelo lo contradiga.
   */
  if (invierteLaDependencia(texto)) {
    if (enr.dependientes !== undefined) {
      delete enr.dependientes;
      delete origen["enriquecido.dependientes"];
      descartes.push(
        "dependientes: la persona dice que ELLA depende de otros, no al revés. No asumas que " +
          "alguien depende de su ingreso, y no se lo vuelvas a preguntar como si lo fuera."
      );
    }
    if (perfil.SEGMENTO_GRUPO_FAMILIAR !== undefined && origen.SEGMENTO_GRUPO_FAMILIAR !== "base") {
      delete perfil.SEGMENTO_GRUPO_FAMILIAR;
      delete origen.SEGMENTO_GRUPO_FAMILIAR;
      descartes.push(
        "SEGMENTO_GRUPO_FAMILIAR: implica que la persona sostiene el hogar, y ella dijo que es " +
          "al revés. Descartado — no le ofrezcas proteger un ingreso que no tiene."
      );
    }
  }

  if (Object.keys(enr).length) perfil.enriquecido = enr;

  /* ── ya_cubierto y marca ───────────────────────────────────────────────── */

  if (Array.isArray(src.ya_cubierto)) {
    const vals = (src.ya_cubierto as unknown[])
      .map(String)
      .filter((v) => COBERTURAS.includes(v));
    const conEvidencia: string[] = [];
    for (const v of vals) {
      // Ya venía de antes: la evidencia se dio en su momento y no se vuelve a pedir.
      if (restoPrevio.ya_cubierto?.includes(v)) { conEvidencia.push(v); continue; }
      if (declaroQueTiene(texto, v)) conEvidencia.push(v);
      else descartes.push(`ya_cubierto.${v}: la persona no dijo que ya lo tiene, descartado`);
    }
    // También se une: `ya_cubierto` dispara el anti-venta ("eso ya lo tienes"), así que perder
    // una cobertura mencionada tres turnos atrás es venderle algo que ya tiene.
    if (conEvidencia.length) {
      perfil.ya_cubierto = unir(restoPrevio.ya_cubierto, conEvidencia);
      // El único campo del perfil que se aceptaba SIN registrar de dónde salió. La traza lo
      // mostraba como "sin procedencia", que era literalmente cierto.
      origen.ya_cubierto = origen.ya_cubierto ?? "declarado";
    }
  }
  // `marca.*` son datos de consumo de la base: el LLM no los puede conocer.
  if (src.marca && !ctx.segmentoBase) {
    descartes.push("marca: son datos de consumo de la base; no se aceptan desde la conversación");
  }

  perfil._origen = origen;
  return { perfil: perfil as Perfil, descartes };
}

/**
 * Resumen de lo que YA está evidente en la conversación, derivado del texto de la persona.
 *
 * Existe porque `/api/chat` es stateless: el modelo reconstruye el perfil del historial crudo en
 * cada turno y a veces no ve que ya preguntó. En la conversación real preguntó dos veces por los
 * dependientes y dos veces por el uso del carro, con las mismas palabras.
 *
 * Es determinista y no necesita estado en el cliente: usa las mismas listas de términos con las
 * que `sanearPerfil` verifica la evidencia.
 */
export interface OpcionesResumen {
  /**
   * El segmento verificado, tal como vive en `estado.identidad`.
   *
   * Va aparte de `perfilPrevio` porque son dos momentos distintos: la identidad se resuelve en
   * cuanto la persona dice su nombre, pero el perfil solo recibe esos ejes DESPUÉS de que el motor
   * haya corrido. Sin esto, entre el reconocimiento y la primera recomendación el bloque no sabía
   * nada de ella — y ese es justo el tramo donde antes preguntaba de más.
   */
  segmentoBase?: SegmentoBase;
  /**
   * ¿La fase actual puede abrir preguntas de perfilamiento? En ASESORANDO no — y ese matiz es la
   * mitad de este paso: el bloque ahora corre SIEMPRE, así que tiene que saber decir "ya no
   * preguntes" en vez de "pregunta lo de mayor valor".
   */
  puedePreguntar?: boolean;
}

/**
 * La edad EXACTA, si la persona llegó a decirla.
 *
 * `RANGO_EDAD` viene de la base y sirve para puntuar; la prima necesita un número. Son dos datos
 * distintos, y confundirlos es lo que hacía que Amparito preguntara la edad a alguien cuyo rango ya
 * tenía verificado. Se busca con patrón, no con un número suelto: "gano 39 mil" no es una edad.
 */
const EDAD_DICHA =
  // El `(?!…)` es el arreglo de un falso positivo encontrado al revisar: "tengo 40 mil pesos
  // ahorrados" devolvía 40 años. En una conversación de seguros se habla de plata todo el rato, así
  // que un número detrás de "tengo" es tan probablemente dinero como edad.
  /\b(?:tengo|cumplo|cumpli|voy a cumplir)\s+(\d{2})\b(?!\s*(?:mil|millon|lucas|barras|pesos|k\b))|\b(\d{2})\s*anos?\b/;

export function edadDicha(textoNormalizado: string): number | null {
  const m = textoNormalizado.match(EDAD_DICHA);
  const n = Number(m?.[1] ?? m?.[2]);
  return Number.isFinite(n) && n >= 18 && n <= 99 ? n : null;
}

export function resumenEvidencia(
  textoUsuario: string,
  perfilPrevio?: Perfil,
  opciones: OpcionesResumen = {}
): string | null {
  const puedePreguntar = opciones.puedePreguntar !== false;
  const texto = norm(textoUsuario);
  const enr = perfilPrevio?.enriquecido ?? {};
  // Antes miraba solo `enriquecido`, así que un afiliado con los cuatro ejes de la base y sin nada
  // conversacional contaba como "sin perfil".
  const tienePerfil = Object.keys(perfilPrevio ?? {}).some((k) => k !== "_origen");
  if (!texto.trim() && !tienePerfil) return null;
  const menciona = (t: readonly string[]) => mencionaTermino(texto, t);

  // El TEXTO manda para decidir qué no volver a preguntar: recoge lo que la persona mencionó,
  // aunque el modelo no lo haya capturado en el perfil. El PERFIL suma lo que además ya está
  // confirmado y sobrevivió la compuerta. Quedarse solo con el perfil haría repreguntar cosas
  // que la persona sí dijo pero el modelo no transcribió.
  const vehiculos = Array.from(new Set([
    ...Object.entries(TERMINOS_VEHICULO).filter(([, t]) => menciona(t)).map(([k]) => k),
    ...(enr.tiene_vehiculo ?? []),
  ]));
  const mascotas = Array.from(new Set([
    ...Object.entries(TERMINOS_MASCOTA).filter(([, t]) => menciona(t)).map(([k]) => k),
    ...(enr.tiene_mascota ?? []),
  ]));
  const hablóDeVivienda = menciona(TERMINOS_VIVIENDA) || enr.vivienda !== undefined;
  // Lo dijo ELLA: va en la lista de lo conversacional.
  // Los términos siguen la convención de lib/vocabulario.ts: `*` = prefijo, sin `*` = palabra
  // exacta. Antes eran `includes` a secas, con el mismo riesgo que hundió a "auto"/"autorizo".
  const contóDependientes =
    menciona([
      "hijo*", "hija*", "esposa*", "esposo*", "pareja*", "mama", "papa", "madre", "padre",
      "depend*", "a cargo", "solo yo", "nadie",
    ]) || enr.dependientes !== undefined;

  /*
   * Pero el grupo familiar YA responde esta pregunta —incluido "Sin grupo familiar", que responde
   * que nadie—, así que tampoco falta por saber. Se distingue de lo anterior a propósito: si vino
   * de la base, decir "te lo contó ella" sería atribuirle a la persona algo que no dijo, y afirmar
   * de más sobre la base es justo lo que el validador existe para impedir. Ya está listado arriba
   * como verificado; aquí solo deja de pedirse.
   */
  const sabeDependientes =
    contóDependientes ||
    (opciones.segmentoBase?.SEGMENTO_GRUPO_FAMILIAR ?? perfilPrevio?.SEGMENTO_GRUPO_FAMILIAR) !== undefined;
  const hablóDeIngreso =
    menciona(["ingreso*", "gano", "sueldo*", "salario*", "trabaj*", "emple*", "desemplead*"]) ||
    enr.sin_ingresos !== undefined;

  const sabe: string[] = [];
  const falta: string[] = [];
  (vehiculos.length ? sabe : falta).push(vehiculos.length ? `vehículo = ${vehiculos.join(", ")}` : "vehículo");
  if (contóDependientes) sabe.push("quién depende de su ingreso");
  else if (!sabeDependientes) falta.push("quién depende de su ingreso");
  (hablóDeVivienda ? sabe : falta).push("vivienda");
  if (mascotas.length) sabe.push(`mascota = ${mascotas.join(", ")}`);
  if (hablóDeIngreso) sabe.push("su situación de ingreso");

  /*
   * ── Los ejes de la base ───────────────────────────────────────────────────
   *
   * Faltaban por completo, y eran la mitad del bug que se veía en producción: Amparito le
   * preguntaba la edad a alguien cuyo rango vino verificado de Colsubsidio. Se listan APARTE de lo
   * conversacional a propósito — decir "tú me contaste que tienes 36 a 45" sería falso, y afirmar
   * de más sobre la base es justo lo que el validador existe para impedir.
   */
  const org = perfilPrevio?._origen ?? {};
  const base = opciones.segmentoBase ?? {};
  const ETIQUETAS: Array<[keyof Perfil & keyof SegmentoBase, string]> = [
    ["RANGO_EDAD", "edad"],
    ["SEGMENTO_GRUPO_FAMILIAR", "grupo familiar"],
    ["CATEGORIA", "categoría"],
    ["GENERO", "género"],
  ];
  // Vale por las dos vías: el segmento recién resuelto y el perfil que ya pasó por la compuerta.
  const valorVerificado = (k: keyof Perfil & keyof SegmentoBase) =>
    base[k] ?? (org[k as string] === "base" ? (perfilPrevio?.[k] as string | undefined) : undefined);
  const verificado = ETIQUETAS.map(([k, etq]) => [etq, valorVerificado(k)] as const)
    .filter(([, v]) => !!v)
    .map(([etq, v]) => `${etq} = ${String(v)}`);

  // La edad exacta es OTRO dato que el rango. Si ya la dijo, no se vuelve a pedir; si no, se pide
  // en el único momento en que hace falta.
  const edad = edadDicha(texto);
  const lineaEdad = edad
    ? `Edad exacta: ${edad} años, la dijo ella. Ya la tienes: no la vuelvas a pedir.`
    : (opciones.segmentoBase?.RANGO_EDAD ?? perfilPrevio?.RANGO_EDAD)
      ? `Para COTIZAR necesitas la edad exacta — la base solo da el rango. Pídela únicamente cuando ` +
        `vayas a cotizar, y di para qué sirve. Nunca antes.`
      : null;

  return [
    `## LO QUE YA SABES DE ESTA PERSONA (no lo vuelvas a preguntar)`,
    verificado.length ? `Verificado por Colsubsidio: ${verificado.join("; ")}.` : null,
    sabe.length ? `Te lo contó ella: ${sabe.join("; ")}.` : null,
    !verificado.length && !sabe.length ? `Todavía no sabes nada concreto de ella.` : null,
    lineaEdad,
    falta.length
      ? puedePreguntar
        ? `Falta por saber: ${falta.join("; ")}. Pregunta solo lo de mayor valor y una cosa por turno.`
        : `Falta por saber: ${falta.join("; ")} — pero NO abras preguntas de perfilamiento aquí: ya ` +
          `hay recomendación en pantalla. Si algo falta de verdad, se afina cuando ella lo mencione.`
      : puedePreguntar
        ? `No necesitas preguntar nada más: recomienda ya.`
        : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** ¿Los 4 ejes del peer-group están verificados (base o declarados)? */
export function ejesPeerVerificados(perfil: Perfil): boolean {
  const o = perfil._origen ?? {};
  return (["GENERO", "RANGO_EDAD", "SEGMENTO_GRUPO_FAMILIAR", "CATEGORIA"] as const).every(
    (e) => o[e] === "base" || o[e] === "declarado"
  );
}
