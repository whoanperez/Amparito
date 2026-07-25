import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { ejecutarTurno, depsReales, type EntradaTurno } from "@/lib/turno";

export const maxDuration = 60;

/**
 * Adaptador HTTP del chat.
 *
 * Toda la lógica del turno vive en `lib/turno.ts`, con el I/O inyectable: `route.ts` no se podía
 * ejercitar en ningún test, y es donde viven cuatro de los seis bugs que rompen el demo. Aquí
 * quedan solo las tres cosas que son de HTTP: leer el body, validarlo y no dejar que una
 * excepción llegue al navegador como un 500.
 */
export async function POST(req: NextRequest) {
  try {
    const entrada = (await req.json()) as EntradaTurno;
    // Un historial vacío ya NO es un error: es la petición del turno 0, donde el servidor
    // devuelve el saludo. Lo que sigue siendo inválido es que `messages` no sea un array.
    if (!Array.isArray(entrada.messages)) {
      return NextResponse.json({ error: "messages debe ser un array" }, { status: 400 });
    }

    const client = new Anthropic(); // usa ANTHROPIC_API_KEY del entorno
    const salida = await ejecutarTurno(entrada, depsReales(client));
    return NextResponse.json(salida);
  } catch (err) {
    console.error("[amparito] error:", err);
    return NextResponse.json(
      { reply: "Se me trabó la consulta en este momento 😅. ¿Intentamos de nuevo?", events: [] },
      { status: 200 }
    );
  }
}
