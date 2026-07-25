import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const SERVICIOS = [
  { t: "Personal y familiar", d: "Protégelos de cualquier evento inesperado.", s: "personal_familiar" },
  { t: "Movilidad", d: "Protección para auto, moto, bici y patineta.", s: "movilidad" },
  { t: "Mascotas", d: "Cobertura veterinaria y emergencias.", s: "mascotas" },
  { t: "Crédito", d: "Respaldo económico cuando más lo necesitas.", s: "creditos" },
  { t: "Hogar", d: "Protege tu vivienda y sus contenidos.", s: "hogar" },
  { t: "Exequial y asistencias", d: "Tranquilidad y acompañamiento para tu familia.", s: "exequial" },
];

const SEGUROS = [
  { ico: "🛡️", n: "Accidentes personales", a: "MetLife", s: "accidentes" },
  { ico: "❤️", n: "Vida", a: "Pan-American Life", s: "vida" },
  { ico: "🩺", n: "Asistencia médica familiar", a: "Seguros Mundial", s: "asistencia_medica" },
  { ico: "⚕️", n: "Póliza de salud", a: "BMI", s: "salud" },
  { ico: "🚗", n: "SOAT", a: "Seguros Mundial", s: "soat" },
  { ico: "🚙", n: "Todo riesgo carro", a: "Chubb", s: "carro" },
  { ico: "🏍️", n: "Moto y asistencia", a: "Seguros Mundial", s: "moto" },
  { ico: "🚲", n: "Bici o patineta", a: "Seguros Bolívar", s: "bici" },
  { ico: "🐾", n: "Mascotas", a: "Seguros Bolívar", s: "mascotas" },
  { ico: "🐶", n: "Prepagada mascotas", a: "VetPlus", s: "prepagada_mascotas" },
  { ico: "🏠", n: "Hogar y contenidos", a: "Chubb", s: "hogar" },
  { ico: "🔑", n: "Arrendamiento", a: "Seguros Mundial", s: "arrendamiento" },
  { ico: "🕊️", n: "Exequial", a: "GEA", s: "exequial" },
  { ico: "✈️", n: "Asistencia de viajes", a: "BMI", s: "viajes" },
  { ico: "🧰", n: "Asistencias múltiples", a: "Seguros Mundial", s: "asistencias" },
  { ico: "💳", n: "Seguros para créditos", a: "Pan-American Life", s: "creditos" },
];

const ALIADOS = [
  "MetLife", "Chubb", "Pan-American Life", "GEA",
  "Seguros Bolívar", "VetPlus", "BMI", "Seguros Mundial",
];

export default function Home() {
  return (
    <main>
      <SiteHeader />

      {/* ===== HERO ===== */}
      <section className="hero">
        <div className="hero-inner">
          <div>
            <div className="breadcrumb">
              <a href="https://www.colsubsidio.com/" target="_blank" rel="noopener noreferrer">Inicio</a>
              {" / "}
              <a href="https://www.colsubsidio.com/seguros" target="_blank" rel="noopener noreferrer">Seguros</a>
              {" / "}
              <b>Amparito</b>
            </div>
            <h1>Tus seguros a un clic. Ahora sí, de verdad.</h1>
            <p className="lead">
              Cuéntale a <b>Amparito</b> qué cambió en tu vida y sal asegurado en una sola
              conversación. Sin formularios, sin &quot;te contactaremos&quot;, sin esperas.
            </p>
            <Link href="/chat" className="hero-btn">
              Hablar con Amparito →
            </Link>
            <div className="hero-meta">
              <b>24/7</b> · Emisión inmediata en productos estandarizados · Respaldado por
              las aseguradoras aliadas de Colsubsidio
            </div>
          </div>

          <div className="hero-visual">
            <div className="shape" />
            <div className="chatcard">
              <div className="head">
                <div className="av">A</div>
                <div>
                  <h4>Amparito</h4>
                  <p>● En línea — sin esperas</p>
                </div>
              </div>
              {/* El mockup muestra lo que NINGÚN otro canal puede hacer: reconocer al afiliado y
                  negarse a vender. Antes mostraba "compré una moto → te recomiendo accidentes",
                  que es la versión commodity, y remataba con "✓ Póliza activa" — lo mismo que el
                  producto tiene prohibido decir, porque aquí nada se emite de verdad. */}
              <div className="body">
                <div className="bub user">Soy Carolina Ramírez</div>
                <div className="bub bot">Bienvenida, Carolina. Veo que sostienes sola tu hogar 💛</div>
                <div className="bub mini">62.459 afiliadas en tu mismo segmento</div>
                <div className="bub user">Me quedé sin trabajo</div>
                <div className="bub bot">Entonces hoy no te vendo nada. Te apunto al subsidio al desempleo.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SERVICIOS ===== */}
      <section className="section">
        <div className="servicios">
          <div>
            <h2 className="h2">Servicios</h2>
            <p className="sub">
              Conoce las coberturas personalizadas, asistencia inmediata y soluciones a tu
              medida — todo resuelto en una conversación con Amparito.
            </p>
            <Link href="/chat" className="hero-btn" style={{ marginTop: 24 }}>
              Empezar ahora →
            </Link>
          </div>
          <div className="serv-grid">
            {SERVICIOS.map((s) => (
              <Link href={`/chat?interes=${s.s}`} key={s.t} className="serv-item">
                <h3>{s.t}</h3>
                <p>{s.d}</p>
                <div className="serv-arrow">›</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TUS SEGUROS A UN CLIC ===== */}
      <section className="section alt">
        <div className="inner">
          <span className="eyebrow">Tus seguros a un clic</span>
          <h2 className="h2" style={{ marginTop: 8 }}>Todo lo que Amparito cubre</h2>
          <p className="sub">
            Dieciséis productos en nueve categorías, con las aseguradoras aliadas de
            Colsubsidio. Amparito entiende tu situación y te lleva al que necesitas.
          </p>
          <div className="chips">
            {SEGUROS.map((s) => (
              <Link href={`/chat?interes=${s.s}`} key={s.n} className="chip">
                <div className="ico">{s.ico}</div>
                <div className="txt">
                  <b>{s.n}</b>
                  <small>{s.a}</small>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ALIADOS ===== */}
      <section className="section" style={{ textAlign: "center" }}>
        <span className="eyebrow">Aliados</span>
        <h2 className="h2" style={{ marginTop: 8 }}>Las mejores aseguradoras del país</h2>
        <p className="sub" style={{ margin: "12px auto 0" }}>
          Amparito cotiza y emite respaldado por aseguradoras reconocidas, con toda la
          información legal clara antes de que decidas.
        </p>
        <div className="aliados-row">
          {ALIADOS.map((a) => (
            <div className="aliado" key={a}>{a}</div>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="cta-band">
        <div className="inner">
          <h3>Del &quot;no sé qué necesito&quot; al &quot;ya quedé asegurado&quot;.</h3>
          <Link href="/chat">Hablar con Amparito →</Link>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="foot">
        <div className="foot-inner">
          <div>
            <div className="brandw">Colsubsidio · Amparito</div>
          </div>
          <small>
            Amparito es una asistente virtual de venta de seguros. Antes de emitir, verás qué
            cubre, qué no cubre, cuánto pagas y cómo se calcula (Ley 1328 de 2009, Art. 9). Tus
            datos se tratan según la Ley 1581 de 2012. Proyecto para el Hackathon Colsubsidio ×
            30X; la marca Colsubsidio se usa con fines demostrativos.
          </small>
        </div>
      </footer>
    </main>
  );
}
