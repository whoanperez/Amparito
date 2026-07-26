import { NextRequest, NextResponse } from "next/server";
import { executeTool, type UiEvent } from "@/lib/tools";
import { copyCierre } from "@/lib/expedicion";
import { logToSheets } from "@/lib/sheets";
import { getInsurerGateway } from "@/lib/insurer/mock-adapter";
import { getProduct } from "@/lib/catalog";

export const maxDuration = 30;

/**
 * Emisión determinista (fuera del loop del LLM).
 * El formulario del frontend envía quoteId + contacto + consentimiento.
 * Aquí se aplican las compuertas de cumplimiento (en servidor), se emite
 * vía el InsurerGateway y se registra en Google Sheets.
 */
export async function POST(req: NextRequest) {
  try {
    const { quoteId, contacto, consentimiento, pagado } = await req.json();

    /*
     * ── El paso que faltaba: primero se paga ──────────────────────────────────
     *
     * El sistema iba del formulario a la emisión sin nada en medio, y el pitch del producto dice
     * que Amparito "reemplaza el te contactaremos". Sin un pago, lo que reemplazaba el
     * "te contactaremos" era un formulario — y quien lo llena sigue sin saber si quedó o no.
     *
     * El IMPORTE lo pone el servidor leyendo la cotización, no el navegador. El navegador lo tiene
     * en pantalla, pero cobrar por lo que diga el cliente es de las cosas que no se hacen aunque
     * hoy sea una simulación: el día que el pago sea real, esta ruta ya está bien.
     */
    if (pagado !== true) {
      const cot = await getInsurerGateway().leerCotizacion?.(String(quoteId ?? ""));
      const p = cot ? getProduct(cot.productId) : undefined;
      return NextResponse.json({
        evento: {
          type: "pago",
          data: {
            quoteId,
            producto: p?.nombre ?? null,
            aseguradora: p?.aseguradora ?? null,
            // Si el adaptador no sabe leer la cotización, se muestra el paso SIN importe en vez de
            // inventarlo. Un número equivocado en una pantalla de pago es peor que ningún número.
            prima: cot?.prima ?? null,
            periodicidad: cot?.periodicidad ?? null,
          },
        },
      });
    }

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
