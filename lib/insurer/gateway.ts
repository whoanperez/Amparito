/**
 * InsurerGateway — contrato único de integración con aseguradoras.
 *
 * HOY: lo implementa MockInsurerAdapter (simulación determinista).
 * MAÑANA: Colsubsidio implementa MetLifeAdapter, BolivarAdapter, etc.
 * con este MISMO contrato y lo activa vía INSURER_ADAPTER en .env.
 * Ni el system prompt ni las tools cambian al integrar la API real.
 */

export interface Perfil {
  edad?: number;
  ciudad?: string;
  contexto?: string; // texto libre: uso, dependientes, presupuesto
}

export interface Contacto {
  nombre: string;
  tipoDocumento: "CC" | "CE" | "PASAPORTE";
  numeroDocumento: string;
  fechaNacimiento: string; // DD/MM/AAAA
  celular: string;
  correo: string;
}

export interface Quote {
  quoteId: string;
  productId: string;
  prima: number;          // COP
  periodicidad: string;   // mensual | anual | por_viaje
  coberturas: string[];
  vigenciaOfertaMin: number;
  /** Edad con la que se calculó. `null` = no se conocía; la prima es solo la base. */
  edadUsada: number | null;
}

export interface Policy {
  policyId: string;
  productId: string;
  // "SIMULADA" cuando no hay aseguradora conectada (mock). Un adaptador real devuelve "ACTIVA".
  // El valor llega al LLM en el resultado de la tool: si dice ACTIVA, el modelo lo va a narrar.
  estado: "ACTIVA" | "SIMULADA";
  prima: number;
  periodicidad: string;
  vigenciaMeses: number;
  fechaEmision: string; // ISO
  certificado: string;  // texto del certificado digital
}

export interface InsurerGateway {
  quote(productId: string, perfil: Perfil): Promise<Quote>;
  issue(quoteId: string, contacto: Contacto): Promise<Policy>;
}
