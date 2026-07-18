import Link from "next/link";

// Enlaces reales de Colsubsidio (verificados en colsubsidio.com, julio 2026).
// Amparito es una demo del Hackathon; la navegación superior lleva a las
// páginas oficiales reales para reforzar el "se siente como Colsubsidio".
const EXT = {
  personas: "https://www.colsubsidio.com/",
  empresas: "https://www.colsubsidio.com/empresas",
  transparencia: "https://www.colsubsidio.com/transparencia-acceso-informacion",
  teAyudamos: "https://ayuda.colsubsidio.com/",
  encuentranos: "https://www.colsubsidio.com/donde-estamos",
  compra: "https://www.colsubsidio.com/tienda-en-linea",
  afiliaciones: "https://www.colsubsidio.com/afiliaciones",
  beneficios: "https://www.tusbeneficioscolsubsidio.com/personas/",
  virtual: "https://transacciones.colsubsidio.com/portalpersonas/#/login",
  // Barra de categorías
  subsidios: "https://www.colsubsidio.com/subsidios",
  salud: "https://www.colsubsidio.com/salud",
  vivienda: "https://www.colsubsidio.com/vivienda",
  deportes: "https://www.colsubsidio.com/recreacion",
  educacion: "https://www.colsubsidio.com/educacion",
  clubes: "https://www.colsubsidio.com/clubes",
  turismo: "https://www.colsubsidio.com/turismo",
  creditos: "https://www.colsubsidio.com/creditos",
  seguros: "https://www.colsubsidio.com/seguros",
};

// Abre las páginas oficiales en una pestaña nueva (no perder la demo de Amparito).
function Ext({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export default function SiteHeader() {
  return (
    <header>
      {/* Nivel 1 — barra superior */}
      <div className="topbar">
        <div className="topbar-inner">
          <div className="seg">
            <Ext href={EXT.personas} className="on">Personas</Ext>
            <Ext href={EXT.empresas}>Empresas</Ext>
          </div>
          <div className="util">
            <span>✎ Personalizar</span>
            <span>A+ Accesibilidad ▾</span>
            <Ext href={EXT.transparencia}>▤ Transparencia</Ext>
            <span>⌕ Buscar</span>
          </div>
        </div>
      </div>

      {/* Nivel 2 — logo + navegación */}
      <div className="mainbar">
        <div className="mainbar-inner">
          <Link href="/" className="brand" aria-label="Colsubsidio · Amparito, inicio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/colsubsidio-logo.webp" alt="Colsubsidio" />
            <span className="word">Colsubsidio</span>
          </Link>
          <nav>
            <Ext href={EXT.teAyudamos}>Te ayudamos</Ext>
            <Ext href={EXT.encuentranos}>Encuéntranos</Ext>
            <Ext href={EXT.compra}>Compra en línea</Ext>
            <Ext href={EXT.afiliaciones}>Afiliaciones</Ext>
            <Ext href={EXT.beneficios}>Beneficios</Ext>
            <Ext href={EXT.virtual} className="pill">Colsubsidio virtual ▾</Ext>
          </nav>
        </div>
      </div>

      {/* Nivel 3 — categorías */}
      <div className="catbar">
        <div className="catbar-inner">
          <Ext href={EXT.subsidios}>Subsidios ▾</Ext>
          <Ext href={EXT.salud}>Salud ▾</Ext>
          <Ext href={EXT.vivienda}>Vivienda ▾</Ext>
          <Ext href={EXT.deportes}>Deportes ▾</Ext>
          <Ext href={EXT.educacion}>Educación ▾</Ext>
          <Ext href={EXT.clubes}>Clubes y BLOC ▾</Ext>
          <Ext href={EXT.turismo}>Turismo ▾</Ext>
          <Ext href={EXT.creditos}>Créditos ▾</Ext>
          <Ext href={EXT.seguros} className="cat-on">Seguros ▾</Ext>
        </div>
      </div>
    </header>
  );
}
