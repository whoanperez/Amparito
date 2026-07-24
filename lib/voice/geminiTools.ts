/**
 * Puente de tools hacia Gemini Live (Bloque 4).
 *
 * Reusa EXACTAMENTE las mismas tools y el system prompt del chat Haiku, para que la voz
 * tenga las mismas capacidades y no invente datos (misma fuente de verdad). Solo cambia el
 * FORMATO: Gemini usa `functionDeclarations` (OpenAPI-ish) en vez del `input_schema` de Anthropic.
 *
 * Este módulo es SERVER-ONLY (lo importa app/api/live-token). No se importa en el cliente,
 * así no arrastramos el SDK de Anthropic ni la lógica de tools al bundle del navegador.
 */
import { toolDefinitions } from "../tools";
import { SYSTEM_PROMPT } from "../prompts";

interface JsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
}

const TYPE_MAP: Record<string, string> = {
  object: "OBJECT",
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
  array: "ARRAY",
};

function toGeminiSchema(s: JsonSchema | undefined): Record<string, unknown> | undefined {
  if (!s) return undefined;
  const out: Record<string, unknown> = {};
  if (s.type) out.type = TYPE_MAP[s.type] ?? s.type.toUpperCase();
  if (s.description) out.description = s.description;
  if (s.enum) out.enum = s.enum;
  if (s.items) out.items = toGeminiSchema(s.items);
  if (s.properties) {
    out.properties = Object.fromEntries(
      Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)])
    );
  }
  if (s.required?.length) out.required = s.required;
  return out;
}

/** Las mismas tools del chat, en el formato que Gemini Live espera. */
export const geminiFunctionDeclarations = toolDefinitions.map((t) => ({
  name: t.name,
  description: t.description,
  parameters: toGeminiSchema(t.input_schema as unknown as JsonSchema),
}));

/** El mismo cerebro del chat + una nota para adaptar el registro a la voz. */
export const VOICE_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

## MODO VOZ (estás hablando, no escribiendo)
Sé breve y natural, como en una llamada telefónica corta. NO uses los formatos de texto del chat escrito (no digas "RECOMENDACION:" ni "OPCIONES:"): esos solo sirven para el chat. Llama a las MISMAS herramientas de siempre para no inventar precios, coberturas ni razones. Una idea por turno y espera la respuesta de la persona.`;
