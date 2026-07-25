import { NextRequest, NextResponse } from "next/server";
import { logToSheets } from "@/lib/sheets";

export const maxDuration = 15;

/**
 * Medición de esfuerzo (CES) y satisfacción (CSAT) al cierre.
 *
 * Pedido del equipo de seguros de Colsubsidio. Es la métrica que el PRD nunca definió: hoy no hay
 * forma de saber si el flujo de verdad le hizo la vida fácil a alguien, solo si terminó.
 *
 * Se guarda con el mismo canal que la emisión (Google Sheet) y SIN datos personales: solo las dos
 * calificaciones y el producto. La medición no necesita saber quién fue.
 */
export async function POST(req: NextRequest) {
  try {
    const { ces, csat, producto } = (await req.json()) as {
      ces?: number;
      csat?: number;
      producto?: string | null;
    };

    const valida = (n: unknown) => typeof n === "number" && n >= 1 && n <= 5;
    if (!valida(ces) || !valida(csat)) {
      return NextResponse.json({ error: "ces y csat deben ser números de 1 a 5" }, { status: 400 });
    }

    await logToSheets({
      fecha: new Date().toISOString(),
      canal: "Amparito",
      tipo: "feedback",
      producto: producto ?? null,
      ces,
      csat,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // La medición nunca puede romper el cierre de la venta.
    console.error("[amparito] error feedback:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
