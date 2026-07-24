import { NextResponse } from "next/server";
import { voiceEnabled } from "@/lib/flags";
import { geminiFunctionDeclarations, VOICE_SYSTEM_PROMPT } from "@/lib/voice/geminiTools";
import { sameOrigin } from "@/lib/voice/guard";

/**
 * Token efímero para Gemini Live (Bloque 4).
 *
 * El navegador NO se conecta con la key real: pide aquí un token de corta vida acuñado en el
 * servidor con GEMINI_API_KEY (nunca `NEXT_PUBLIC`). El cliente se conecta directo a Google con
 * ese token (patrón recomendado por Google: menor latencia, sin relay). Nota: Vercel sí soporta
 * WebSockets hoy (Fluid Compute); aun así el patrón directo con token efímero es el preferido.
 * Ref: https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
 *
 * `liveConnectConstraints` fija el modelo y la config en el token: si alguien roba el token, no
 * puede abrir otro modelo ni cambiar la sesión. Devolvemos también model + config para que el
 * cliente arme la conexión sin importar la lógica de tools.
 */
const MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-2.5-flash-native-audio-preview-12-2025";

export async function POST(req: Request) {
  if (!voiceEnabled) {
    return NextResponse.json({ error: "Voz deshabilitada" }, { status: 404 });
  }
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Falta GEMINI_API_KEY en el servidor." }, { status: 500 });
  }
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const sessionConfig = {
      responseModalities: ["AUDIO"],
      systemInstruction: VOICE_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: geminiFunctionDeclarations }],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    };

    // Acuña el token (SDK, v1beta por defecto) con la config fijada.
    const token = await (ai as unknown as {
      authTokens: { create: (o: unknown) => Promise<{ name?: string }> };
    }).authTokens.create({
      config: {
        uses: 1,
        liveConnectConstraints: { model: MODEL, config: sessionConfig },
      },
    });

    if (!token?.name) {
      return NextResponse.json({ error: "Token vacío." }, { status: 502 });
    }
    return NextResponse.json({
      token: token.name,
      model: MODEL,
      systemInstruction: VOICE_SYSTEM_PROMPT,
      functionDeclarations: geminiFunctionDeclarations,
    });
  } catch (err) {
    console.error("[amparito/live-token] error:", err);
    return NextResponse.json({ error: "No se pudo crear el token de voz." }, { status: 502 });
  }
}
