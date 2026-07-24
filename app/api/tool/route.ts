import { NextRequest, NextResponse } from "next/server";
import { executeTool } from "@/lib/tools";
import { voiceEnabled } from "@/lib/flags";

/**
 * Bridge de function-calls para la voz (Bloque 4).
 * Stateless: recibe { name, input }, corre el MISMO executeTool que el chat y devuelve
 * { result, event }. Es la única fuente de verdad de datos de producto y propensión —
 * la voz no reimplementa nada. Solo se usa con la voz encendida; con el flag apagado,
 * responde deshabilitado (no expone nada).
 */
export async function POST(req: NextRequest) {
  if (!voiceEnabled) {
    return NextResponse.json({ error: "Voz deshabilitada" }, { status: 404 });
  }
  try {
    const { name, input } = (await req.json()) as {
      name: string;
      input?: Record<string, unknown>;
    };
    if (!name) {
      return NextResponse.json({ error: "name requerido" }, { status: 400 });
    }
    const { result, event } = await executeTool(name, input ?? {});
    return NextResponse.json({ result, event: event ?? null });
  } catch (err) {
    console.error("[amparito/voice/tool] error:", err);
    return NextResponse.json({ error: "La herramienta falló." }, { status: 200 });
  }
}
