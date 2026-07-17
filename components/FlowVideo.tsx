"use client";

import { useEffect, useState } from "react";

// Explainer embebido (sin voz ni sonido, solo subtítulos) que se reproduce al
// entregar la póliza. Versión técnica: intercala la EXPERIENCIA (lo que ves) con
// la INGENIERÍA (lo que pasa por debajo), con chips técnicos reales — para jurado experto.
type Scene = { ico: string; t: string; s: string; tag?: "exp" | "ing"; chip?: string; k?: "intro" | "outro" };

const SCENES: Scene[] = [
  { ico: "🛡️", t: "Amparito · cómo funciona por dentro", s: "Del “no sé qué necesito” al “ya quedé asegurado” — y la ingeniería detrás.", chip: "Next.js · Claude Haiku · Vercel", k: "intro" },
  { ico: "💬", tag: "exp", t: "1 · Entras y cuentas tu situación", s: "Sin formularios: le hablas como a una persona.", chip: "POST /api/chat" },
  { ico: "🧠", tag: "ing", t: "2 · Orquestador con Claude Haiku", s: "System prompt como máquina de estados: rápido y de bajo costo.", chip: "model: claude-haiku · tool-use loop" },
  { ico: "🎯", tag: "ing", t: "3 · Detecta tu intención y tu gatillo de vida", s: "Interpreta “compré una moto” → necesidad de cobertura.", chip: "elicitación · state machine" },
  { ico: "🧩", tag: "ing", t: "4 · Recomienda con un motor sobre el catálogo", s: "Matching por gatillos y reglas; nunca de memoria.", chip: "tool: recommend_products" },
  { ico: "🔒", tag: "ing", t: "5 · Grounding total: cero alucinación", s: "Cada cobertura y precio sale de una tool, no del modelo.", chip: "catalog.json · clausulados reales" },
  { ico: "⭐", tag: "exp", t: "6 · Te muestra opciones (con una recomendada)", s: "Cotización + qué cubre y qué no, con su fuente.", chip: "tool: quote_product / get_product_details" },
  { ico: "⚖️", tag: "ing", t: "7 · Cumplimiento por diseño", s: "Art. 9 (Ley 1328) + habeas data (Ley 1581), validados EN SERVIDOR.", chip: "compliance gate · server-side" },
  { ico: "📝", tag: "exp", t: "8 · Llenas tus datos", s: "Captura estructurada y validada, con tu autorización.", chip: "tool: collect_customer_data" },
  { ico: "⚙️", tag: "ing", t: "9 · Emisión determinista, fuera del modelo", s: "La póliza no depende del LLM: lógica de negocio pura.", chip: "POST /api/issue" },
  { ico: "🔌", tag: "ing", t: "10 · InsurerGateway · patrón adaptador", s: "Hoy simulado; mañana la API real de la aseguradora sin tocar prompt ni tools.", chip: "MockAdapter → MetLifeAdapter…" },
  { ico: "🏦", tag: "ing", t: "11 · Se transmite al seguro y al banco", s: "Cifrado, y cada póliza queda registrada.", chip: "webhook → Google Sheets" },
  { ico: "📄", tag: "exp", t: "12 · Recibes tu póliza", s: "Certificado digital a tu correo en pocas horas.", chip: "certificado emitido" },
  { ico: "🎉", t: "Del “no sé” al “ya quedé asegurado”.", s: "Ingeniería lista para producción: Claude Haiku · Next.js · Vercel · adaptador de APIs.", chip: "24/7 · 0 humanos en el cierre · compliance by design", k: "outro" },
];
const DUR = 2900;

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

  return (
    <div className="flowvid">
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
        {sc.chip && <div className="fv-chip" key={"c" + i}>{sc.chip}</div>}
      </div>
      <div className="fv-bar"><div className="fv-bar-fill" style={{ width: `${((i + 1) / SCENES.length) * 100}%` }} /></div>
      {done && <button className="fv-replay" onClick={() => { setI(0); setPlaying(true); }}>↺ Ver de nuevo</button>}
    </div>
  );
}
