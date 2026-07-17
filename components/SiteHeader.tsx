import Link from "next/link";

export default function SiteHeader() {
  return (
    <header>
      {/* Nivel 1 — barra superior */}
      <div className="topbar">
        <div className="topbar-inner">
          <div className="seg">
            <span className="on">Personas</span>
            <span>Empresas</span>
          </div>
          <div className="util">
            <span>✎ Personalizar</span>
            <span>A+ Accesibilidad ▾</span>
            <span>▤ Transparencia</span>
            <span>⌕ Buscar</span>
          </div>
        </div>
      </div>

      {/* Nivel 2 — logo + navegación */}
      <div className="mainbar">
        <div className="mainbar-inner">
          <Link href="/" className="brand" aria-label="Colsubsidio inicio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/colsubsidio-logo.webp" alt="Colsubsidio" />
            <span className="word">Colsubsidio</span>
          </Link>
          <nav>
            <span>Te ayudamos</span>
            <span>Encuéntranos</span>
            <span>Compra en línea</span>
            <span>Afiliaciones</span>
            <span>Beneficios</span>
            <span className="pill">Colsubsidio virtual ▾</span>
          </nav>
        </div>
      </div>

      {/* Nivel 3 — categorías */}
      <div className="catbar">
        <div className="catbar-inner">
          <span>Subsidios ▾</span>
          <span>Salud ▾</span>
          <span>Vivienda ▾</span>
          <span>Deportes ▾</span>
          <span>Educación ▾</span>
          <span>Clubes y BLOC ▾</span>
          <span>Turismo ▾</span>
          <span>Créditos ▾</span>
          <span>Otros servicios ▾</span>
        </div>
      </div>
    </header>
  );
}
