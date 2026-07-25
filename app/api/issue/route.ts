import { NextRequest, NextResponse } from "next/server";
import { executeTool, type UiEvent } from "@/lib/tools";
import { copyCierre } from "@/lib/expedicion";
import { logToSheets } from "@/lib/sheets";

export const maxDuration = 30;

/**
 * Emisión determinista (fuera del loop del LLM).
 * El formulario del frontend envía quoteId + contacto + consentimiento.
 * Aquí se aplican las compuertas de cumplimiento (en servidor), se emite
 * vía el InsurerGateway y se registra en Google Sheets.
 */
export async function POST(req: NextRequest) {
  try {
    const { quoteId, contacto, consentimiento } = await req.json();

    if (consentimiento !== true) {
      return NextResponse.json(
        { error: "Necesitas autorizar el tratamiento de tus datos para emitir la póliza." },
        { status: 400 }
      );
    }

    const { result, event } = await executeTool("issue_policy", {
      quoteId,
      consentimiento: true,
      contacto,
    });

    const r = result as Record<string, unknown>;
    if (r.error) {
      return NextResponse.json({ error: r.error, detalle: r }, { status: 400 });
    }

    // Registro en Google Sheets (no bloqueante)
    const d = (event?.data ?? {}) as Record<string, unknown>;
    await logToSheets({
      fecha: new Date().toISOString(),
      poliza: d.policyId,
      producto: d.producto,
      aseguradora: d.aseguradora,
      nombres: contacto?.nombre,
      tipoDocumento: contacto?.tipoDocumento,
      documento: contacto?.numeroDocumento,
      fechaNacimiento: contacto?.fechaNacimiento,
      celular: contacto?.celular,
      correo: contacto?.correo,
      prima: d.prima,
      periodicidad: d.periodicidad,
      canal: "Amparito",
    });

    // Nada se emite de verdad (mock-adapter), y el handoff a la aseguradora es real: el cierre
    // explica el proceso completo en vez de prometer un correo que no va a llegar.
    const aseguradora = String((event?.data as Record<string, unknown>)?.aseguradora ?? "la aseguradora");
    const closing = copyCierre(aseguradora);

    // Medición de esfuerzo y satisfacción (pedido del equipo de seguros). Va como evento aparte
    // para que la tarjeta aparezca después del cierre y no compita con él.
    const feedback: UiEvent = { type: "feedback", data: { producto: (event?.data as Record<string, unknown>)?.producto ?? null } };

    return NextResponse.json({ event, closing, feedback });
  } catch (err) {
    console.error("[amparito] error emisión:", err);
    return NextResponse.json(
      { error: "No pudimos emitir en este momento. Inténtalo de nuevo en un momento." },
      { status: 200 }
    );
  }
}
