/**
 * Guarda de origen para las rutas de voz (Bloque 4).
 *
 * Con el flag encendido, /api/live-token y /api/tool quedan expuestas. Esta guarda mínima
 * exige que la petición venga del mismo origen del sitio (así un tercero no acuña tokens
 * Gemini contra tu cuota ni ejecuta tools desde fuera). No sustituye rate-limit/auth de
 * producción; es el piso razonable para el demo. Se puede relajar si un proxy altera headers.
 */
export function sameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return false;
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  // Sin Origin (algunos clientes): caemos al Referer.
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }
  return false;
}
