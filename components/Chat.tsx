"use client";

import { useEffect, useRef, useState } from "react";
import FlowVideo from "./FlowVideo";

interface UiEvent {
  type: "quote" | "policy" | "escalation" | "compliance" | "form" | "propension";
  data: Record<string, any>;
}
interface Rec { nombre: string; recomendado: boolean; razon: string }
interface ChatItem {
  kind: "msg" | "event" | "recommend" | "video";
  role?: "user" | "assistant";
  text?: string;
  event?: UiEvent;
  recs?: Rec[];
}
interface Contacto {
  nombre: string;
  tipoDocumento: "CC" | "CE" | "PASAPORTE";
  numeroDocumento: string;
  fechaNacimiento: string;
  celular: string;
  correo: string;
}

const GREETING =
  "¡Hola! Soy Amparito, tu asistente de seguros de Colsubsidio 😊 Cuéntame: ¿qué cambió en tu vida o qué te tiene pensando en protegerte?";

// Entrada pull-first: tarjetas grandes "¿Qué quieres proteger?" (reemplaza la caja vacía)
const PROTEGER = [
  { ico: "👪", t: "Mi familia", msg: "Quiero proteger a mi familia" },
  { ico: "🏍️", t: "Mi movilidad", msg: "Quiero proteger mi moto o mi carro" },
  { ico: "🐶", t: "Mi mascota", msg: "Quiero proteger a mi mascota" },
  { ico: "🏠", t: "Mi hogar", msg: "Quiero proteger mi hogar" },
  { ico: "💳", t: "Mi crédito", msg: "Tengo un crédito que quiero respaldar" },
  { ico: "✈️", t: "Un viaje", msg: "Voy a viajar y quiero asistencia" },
];

const INTERES: Record<string, string> = {
  moto: "un seguro para mi moto",
  carro: "un seguro todo riesgo para mi carro",
  soat: "el SOAT para mi vehículo",
  bici: "un seguro para mi bici o patineta",
  vida: "un seguro de vida",
  accidentes: "un seguro de accidentes personales",
  salud: "una póliza de salud",
  asistencia_medica: "una asistencia médica familiar",
  mascotas: "un seguro para mi mascota",
  prepagada_mascotas: "una medicina prepagada para mi mascota",
  hogar: "un seguro para mi hogar",
  arrendamiento: "un seguro de arrendamiento",
  exequial: "un seguro exequial",
  viajes: "una asistencia de viajes",
  asistencias: "las asistencias múltiples",
  creditos: "un seguro para mi crédito",
  personal_familiar: "un seguro para mí y mi familia",
  movilidad: "un seguro para mi vehículo",
};

const INSURER: Record<string, { color: string; short: string }> = {
  "MetLife": { color: "#0090da", short: "MetLife" },
  "Chubb": { color: "#d31245", short: "Chubb" },
  "Pan-American Life": { color: "#004a97", short: "PALIG" },
  "GEA": { color: "#e2231a", short: "GEA" },
  "Seguros Bolívar": { color: "#00953b", short: "Bolívar" },
  "VetPlus": { color: "#00a3a1", short: "VetPlus" },
  "BMI": { color: "#0a3d91", short: "BMI" },
  "Seguros Mundial": { color: "#e30613", short: "Mundial" },
};
function insurerOf(name: string) {
  return INSURER[name] ?? { color: "#0b62b4", short: name };
}

function clean(t: string): string {
  return t
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/`/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Extrae texto, quick-replies (OPCIONES) y recomendaciones (RECOMENDACION) del reply
function parseReply(raw: string): { text: string; options: string[]; recs: Rec[] } {
  let text = raw;
  const recs: Rec[] = [];
  raw.split("\n").forEach((line) => {
    const mm = line.match(/^\s*RECOMENDACION:\s*(.+)$/i);
    if (mm) {
      const parts = mm[1].split("|").map((s) => s.trim());
      recs.push({
        nombre: parts[0] || "",
        recomendado: /recomendad/i.test(parts[1] || ""),
        razon: parts[2] || "",
      });
      text = text.replace(line, "");
    }
  });
  let options: string[] = [];
  const om = text.match(/OPCIONES:\s*(.+)\s*$/im);
  if (om) {
    options = om[1].split("|").map((s) => s.trim()).filter(Boolean).slice(0, 4);
    text = text.replace(om[0], "");
  }
  return { text: clean(text), options, recs };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Chat({ interes }: { interes?: string | null }) {
  const [items, setItems] = useState<ChatItem[]>([{ kind: "msg", role: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeForm, setActiveForm] = useState<UiEvent["data"] | null>(null);
  const [processing, setProcessing] = useState<null | "emision" | "reco">(null);
  const lastQuote = useRef<string | null>(null);
  const started = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, busy, activeForm, processing, suggestions]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const key = (interes ?? "").toLowerCase();
    if (key && INTERES[key]) setTimeout(() => send(`Hola Amparito, tengo interés en ${INTERES[key]}.`), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interes]);

  function pickSuggestion(opt: string) {
    setInput(opt.endsWith(" ") ? opt : opt + " ");
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy || processing) return;
    setInput("");
    setSuggestions([]);

    const next: ChatItem[] = [...itemsRef.current, { kind: "msg", role: "user", text: t }];
    setItems(next);
    setBusy(true);

    try {
      const history = next.filter((i) => i.kind === "msg").map((i) => ({ role: i.role!, content: i.text! }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = (await res.json()) as { reply: string; events: UiEvent[] };
      const parsed = parseReply(data.reply || "");

      const eventItems: ChatItem[] = [];
      let openForm: UiEvent["data"] | null = null;
      for (const ev of data.events ?? []) {
        if (ev.type === "quote") lastQuote.current = String(ev.data.quoteId ?? lastQuote.current);
        if (ev.type === "form") { openForm = ev.data; continue; }
        eventItems.push({ kind: "event", event: ev });
      }

      const msgItems: ChatItem[] = [];
      if (parsed.text) msgItems.push({ kind: "msg", role: "assistant", text: parsed.text });

      // Si hay recomendaciones -> pantalla de "evaluando opciones" y luego las tarjetas
      if (parsed.recs.length) {
        setBusy(false);
        setProcessing("reco");
        await sleep(4000);
        setProcessing(null);
        setItems((cur) => [...cur, ...msgItems, ...eventItems, { kind: "recommend", recs: parsed.recs }]);
        return;
      }

      setItems((cur) => [...cur, ...msgItems, ...eventItems]);
      setSuggestions(parsed.options);
      if (openForm) setActiveForm(openForm);
    } catch {
      setItems((cur) => [...cur, { kind: "msg", role: "assistant", text: "Se me trabó la conexión. ¿Intentamos de nuevo?" }]);
    } finally {
      setBusy(false);
    }
  }

  async function submitForm(contacto: Contacto) {
    setActiveForm(null);
    setProcessing("emision");
    const t0 = Date.now();
    let result: { event?: UiEvent; closing?: string; error?: string } = {};
    try {
      const res = await fetch("/api/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: lastQuote.current, contacto, consentimiento: true }),
      });
      result = await res.json();
    } catch { result = { error: "No pudimos emitir en este momento." }; }
    await sleep(Math.max(0, 7000 - (Date.now() - t0)));
    setProcessing(null);
    if (result.event) {
      setItems((cur) => [...cur, { kind: "event", event: result.event },
        { kind: "msg", role: "assistant", text: result.closing ?? "¡Listo, quedaste asegurado!" },
        { kind: "video" }]);
    } else {
      setItems((cur) => [...cur, { kind: "msg", role: "assistant", text: result.error ?? "No pudimos emitir. Inténtalo de nuevo." }]);
    }
  }

  const locked = busy || !!processing || !!activeForm;
  const showStarters = items.length === 1 && !interes && !locked;

  return (
    <div className="chat-shell">
      <div className="chat-title">
        <div className="avatar">A</div>
        <div>
          <h2>Amparito</h2>
          <div className="status">● En línea — 24/7, sin esperas</div>
        </div>
      </div>

      <div className="msgs">
        {items.map((item, i) =>
          item.kind === "msg" ? (
            <div key={i} className={`msg ${item.role === "user" ? "user" : "bot"}`}>{item.text}</div>
          ) : item.kind === "recommend" ? (
            <RecommendCards key={i} recs={item.recs!} onPick={(n) => send(`Quiero el ${n}`)} />
          ) : item.kind === "video" ? (
            <FlowVideo key={i} />
          ) : (
            <EventCard key={i} event={item.event!} />
          )
        )}

        {showStarters && (
          <div className="pullfirst">
            <div className="pf-q">¿Qué quieres proteger?</div>
            <div className="pf-grid">
              {PROTEGER.map((p) => (
                <button key={p.t} className="pf-card" onClick={() => send(p.msg)}>
                  <span className="pf-ico">{p.ico}</span>
                  <span className="pf-t">{p.t}</span>
                </button>
              ))}
            </div>
            <button className="pf-talk" onClick={() => inputRef.current?.focus()}>
              Prefiero contarte con mis palabras →
            </button>
          </div>
        )}

        {suggestions.length > 0 && !locked && (
          <div className="qr-row">
            {suggestions.map((s) => (
              <button key={s} className="quick" onClick={() => pickSuggestion(s)}>{s}</button>
            ))}
          </div>
        )}

        {activeForm && <DataForm data={activeForm} onSubmit={submitForm} />}
        {processing && <ProcessingCard variant={processing} />}
        {busy && <div className="typing">Amparito está escribiendo…</div>}
        <div ref={endRef} />
      </div>

      {!activeForm && (
        <div className="inputbar">
          <form onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Escríbele a Amparito…" disabled={locked} autoFocus />
            <button type="submit" disabled={locked || !input.trim()}>Enviar</button>
          </form>
          <p className="disclaimer">Amparito es una asistente virtual de Colsubsidio. Tus datos se tratan según la Ley 1581 de 2012.</p>
        </div>
      )}
    </div>
  );
}

/* ===== Tarjetas de recomendación (con "Recomendado" resaltado) ===== */
function RecommendCards({ recs, onPick }: { recs: Rec[]; onPick: (nombre: string) => void }) {
  return (
    <div className="recos">
      {recs.map((r, i) => (
        <button key={i} className={`reco ${r.recomendado ? "top" : ""}`} onClick={() => onPick(r.nombre)}>
          {r.recomendado && <span className="reco-badge">★ Recomendado para ti</span>}
          <span className="reco-name">{r.nombre}</span>
          {r.razon && <span className="reco-why">{r.razon}</span>}
          <span className="reco-cta">Elegir este →</span>
        </button>
      ))}
    </div>
  );
}

/* ===== Pantalla de transición ===== */
function ProcessingCard({ variant }: { variant: "emision" | "reco" }) {
  const SETS: Record<string, string[]> = {
    emision: ["Validando tu información…", "Consultando con la aseguradora…", "Personalizando tu cobertura…", "Generando tu certificado…"],
    reco: ["Analizando tu situación…", "Comparando coberturas de nuestras aseguradoras…", "Eligiendo lo mejor para tu caso…"],
  };
  const steps = SETS[variant];
  const sub = variant === "reco"
    ? "Amparito está personalizando tus opciones."
    : "Estamos personalizando tu seguro con estándar de calidad Colsubsidio.";
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % steps.length), 1300);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="processing">
      <div className="spinner" />
      <div className="ptext">{steps[i]}</div>
      <div className="psub">{sub}</div>
    </div>
  );
}

/* ===== Formulario de datos ===== */
function DataForm({ data, onSubmit }: { data: any; onSubmit: (c: Contacto) => void }) {
  const [f, setF] = useState<Contacto>({ nombre: "", tipoDocumento: "CC", numeroDocumento: "", fechaNacimiento: "", celular: "", correo: "" });
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  function set<K extends keyof Contacto>(k: K, v: Contacto[K]) { setF((p) => ({ ...p, [k]: v })); }
  function fechaMask(v: string): string {
    const d = v.replace(/\D/g, "").slice(0, 8);
    let out = d.slice(0, 2);
    if (d.length >= 3) out += "/" + d.slice(2, 4);
    if (d.length >= 5) out += "/" + d.slice(4, 8);
    return out;
  }
  function validar(): string | null {
    if (!f.nombre.trim() || f.nombre.trim().split(" ").length < 2) return "Escribe tus nombres y apellidos completos.";
    if (f.tipoDocumento !== "PASAPORTE" && !/^\d{5,12}$/.test(f.numeroDocumento)) return "El número de documento debe ser solo números.";
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(f.fechaNacimiento)) return "La fecha debe ir en formato DD/MM/AAAA.";
    if (!/^\d{10}$/.test(f.celular)) return "El celular debe tener 10 dígitos.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo)) return "Escribe un correo válido.";
    if (!consent) return "Necesitas autorizar el tratamiento de tus datos para continuar.";
    return null;
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validar();
    if (v) { setErr(v); return; }
    setErr(null); onSubmit(f);
  }
  return (
    <form className="dataform" onSubmit={submit}>
      <div className="df-head">
        <span className="badge">Últimos datos</span>
        <h4>Completa tus datos para {String(data.producto)}</h4>
        <p>Es rápido. Con esto emitimos tu póliza al instante.</p>
      </div>
      <label>Nombres y apellidos completos
        <input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Juan Camilo Pérez Cuervo" />
      </label>
      <div className="df-row">
        <label>Tipo de documento
          <select value={f.tipoDocumento} onChange={(e) => set("tipoDocumento", e.target.value as any)}>
            <option value="CC">Cédula de ciudadanía</option>
            <option value="CE">Cédula de extranjería</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
        </label>
        <label>Número de documento
          <input value={f.numeroDocumento} onChange={(e) => set("numeroDocumento", e.target.value)} placeholder="Sin puntos" />
        </label>
      </div>
      <div className="df-row">
        <label>Fecha de nacimiento
          <input value={f.fechaNacimiento} onChange={(e) => set("fechaNacimiento", fechaMask(e.target.value))} placeholder="DD/MM/AAAA" inputMode="numeric" maxLength={10} />
        </label>
        <label>Celular
          <input value={f.celular} onChange={(e) => set("celular", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10 dígitos" inputMode="numeric" />
        </label>
      </div>
      <label>Correo electrónico
        <input value={f.correo} onChange={(e) => set("correo", e.target.value)} placeholder="tucorreo@ejemplo.com" />
      </label>
      <label className="df-check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>Autorizo a Colsubsidio y a la aseguradora el tratamiento de mis datos personales (Ley 1581 de 2012).</span>
      </label>
      {err && <div className="df-err">{err}</div>}
      <button type="submit" className="df-submit">Confirmar y asegurarme →</button>
    </form>
  );
}

/* ===== Tarjeta de propensión (el porqué: WhyThis + GapsLedger + PeerProof + Descartados) ===== */
function PropensionCard({ data }: { data: Record<string, any> }) {
  const recs = (data.recomendaciones ?? []) as Array<{ nombre: string; aseguradora: string; reason_codes: string[] }>;
  const descartados = (data.descartados ?? []) as Array<{ nombre: string; motivo: string }>;
  const riesgos = (data.ledger?.riesgos_hoy ?? []) as string[];
  const yaCubierto = (data.ledger?.ya_cubierto ?? []) as Array<{ producto: string; razon: string }>;
  const peer = data.peer as { descripcion: string; n: number; pct: number } | null;
  const top = recs[0];

  return (
    <div className="propcard">
      <div className="pp-head">
        <span className="pp-eyebrow">Por qué esto es para ti</span>
        <div className="pp-title">Así analicé tu protección</div>
      </div>

      {/* WhyThis — el porqué del #1, con sus reason codes */}
      {top && (
        <div className="pp-why">
          <div className="pp-why-top">
            <span className="pp-check">✓</span>
            <div>
              <b>{top.nombre}</b>
              <small>{top.aseguradora}</small>
            </div>
          </div>
          <ul className="pp-reasons">
            {top.reason_codes.map((r, i) => (
              <li key={i}><span className="pp-dot" />{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* GapsLedger — riesgos hoy vs lo que ya tiene (anti-venta) */}
      <div className="pp-ledger">
        <div className="pp-col risk">
          <div className="pp-col-lbl">Riesgos hoy</div>
          {riesgos.length ? (
            <ul>{riesgos.map((r, i) => <li key={i}>{r}</li>)}</ul>
          ) : (
            <p className="pp-empty">—</p>
          )}
        </div>
        <div className="pp-col cov">
          <div className="pp-col-lbl">Ya cubierto</div>
          {yaCubierto.length ? (
            <ul>{yaCubierto.map((c, i) => <li key={i}>{c.producto}</li>)}</ul>
          ) : (
            <p className="pp-empty">Nada aún</p>
          )}
        </div>
      </div>

      {/* PeerProof — tamaño REAL del segmento (honesto, sin fracción de compra inventada) */}
      {peer && peer.n > 0 && (
        <div className="pp-peer">
          <b>{peer.n.toLocaleString("es-CO")}</b> afiliados como tú ({peer.descripcion}) — el {peer.pct}% de la base de Colsubsidio. No estás solo en esto.
        </div>
      )}

      {/* Descartados — la pregunta de segundo orden: por qué NO lo otro */}
      {descartados.length > 0 && (
        <details className="pp-disc">
          <summary>Ver qué NO te recomendé y por qué</summary>
          <ul>
            {descartados.map((x, i) => (
              <li key={i}><b>{x.nombre}:</b> {x.motivo}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/* ===== Tarjetas ===== */
function EventCard({ event }: { event: UiEvent }) {
  const d = event.data;

  if (event.type === "propension") return <PropensionCard data={d} />;

  if (event.type === "quote") {
    const regulado = d.precio_tipo === "regulado";
    return (
      <div className="card">
        <h4>Cotización · {String(d.aseguradora)}</h4>
        <div className="big">
          ${Number(d.prima).toLocaleString("es-CO")} <span className="sub">/{String(d.periodicidad).replace("_", " ")}</span>
        </div>
        <div className="sub">{String(d.producto)}</div>
        <div className={`price-tag ${regulado ? "reg" : ""}`}>
          {regulado ? "Tarifa oficial regulada" : "Valor de referencia (el precio final lo confirma la aseguradora)"}
        </div>
        {d.nota_precio && <div className="price-note">{String(d.nota_precio)}</div>}
        <details className="cov" open>
          <summary>Qué cubre y qué no cubre</summary>
          <p className="cov-lbl">Te cubre</p>
          <ul>{(d.coberturas as string[]).map((c, i) => <li key={i}>{c}</li>)}</ul>
          {Array.isArray(d.exclusiones) && d.exclusiones.length > 0 && (<>
            <p className="cov-lbl no">No te cubre</p>
            <ul>{(d.exclusiones as string[]).map((c, i) => <li key={i}>{c}</li>)}</ul>
          </>)}
          {d.forma_calculo && (<><p className="cov-lbl">Cómo se calcula lo que pagas</p><p className="cov-txt">{String(d.forma_calculo)}</p></>)}
          {d.consecuencias && (<><p className="cov-lbl">Si dejas de pagar</p><p className="cov-txt">{String(d.consecuencias)}</p></>)}
          <p className="cov-legal">
            Información según la Ley 1328 de 2009 (Art. 9).
            {d.fuente ? <> · <a href={String(d.fuente)} target="_blank" rel="noreferrer">Ver fuente</a></> : null}
          </p>
        </details>
      </div>
    );
  }

  if (event.type === "compliance") {
    return (
      <div className="card compliance">
        <h4>Lo que debes saber antes de decidir</h4>
        <p className="cl-lbl">Te cubre</p>
        <ul>{(d.coberturas as string[]).map((c, i) => <li key={i}>{c}</li>)}</ul>
        <p className="cl-lbl no">No te cubre</p>
        <ul>{(d.exclusiones as string[]).map((c, i) => <li key={i}>{c}</li>)}</ul>
        <p className="cl-lbl">Cómo se calcula lo que pagas</p>
        <p className="cl-txt">{String(d.art9?.forma_calculo)}</p>
        <p className="cl-lbl">Si dejas de pagar</p>
        <p className="cl-txt">{String(d.art9?.consecuencias_no_pago)}</p>
        <p className="cl-legal">Información según la Ley 1328 de 2009 (Art. 9).</p>
      </div>
    );
  }

  if (event.type === "policy") {
    const ins = insurerOf(String(d.aseguradora));
    const per = String(d.periodicidad).replace("_", " ");
    return (
      <div className="policycard">
        <div className="pc-top">
          <span className="pc-badge">✓ Póliza activa</span>
          <div className="pc-logo">
            <span className="pc-mono" style={{ background: ins.color }}>{ins.short.charAt(0)}</span>
            <span className="pc-brand" style={{ color: ins.color }}>{ins.short}</span>
          </div>
        </div>
        <div className="pc-product">{String(d.producto)}</div>
        <div className="pc-id">{String(d.policyId)}</div>
        <div className="pc-grid">
          <div><small>Asegurado</small><b>{String(d.asegurado)}</b></div>
          <div><small>Vigencia</small><b>{String(d.vigenciaMeses)} meses</b></div>
          <div><small>Pagas</small><b>${Number(d.prima).toLocaleString("es-CO")} <span>/{per}</span></b></div>
          <div><small>Estado</small><b className="ok">Activa</b></div>
        </div>
        <div className="pc-cert-label">Certificado digital</div>
        <div className="cert">{String(d.certificado)}</div>
      </div>
    );
  }

  if (event.type === "escalation") {
    return (
      <div className="card escalation">
        <h4>Te comunico con un asesor</h4>
        <div className="big">{String(d.ticket)}</div>
        <div className="sub">Un asesor de Colsubsidio te contactará. Motivo: {String(d.motivo)}</div>
      </div>
    );
  }
  return null;
}
