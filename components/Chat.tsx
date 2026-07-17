"use client";

import { useEffect, useRef, useState } from "react";

interface UiEvent {
  type: "quote" | "policy" | "escalation" | "compliance" | "form";
  data: Record<string, any>;
}
interface ChatItem {
  kind: "msg" | "event";
  role?: "user" | "assistant";
  text?: string;
  event?: UiEvent;
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

// Limpia cualquier markdown que Haiku pudiera dejar (por robustez)
function clean(t: string): string {
  return t
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/`/g, "")
    .trim();
}

// Extrae quick-replies de una línea "OPCIONES: a | b | c"
function parseOptions(t: string): { text: string; options: string[] } {
  const m = t.match(/OPCIONES:\s*(.+)\s*$/im);
  if (!m) return { text: clean(t), options: [] };
  const options = m[1].split("|").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const text = clean(t.replace(m[0], ""));
  return { text, options };
}

export default function Chat({ interes }: { interes?: string | null }) {
  const [items, setItems] = useState<ChatItem[]>([
    { kind: "msg", role: "assistant", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeForm, setActiveForm] = useState<UiEvent["data"] | null>(null);
  const [processing, setProcessing] = useState(false);
  const lastQuote = useRef<string | null>(null);
  const started = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, busy, activeForm, processing, suggestions]);

  // Disparador desde la landing: auto-enviar el primer mensaje contextual
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const key = (interes ?? "").toLowerCase();
    if (key && INTERES[key]) {
      const first = `Hola Amparito, tengo interés en ${INTERES[key]}.`;
      setTimeout(() => send(first), 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interes]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy || processing) return;
    setInput("");
    setSuggestions([]);

    const next: ChatItem[] = [...itemsRef.current, { kind: "msg", role: "user", text: t }];
    setItems(next);
    setBusy(true);

    try {
      const history = next
        .filter((i) => i.kind === "msg")
        .map((i) => ({ role: i.role!, content: i.text! }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = (await res.json()) as { reply: string; events: UiEvent[] };

      const parsed = parseOptions(data.reply || "");
      const additions: ChatItem[] = [];
      if (parsed.text) additions.push({ kind: "msg", role: "assistant", text: parsed.text });

      let openForm: UiEvent["data"] | null = null;
      for (const ev of data.events ?? []) {
        if (ev.type === "quote") lastQuote.current = String(ev.data.quoteId ?? lastQuote.current);
        if (ev.type === "form") { openForm = ev.data; continue; }
        additions.push({ kind: "event", event: ev });
      }

      setItems((cur) => [...cur, ...additions]);
      setSuggestions(parsed.options);
      if (openForm) setActiveForm(openForm);
    } catch {
      setItems((cur) => [
        ...cur,
        { kind: "msg", role: "assistant", text: "Se me trabó la conexión. ¿Intentamos de nuevo?" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  // ref espejo de items para usarlo dentro de send sin closure viejo
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  async function submitForm(contacto: Contacto) {
    setActiveForm(null);
    setProcessing(true);
    const t0 = Date.now();
    let result: { event?: UiEvent; closing?: string; error?: string } = {};
    try {
      const res = await fetch("/api/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: lastQuote.current, contacto, consentimiento: true }),
      });
      result = await res.json();
    } catch {
      result = { error: "No pudimos emitir en este momento." };
    }
    const elapsed = Date.now() - t0;
    await new Promise((r) => setTimeout(r, Math.max(0, 5000 - elapsed)));
    setProcessing(false);

    if (result.event) {
      setItems((cur) => [
        ...cur,
        { kind: "event", event: result.event },
        { kind: "msg", role: "assistant", text: result.closing ?? "¡Listo, quedaste asegurado!" },
      ]);
    } else {
      setItems((cur) => [
        ...cur,
        { kind: "msg", role: "assistant", text: result.error ?? "No pudimos emitir. Inténtalo de nuevo." },
      ]);
    }
  }

  const locked = busy || processing || !!activeForm;

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
          ) : (
            <EventCard key={i} event={item.event!} />
          )
        )}

        {activeForm && <DataForm data={activeForm} onSubmit={submitForm} />}
        {processing && <ProcessingCard />}
        {busy && <div className="typing">Amparito está escribiendo…</div>}
        <div ref={endRef} />
      </div>

      {suggestions.length > 0 && !locked && (
        <div className="quickbar">
          <div className="quickbar-inner">
            {suggestions.map((s) => (
              <button key={s} className="quick" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {!activeForm && (
        <div className="inputbar">
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escríbele a Amparito…"
              disabled={locked}
              autoFocus
            />
            <button type="submit" disabled={locked || !input.trim()}>Enviar</button>
          </form>
          <p className="disclaimer">
            Amparito es una asistente virtual de Colsubsidio. Tus datos se tratan según la Ley 1581 de 2012.
          </p>
        </div>
      )}
    </div>
  );
}

/* ============ Pantalla de transición ("proceso de calidad") ============ */
function ProcessingCard() {
  const steps = [
    "Validando tu información…",
    "Consultando con la aseguradora…",
    "Personalizando tu cobertura…",
    "Generando tu certificado…",
  ];
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
      <div className="psub">Estamos personalizando tu seguro con estándar de calidad Colsubsidio.</div>
    </div>
  );
}

/* ============ Formulario / tabla de datos ============ */
function DataForm({ data, onSubmit }: { data: any; onSubmit: (c: Contacto) => void }) {
  const [f, setF] = useState<Contacto>({
    nombre: "", tipoDocumento: "CC", numeroDocumento: "", fechaNacimiento: "", celular: "", correo: "",
  });
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof Contacto>(k: K, v: Contacto[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function validar(): string | null {
    if (!f.nombre.trim() || f.nombre.trim().split(" ").length < 2)
      return "Escribe tus nombres y apellidos completos.";
    if (f.tipoDocumento !== "PASAPORTE" && !/^\d{5,12}$/.test(f.numeroDocumento))
      return "El número de documento debe ser solo números.";
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(f.fechaNacimiento))
      return "La fecha debe ir en formato DD/MM/AAAA.";
    if (!/^\d{10}$/.test(f.celular)) return "El celular debe tener 10 dígitos.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo)) return "Escribe un correo válido.";
    if (!consent) return "Necesitas autorizar el tratamiento de tus datos para continuar.";
    return null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validar();
    if (v) { setErr(v); return; }
    setErr(null);
    onSubmit(f);
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
          <input value={f.fechaNacimiento} onChange={(e) => set("fechaNacimiento", e.target.value)} placeholder="DD/MM/AAAA" />
        </label>
        <label>Celular
          <input value={f.celular} onChange={(e) => set("celular", e.target.value)} placeholder="10 dígitos" />
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

/* ============ Tarjetas ============ */
function EventCard({ event }: { event: UiEvent }) {
  const d = event.data;

  if (event.type === "quote") {
    return (
      <div className="card">
        <h4>Cotización · {String(d.aseguradora)}</h4>
        <div className="big">
          ${Number(d.prima).toLocaleString("es-CO")} <span className="sub">/{String(d.periodicidad).replace("_", " ")}</span>
        </div>
        <div className="sub">{String(d.producto)}</div>
        <ul>{(d.coberturas as string[]).slice(0, 4).map((c, i) => <li key={i}>{c}</li>)}</ul>
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
    return (
      <div className="card policy">
        <span className="badge">Póliza activa</span>
        <h4>{String(d.producto)} · {String(d.aseguradora)}</h4>
        <div className="big">{String(d.policyId)}</div>
        <div className="sub">
          Asegurado: {String(d.asegurado)} · Vigencia: {String(d.vigenciaMeses)} meses · $
          {Number(d.prima).toLocaleString("es-CO")}/{String(d.periodicidad).replace("_", " ")}
        </div>
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
