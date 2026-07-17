import { InsurerGateway, Perfil, Contacto, Quote, Policy } from "./gateway";
import { getProduct } from "../catalog";

/**
 * MockInsurerAdapter — simula la API de la aseguradora.
 *
 * Diseño stateless: el quoteId codifica en base64 el contenido de la
 * cotización, de modo que issue() no depende de memoria compartida
 * (robusto en serverless/Vercel). Una API real reemplaza esto por
 * sus propios IDs sin tocar el contrato.
 */
export class MockInsurerAdapter implements InsurerGateway {
  async quote(productId: string, perfil: Perfil): Promise<Quote> {
    const p = getProduct(productId);
    if (!p) throw new Error(`Producto no encontrado: ${productId}`);

    const edad = perfil.edad ?? 30;
    const extra = Math.max(0, edad - p.prima_regla.edad_pivote) * (p.prima_regla.por_edad ?? 0);
    const prima = Math.round((p.prima_regla.base + extra) / 100) * 100;

    const payload = { productId, prima, periodicidad: p.periodicidad, ts: Date.now() };
    const quoteId = "Q-" + Buffer.from(JSON.stringify(payload)).toString("base64url");

    return {
      quoteId,
      productId,
      prima,
      periodicidad: p.periodicidad,
      coberturas: p.coberturas,
      vigenciaOfertaMin: 60,
    };
  }

  async issue(quoteId: string, contacto: Contacto): Promise<Policy> {
    const decoded = JSON.parse(
      Buffer.from(quoteId.replace(/^Q-/, ""), "base64url").toString("utf8")
    ) as { productId: string; prima: number; periodicidad: string };

    const p = getProduct(decoded.productId);
    if (!p) throw new Error(`Producto no encontrado: ${decoded.productId}`);

    const policyId =
      "AMP-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(Math.random() * 900 + 100);
    const fechaEmision = new Date().toISOString();

    const certificado = [
      `CERTIFICADO DE SEGURO — ${p.nombre.toUpperCase()}`,
      `Póliza No. ${policyId}`,
      `Asegurado: ${contacto.nombre} (${contacto.tipoDocumento} ${contacto.numeroDocumento})`,
      `Aseguradora: ${p.aseguradora} · Distribuido por Colsubsidio`,
      `Prima: $${decoded.prima.toLocaleString("es-CO")} COP (${decoded.periodicidad})`,
      `Vigencia: 12 meses desde la fecha de emisión`,
      `Emitido digitalmente — canal Amparito, 24/7 sin intervención humana.`,
    ].join("\n");

    return {
      policyId,
      productId: decoded.productId,
      estado: "ACTIVA",
      prima: decoded.prima,
      periodicidad: decoded.periodicidad,
      vigenciaMeses: 12,
      fechaEmision,
      certificado,
    };
  }
}

/** Selector de adaptador según .env — punto único de integración futura. */
export function getInsurerGateway(): InsurerGateway {
  const adapter = process.env.INSURER_ADAPTER ?? "mock";
  switch (adapter) {
    case "mock":
    default:
      return new MockInsurerAdapter();
    // case "metlife": return new MetLifeAdapter();  // ← integración real futura
    // case "bolivar": return new BolivarAdapter();
  }
}
