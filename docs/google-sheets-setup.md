# Conectar Amparito con Google Sheets

Cada vez que Amparito emite una póliza, envía los datos del usuario a un Google Sheet.
Se activa con la variable `SHEETS_WEBHOOK_URL`. Si la dejas vacía, Amparito funciona igual
(solo no registra). Montarlo toma ~5 minutos.

## Paso 1 — Crea el Google Sheet
1. Entra a https://sheets.google.com y crea una hoja nueva. Llámala, por ejemplo, **Amparito – Pólizas**.

## Paso 2 — Pega el script
1. En la hoja: menú **Extensiones → Apps Script**.
2. Borra lo que haya y pega esto:

```javascript
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Polizas") || ss.insertSheet("Polizas");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Fecha","Póliza","Producto","Aseguradora","Nombres y apellidos",
      "Tipo doc","Documento","Nacimiento","Celular","Correo","Paga","Periodicidad","Canal"]);
  }
  var d = JSON.parse(e.postData.contents);
  sheet.appendRow([d.fecha, d.poliza, d.producto, d.aseguradora, d.nombres, d.tipoDocumento,
    d.documento, d.fechaNacimiento, d.celular, d.correo, d.prima, d.periodicidad, d.canal]);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Guarda (ícono del disquete).

## Paso 3 — Publica como aplicación web
1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. En el engranaje, elige **Aplicación web**.
3. Configura:
   - **Ejecutar como:** Yo (tu cuenta).
   - **Quién tiene acceso:** **Cualquier persona**.
4. **Implementar**. Autoriza los permisos que pida (es tu propio script).
5. Copia la **URL de la aplicación web** (termina en `/exec`).

## Paso 4 — Conéctala a Amparito
- **En local:** pega la URL en tu archivo `.env`, en la línea `SHEETS_WEBHOOK_URL=`.
- **En Vercel:** Project → Settings → Environment Variables → agrega `SHEETS_WEBHOOK_URL` con esa URL → vuelve a desplegar (Deployments → Redeploy).

Listo. La próxima póliza que emita Amparito aparecerá como una fila nueva en tu hoja.

> Nota: el envío es "fire-and-forget" desde el servidor de Amparito (no desde el navegador),
> así que no hay problemas de CORS y, si Sheets llegara a fallar, la emisión de la póliza
> nunca se cae — el registro es un extra, no un bloqueante.
