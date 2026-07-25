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

export interface PropensionResult {
  recomendaciones: Recomendacion[];
  /** Banda propia, por encima del ranking. Vacía si no aplica o si ya lo tiene. */
  obligatorios: Obligatorio[];
  descartados: Descartado[];
  ledger: {
    riesgos_hoy: string[];
    ya_cubierto: YaCubierto[];
  };
  peer: Peer | null;
}
