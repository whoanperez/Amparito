import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/prompts";
import { toolDefinitions, executeTool, UiEvent } from "@/lib/tools";

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
    const { messages } = (await req.json()) as {
      messages: { role: "user" | "assistant"; content: string }[];
    };
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages requerido" }, { status: 400 });
    }

    const client = new Anthropic(); // usa ANTHROPIC_API_KEY del entorno
    const events: UiEvent[] = [];

    const convo: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
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
            (block.input ?? {}) as Record<string, unknown>
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
        system: SYSTEM_PROMPT,
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
