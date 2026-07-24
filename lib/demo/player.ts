/**
 * Player del demo offline (RNF-1). Reproduce un guion de `scripts.ts` SIN red:
 * las frases son fijas, pero las tarjetas las produce `executeTool` en local (mismo motor +
 * gateway mock del vivo). Se importa de forma dinámica (solo entra al bundle en modo offline).
 */
import { executeTool } from "../tools";
import { DemoBeat } from "./scripts";

export interface Rec {
  nombre: string;
  recomendado: boolean;
  razon: string;
}

export interface PlayerCallbacks {
  addMsg: (role: "user" | "assistant", text: string) => void;
  addEvent: (event: { type: string; data: Record<string, unknown> }) => void;
  addRecommend: (recs: Rec[]) => void;
  sleep: (ms: number) => Promise<void>;
  cancelled: () => boolean;
}

export async function playDemo(beats: DemoBeat[], cb: PlayerCallbacks): Promise<void> {
  let lastQuoteId: string | undefined;

  for (const beat of beats) {
    if (cb.cancelled()) return;

    if (beat.say) {
      cb.addMsg(beat.role, beat.say);
      await cb.sleep(beat.role === "user" ? 800 : 1500);
    }
    if (cb.cancelled()) return;

    if (beat.tool) {
      const input: Record<string, unknown> = { ...beat.tool.input };
      // Hilvana el quoteId de la cotización hacia la emisión.
      if (beat.tool.name === "issue_policy" && lastQuoteId) input.quoteId = lastQuoteId;

      const { result, event } = await executeTool(beat.tool.name, input);
      if (cb.cancelled()) return;

      if (event) cb.addEvent(event);

      // La tarjeta de propensión también alimenta las tarjetas de recomendación seleccionables.
      if (beat.tool.name === "calcular_propension") {
        const recs = extractRecs(result);
        if (recs.length) {
          await cb.sleep(600);
          cb.addRecommend(recs);
        }
      }
      if (beat.tool.name === "quote_product") {
        lastQuoteId = readQuoteId(result, event);
      }
      await cb.sleep(1200);
    }
  }
}

function extractRecs(result: unknown): Rec[] {
  const recomendaciones = (result as { recomendaciones?: Array<{ nombre: string; reason_codes?: string[] }> })?.recomendaciones ?? [];
  return recomendaciones.map((r, i) => ({
    nombre: r.nombre,
    recomendado: i === 0,
    razon: r.reason_codes?.[0] ?? "",
  }));
}

function readQuoteId(result: unknown, event?: { data: Record<string, unknown> }): string | undefined {
  const fromResult = (result as { quoteId?: string })?.quoteId;
  const fromEvent = event?.data?.quoteId as string | undefined;
  return fromResult ?? fromEvent;
}
