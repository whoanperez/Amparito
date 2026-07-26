"use client";

import { useEffect, useState } from "react";

/**
 * Explainer embebido (sin voz ni sonido, solo subtítulos) que intercala la EXPERIENCIA (lo que ves)
 * con la INGENIERÍA (lo que pasa por debajo), con chips técnicos reales — para jurado experto.
 *
 * QUÉ TENÍA MAL (#29 · #30), y por qué era más grave de lo que parece:
 *
 * 1 · DESMENTÍA EL SELLO. La escena 12 prometía "certificado digital a tu correo en pocas horas"
 *     a dos centímetros de la tarjeta que dice "no vas a recibir ningún correo". El sello de
 *     simulación es la pieza que el producto usa para pedir confianza en todo lo demás; una
 *     vecina que lo contradice la gasta entera. Ahora el sello es dato compartido
 *     (`contradiceElSello`) y el gate lo corre sobre CADA escena.
 *
 * 2 · INVENTABA UN TIEMPO. "en pocas horas" no lo acordó nadie con ninguna aseguradora.
 *     `lib/expedicion.ts` ya había declarado que los SLA son dato y hoy son `null`; el video se
 *     saltaba esa regla porque la regla vivía en un comentario. Ahora vive en `inventaTiempos`.
 *
 * 3 · NARRABA EN PRESENTE COSAS QUE NO PASARON. "Se transmite al seguro y al banco" con el
 *     adaptador en mock. Cada escena declara ahora si describe lo que corre HOY o lo que falta
 *     para producción, y la que falta se pinta marcada — la misma disciplina de la tarjeta de
 *     póliza, que dice "Simulada" porque el adaptador lo dice, no porque alguien lo escribió.
 */
type Scene = {
  ico: string;
  t: string;
  s: string;
  tag?: "exp" | "ing";
  chip?: string;
  k?: "intro" | "outro";
  /** `produccion` = describe lo que falta, no lo que acaba de pasar. Se pinta marcado. */
  estado?: "produccion";
};

export const SCENES: Scene[] = [
  { ico: "🛡️", t: "Amparito · cómo funciona por dentro", s: "Del “no sé qué necesito” al “ya sé qué me protege” — y la ingeniería detrás.", chip: "Next.js · Claude Haiku · Vercel", k: "intro" },
  { ico: "💬", tag: "exp", t: "1 · Entras y cuentas tu situación", s: "Sin formularios: le hablas como a una persona.", chip: "POST /api/chat" },
  { ico: "🧠", tag: "ing", t: "2 · Orquestador con Claude Haiku", s: "El servidor lleva el estado de la conversación; el modelo pone las palabras.", chip: "reducer puro · tool-use loop" },
  { ico: "🎯", tag: "ing", t: "3 · Detecta tu intención y tu gatillo de vida", s: "Interpreta “compré una moto” → necesidad de cobertura.", chip: "elicitación · máquina de fases" },
  { ico: "🧩", tag: "ing", t: "4 · Recomienda con un motor sobre el catálogo", s: "Matching por gatillos y reglas; nunca de memoria.", chip: "tool: recommend_products" },
  {
    ico: "🔒", tag: "ing", t: "5 · Los hechos los pone el código",
    // Antes decía "Grounding total: cero alucinación". El producto tiene un validador de salida
    // justamente PORQUE el modelo llegó a afirmar cosas falsas sobre la base. Afirmar "cero" al
    // lado de la pieza construida para atajarlo es la misma contradicción de la escena 12, y a un
    // jurado técnico le suena a marketing. Lo que de verdad hay es más fuerte: dos capas.
    s: "Cada cobertura y precio sale de una tool, y el servidor revisa la respuesta antes de que salga.",
    chip: "catalog.json · validador de salida",
  },
  { ico: "⭐", tag: "exp", t: "6 · Te muestra opciones (con una recomendada)", s: "Cotización + qué cubre y qué no, con su fuente.", chip: "tool: quote_product / get_product_details" },
  { ico: "⚖️", tag: "ing", t: "7 · Cumplimiento por diseño", s: "Art. 9 (Ley 1328) + habeas data (Ley 1581), validados EN SERVIDOR.", chip: "compliance gate · server-side" },
  { ico: "📝", tag: "exp", t: "8 · Llenas tus datos", s: "Captura estructurada y validada, con tu autorización.", chip: "tool: collect_customer_data" },
  { ico: "⚙️", tag: "ing", t: "9 · Emisión determinista, fuera del modelo", s: "La póliza no depende del LLM: lógica de negocio pura.", chip: "POST /api/issue" },
  { ico: "🔌", tag: "ing", t: "10 · InsurerGateway · patrón adaptador", s: "Hoy responde un mock; el día que haya API real de la aseguradora, entra sin tocar prompt ni tools.", chip: "MockAdapter → MetLifeAdapter…" },
  { ico: "🗂️", tag: "ing", t: "11 · Cada solicitud queda registrada", s: "El registro corre de verdad y no bloquea la emisión si falla.", chip: "webhook → Google Sheets" },
  {
    ico: "📄", tag: "exp", t: "12 · Así llegaría tu certificado",
    // El texto NO puede prometer una entrega sin cargar el sello, ni afirmar un tiempo que ningún
    // SLA respalda. Las dos cosas las verifica `scripts/test-sello.ts` sobre esta misma constante.
    s: "Colsubsidio valida, la aseguradora expide y te envía el certificado al correo. Hoy es una simulación: nada de eso se dispara.",
    chip: "certificado simulado",
    estado: "produccion",
  },
  { ico: "🎉", t: "Del “no sé” al “ya sé qué me protege”.", s: "Ingeniería lista para producción: Claude Haiku · Next.js · Vercel · adaptador de APIs.", chip: "24/7 · compliance by design · el motor decide, el modelo conversa", k: "outro" },
];
const DUR = 2900;

/** La marca visible de una escena que describe lo que falta. Se exporta porque tiene gate. */
export const MARCA_PRODUCCION = "Falta para producción · hoy no ocurre";

export function marcaDeEscena(sc: Scene): string | null {
  return sc.estado === "produccion" ? MARCA_PRODUCCION : null;
}

export default function FlowVideo() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || i >= SCENES.length - 1) {
      if (i >= SCENES.length - 1) setPlaying(false);
      return;
    }
    const id = setTimeout(() => setI((x) => x + 1), DUR);
    return () => clearTimeout(id);
  }, [i, playing]);

  const sc = SCENES[i];
  const done = i >= SCENES.length - 1 && !playing;
  const marca = marcaDeEscena(sc);

  return (
    <div className="flowvid demo">
      <div className="fv-head">
        <span className="fv-tag">▶ Detrás de cámaras · técnico</span>
        <span className="fv-cnt">{i + 1}/{SCENES.length}</span>
      </div>
      <div className={`fv-stage ${sc.k ?? ""}`}>
        {sc.tag && (
          <span className={`fv-layer ${sc.tag}`} key={"l" + i}>
            {sc.tag === "exp" ? "Lo que ves" : "Por debajo · ingeniería"}
          </span>
        )}
        <div className="fv-ico" key={"i" + i}>{sc.ico}</div>
        <div className="fv-t" key={"t" + i}>{sc.t}</div>
        <div className="fv-s" key={"s" + i}>{sc.s}</div>
        {marca && <div className="fv-falta" key={"f" + i}>{marca}</div>}
        {sc.chip && <div className="fv-chip" key={"c" + i}>{sc.chip}</div>}
      </div>
      <div className="fv-bar"><div className="fv-bar-fill" style={{ width: `${((i + 1) / SCENES.length) * 100}%` }} /></div>
      {done && <button className="fv-replay" onClick={() => { setI(0); setPlaying(true); }}>↺ Ver de nuevo</button>}
    </div>
  );
}

/**
 * El video, plegado (#29).
 *
 * Antes se inyectaba solo en el hilo y arrancaba a reproducirse: la conversación venía en segunda
 * persona —"tu solicitud queda completa"— y de repente el mismo hilo emitía `POST /api/issue` y
 * `webhook → Google Sheets`. Son DOS audiencias en un canal: quien está comprando y quien está
 * evaluando la ingeniería. Al que compra le rompe la ficción justo en el cierre; al que evalúa no
 * le quita nada tener que dar un toque.
 *
 * Se conserva entero y a un toque de distancia. El botón dice a quién le habla, para que quien no
 * sea esa persona pueda ignorarlo.
 */
export function DetrasDeCamaras() {
  const [abierto, setAbierto] = useState(false);
  if (abierto) return <FlowVideo />;
  return (
    <button className="fv-fold" onClick={() => setAbierto(true)}>
      <span className="fv-fold-ico">▶</span>
      <span>
        <b>Ver cómo funciona por dentro</b>
        <small>Explicación técnica en {SCENES.length} pasos · para quien quiera ver la ingeniería</small>
      </span>
    </button>
  );
}
