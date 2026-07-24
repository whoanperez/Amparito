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
}

// --- Forma de data/weights.json (subconjunto que consume el motor) ---

export interface Senal {
  feature: string;
  en?: string[];
  op?: ">=" | ">" | "<=" | "<" | "==";
  valor?: number;
  es?: boolean | string;
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
  "señales": Senal[];
  redundancia?: Redundancia[];
  nota?: string;
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

export interface PropensionResult {
  recomendaciones: Recomendacion[];
  descartados: Descartado[];
  ledger: {
    riesgos_hoy: string[];
    ya_cubierto: YaCubierto[];
  };
  peer: Peer | null;
}
