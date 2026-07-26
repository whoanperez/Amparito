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

/** Términos que prueban que la persona habló de su VIVIENDA (no de otra cosa "propia"). */
const TERMINOS_VIVIENDA = ["casa", "apartamento", "apto", "vivienda", "arriend", "inmueble", "finca", "propiedad", "vivo en"];

/** Cada tipo de vehículo se acepta solo si la persona nombró ESE tipo. */
const TERMINOS_VEHICULO: Record<string, string[]> = {
  carro: ["carro", "automovil", "auto", "camioneta", "vehiculo"],
  moto: ["moto", "motocicleta", "scooter"],
  bici: ["bici", "bicicleta"],
  patineta: ["patineta", "monopatin", "scooter electric"],
};

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

const TERMINOS_MASCOTA: Record<string, string[]> = {
  perro: ["perro", "perra", "perrito", "cachorro", "mascota"],
  gato: ["gato", "gata", "gatico", "michi", "mascota"],
};

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

  const menciona = (terminos: string[]) => terminos.some((t) => texto.includes(t));
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
export function resumenEvidencia(textoUsuario: string, perfilPrevio?: Perfil): string | null {
  const texto = norm(textoUsuario);
  const enr = perfilPrevio?.enriquecido ?? {};
  const tienePerfil = Object.keys(enr).length > 0;
  if (!texto.trim() && !tienePerfil) return null;
  const menciona = (t: string[]) => t.some((x) => texto.includes(x));

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
  const hablóDeDependientes =
    menciona([
      "hijo", "hija", "hijos", "esposa", "esposo", "pareja", "mama", "papa", "madre", "padre",
      "depende", "dependen", "a cargo", "solo yo", "nadie",
    ]) || enr.dependientes !== undefined;
  const hablóDeIngreso =
    menciona(["ingreso", "gano", "sueldo", "salario", "trabajo", "empleo", "desemplead"]) ||
    enr.sin_ingresos !== undefined;

  const sabe: string[] = [];
  const falta: string[] = [];
  (vehiculos.length ? sabe : falta).push(vehiculos.length ? `vehículo = ${vehiculos.join(", ")}` : "vehículo");
  (hablóDeDependientes ? sabe : falta).push("quién depende de su ingreso");
  (hablóDeVivienda ? sabe : falta).push("vivienda");
  if (mascotas.length) sabe.push(`mascota = ${mascotas.join(", ")}`);
  if (hablóDeIngreso) sabe.push("su situación de ingreso");

  return (
    `## LO QUE YA TE CONTÓ (no lo vuelvas a preguntar)\n` +
    (sabe.length ? `Ya sabes: ${sabe.join("; ")}.\n` : `Todavía no te ha contado nada concreto.\n`) +
    (falta.length ? `Falta por saber: ${falta.join("; ")}. Pregunta solo lo de mayor valor y una cosa por turno.` : `No necesitas preguntar nada más: recomienda ya.`)
  );
}

/** ¿Los 4 ejes del peer-group están verificados (base o declarados)? */
export function ejesPeerVerificados(perfil: Perfil): boolean {
  const o = perfil._origen ?? {};
  return (["GENERO", "RANGO_EDAD", "SEGMENTO_GRUPO_FAMILIAR", "CATEGORIA"] as const).every(
    (e) => o[e] === "base" || o[e] === "declarado"
  );
}
