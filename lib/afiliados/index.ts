/**
 * Selector de la fuente de afiliados según el entorno (mismo espíritu que getInsurerGateway).
 * - Dev/demo local  → adaptador local (sample sintético).
 * - Deploy          → adaptador remoto (Turso) si hay TURSO_DATABASE_URL. [se agrega en H4]
 * - Producción real → adaptador contra la base viva de Colsubsidio.
 */
import { AffiliateGateway } from "./gateway";
import { LocalAffiliateAdapter } from "./local-adapter";
import { TursoAffiliateAdapter } from "./turso-adapter";

let cached: AffiliateGateway | null = null;

export function getAffiliateGateway(): AffiliateGateway {
  if (cached) return cached;
  // En el deploy: si hay Turso configurado, se consulta la base completa; si no, el sample local.
  cached = process.env.TURSO_DATABASE_URL ? new TursoAffiliateAdapter() : new LocalAffiliateAdapter();
  return cached;
}

export * from "./gateway";
