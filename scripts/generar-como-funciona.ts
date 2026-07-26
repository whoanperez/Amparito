/**
 * Genera `docs/como-funciona.html`: la página `/como-funciona` en UN SOLO archivo.
 *   npm run doc:como-funciona     (con `npm run dev` corriendo)
 *
 * POR QUÉ EXISTE. La página vive como ruta de la aplicación, y eso está bien para quien abre el
 * enlace: se ve. Pero desde GitHub, un `.tsx` muestra el código y un `.html` también — GitHub no
 * renderiza HTML. Quien clique cualquiera de los dos se encuentra con código fuente y concluye,
 * con razón, que no hay nada que ver.
 *
 * Este archivo es la salida descargable: doble clic y funciona, sin servidor, sin red y sin
 * depender de que el despliegue esté arriba. Las imágenes van DENTRO, en base64, porque un HTML
 * suelto que pide una carpeta al lado se rompe en cuanto alguien lo manda por correo.
 *
 * NO SE ESCRIBE A MANO, SE GENERA. Mantener la misma página en dos sitios es cómo se arregla uno y
 * se olvida el otro: la fuente sigue siendo `app/como-funciona/page.tsx`, y esto la fotografía.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { COMPARACION, HOY, LAURA, PIEZAS } from "../app/como-funciona/contenido";

const ORIGEN = process.env.ORIGEN ?? "http://localhost:3000";
const SALIDA = "docs/como-funciona.html";
const SALIDA_MD = "docs/como-funciona.md";

/* ─────────────────────────────────────────────────────────────────────────────
   La versión Markdown

   Es la que resuelve el problema de verdad: GitHub NO renderiza HTML —clicar un `.html` muestra el
   código fuente, igual que clicar un `.tsx`— pero sí renderiza Markdown, con sus imágenes y con los
   diagramas `mermaid`. O sea que esta es la única de las tres que se ve de un clic desde el repo.

   El C4 va en mermaid por lo mismo: un diagrama que GitHub dibuja solo, sin que nadie descargue nada.
   ────────────────────────────────────────────────────────────────────────── */
function generarMarkdown(): string {
  const capturas = HOY.map(
    (p) =>
      `### ${p.paso} · ${p.t}\n\n` +
      `<img src="../public/como-funciona/${p.img}.jpg" alt="${p.alt}" width="300">\n\n${p.d}\n`
  ).join("\n");

  const tabla = [
    "| | Hoy | Con Amparito |",
    "|---|---|---|",
    ...COMPARACION.map((f) => `| **${f.q}** | ${f.antes} | ${f.ahora} |`),
  ].join("\n");

  const laura = LAURA.map((p) => `**${p.ico} ${p.t}**\n\n${p.d}\n`).join("\n");

  const piezas = PIEZAS.map(
    (p) => `| ${p.acento ? "**" + p.n + "**" : p.n} | ${p.d} |`
  ).join("\n");

  return `# El proceso de hoy termina en «te contactaremos»

> Cómo se compra un seguro hoy y qué cambia con un asesor que conversa. Sin tecnicismos.
> Las capturas del proceso actual son reales.

**¿Prefieres verlo con el diseño completo?** → [amparito-zeta.vercel.app/como-funciona](https://amparito-zeta.vercel.app/como-funciona)

---

## 1 · Así funciona hoy

Cuatro pantallas del recorrido actual. Cada una añade un paso, y ninguna entrega una respuesta.

${capturas}

> Para comprar cualquier seguro hay que llenar un formulario que se vuelve tedioso, y lo único que
> devuelve es la confirmación de que se solicitó una cotización. Más allá de eso, nada. Toda la carga
> queda en el cliente: le toca ir a la aseguradora y hacerse él mismo la gestión.
>
> — *Sobre el proceso actual de compra*

---

## 2 · Antes y ahora

El cambio no es de diseño: es qué recibe la persona cuando termina de hablar.

${tabla}

---

## 3 · Conozcamos a Laura

Laura entra al asesor porque quiere proteger a su familia, pero no sabe qué seguro necesita.
Esto es todo lo que pasa, en una sola conversación.

${laura}

---

## 4 · Qué hay por dentro

Un diagrama de arquitectura, contado sin tecnicismos.

### Quién habla con quién

\`\`\`mermaid
flowchart LR
  P["👤 Una persona<br/><small>afiliada a Colsubsidio o no</small>"] --> A
  A["🛡️ <b>Amparito</b><br/>Conversa, recomienda, cotiza<br/>y deja la solicitud lista"] --> B["🗂️ Base de afiliados"]
  A --> C["📋 Catálogo de seguros"]
  A --> D["🏢 Aseguradora aliada"]
  A --> E["☎️ Asesor humano"]
  style A fill:#1d1d1f,color:#fff,stroke:#1d1d1f
  style P fill:#f4f5f7,stroke:#e5e6e9
\`\`\`

### Qué piezas hay dentro, y cuál decide

Las tres **en negrita** son las que sostienen la garantía.

| Pieza | Qué hace |
|---|---|
${piezas}

\`\`\`mermaid
flowchart TD
  U["Lo que la persona escribe"] --> M["El que redacta<br/><small>modelo de lenguaje</small>"]
  M -- propone --> G["<b>Las compuertas</b><br/><small>revisan antes de que salga</small>"]
  G -- perfil validado --> E["<b>El motor que decide</b><br/><small>reglas escritas, siempre las mismas</small>"]
  E -- recomendación con su razón --> G
  G --> V["Lo que se pinta en pantalla"]
  E --> T["La traza<br/><small>por qué se recomendó cada cosa</small>"]
  style E fill:#f7fbff,stroke:#0067b1,stroke-width:2px
  style G fill:#f7fbff,stroke:#0067b1,stroke-width:2px
\`\`\`

**La regla que sostiene todo lo demás: el motor calcula y el servidor valida; el que escribe no
decide.** Por eso una recomendación se puede explicar punto por punto, y por eso no hay forma de que
aparezca en pantalla un precio o una cobertura que nadie verificó.

---

## Donde hoy el proceso termina con «te contactaremos», aquí termina con una cotización generada y un paso de pago listo para asegurar a la persona en ese mismo momento.

---

*Esta es una demostración. No hay integración con aseguradoras: no se emite ninguna póliza, no se
cobra nada y nadie recibe un correo. Los datos de afiliados usados en los ejemplos son sintéticos.
La marca Colsubsidio se usa únicamente como contexto del ejercicio.*

<sub>Archivo generado desde \`app/como-funciona/contenido.ts\` con \`npm run doc:como-funciona\`. No lo edites a mano.</sub>
`;
}

/** Las imágenes viajan dentro del archivo: un HTML que pide una carpeta al lado no sobrevive. */
function comoDataUri(ruta: string): string {
  const b64 = readFileSync(`public${ruta}`).toString("base64");
  return `data:image/jpeg;base64,${b64}`;
}

async function main() {
  const res = await fetch(`${ORIGEN}/como-funciona`);
  if (!res.ok) throw new Error(`${ORIGEN} devolvió ${res.status}. ¿Está corriendo 'npm run dev'?`);
  const pagina = await res.text();

  /*
   * Se extrae el DIV DE LA PÁGINA, no el `<main>`. Dentro del main también va el encabezado del
   * sitio, y en un archivo descargable ese encabezado es un estorbo: sus enlaces salen a
   * colsubsidio.com y su logo es un `.webp` externo que sin red aparece roto. Un documento que se
   * abre offline no puede depender de una imagen que no trae.
   */
  const cf = pagina.match(/<div class="cf">([\s\S]*?)<\/div><\/main>/);
  if (!cf) throw new Error('No se encontró el <div class="cf">. ¿Cambió la estructura de la página?');

  let cuerpo = `<div class="cf">${cf[1]}</div>`
    .slice(0)
    // Next inyecta scripts y comentarios de hidratación dentro del árbol. Aquí sobran: este archivo
    // no ejecuta nada, y dejarlos convertiría un documento en algo que parece una aplicación rota.
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  /*
   * Fuera el enlace "ver completa" que envuelve cada captura.
   *
   * En la página abre la imagen a tamaño real; aquí no aporta —la imagen ya viaja dentro y el
   * navegador hace zoom— y sí cuesta: al incrustarla, el `href` guardaba una SEGUNDA copia en base64
   * de cada foto. El archivo pesaba el doble por una función que ni siquiera se usaba.
   */
  cuerpo = cuerpo.replace(
    /<a href="\/como-funciona\/[^"]+"[^>]*>([\s\S]*?)<\/a>/g,
    (_, dentro: string) => String(dentro).replace(/<span class="cf-lupa">[\s\S]*?<\/span>/g, "")
  );

  // Y ahora sí, las capturas dentro del archivo.
  // Sin spread de iteradores: el `target` del tsconfig es anterior a es2015 y no los admite.
  const rutas = (cuerpo.match(/\/como-funciona\/[a-z0-9-]+\.jpg/g) ?? []).filter(
    (r, i, todas) => todas.indexOf(r) === i
  );
  for (const r of rutas) cuerpo = cuerpo.split(r).join(comoDataUri(r));

  const css = readFileSync("app/globals.css", "utf8");

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Amparito · Qué cambia</title>
<!--
  ARCHIVO GENERADO. No lo edites a mano: se regenera con \`npm run doc:como-funciona\` desde
  app/como-funciona/page.tsx, que es la fuente. Un cambio escrito aquí se pierde en la siguiente
  generación, y mientras tanto esta página estaría diciendo algo distinto de la que está en línea.
-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
${css}
/* Sin red no hay Poppins. La pila de respaldo se declara aquí para que el documento se lea igual
   de bien abierto en un avión que abierto en una oficina. */
body { font-family: "Poppins", -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
/* El encabezado del sitio no se incluye: aquí no hay a dónde navegar. */
.gen-aviso {
  max-width: 940px; margin: 0 auto; padding: 14px 20px 0;
  font-size: var(--t-sm); line-height: 1.6; color: var(--gris);
}
.gen-aviso a { color: var(--azul); text-decoration: underline; }
</style>
</head>
<body>
<p class="gen-aviso">
  Versión descargable de <a href="https://amparito-zeta.vercel.app/como-funciona">amparito-zeta.vercel.app/como-funciona</a>,
  en un solo archivo y con las imágenes dentro. Generada desde <code>app/como-funciona/page.tsx</code>.
</p>
${cuerpo}
</body>
</html>
`;

  writeFileSync(SALIDA, html);
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  console.log(`✅ ${SALIDA} · ${kb} KB · ${rutas.length} imágenes dentro (para descargar y abrir)`);

  const md = generarMarkdown();
  writeFileSync(SALIDA_MD, md);
  console.log(`✅ ${SALIDA_MD} · ${Math.round(Buffer.byteLength(md) / 1024)} KB · se ve de un clic en GitHub`);
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
