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

    // La edad la aporta el LLM y puede venir inventada o fuera de rango. Antes se asumía 30 en
    // silencio, lo que hacía indistinguible "no sé" de "tiene 30". Si no es plausible, se cotiza
    // sobre la base y se declara que la edad no se usó.
    const declarada = perfil.edad;
    const edadUsada =
      typeof declarada === "number" && Number.isFinite(declarada) && declarada >= 18 && declarada <= 100
        ? Math.floor(declarada)
        : null;
    const extra =
      edadUsada === null
        ? 0
        : Math.max(0, edadUsada - p.prima_regla.edad_pivote) * (p.prima_regla.por_edad ?? 0);
    const prima = Math.round((p.prima_regla.base + extra) / 100) * 100;

    // Cotizar en cero nunca es un resultado válido: significa que el catálogo está incompleto.
    // Mostrarlo sería decirle a alguien que el seguro es gratis.
    if (prima <= 0) {
      throw new Error(
        `Prima no cotizable para ${p.id}: prima_regla incompleta (base=${p.prima_regla.base}).`
      );
    }

    const payload = { productId, prima, periodicidad: p.periodicidad, ts: Date.now() };
    const quoteId = "Q-" + Buffer.from(JSON.stringify(payload)).toString("base64url");

    return {
      quoteId,
      productId,
      prima,
      periodicidad: p.periodicidad,
      coberturas: p.coberturas,
      vigenciaOfertaMin: 60,
      edadUsada,
    };
  }

  /** El `quoteId` codifica su propio contenido, así que leerlo no necesita almacenamiento. */
  async leerCotizacion(quoteId: string) {
    try {
      const d = JSON.parse(Buffer.from(quoteId.replace(/^Q-/, ""), "base64url").toString("utf8"));
      return typeof d?.prima === "number" && typeof d?.productId === "string"
        ? { productId: d.productId, prima: d.prima, periodicidad: String(d.periodicidad ?? "mensual") }
        : null;
    } catch {
      return null;
    }
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

    // Este adaptador NO emite: no hay aseguradora conectada. El certificado debe decirlo,
    // porque de lo contrario alguien queda esperando una póliza y un correo que no existen.
    const certificado = [
      `── SIMULACIÓN · DEMO AMPARITO ──`,
      `Este documento no tiene validez legal y no constituye un contrato de seguro.`,
      ``,
      `CERTIFICADO DE SEGURO (SIMULADO) — ${p.nombre.toUpperCase()}`,
      `Referencia No. ${policyId}`,
      `Tomador: ${contacto.nombre} (${contacto.tipoDocumento} ${contacto.numeroDocumento})`,
      `Aseguradora que asumiría el riesgo: ${p.aseguradora}`,
      `Comercializa: Colsubsidio`,
      `Prima de referencia: $${decoded.prima.toLocaleString("es-CO")} COP (${decoded.periodicidad})`,
      `Vigencia que tendría: 12 meses desde la emisión real`,
      ``,
      `En una emisión real, Colsubsidio envía la solicitud a la aseguradora, que es quien`,
      `expide la póliza y remite el certificado.`,
    ].join("\n");

    return {
      policyId,
      productId: decoded.productId,
      estado: "SIMULADA",
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
