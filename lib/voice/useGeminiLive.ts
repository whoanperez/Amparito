/**
 * Hook de voz Gemini Live (Bloque 4). TODO gated: si `enabled` es false, `start()` no hace nada,
 * no pide micrófono y no importa el SDK (dynamic import). Con el flag apagado, es inerte.
 *
 * Flujo: pide un token efímero a /api/live-token (con las mismas tools + system prompt del chat) →
 * abre la sesión Live directo con Google → captura el micrófono (PCM16 16kHz) y lo transmite →
 * reproduce el audio de respuesta (PCM 24kHz) → cuando Gemini llama una tool, la ejecuta vía
 * /api/tool (misma fuente de verdad) y devuelve el resultado. Transcripts y eventos salen por callbacks.
 *
 * No es probable en vivo hasta tener GEMINI_API_KEY + ANTHROPIC_API_KEY y prender el flag.
 */
import { useCallback, useRef, useState } from "react";

export type VoiceStatus = "idle" | "connecting" | "listening" | "error";

export interface UiEventLike {
  type: string;
  data: Record<string, unknown>;
}

interface UseGeminiLiveOpts {
  enabled: boolean;
  onUserText?: (text: string) => void;
  onBotText?: (text: string) => void;
  onEvent?: (event: UiEventLike) => void;
}

export function useGeminiLive({ enabled, onUserText, onBotText, onEvent }: UseGeminiLiveOpts) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<{ sendRealtimeInput: (x: unknown) => void; sendToolResponse: (x: unknown) => void; close?: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inCtxRef = useRef<AudioContext | null>(null);
  const outCtxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const playHeadRef = useRef(0);

  const supported =
    enabled &&
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof AudioContext !== "undefined";

  const stop = useCallback(() => {
    try { procRef.current?.disconnect(); } catch { /* noop */ }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try { inCtxRef.current?.close(); } catch { /* noop */ }
    try { outCtxRef.current?.close(); } catch { /* noop */ }
    try { sessionRef.current?.close?.(); } catch { /* noop */ }
    procRef.current = null;
    streamRef.current = null;
    inCtxRef.current = null;
    outCtxRef.current = null;
    sessionRef.current = null;
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    setStatus("connecting");
    try {
      // 1) Token efímero + config de sesión (mismas tools y prompt del chat).
      const tokRes = await fetch("/api/live-token", { method: "POST" });
      if (!tokRes.ok) throw new Error("No se pudo iniciar la voz.");
      const { token, model, systemInstruction, functionDeclarations } = await tokRes.json();

      // 2) SDK cargado en caliente (no entra al bundle si la voz está apagada).
      const genai = (await import("@google/genai")) as unknown as {
        GoogleGenAI: new (o: unknown) => { live: { connect: (p: unknown) => Promise<unknown> } };
      };
      const ai = new genai.GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });

      // 3) Contexto de reproducción (Gemini responde a 24kHz).
      const outCtx = new AudioContext({ sampleRate: 24000 });
      outCtxRef.current = outCtx;
      playHeadRef.current = 0;

      const session = (await ai.live.connect({
        model,
        config: {
          responseModalities: ["AUDIO"],
          systemInstruction,
          tools: [{ functionDeclarations }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => setStatus("listening"),
          onmessage: async (msg: Record<string, any>) => {
            const sc = msg?.serverContent;
            if (sc?.inputTranscription?.text) onUserText?.(sc.inputTranscription.text);
            if (sc?.outputTranscription?.text) onBotText?.(sc.outputTranscription.text);
            const parts = sc?.modelTurn?.parts ?? [];
            for (const p of parts) {
              const data = p?.inlineData?.data;
              if (data) playPcm(outCtx, playHeadRef, data);
            }
            const calls = msg?.toolCall?.functionCalls;
            if (Array.isArray(calls) && calls.length && sessionRef.current) {
              const functionResponses: unknown[] = [];
              for (const fc of calls) {
                let result: unknown = {};
                try {
                  const r = await fetch("/api/tool", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: fc.name, input: fc.args ?? {} }),
                  });
                  const j = await r.json();
                  result = j.result ?? {};
                  if (j.event) onEvent?.(j.event as UiEventLike);
                } catch { /* noop */ }
                functionResponses.push({ id: fc.id, name: fc.name, response: result });
              }
              sessionRef.current.sendToolResponse({ functionResponses });
            }
          },
          onerror: () => { setError("Se interrumpió la voz."); setStatus("error"); },
          onclose: () => setStatus("idle"),
        },
      })) as typeof sessionRef.current;
      sessionRef.current = session;

      // 4) Captura del micrófono → PCM16 16kHz base64 → streaming.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const inCtx = new AudioContext({ sampleRate: 16000 });
      inCtxRef.current = inCtx;
      const source = inCtx.createMediaStreamSource(stream);
      const proc = inCtx.createScriptProcessor(4096, 1, 1);
      procRef.current = proc;
      proc.onaudioprocess = (ev: AudioProcessingEvent) => {
        const b64 = floatToPcm16Base64(ev.inputBuffer.getChannelData(0));
        try {
          sessionRef.current?.sendRealtimeInput({ audio: { data: b64, mimeType: "audio/pcm;rate=16000" } });
        } catch { /* noop */ }
      };
      source.connect(proc);
      proc.connect(inCtx.destination);
    } catch (err) {
      console.error("[amparito/voice]", err);
      setError(err instanceof Error ? err.message : "No se pudo iniciar la voz.");
      setStatus("error");
      stop();
    }
  }, [enabled, onUserText, onBotText, onEvent, stop]);

  return { supported, status, error, start, stop };
}

/** Float32 [-1,1] → PCM16 little-endian → base64 (formato de entrada de Gemini Live). */
function floatToPcm16Base64(input: Float32Array): string {
  const view = new DataView(new ArrayBuffer(input.length * 2));
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(view.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Reproduce un chunk PCM16 24kHz encolándolo tras el anterior (audio continuo sin cortes). */
function playPcm(ctx: AudioContext, playHead: { current: number }, b64: string) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer);
  const frame = ctx.createBuffer(1, pcm.length, 24000);
  const ch = frame.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
  const node = ctx.createBufferSource();
  node.buffer = frame;
  node.connect(ctx.destination);
  const startAt = Math.max(ctx.currentTime, playHead.current);
  node.start(startAt);
  playHead.current = startAt + frame.duration;
}
