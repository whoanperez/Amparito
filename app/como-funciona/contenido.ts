/**
 * El CONTENIDO de /como-funciona, separado de cómo se pinta.
 *
 * Vive aparte porque tiene dos lectores: la página (`page.tsx`) y el generador que produce las
 * versiones descargables de `docs/` (`scripts/generar-como-funciona.ts`). Escribir lo mismo en dos
 * sitios es cómo se corrige uno y se olvida el otro — y aquí eso significaría que la página en línea
 * y la que alguien descargó cuentan cosas distintas del mismo proceso.
 *
 * Sin JSX a propósito: un script de Node lo importa, y no tiene por qué arrastrar React para leer
 * una lista de textos.
 */

/* ── 1 · La evidencia del proceso de hoy ──────────────────────────────────── */
export const HOY = [
  {
    img: "antes-1-catalogo",
    alt: "Página de SOAT de Colsubsidio con la lista de tipos de seguros y un botón «Cotiza»",
    paso: "Paso 1",
    t: "Hay que saber de antemano qué se busca",
    d: "El punto de partida es un catálogo. Quien no sabe si necesita un seguro de vida o uno de accidentes tiene que averiguarlo por su cuenta antes de empezar.",
  },
  {
    img: "antes-2-registrate-en-la-aseguradora",
    alt: "Paso a paso que indica «Regístrate: ingresa a la página de Seguros Mundial»",
    paso: "Paso 2",
    t: "El proceso se sale de Colsubsidio",
    d: "El primer paso del «paso a paso» es registrarse en la página de la aseguradora y volver a escribir los mismos datos. La gestión queda del lado de la persona.",
  },
  {
    img: "antes-3-te-contactaremos",
    alt: "Pantalla que dice «Has solicitado una cotización. Muy pronto te contactaremos»",
    paso: "Paso 3",
    t: "Y termina en «te contactaremos»",
    d: "No hay precio, ni coberturas, ni exclusiones, ni un número de radicado. La persona hizo todo el esfuerzo y se queda igual que al principio.",
  },
  {
    img: "antes-4-correo-tres-dias",
    alt: "Correo de confirmación que anuncia contacto en máximo 3 días hábiles",
    paso: "Paso 4",
    t: "La respuesta llega hasta 3 días después",
    d: "Un correo automático confirma la solicitud y anuncia contacto en máximo 3 días hábiles. Para entonces la decisión ya se enfrió, o se tomó en otra parte.",
  },
];

/* ── 2 · Antes y hoy, lado a lado ─────────────────────────────────────────── */
export const COMPARACION: Array<{ q: string; antes: string; ahora: string }> = [
  {
    q: "Qué recibe la persona al final",
    antes: "Un mensaje de «te contactaremos»",
    ahora: "Una cotización con su precio, qué cubre y qué no, y el paso de pago",
  },
  {
    q: "Cuánto tiene que esperar",
    antes: "Hasta 3 días hábiles",
    ahora: "Lo que dura la conversación",
  },
  {
    q: "Quién hace la gestión",
    antes: "La persona, y además en la página de la aseguradora",
    ahora: "El asistente, sin salir del mismo chat",
  },
  {
    q: "Qué le preguntan",
    antes: "Un formulario igual para todos",
    ahora: "Lo mínimo. A quien ya está afiliado, casi nada: sus datos ya están",
  },
  {
    q: "Si tiene una duda",
    antes: "Centro de ayuda, o llamar",
    ahora: "Se responde ahí mismo, leyendo el clausulado real del producto",
  },
  {
    q: "Si prefiere un humano",
    antes: "Otro canal, y contar todo de nuevo",
    ahora: "Lo pide y la conversación se transfiere con el contexto puesto",
  },
  {
    q: "Si el seguro no le conviene",
    antes: "Le cotizan igual",
    ahora: "Se lo dice, con el motivo, y le ofrece lo que sí le sirve hoy",
  },
];

/* ── 3 · El recorrido de Laura ────────────────────────────────────────────── */
export const LAURA = [
  {
    ico: "👋",
    t: "Laura llega sin saber qué necesita",
    d: "Quiere proteger a su familia, pero no sabe qué seguro le sirve. No tiene que saberlo: la conversación abre por su situación de vida, no por el catálogo.",
  },
  {
    // Nada de emoji reciente: 🪪 es Unicode 14 y en un sistema sin esa fuente sale como caja.
    ico: "🔎",
    t: "En segundos se sabe si ya es de la comunidad",
    d: "El sistema reconoce si Laura ya está afiliada a Colsubsidio o si llega desde fuera, y sigue por el camino que corresponda.",
  },
  {
    ico: "💛",
    t: "Si es afiliada, no la interrogan",
    d: "Se usa la información que ella ya autorizó para personalizar la conversación y mostrarle lo que aplica a su perfil. Antes de eso se le pide un dato que solo ella sabría, para confirmar que es ella.",
  },
  {
    ico: "🚪",
    t: "Si no lo es, también la atienden completa",
    d: "La conversación se adapta y la guía con un proceso pensado para alguien nuevo. Identificarse nunca es un requisito.",
  },
  {
    ico: "🧠",
    t: "Entiende, recomienda y explica el porqué",
    d: "Mientras conversan, entiende qué necesita y le recomienda el seguro adecuado — con la razón escrita de cada recomendación, no como una caja negra.",
  },
  {
    ico: "✋",
    t: "Y a veces le dice que no",
    d: "Si un producto no le sirve hoy, se lo dice y le ofrece lo que sí. Una recomendación en la que caben los «no» es una en la que se puede confiar.",
  },
  {
    ico: "☎️",
    t: "Puede pedir un humano cuando quiera",
    d: "Si Laura escribe «quiero hablar con un asesor», la conversación se transfiere sin que ella tenga que repetir nada.",
  },
  {
    ico: "✅",
    t: "Y si decide seguir, termina ahí mismo",
    d: "El mismo chat genera la cotización, muestra el valor y entrega el paso de pago para completar la compra en ese momento.",
  },
];

/* ── 4 · El C4, en cristiano ──────────────────────────────────────────────── */
export const PIEZAS = [
  {
    n: "La conversación",
    d: "Lo que la persona ve y escribe. Aquí no se decide nada: solo se pinta lo que el servidor mandó.",
  },
  {
    n: "El que redacta",
    d: "Un modelo de lenguaje. Pone las palabras y conversa — pero no elige el producto, no inventa un precio ni una cobertura.",
    acento: true,
  },
  {
    n: "El motor que decide",
    d: "Reglas escritas, siempre las mismas: con el mismo perfil sale la misma recomendación, y cada punto trae su razón.",
    acento: true,
  },
  {
    n: "Las compuertas",
    d: "Revisan lo que el modelo propone antes de que llegue a la pantalla. Si afirma algo que nadie verificó, no sale.",
    acento: true,
  },
  {
    n: "La base de afiliados",
    d: "Para reconocer a quien ya es de Colsubsidio y no volver a preguntarle lo que ya se sabe de él.",
  },
  {
    n: "El catálogo",
    d: "Los seguros reales, con lo que cubren, lo que no, y la fuente de cada dato.",
  },
  {
    n: "La aseguradora",
    d: "Quien emite la póliza y asume el riesgo. Colsubsidio comercializa.",
  },
  {
    n: "La traza",
    d: "El registro de por qué se recomendó cada cosa. Se puede abrir en pantalla, en la misma conversación.",
  },
];

