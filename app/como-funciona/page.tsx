import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

/**
 * La página que explica el problema y la solución SIN tecnicismos.
 *
 * POR QUÉ ES UNA RUTA Y NO UN .md NI UN .html EN `docs/`. GitHub no renderiza HTML: quien abriera
 * `docs/reto/arquitectura-c4.html` desde el README veía el código fuente, no la página. Y el
 * público de este documento —alguien de negocio que quiere entender qué cambia— no va a leer
 * markdown con diagramas ASCII. Como ruta, se abre con un enlace y se ve.
 *
 * Las cuatro capturas del "antes" son reales, tomadas del flujo de compra actual. La del correo
 * lleva TAPADO el nombre de pila de la persona: es evidencia de un proceso, no de nadie en
 * particular, y este repo es público.
 */

export const metadata = {
  title: "Amparito · Qué cambia",
  description:
    "El proceso de compra de seguros hoy termina en «te contactaremos». Qué cambia con un asesor conversacional, explicado sin tecnicismos.",
};

/* ── 1 · La evidencia del proceso de hoy ──────────────────────────────────── */
const HOY = [
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
const COMPARACION: Array<{ q: string; antes: string; ahora: string }> = [
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
const LAURA = [
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
const PIEZAS = [
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

export default function ComoFunciona() {
  return (
    <main>
      <SiteHeader />

      <div className="cf">
        <header className="cf-hero">
          <span className="cf-eyebrow">Cómo funciona</span>
          <h1>El proceso de hoy termina en «te contactaremos»</h1>
          <p className="cf-lede">
            Esta página cuenta, sin tecnicismos, cómo se compra un seguro hoy y qué cambia con un
            asesor que conversa. Las capturas del proceso actual son reales.
          </p>
        </header>

        {/* ── 1 ─────────────────────────────────────────────────────────── */}
        <section className="cf-sec">
          <h2>
            <span className="cf-num">1</span> Así funciona hoy
          </h2>
          <p className="cf-intro">
            Cuatro pantallas del recorrido actual. Cada una añade un paso, y ninguna entrega una
            respuesta.
          </p>

          <div className="cf-tira">
            {HOY.map((p) => (
              <figure key={p.img} className="cf-shot">
                {/* A cuatro columnas la captura queda a un tercio de su tamaño y la letra de dentro
                    no se lee. El enlace la abre completa: es evidencia, y la evidencia tiene que
                    poderse mirar de cerca. */}
                <a href={`/como-funciona/${p.img}.jpg`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/como-funciona/${p.img}.jpg`} alt={p.alt} loading="lazy" />
                  <span className="cf-lupa">Ver completa</span>
                </a>
                <figcaption>
                  <span className="cf-paso">{p.paso}</span>
                  <b>{p.t}</b>
                  <span>{p.d}</span>
                </figcaption>
              </figure>
            ))}
          </div>

          <blockquote className="cf-cita">
            <p>
              Para comprar cualquier seguro hay que llenar un formulario que se vuelve tedioso, y lo
              único que devuelve es la confirmación de que se solicitó una cotización. Más allá de
              eso, nada. Toda la carga queda en el cliente: le toca ir a la aseguradora y hacerse él
              mismo la gestión.
            </p>
            <cite>Sobre el proceso actual de compra</cite>
          </blockquote>
        </section>

        {/* ── 2 ─────────────────────────────────────────────────────────── */}
        <section className="cf-sec">
          <h2>
            <span className="cf-num">2</span> Antes y ahora
          </h2>
          <p className="cf-intro">
            El cambio no es de diseño: es qué recibe la persona cuando termina de hablar.
          </p>

          <div className="cf-tabla" role="table" aria-label="Comparación entre el proceso actual y Amparito">
            <div className="cf-fila cf-head" role="row">
              <span role="columnheader" />
              <span role="columnheader">Hoy</span>
              <span role="columnheader">Con Amparito</span>
            </div>
            {COMPARACION.map((f) => (
              <div className="cf-fila" role="row" key={f.q}>
                <span className="cf-q" role="cell">{f.q}</span>
                <span className="cf-antes" role="cell">{f.antes}</span>
                <span className="cf-ahora" role="cell">{f.ahora}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3 ─────────────────────────────────────────────────────────── */}
        <section className="cf-sec">
          <h2>
            <span className="cf-num">3</span> Conozcamos a Laura
          </h2>
          <p className="cf-intro">
            Laura entra al asesor porque quiere proteger a su familia, pero no sabe qué seguro
            necesita. Esto es todo lo que pasa, en una sola conversación.
          </p>

          <ol className="cf-viaje">
            {LAURA.map((p) => (
              <li key={p.t}>
                <span className="cf-ico" aria-hidden="true">{p.ico}</span>
                <div>
                  <b>{p.t}</b>
                  <span>{p.d}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── 4 ─────────────────────────────────────────────────────────── */}
        <section className="cf-sec">
          <h2>
            <span className="cf-num">4</span> Qué hay por dentro
          </h2>
          <p className="cf-intro">
            Un diagrama de arquitectura, contado sin tecnicismos. Primero quién habla con quién;
            después, qué piezas hay dentro y cuál decide qué.
          </p>

          <h3 className="cf-h3">Quién habla con quién</h3>
          <div className="cf-c4">
            <div className="cf-actor">
              <b>Una persona</b>
              <span>Afiliada a Colsubsidio o no</span>
            </div>
            <div className="cf-flecha" aria-hidden="true">→</div>
            <div className="cf-sistema">
              <b>Amparito</b>
              <span>Conversa, recomienda, cotiza y deja la solicitud lista</span>
            </div>
            <div className="cf-flecha" aria-hidden="true">→</div>
            <div className="cf-externos">
              <span>Base de afiliados</span>
              <span>Catálogo de seguros</span>
              <span>Aseguradora aliada</span>
              <span>Asesor humano</span>
            </div>
          </div>

          <h3 className="cf-h3">Qué piezas hay dentro, y cuál decide</h3>
          <div className="cf-piezas">
            {PIEZAS.map((p) => (
              <div key={p.n} className={`cf-pieza${p.acento ? " acento" : ""}`}>
                <b>{p.n}</b>
                <span>{p.d}</span>
              </div>
            ))}
          </div>

          <p className="cf-regla">
            La regla que sostiene todo lo demás: <b>el motor calcula y el servidor valida; el que
            escribe no decide</b>. Por eso una recomendación se puede explicar punto por punto, y por
            eso no hay forma de que aparezca en pantalla un precio o una cobertura que nadie
            verificó.
          </p>
        </section>

        {/* ── Cierre ────────────────────────────────────────────────────── */}
        <section className="cf-cierre">
          <p>
            Donde hoy el proceso termina con «te contactaremos», aquí termina con una cotización
            generada y un paso de pago listo para asegurar a la persona en ese mismo momento.
          </p>
          <Link href="/chat" className="cf-cta">
            Probar la conversación →
          </Link>
        </section>

        {/* El mismo criterio que la propia aplicación: lo que es de la demostración lo dice. */}
        <p className="cf-nota demo">
          Esta es una demostración. No hay integración con aseguradoras: no se emite ninguna póliza,
          no se cobra nada y nadie recibe un correo. Los datos de afiliados usados en los ejemplos
          son sintéticos. La marca Colsubsidio se usa únicamente como contexto del ejercicio.
        </p>
      </div>
    </main>
  );
}
