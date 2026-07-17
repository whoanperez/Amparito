/**
 * Envío de cada póliza emitida a un Google Sheet, vía un Apps Script
 * publicado como Web App. Fire-and-forget: si falla o no está
 * configurado, la emisión NO se cae (Sheets es un registro, no un
 * bloqueante). Configura SHEETS_WEBHOOK_URL en .env para activarlo.
 * Guía de montaje: docs/google-sheets-setup.md
 */
export async function logToSheets(row: Record<string, unknown>): Promise<void> {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return; // no configurado -> se omite en silencio
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
  } catch (err) {
    console.error("[amparito] Sheets log falló (no bloqueante):", err);
  }
}
