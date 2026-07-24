/**
 * Feature flags de Amparito.
 *
 * `voiceEnabled` controla TODO el Bloque 4 (voz Gemini Live). Apagado por defecto:
 * si la env var no está en "true", la voz no se renderiza, no conecta y sus rutas
 * responden deshabilitado. El comportamiento del chat es idéntico al de siempre.
 *
 * Para prender la voz (una vez con las keys): en `.env.local` (o en Vercel)
 *   NEXT_PUBLIC_VOICE_ENABLED=true
 * y reiniciar/redeployar (Next inyecta las NEXT_PUBLIC_* en build).
 */
export const voiceEnabled = process.env.NEXT_PUBLIC_VOICE_ENABLED === "true";
