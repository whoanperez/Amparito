import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { buildSystemPrompt, detectarEstado } from "@/lib/prompts";
import { toolDefinitions, executeTool, UiEvent, type ToolCtx } from "@/lib/tools";
import { resolverIdentidad } from "@/lib/afiliados/resolver";

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

    const events: UiEvent[] = [];

    // Arranque caliente. La detección del nombre y la búsqueda pasan EN CÓDIGO: la regla "cuando
    // aparece un nombre, busca" es determinista y no debe depender de que el modelo llame una tool
    // en el momento justo. Antes no existía ningún camino del chat al gateway, y por eso
    // "soy Mauricio Cajamarca" caía al vacío.
    const identidad = await resolverIdentidad(messages, afiliado);
    const afiliadoReconocido = identidad.estado === "reconocido";
    const contexto = identidad.contexto;
    const seg = identidad.segmento;
    // El segmento verificado va al motor por el SERVIDOR, no retranscrito por el modelo: así un
    // error de transcripción no puede producir una celda de peer-group falsa.
    const segmentoBase: ToolCtx["segmentoBase"] = seg
      ? {
          GENERO: seg.genero,
          RANGO_EDAD: seg.rango_edad,
          CATEGORIA: seg.categoria,
          SEGMENTO_GRUPO_FAMILIAR: seg.grupo_familiar,
          SEGMENTO_POBLACIONAL: seg.poblacional,
        }
      : undefined;

    // El cliente debe recordar el hallazgo: los resultados de tools NO sobreviven entre mensajes
    // (el historial se reconstruye solo con los textos), así que sin esto Amparito identificaría a
    // la persona en el turno 1 y no sabría quién es en el turno 3.
    if (identidad.persistir) {
      events.push({ type: "afiliado", data: identidad.persistir });
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
