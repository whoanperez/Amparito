import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { COMPARACION, HOY, LAURA, PIEZAS } from "./contenido";

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
