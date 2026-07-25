import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { buildSystemPrompt, detectarEstado } from "@/lib/prompts";
import { toolDefinitions, executeTool, UiEvent, type ToolCtx } from "@/lib/tools";
import { getAffiliateGateway } from "@/lib/afiliados";

export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
const MAX_TOOL_ROUNDS = 8;

/**
 * Orquestador de Amparito.
 * Recibe el historial del cliente (stateless en servidor), corre el loop
 * de tool-use con Claude Haiku y devuelve { reply, events } donde events
 * son las tarjetas estructuradas (cotización, póliza, cumplimiento, escalamiento).
 */
export async function POST(req: NextRequest) {
  try {
    const { messages, afiliado } = (await req.json()) as {
      messages: { role: "user" | "assistant"; content: string }[];
      afiliado?: { nombre?: string; ciudad?: string };
    };
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages requerido" }, { status: 400 });
    }

    // Arranque caliente: si llega un afiliado identificado, buscamos su segmento en el servidor
    // (los nombres nunca llegan al navegador) y se lo damos a Amparito como contexto.
    let contexto: string | undefined;
    let afiliadoReconocido = false;
    let segmentoBase: ToolCtx["segmentoBase"];
    if (afiliado?.nombre) {
      const seg = await getAffiliateGateway().lookup(afiliado.nombre, afiliado.ciudad);
      if (seg) {
        afiliadoReconocido = true;
        // El segmento verificado va al motor por el SERVIDOR, no retranscrito por el modelo:
        // así un error de transcripción no puede producir una celda de peer-group falsa.
        segmentoBase = {
          GENERO: seg.genero,
          RANGO_EDAD: seg.rango_edad,
          CATEGORIA: seg.categoria,
          SEGMENTO_GRUPO_FAMILIAR: seg.grupo_familiar,
          SEGMENTO_POBLACIONAL: seg.poblacional,
        };
        const primerNombre = seg.nombre.split(" ")[0];
        contexto =
          `## SEGMENTO VERIFICADO DE ESTE AFILIADO (viene de la base de Colsubsidio, no lo preguntes)\n` +
          `Primer nombre: ${primerNombre}.\n` +
          // Los 4 ejes del peer-group (género, edad, grupo familiar, categoría) van COMPLETOS:
          // `lookupPeer` exige los 4 para ubicar la celda; si falta uno, no hay PeerProof.
          `Género = ${seg.genero ?? "?"}; grupo familiar = ${seg.grupo_familiar ?? "?"}; ` +
          `rango de edad = ${seg.rango_edad ?? "?"}; categoría = ${seg.categoria ?? "?"}; ` +
          `segmento poblacional = ${seg.poblacional ?? "?"}; ciudad = ${seg.ciudad ?? "?"}.\n` +
          `Estos son los únicos campos de segmento que puedes usar: vinieron verificados de la base. ` +
          `Pásalos tal cual a calcular_propension y no los preguntes de nuevo. Si la persona te corrige, mandan sus palabras.`;
      }
    }

    // v4 · el estado lo decide el SERVIDOR y solo viaja el bloque de ese estado. Antes todo el
    // prompt iba en cada turno y las secciones competían: el arranque caliente perdía contra el
    // ESTADO 2 ("haz 1 a 3 micro-preguntas"), que era más específico.
    const estado = detectarEstado(messages, { afiliadoReconocido });
    const system = buildSystemPrompt(estado, contexto);

    // Contexto de las tools: `sanearPerfil` verifica los campos con gate contra lo que la PERSONA
    // escribió (no contra lo que escribió Amparito — ahí estaba el bug de `vivienda:"propia"`).
    const toolCtx: ToolCtx = {
      textoUsuario: messages.filter((m) => m.role === "user").map((m) => m.content).join("\n"),
      segmentoBase,
    };

    const client = new Anthropic(); // usa ANTHROPIC_API_KEY del entorno
    const events: UiEvent[] = [];

    const convo: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools: toolDefinitions,
      messages: convo,
    });

    let rounds = 0;
    while (response.stop_reason === "tool_use" && rounds < MAX_TOOL_ROUNDS) {
      rounds++;
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          const { result, event } = await executeTool(
            block.name,
            (block.input ?? {}) as Record<string, unknown>,
            toolCtx
          );
          if (event) events.push(event);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      convo.push({ role: "assistant", content: response.content });
      convo.push({ role: "user", content: toolResults });

      response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: toolDefinitions,
        messages: convo,
      });
    }

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ reply, events });
  } catch (err) {
    console.error("[amparito] error:", err);
    return NextResponse.json(
      { reply: "Se me trabó la consulta en este momento 😅. ¿Intentamos de nuevo?", events: [] },
      { status: 200 }
    );
  }
}
