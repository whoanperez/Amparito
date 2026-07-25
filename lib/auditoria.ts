/**
 * Registro de decisiones — Command + Observer, en su versión útil.
 *
 * Cierra el **RNF-6** del PRD, que era el único no-negociable sin implementar:
 *   "toda recomendación persiste {perfil, reglas, pesos, reason codes, cita de fuente};
 *    inspeccionable en pantalla (no caja negra)."
 *
 * Cada ejecución de tool se registra como un COMANDO —nombre, input, resultado, momento— y se
 * notifica a los suscriptores (OBSERVER). Con eso se consiguen tres cosas de una:
 *   1. La traza auditable que pide el RNF-6.
 *   2. Replay determinista de una conversación, que es lo que la hace depurable.
 *   3. La base para el derecho de retracto, que quedó identificado como brecha.
 *
 * Lo que NO es: telemetría, ni un log de infraestructura, ni notificación a terceros. Hoy hay un
 * solo consumidor. Se estructura así porque el punto de registro es único (`executeTool`) y añadir
 * un suscriptor —un CRM, un almacén real— no debería tocar el motor ni las tools.
 *
 * PII: el registro NUNCA guarda nombres ni datos de contacto. Audita decisiones, no personas.
 */

/** Un comando ejecutado: qué se pidió, con qué, y qué salió. */
export interface Decision {
  ts: string;
  tool: string;
  /** Input saneado: sin nombres ni datos de contacto. */
  input: Record<string, unknown>;
  /** Resumen del resultado, no el objeto completo (los certificados y coberturas no aportan aquí). */
  resultado: Record<string, unknown>;
}

export type Suscriptor = (d: Decision) => void;

const suscriptores: Suscriptor[] = [];
/** Historial de la sesión del proceso. Sirve para el replay y para mostrar la traza. */
const historial: Decision[] = [];
const MAX_HISTORIAL = 200;

export function suscribir(s: Suscriptor): () => void {
  suscriptores.push(s);
  return () => {
    const i = suscriptores.indexOf(s);
    if (i >= 0) suscriptores.splice(i, 1);
  };
}

/** Campos que NUNCA entran al registro: identifican a una persona, no a una decisión. */
const PII = new Set([
  "nombre", "nombres", "apellidos", "numeroDocumento", "documento", "tipoDocumento",
  "fechaNacimiento", "celular", "telefono", "correo", "email", "direccion", "contacto",
  "asegurado", "certificado",
]);

/** Quita PII de forma recursiva. Conserva la forma para que el replay siga sirviendo. */
export function sinPII(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sinPII);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (PII.has(k)) {
        out[k] = "[omitido]";
        continue;
      }
      out[k] = sinPII(val);
    }
    return out;
  }
  return v;
}

/**
 * Resumen del resultado: lo que sirve para auditar la decisión. Un certificado completo o la lista
 * de coberturas no explican nada del porqué, y solo ensucian la traza.
 */
function resumir(tool: string, resultado: unknown): Record<string, unknown> {
  const r = (resultado ?? {}) as Record<string, unknown>;
  if (r.error) return { error: r.error };

  if (tool === "calcular_propension") {
    const recs = (r.recomendaciones ?? []) as Array<{ nombre?: string; score?: number }>;
    return {
      recomendaciones: recs.map((x) => `${x.nombre} (${x.score})`),
      obligatorios: ((r.obligatorios ?? []) as Array<{ nombre?: string }>).map((x) => x.nombre),
      descartados: ((r.descartados ?? []) as Array<{ nombre?: string }>).map((x) => x.nombre),
      no_venta: r.no_venta ? "sí" : undefined,
      peer_afirmada: !!r.peer,
      // La traza completa (reglas, pesos, procedencia) va aquí: es el corazón del RNF-6.
      traza: sinPII(r.traza),
      descartes_de_entrada: r.descartado_por_falta_de_evidencia,
    };
  }
  if (tool === "quote_product") {
    return { prima: r.prima ?? null, sin_precio: r.sin_precio ?? false, valor_asegurado: r.valor_asegurado ?? null };
  }
  if (tool === "issue_policy") {
    return { policyId: r.policyId, estado: r.estado, prima: r.prima };
  }
  return { ok: true };
}

/** Registra un comando y notifica. Nunca lanza: la auditoría no puede tumbar una conversación. */
export function registrar(tool: string, input: unknown, resultado: unknown): void {
  try {
    const d: Decision = {
      ts: new Date().toISOString(),
      tool,
      input: sinPII(input) as Record<string, unknown>,
      resultado: resumir(tool, resultado),
    };
    historial.push(d);
    if (historial.length > MAX_HISTORIAL) historial.shift();
    for (const s of suscriptores) {
      try {
        s(d);
      } catch {
        /* un suscriptor roto no puede afectar a los demás ni al flujo */
      }
    }
  } catch {
    /* si la auditoría falla, se pierde el registro y nada más */
  }
}

/** Historial de la sesión (para replay o para inspección). */
export function decisiones(): readonly Decision[] {
  return historial;
}

export function limpiarHistorial(): void {
  historial.length = 0;
}
