/**
 * Player del demo offline (RNF-1). Reproduce un guion de `scripts.ts` SIN red:
 * las frases son fijas, pero las tarjetas las produce `executeTool` en local (mismo motor +
 * gateway mock del vivo). Se importa de forma dinámica (solo entra al bundle en modo offline).
 */
import { executeTool } from "../tools";
import { DemoBeat } from "./scripts";
import { recsDeEvento } from "../estado/vista";
import type { Rec } from "../estado/tipos";

export type { Rec };

export interface PlayerCallbacks {
  addMsg: (role: "user" | "assistant", text: string) => void;
  addEvent: (event: { type: string; data: Record<string, unknown> }) => void;
  addRecommend: (recs: Rec[]) => void;
  sleep: (ms: number) => Promise<void>;
  cancelled: () => boolean;
}

export async function playDemo(beats: DemoBeat[], cb: PlayerCallbacks): Promise<void> {
  let lastQuoteId: string | undefined;

  // El guion offline lo escribimos NOSOTROS con datos derivados de la base real: no es salida de
  // un modelo. Así que su segmento entra como verificado — si no, `sanearPerfil` lo descartaría y
  // el demo perdería la prueba social, que es justo el momento central de Carolina.
  const guionUsuario = beats.filter((b) => b.role === "user" && b.say).map((b) => b.say!).join("\n");
  const segmentoDelGuion = (() => {
    const p = beats.find((b) => b.tool?.name === "calcular_propension")?.tool?.input?.perfil as
      | Record<string, unknown>
      | undefined;
    if (!p) return undefined;
    const pick = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
    return {
      GENERO: pick("GENERO"),
      RANGO_EDAD: pick("RANGO_EDAD"),
      CATEGORIA: pick("CATEGORIA"),
      SEGMENTO_GRUPO_FAMILIAR: pick("SEGMENTO_GRUPO_FAMILIAR"),
      SEGMENTO_POBLACIONAL: pick("SEGMENTO_POBLACIONAL"),
    };
  })();
  const ctx = { textoUsuario: guionUsuario, segmentoBase: segmentoDelGuion };

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

      const { result, event } = await executeTool(beat.tool.name, input, ctx);
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

/**
 * El demo offline pinta las MISMAS tarjetas que el vivo, con la misma función. Aquí había una
 * copia: mientras las dos coincidan nadie se entera, y el día que el criterio de "recomendado"
 * cambie en una, el guion offline —el que se usa si falla la red del salón— pinta otra cosa.
 */
const extractRecs = (result: unknown): Rec[] => recsDeEvento((result ?? {}) as Record<string, unknown>);

function readQuoteId(result: unknown, event?: { data: Record<string, unknown> }): string | undefined {
  const fromResult = (result as { quoteId?: string })?.quoteId;
  const fromEvent = event?.data?.quoteId as string | undefined;
  return fromResult ?? fromEvent;
}
