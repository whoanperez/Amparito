import { NextResponse } from "next/server";
import { voiceEnabled } from "@/lib/flags";
import { geminiFunctionDeclarations, VOICE_SYSTEM_PROMPT } from "@/lib/voice/geminiTools";

/**
 * Token efímero para Gemini Live (Bloque 4).
 *
 * El navegador NO se conecta con la key real: pide aquí un token de corta vida que se acuña
 * en el servidor con GEMINI_API_KEY (nunca `NEXT_PUBLIC`). Así la voz funciona con el cliente
 * conectándose directo a Google (Vercel no soporta WS server) sin exponer el secreto.
 * Ref: https://ai.google.dev/gemini-api/docs/ephemeral-tokens
 *
 * Devuelve también la config de sesión (mismas tools + system prompt del chat) para que el
 * cliente no tenga que importar la lógica de tools.
 */
const MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-2.0-flash-live-001";

export async function POST() {
  if (!voiceEnabled) {
    return NextResponse.json({ error: "Voz deshabilitada" }, { status: 404 });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Falta GEMINI_API_KEY en el servidor." }, { status: 500 });
  }
  try {
    // Cuerpo mínimo; ajustar (uses/expireTime/liveConnectConstraints) según la versión vigente
    // de la API al validar con la key. Un solo uso, para abrir la sesión de inmediato.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uses: 1 }),
      }
    );
    if (!res.ok) {
      const txt = await res.text();
      console.error("[amparito/live-token] Google respondió", res.status, txt);
      return NextResponse.json({ error: "No se pudo crear el token de voz." }, { status: 502 });
    }
    const data = (await res.json()) as { name?: string };
    if (!data.name) {
      return NextResponse.json({ error: "Token vacío." }, { status: 502 });
    }
    return NextResponse.json({
      token: data.name,
      model: MODEL,
      systemInstruction: VOICE_SYSTEM_PROMPT,
      functionDeclarations: geminiFunctionDeclarations,
    });
  } catch (err) {
    console.error("[amparito/live-token] error:", err);
    return NextResponse.json({ error: "Error creando el token de voz." }, { status: 500 });
  }
}
