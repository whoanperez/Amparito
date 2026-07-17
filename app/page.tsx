import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const SERVICIOS = [
  { t: "Personal y familiar", d: "Protégelos de cualquier evento inesperado." },
  { t: "Movilidad", d: "Protección para auto, moto, bici y patineta." },
  { t: "Mascotas", d: "Cobertura veterinaria y emergencias." },
  { t: "Crédito", d: "Respaldo económico cuando más lo necesitas." },
  { t: "Hogar", d: "Protege tu vivienda y sus contenidos." },
  { t: "Exequial y asistencias", d: "Tranquilidad y acompañamiento para tu familia." },
];

const SEGUROS = [
  { ico: "🛡️", n: "Accidentes personales", a: "MetLife" },
  { ico: "❤️", n: "Vida", a: "Pan-American Life" },
  { ico: "🩺", n: "Asistencia médica familiar", a: "Seguros Mundial" },
  { ico: "⚕️", n: "Póliza de salud", a: "BMI" },
  { ico: "🚗", n: "SOAT", a: "Seguros Mundial" },
  { ico: "🚙", n: "Todo riesgo carro", a: "Chubb" },
  { ico: "🏍️", n: "Moto y asistencia", a: "Seguros Mundial" },
  { ico: "🚲", n: "Bici o patineta", a: "Seguros Bolívar" },
  { ico: "🐾", n: "Mascotas", a: "Seguros Bolívar" },
  { ico: "🐶", n: "Prepagada mascotas", a: "VetPlus" },
  { ico: "🏠", n: "Hogar y contenidos", a: "Chubb" },
  { ico: "🔑", n: "Arrendamiento", a: "Seguros Mundial" },
  { ico: "🕊️", n: "Exequial", a: "GEA" },
  { ico: "✈️", n: "Asistencia de viajes", a: "BMI" },
  { ico: "🧰", n: "Asistencias múltiples", a: "Seguros Mundial" },
  { ico: "💳", n: "Seguros para créditos", a: "Pan-American Life" },
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
              Inicio / <b>Seguros y asistencias Colsubsidio</b>
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
              <b>24/7</b> · Emisión inmediata en productos estandarizados ·{" "}
              <b>Respaldado por las aseguradoras aliadas de Colsubsidio</b>
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
              <div className="body">
                <div className="bub bot">¿Qué cambió en tu vida o qué te tiene pensando en protegerte?</div>
                <div className="bub user">Acabo de comprar una moto 🏍️</div>
                <div className="bub bot">¡Felicitaciones! Te recomiendo Accidentes Personales + Asistencia moto. ¿Te cotizo?</div>
                <div className="bub mini">✓ Póliza AMP-0294 activa · certificado listo</div>
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
              <Link href="/chat" key={s.t} className="serv-item">
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
              <Link href="/chat" key={s.n} className="chip">
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
