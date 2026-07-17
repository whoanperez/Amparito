import Link from "next/link";

export default function Home() {
  return (
    <main>
      <header className="header">
        <Link href="/" className="logo">
          <span className="logo-mark" />
          Colsubsidio
        </Link>
        <nav className="header-nav">
          <span>Subsidios</span>
          <span>Salud</span>
          <span>Vivienda</span>
          <span className="active">Seguros</span>
          <span>Créditos</span>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <h1>Tus seguros a un clic. Ahora sí, de verdad.</h1>
          <p>
            Cuéntale a Amparito qué cambió en tu vida y sal asegurado en una sola
            conversación. Sin formularios, sin &quot;te contactaremos&quot;, sin esperas.
            A cualquier hora.
          </p>
          <Link href="/chat" className="cta">
            Hablar con Amparito →
          </Link>
          <p className="hero-meta">
            24/7 · Emisión inmediata en productos estandarizados · Respaldado por las
            aseguradoras aliadas de Colsubsidio
          </p>
        </div>
      </section>

      <section className="features">
        <div className="feature">
          <h3>Te entiende, no te vende</h3>
          <p>
            Amparito parte de tu situación —una moto nueva, un bebé, una mascota, un
            viaje— y te recomienda solo lo que necesitas, con el porqué.
          </p>
        </div>
        <div className="feature">
          <h3>Del &quot;no sé&quot; al &quot;asegurado&quot;</h3>
          <p>
            Cotización al instante y emisión de la póliza en la misma conversación,
            con tu certificado digital de inmediato.
          </p>
        </div>
        <div className="feature">
          <h3>Claridad total</h3>
          <p>
            Antes de emitir, verás qué cubre, qué NO cubre, cuánto pagas y cómo se
            calcula. Transparencia según la Ley 1328 de 2009 (Art. 9).
          </p>
        </div>
        <div className="feature">
          <h3>Humanos cuando importa</h3>
          <p>
            Los productos que requieren asesoría especializada se derivan a un asesor
            de carne y hueso. Lo simple, inmediato; lo complejo, acompañado.
          </p>
        </div>
      </section>
    </main>
  );
}
