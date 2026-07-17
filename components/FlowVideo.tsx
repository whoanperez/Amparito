"use client";

import { useEffect, useState } from "react";

// Explainer embebido (sin voz ni sonido, solo subtítulos) que se reproduce
// al entregar la póliza: muestra la ruta que siguió el usuario.
const SCENES = [
  { ico: "🛡️", t: "Amparito — ¿qué acaba de pasar?", s: "La ruta que seguiste para quedar asegurado, en segundos.", kind: "intro" },
  { ico: "💬", t: "1 · Entraste a Amparito", s: "Le contaste qué cambió en tu vida." },
  { ico: "🧠", t: "2 · La IA analizó tu situación", s: "Entendió lo que realmente necesitas." },
  { ico: "⭐", t: "3 · Te mostró opciones", s: "Con una recomendada para ti y su porqué." },
  { ico: "👆", t: "4 · Elegiste la que te convenía", s: "Tú decides, sin presión." },
  { ico: "📝", t: "5 · Llenaste tus datos", s: "Un formulario rápido, con tu autorización (Ley 1581)." },
  { ico: "🔒", t: "6 · Se transmitió de forma segura", s: "Tus datos viajaron cifrados a la API del seguro y del banco." },
  { ico: "📄", t: "7 · Recibiste tu póliza", s: "Tu certificado llega a tu correo en pocas horas." },
  { ico: "🎉", t: "Del “no sé qué necesito” al “ya quedé asegurado”.", s: "Amparito · Colsubsidio · 24/7, sin esperas.", kind: "outro" },
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
        <span className="fv-tag">▶ Detrás de cámaras</span>
        <span className="fv-cnt">{i + 1}/{SCENES.length}</span>
      </div>
      <div className={`fv-stage ${sc.kind ?? ""}`}>
        <div className="fv-ico" key={"i" + i}>{sc.ico}</div>
        <div className="fv-t" key={"t" + i}>{sc.t}</div>
        <div className="fv-s" key={"s" + i}>{sc.s}</div>
      </div>
      <div className="fv-bar"><div className="fv-bar-fill" style={{ width: `${((i + 1) / SCENES.length) * 100}%` }} /></div>
      {done && <button className="fv-replay" onClick={() => { setI(0); setPlaying(true); }}>↺ Ver de nuevo</button>}
    </div>
  );
}
