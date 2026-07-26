/**
 * Tipos del motor de propensión (Amparito+).
 *
 * El motor es determinista y auditable: dado un `Perfil` estructurado, calcula
 * `score(perfil, producto) = Σ señales_que_aplican + redundancia` sobre `data/weights.json`
 * y devuelve un `PropensionResult`. Las `razon` de cada señal son los reason codes que el
 * LLM REDACTA (nunca inventa). Ver docs/reto/11-contrato-tools.md y 12-build-tracker.md.
 */

export type Categoria = "A" | "B" | "C" | "";

/** Señales de vida que se recogen en la conversación (namespace `enriquecido.*` en weights.json). */
export interface PerfilEnriquecido {
  dependientes?: number;
  tiene_vehiculo?: string[]; // "moto" | "carro" | "bici" | "patineta"
  tiene_mascota?: string[]; // "perro" | "gato"
  vivienda?: "propia" | "arriendo";
  necesidad_salud?: boolean;
  viaja?: boolean;
  tiene_credito?: boolean;
  mascota_veterinario_frecuente?: boolean;
  /** No tiene ingresos hoy (desempleo, informalidad sin entrada). Dispara el "hoy no te vendo". */
  sin_ingresos?: boolean;
  /**
   * ARRIENDA una propiedad suya, es decir: es el arrendador.
   *
   * Es un campo distinto de `vivienda: "arriendo"`, que significa lo contrario —vivir de
   * inquilino—. Hasta ahora el Seguro de Arrendamiento disparaba con ese, así que le ofrecía al
   * INQUILINO un producto que protege al DUEÑO contra impagos, con una razón que decía
   * literalmente "si arriendas tu propiedad". Es la misma inversión de dirección que ya apareció
   * en los dependientes y en el ingreso, esta vez dentro de las reglas del motor.
   */
  arrienda_propiedad?: boolean;
}

/**
 * Perfil estructurado que entra al motor. Los campos demográficos salen de la base (arranque
 * caliente por SERIE) o de la conversación; `enriquecido.*` de la conversación; `marca.*` son
 * marcas de consumo real (solo ~10% las tiene); `ya_cubierto` dispara la regla de anti-venta.
 */
export interface Perfil {
  GENERO?: "F" | "M";
  RANGO_EDAD?: string; // "20 a 35 años" | "36 a 45 años" | "46 a 55 años" | "Mayor de 55 años" | "Menor de 19 años"
  CATEGORIA?: Categoria;
  SEGMENTO_GRUPO_FAMILIAR?: string; // "Monoparental" | "Nuclear integral" | "Pareja conyugal" | "Sin grupo familiar" | ...
  SEGMENTO_POBLACIONAL?: string; // valores reales de la base: "Básico" | "Medio" | "Joven" | "Alto"
  enriquecido?: PerfilEnriquecido;
  marca?: Record<string, "SI" | "NO">; // DROGUERIA, VIVIENDA, AGENCIAS, HOTELES, PISCILAGO
  ya_cubierto?: string[]; // coberturas que YA tiene: "exequial" | "vida" | "soat" | "hogar" | "accidentes" | "mascota"
  /**
   * Procedencia por campo, la pone el SERVIDOR (`sanearPerfil`), nunca el LLM.
   * "base" = vino verificado de la base de afiliados · "declarado" = la persona lo dijo y el
   * servidor lo verificó contra su texto · "inferido" = el modelo lo supuso.
   * Un campo `inferido` puede mover el score, pero NO habilita afirmaciones sobre la base
   * (la prueba social exige los 4 ejes en "base" o "declarado").
   */
  _origen?: Record<string, "base" | "declarado" | "inferido">;
}

// --- Forma de data/weights.json (subconjunto que consume el motor) ---

/** Condición de match reutilizable (la comparten las señales y los requisitos de posesión). */
export interface Matcher {
  feature: string;
  en?: string[];
  op?: ">=" | ">" | "<=" | "<" | "==";
  valor?: number;
  es?: boolean | string;
}

export interface Senal extends Matcher {
  peso: number;
  razon: string;
  fuente?: string;
  nota?: string;
}

export interface Redundancia {
  si_tiene: string;
  peso: number;
  razon: string;
}

export interface ProductoWeights {
  linea: string;
  requiere_asesoria: boolean;
  /** Gate de posesión: si está presente y NINGUNA condición se cumple, el producto no se considera. */
  requiere?: Matcher[];
  "señales": Senal[];
  redundancia?: Redundancia[];
  nota?: string;
  /**
   * Obligatorio por ley (ej. SOAT, Ley 769/2002). NO compite por un cupo del ranking y NUNCA
   * puede caer en descartados: si la persona no lo tiene, va en su propia banda arriba.
   */
  obligatorio_legal?: boolean;
  /** Consecuencia real de no tenerlo. Se muestra en la banda de obligatorios. */
  consecuencia_legal?: string;
  /** Motivo específico de descarte. Sin esto, todos los descartados dicen la misma frase. */
  motivo_descarte?: string;
  /**
   * Protege el INGRESO de quien sostiene el hogar (no un bien ni un gusto). Cuando hay
   * personas que dependen de ese ingreso, estos productos encabezan el ranking: sin esto,
   * un seguro de mascotas podía quedar sobre el de vida de una madre cabeza de hogar.
   * No cambia ningún peso — cambia la prioridad.
   */
  protege_ingreso?: boolean;
}

export interface GateAffordability {
  tier: string;
  prioriza_prima_baja?: boolean;
  framing?: string;
}

export interface WeightsFile {
  priors_externos: Array<{ clave: string; valor: number; fuente: string; uso: string }>;
  gate_affordability: Record<string, GateAffordability>;
  productos: Record<string, ProductoWeights>;
}

// --- Salida del motor ---

export interface Recomendacion {
  id: string;
  nombre: string;
  aseguradora: string;
  linea: string;
  score: number;
  reason_codes: string[];
  requiere_asesoria: boolean;
}

export interface Descartado {
  id: string;
  nombre: string;
  motivo: string;
}

export interface YaCubierto {
  producto: string;
  razon: string;
}

/** Prueba social honesta: tamaño REAL del segmento en la base (sin etiqueta de compra inventada). */
export interface Peer {
  descripcion: string;
  n: number;
  pct: number;
}

/**
 * Obligatorio por ley que la persona NO tiene. No es una recomendación: es una obligación.
 * Distinguir las dos cosas es criterio, y evita decirle "esto lo puedes sumar más adelante"
 * a alguien sobre un seguro sin el cual le inmovilizan el vehículo.
 */
export interface Obligatorio {
  id: string;
  nombre: string;
  aseguradora: string;
  razon: string;
  consecuencia: string;
}

/**
 * El segundo tipo de NO: "hoy no te sirve". Hasta ahora el anti-venta solo sabía decir "ya lo
 * tienes"; le faltaba el más humano. Lo decide el MOTOR, no el LLM, para que sea la misma regla
 * de oro: el motor calcula, el modelo redacta.
 */
/**
 * Lo que SÍ responde a lo que la persona pidió, cuando el motor se niega a vender.
 *
 * `no_venta` significa "no te lo vendo", no "no hay nada para ti". Sin esto, alguien que llega
 * pidiendo algo concreto —"quiero dejar algo para que mis hijos no carguen con el entierro"— se va
 * con las manos vacías: el motor devolvía CERO y el prompt prohibía mencionar cualquier producto.
 *
 * Va SIN prima y SIN quoteId a propósito: no es una oferta, es información. Y no puede volverse una
 * venta por descuido, porque la cotización está cerrada por compuerta en servidor.
 */
export interface Informativo {
  id: string;
  nombre: string;
  aseguradora: string;
  /** Por qué responde a lo que pidió. Sale del scorecard, no del modelo. */
  razon: string;
}

export interface NoVenta {
  motivo: string;
  /** Lo que sí sirve hoy. Colsubsidio es una caja: tiene servicios que una aseguradora no. */
  alternativa: string;
}

/* ── Traza auditable (RNF-6) ─────────────────────────────────────────────────
   "Toda recomendación persiste {perfil, reglas, pesos, reason codes, cita de fuente};
   inspeccionable en pantalla (no caja negra)." Los datos ya existían dentro del motor: las
   señales se recolectaban con su peso y se tiraban, y al resultado solo llegaba la razón.
   ────────────────────────────────────────────────────────────────────────── */

/** Una señal que aplicó: qué campo del perfil la disparó, qué dice y cuánto pesó. */
export interface SenalAplicada {
  feature: string;
  razon: string;
  peso: number;
}

export interface TrazaProducto {
  id: string;
  nombre: string;
  score: number;
  senales: SenalAplicada[];
  /** Dónde terminó, para poder explicar también lo que NO se recomendó. */
  resultado: "recomendado" | "obligatorio" | "descartado" | "ya_cubierto" | "fuera_del_top";
  /**
   * Por qué NO entró, cuando el motor tiene un motivo escrito. Sin esto la traza mostraba
   * "Accidentes Personales · 55 · descartado" y dejaba sin respuesta la pregunta obvia de
   * cualquiera que audite: si puntuó 55, ¿por qué lo descartaste? El motivo ya existía en
   * `descartados`; simplemente no llegaba a la pantalla.
   */
  motivo?: string;
}

export interface TrazaDecision {
  /** Versión del scorecard con el que se decidió. Sin esto dos trazas no son comparables. */
  version_reglas: string;
  /** Perfil que ENTRÓ al motor, con la procedencia de cada campo (`_origen`). */
  perfil: Perfil;
  gate_asequibilidad: { categoria: string; prioriza_prima_baja: boolean };
  /** Si la jerarquía de protección movió el orden contra el puntaje. */
  jerarquia_aplicada: boolean;
  /** Por qué se afirmó (o no) la prueba social. */
  peer: { afirmada: boolean; motivo: string };
  productos: TrazaProducto[];
}

export interface PropensionResult {
  recomendaciones: Recomendacion[];
  /** Solo cuando hay `no_venta`: qué existe para lo que pidió, sin precio y sin cierre. */
  informativo?: Informativo;
  /** Traza auditable de esta decisión (RNF-6). Aditiva: nada existente cambia de forma. */
  traza?: TrazaDecision;
  /** Si viene, NO se recomienda ningún producto de pago: no es una venta perdida, es criterio. */
  no_venta?: NoVenta;
  /**
   * Por qué el orden no es el del puntaje. Solo aparece cuando la jerarquía de protección
   * efectivamente movió el ranking, para poder explicarlo en pantalla.
   */
  jerarquia?: string;
  /** Banda propia, por encima del ranking. Vacía si no aplica o si ya lo tiene. */
  obligatorios: Obligatorio[];
  descartados: Descartado[];
  ledger: {
    riesgos_hoy: string[];
    ya_cubierto: YaCubierto[];
  };
  peer: Peer | null;
}
