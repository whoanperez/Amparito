"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FlowVideo from "./FlowVideo";
import { voiceEnabled } from "@/lib/flags";
import { useGeminiLive } from "@/lib/voice/useGeminiLive";

interface UiEvent {
  // Copia deliberada del tipo del servidor: así el cliente no arrastra el SDK de Anthropic.
  // "afiliado" no pinta tarjeta — es el hallazgo de identidad que hay que recordar entre turnos.
  type: "quote" | "policy" | "escalation" | "compliance" | "form" | "propension" | "impacto" | "afiliado" | "feedback";
  data: Record<string, any>;
}
interface Rec { nombre: string; recomendado: boolean; razon: string }
interface ChatItem {
  kind: "msg" | "event" | "recommend" | "video";
  role?: "user" | "assistant";
  text?: string;
  event?: UiEvent;
  recs?: Rec[];
  voice?: boolean; // ítem generado por la voz (para fusionar transcripts consecutivos)
}
interface Contacto {
  nombre: string;
  tipoDocumento: "CC" | "CE" | "PASAPORTE";
  numeroDocumento: string;
  fechaNacimiento: string;
  celular: string;
  correo: string;
}

// Una sola pregunta, y pide lo único que puede ahorrar cinco turnos: el nombre. El servidor lo
// detecta en el texto y busca el segmento solo; identificarse nunca es obligatorio.
const GREETING =
  "Dime tu nombre: si estás afiliado a Colsubsidio te reconozco y nos saltamos el interrogatorio 💛 Soy Amparito — de amparar, protegerte. Y a veces te voy a decir que no.";

// Chips de arranque: prellenan la casilla para que la persona complete y edite.
// El anti-venta es el momento que se recuerda tres horas después, y hoy había que provocarlo con
// la frase exacta. Con el chip se DESCUBRE, que vale el doble.
const CHIPS_ENTRADA = ["Soy ", "Me quedé sin trabajo", "Prefiero no dar mi nombre"];

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

// Autogestión del jurado: cada pastilla manda un NOMBRE, no una autobiografía. Así el primer
// toque llega al reconocimiento contra la base —el foso— en vez de al camino genérico que
// cualquier equipo pudo construir. Los tres existen en data/afiliados_muestra.json con sus 4
// ejes completos, así que el momento sobrevive aunque la red del salón falle.
const PERSONAS_DEMO = [
  { key: "Carolina", n: "Carolina Ramírez", msg: "Soy Carolina Ramírez López" },
  { key: "Andres", n: "Andrés Gómez", msg: "Soy Andrés Gómez Ruiz" },
  { key: "Jaime", n: "Jaime Ortiz", msg: "Soy Jaime Ortiz Vega" },
];

// Momento proactivo (timing/canal): Amparito abre la conversación tras un evento de vida real
// que Colsubsidio ya conoce. Es el diferencial de canal — llegar en el momento correcto.
const EVENTOS: Record<string, string> = {
  credito_vivienda:
    "Hola, soy Amparito 👋 Vi que hace poco tomaste un crédito de vivienda con Colsubsidio. Se me ocurre algo: podríamos proteger tu hogar y lo que estás pagando, por si pasa un imprevisto. ¿Te cuento cómo, sin compromiso?",
  bebe:
    "Hola, soy Amparito 👋 Me contaron que llegó un bebé a tu familia, ¡felicitaciones! En este momento muchas familias piensan en proteger su ingreso, por si algún día faltan. ¿Miramos juntos qué te conviene?",
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

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export default function Chat({ interes, evento, offline }: { interes?: string | null; evento?: string | null; offline?: boolean }) {
  const proactivo = (evento && EVENTOS[evento.toLowerCase()]) || null;
  const [items, setItems] = useState<ChatItem[]>([{ kind: "msg", role: "assistant", text: proactivo ?? GREETING }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeForm, setActiveForm] = useState<UiEvent["data"] | null>(null);
  const [processing, setProcessing] = useState<null | "emision" | "reco">(null);
  const lastQuote = useRef<string | null>(null);
  const started = useRef(false);
  const offlineCancel = useRef(false);
  const afiliadoRef = useRef<{ nombre: string; ciudad: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // --- Voz (Bloque 4) — inerte si el flag está apagado ---
  const pushVoiceText = useCallback((role: "user" | "assistant", text: string) => {
    setItems((cur) => {
      const last = cur[cur.length - 1];
      if (last && last.kind === "msg" && last.role === role && last.voice) {
        const copy = cur.slice();
        copy[copy.length - 1] = { ...last, text: (last.text ?? "") + text };
        return copy;
      }
      return [...cur, { kind: "msg", role, text, voice: true }];
    });
  }, []);
  const voice = useGeminiLive({
    enabled: voiceEnabled,
    onUserText: (t) => pushVoiceText("user", t),
    onBotText: (t) => pushVoiceText("assistant", t),
    onEvent: (ev) => setItems((cur) => [...cur, { kind: "event", event: { type: ev.type as UiEvent["type"], data: ev.data } }]),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, busy, activeForm, processing, suggestions]);

  useEffect(() => () => { offlineCancel.current = true; }, []); // cancela el demo offline al desmontar

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

  async function send(text: string, opts?: { silentFail?: boolean }): Promise<boolean> {
    const t = text.trim();
    if (!t || busy || processing) return false;
    setInput("");
    setSuggestions([]);

    const next: ChatItem[] = [...itemsRef.current, { kind: "msg", role: "user", text: t }];
    setItems(next);
    setBusy(true);

    try {
      const history = next.filter((i) => i.kind === "msg").map((i) => ({ role: i.role!, content: i.text! }));

      // El teatro de explicabilidad (los pasos reales del motor) arranca ANTES de la llamada, para
      // CUBRIR la latencia. Antes corría después de que la respuesta ya había llegado, así que le
      // sumaba 2,5 s: el momento de más valor del producto aterrizaba detrás del silencio más
      // largo de la demo. No hay streaming (decisión registrada), así que esto es la mitigación.
      const esperaMinima = sleep(2200);
      setProcessing("reco");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, afiliado: afiliadoRef.current ?? undefined }),
      });
      const data = (await res.json()) as { reply: string; events: UiEvent[] };
      // Si la respuesta llegó antes de que se alcancen a leer los pasos, se completa la espera; si
      // tardó más, no se suma nada.
      await esperaMinima;
      setProcessing(null);
      const parsed = parseReply(data.reply || "");

      const eventItems: ChatItem[] = [];
      let openForm: UiEvent["data"] | null = null;
      for (const ev of data.events ?? []) {
        if (ev.type === "quote") lastQuote.current = String(ev.data.quoteId ?? lastQuote.current);
        if (ev.type === "form") { openForm = ev.data; continue; }
        // El servidor detectó (o desambiguó) a la persona: lo recordamos para los siguientes
        // turnos. No pinta tarjeta — es estado, no contenido.
        if (ev.type === "afiliado") {
          afiliadoRef.current = {
            nombre: String(ev.data.nombre ?? ""),
            ciudad: String(ev.data.ciudad ?? ""),
          };
          continue;
        }
        eventItems.push({ kind: "event", event: ev });
      }

      const msgItems: ChatItem[] = [];
      if (parsed.text) msgItems.push({ kind: "msg", role: "assistant", text: parsed.text });

      // (El teatro de explicabilidad ya arrancó ANTES del fetch: cubre la latencia real en vez de
      //  sumarse a ella. Antes corría aquí, después de que la respuesta ya había llegado.)
      // Si hay recomendaciones -> pantalla de "evaluando opciones" y luego las tarjetas.
      // La TARJETA va antes del texto: la frase suele comentar lo que la tarjeta muestra ("¿quieres
      // que te cuente cómo funciona el de Hogar?"), y leerla antes de ver Hogar no tiene sentido.
      if (parsed.recs.length) {
        setBusy(false);
        setProcessing(null);
        setItems((cur) => [...cur, ...eventItems, { kind: "recommend", recs: parsed.recs }, ...msgItems]);
        return true;
      }

      // Igual cuando la respuesta trae una tarjeta (cotización, coberturas, póliza): primero se ve,
      // después se comenta.
      setItems((cur) => (eventItems.length ? [...cur, ...eventItems, ...msgItems] : [...cur, ...msgItems]));
      setSuggestions(parsed.options);
      if (openForm) setActiveForm(openForm);
      return true;
    } catch {
      // silentFail: quien llama maneja el fallo (ej. cae al demo offline) sin mostrar el aviso.
      if (!opts?.silentFail) {
        setItems((cur) => [...cur, { kind: "msg", role: "assistant", text: "Se me trabó la conexión. ¿Intentamos de nuevo?" }]);
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  // --- Demo offline (RNF-1) — reproduce el guion local sin red ---
  async function runOffline(key: string, startFrom = 0) {
    if (busy || processing) return;
    setSuggestions([]);
    setInput("");
    offlineCancel.current = false;
    setBusy(true);
    try {
      const [{ playDemo }, { DEMO_SCRIPTS }] = await Promise.all([
        import("@/lib/demo/player"),
        import("@/lib/demo/scripts"),
      ]);
      const beats = DEMO_SCRIPTS[key]?.slice(startFrom);
      if (!beats?.length) return;
      await playDemo(beats, {
        addMsg: (role, text) => setItems((cur) => [...cur, { kind: "msg", role, text }]),
        addEvent: (event) => setItems((cur) => [...cur, { kind: "event", event: { type: event.type as UiEvent["type"], data: event.data } }]),
        addRecommend: (recs) => setItems((cur) => [...cur, { kind: "recommend", recs }]),
        sleep,
        cancelled: () => offlineCancel.current,
      });
    } catch {
      setItems((cur) => [...cur, { kind: "msg", role: "assistant", text: "No pude cargar el demo offline." }]);
    } finally {
      setBusy(false);
    }
  }

  async function startPersona(p: { key: string; msg: string }) {
    if (offline) { runOffline(p.key); return; }
    // En vivo: intenta la API; si falla, cae al guion local (el saludo ya se agregó → salta la beat 0).
    const ok = await send(p.msg, { silentFail: true });
    if (!ok) runOffline(p.key, 1);
  }

  async function submitForm(contacto: Contacto) {
    setActiveForm(null);
    setProcessing("emision");
    const t0 = Date.now();
    let result: { event?: UiEvent; closing?: string; error?: string; feedback?: UiEvent } = {};
    try {
      const res = await fetch("/api/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: lastQuote.current, contacto, consentimiento: true }),
      });
      result = await res.json();
    } catch { result = { error: "No pudimos emitir en este momento." }; }
    await sleep(Math.max(0, 3000 - (Date.now() - t0)));
    setProcessing(null);
    if (result.event) {
      setItems((cur) => [...cur, { kind: "event", event: result.event },
        { kind: "msg", role: "assistant", text: result.closing ?? "Tu solicitud queda completa. Recuerda que esto es una simulación: no se emitió ninguna póliza." },
        { kind: "video" },
        // Medición al cierre (pedido del equipo de seguros): esfuerzo y satisfacción.
        ...(result.feedback ? [{ kind: "event" as const, event: result.feedback }] : [])]);
    } else {
      setItems((cur) => [...cur, { kind: "msg", role: "assistant", text: result.error ?? "No pudimos emitir. Inténtalo de nuevo." }]);
    }
  }

  const locked = busy || !!processing || !!activeForm;
  const showStarters = items.length === 1 && !interes && !proactivo && !locked;
  // Las 6 tarjetas aparecen en el turno 2 y SOLO si la persona no se identificó: para un afiliado
  // reconocido preguntarle qué quiere proteger es empezar el interrogatorio que veníamos a matar.
  const showProteger =
    !showStarters &&
    !locked &&
    !afiliadoRef.current &&
    !interes &&
    !proactivo &&
    items.filter((i) => i.kind === "msg" && i.role === "user").length === 1 &&
    !items.some((i) => i.kind === "recommend" || i.kind === "event");

  return (
    <div className="chat-shell">
      <div className="chat-title">
        <div className="avatar">A</div>
        <div>
          <h2>Amparito</h2>
          <div className="status">{offline ? "● Modo demo offline — sin conexión, todo local" : "● En línea — 24/7, sin esperas"}</div>
        </div>
        {!offline && (
          <button
            className="advisor-btn"
            onClick={() => send("Prefiero que me llame un asesor de Colsubsidio.")}
            disabled={locked}
            title="Hablar con un asesor humano de Colsubsidio"
          >
            ☎ Que me llame un asesor
          </button>
        )}
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

        {/* Entrada de UNA sola pregunta. Antes competían cuatro llamados a la acción sin jerarquía
            (6 tarjetas, "con mis palabras", el formulario de afiliado y el selector del jurado) y eso
            paraliza: la persona tenía que elegir CÓMO empezar, que es una decisión que no le importa.
            Se quitó "Prefiero contarte con mis palabras": solo hacía focus() y el input ya tiene
            autoFocus. Las tarjetas bajan al turno 2, para quien no da su nombre. */}
        {showStarters && (
          <div className="pullfirst">
            <div className="pf-chips">
              {CHIPS_ENTRADA.map((c) => (
                <button key={c} className="pf-chip" onClick={() => pickSuggestion(c)}>{c}</button>
              ))}
            </div>
            <div className="pf-jurado">
              <span className="pf-jurado-lbl">Teclea un nombre y te reconozco. Prueba con uno de la base:</span>
              <div className="pf-jurado-row">
                {PERSONAS_DEMO.map((p) => (
                  <button key={p.n} className="pf-persona" onClick={() => startPersona(p)}>{p.n}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Las 6 tarjetas aparecen en el turno 2, solo si la persona no se identificó. */}
        {showProteger && (
          <div className="pullfirst">
            <div className="pf-q">¿Qué te gustaría proteger?</div>
            <div className="pf-grid">
              {PROTEGER.map((p) => (
                <button key={p.t} className="pf-card" onClick={() => send(p.msg)}>
                  <span className="pf-ico">{p.ico}</span>
                  <span className="pf-t">{p.t}</span>
                </button>
              ))}
            </div>
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
            {voiceEnabled && voice.supported && (
              <button
                type="button"
                className={`voicebtn ${voice.status}`}
                onClick={() => (voice.status === "idle" || voice.status === "error" ? voice.start() : voice.stop())}
                title="Hablar con Amparito por voz"
                aria-label="Hablar con Amparito por voz"
              >
                {voice.status === "connecting" ? "…" : voice.status === "listening" ? "⏹" : "🎤"}
              </button>
            )}
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={offline ? "Modo demo offline — prueba un perfil de arriba ↑" : "Escríbele a Amparito…"}
              disabled={locked || !!offline} autoFocus />
            <button type="submit" disabled={locked || !!offline || !input.trim()}>Enviar</button>
          </form>
          <p className="disclaimer">Amparito es la asistente virtual de seguros de Colsubsidio (comercializador; la aseguradora aliada emite y asume el riesgo). Verás coberturas, exclusiones y forma de pago antes de decidir (Ley 1328/2009, Art. 9) y tus datos se tratan con tu autorización (Ley 1581/2012). Vinculación simplificada bajo SARLAFT.</p>
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
          {/* El porqué del #1 ya vive en la PropensionCard; aquí solo lo mostramos para las opciones. */}
          {!r.recomendado && r.razon && <span className="reco-why">{r.razon}</span>}
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
    // Los pasos REALES del motor de propensión (no relleno): demuestran el "no caja negra".
    reco: [
      "Leyendo tu perfil de vida…",
      "Sumando las señales que aplican a tu caso…",
      "Descartando lo que no puedes tener y lo que hoy no te conviene…",
      "Ordenando por propensión, de forma determinista…",
      "Redactando el porqué de cada recomendación…",
    ],
  };
  const steps = SETS[variant];
  const sub = variant === "reco"
    ? "Motor de propensión explicable · reglas que puedes auditar, no una caja negra."
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

/* El formulario "🪪 Soy afiliado" (nombre + ciudad) se eliminó: era un peaje autoimpuesto de dos
   campos, y remataba autoenviando un "Hola" que la persona nunca escribió. Ahora basta con que
   diga su nombre en la conversación — el servidor lo detecta y busca solo (lib/afiliados/resolver).
   La ciudad se pide únicamente cuando hay homónimos reales, que es el 0,4% de los nombres. */

/* ===== Tarjeta de impacto de ingreso (reframe gasto→protección, en clave de cuidado) ===== */
function ImpactoCard({ data }: { data: Record<string, any> }) {
  const total = Number(data.impacto_total) || 0;
  const anos = Number(data.anos) || 10;
  const ingreso = Number(data.ingreso_mensual) || 0;
  return (
    <div className="impactocard">
      <div className="ic-eyebrow">💛 Lo que proteges</div>
      <div className="ic-big">${total.toLocaleString("es-CO")}</div>
      <div className="ic-sub">es el ingreso que tu familia necesitaría en los próximos {anos} años si un día llegaras a faltar.</div>
      <div className="ic-frame">No es un gasto: es asegurar que a los tuyos no les falte tu respaldo.</div>
      {ingreso > 0 && (
        <div className="ic-note">Referencia con tu ingreso (${ingreso.toLocaleString("es-CO")}/mes × {anos} años). Tú decides cuánto y hasta cuándo.</div>
      )}
    </div>
  );
}

/* ===== Tarjeta de propensión (el porqué: WhyThis + GapsLedger + PeerProof + Descartados) ===== */
function PropensionCard({ data }: { data: Record<string, any> }) {
  const recs = (data.recomendaciones ?? []) as Array<{ nombre: string; aseguradora: string; reason_codes: string[] }>;
  const obligatorios = (data.obligatorios ?? []) as Array<{
    nombre: string; aseguradora: string; razon: string; consecuencia: string;
  }>;
  const descartados = (data.descartados ?? []) as Array<{ nombre: string; motivo: string }>;
  const riesgos = (data.ledger?.riesgos_hoy ?? []) as string[];
  const yaCubierto = (data.ledger?.ya_cubierto ?? []) as Array<{ producto: string; razon: string }>;
  const peer = data.peer as { descripcion: string; n: number; pct: number } | null;
  const noVenta = data.no_venta as { motivo: string; alternativa: string } | undefined;
  const jerarquia = data.jerarquia as string | undefined;
  const traza = data.traza as TrazaData | undefined;
  const top = recs[0];

  // El segundo NO: "hoy no te sirve". Reemplaza la tarjeta entera — no tiene sentido mostrar un
  // ranking de productos de pago a quien acaba de decir que no tiene con qué.
  if (noVenta) {
    return (
      <div className="propcard">
        <div className="pp-head">
          <span className="pp-eyebrow">Lo que de verdad te sirve hoy</span>
          <div className="pp-title">Hoy no te voy a vender nada</div>
        </div>
        <div className="pp-antiventa">
          <span className="pp-av-ico">✋</span>
          <div>
            <b>No te vendo un seguro hoy.</b>
            <span>{noVenta.motivo}</span>
          </div>
        </div>
        <div className="pp-alt">
          <div className="pp-col-lbl">Esto sí te sirve</div>
          <p>{noVenta.alternativa}</p>
        </div>
        <p className="pp-alt-nota">
          Cuando vuelvas a tener entrada, me escribes y en tres minutos te dejo protegido. Aquí voy a estar 💛
        </p>
      </div>
    );
  }

  return (
    <div className="propcard">
      {/* Un solo título: "Por qué esto es para ti" y "Así analicé tu protección" decían lo mismo. */}
      <div className="pp-head">
        <div className="pp-title">Así analicé tu protección</div>
      </div>

      {/* Obligatorio por ley: va ANTES de todo. No compite con el ranking porque no es una
          recomendación — distinguir "la ley te obliga" de "yo te sugiero" es criterio. */}
      {obligatorios.map((o, i) => (
        <div className="pp-oblig" key={i}>
          <div className="pp-oblig-lbl">Esto no es recomendación, es obligación</div>
          <div className="pp-oblig-name">{o.nombre} <small>{o.aseguradora}</small></div>
          <p className="pp-oblig-txt">{o.razon}</p>
          <p className="pp-oblig-cons">⚠️ {o.consecuencia}</p>
        </div>
      ))}

      {/* Anti-venta como HÉROE — el momento honesto que gana confianza */}
      {yaCubierto.length > 0 && (
        <div className="pp-antiventa">
          <span className="pp-av-ico">✋</span>
          <div>
            <b>No te lo vendo de nuevo.</b>
            <span>{yaCubierto.map((c) => c.razon).join(" · ")}.</span>
          </div>
        </div>
      )}

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
          {/* Explicabilidad del orden: si la jerarquía movió el ranking, se dice. */}
          {jerarquia && <p className="pp-jerarquia">↑ {jerarquia}</p>}
        </div>
      )}

      {/* GapsLedger — solo existe para mostrar el CONTRASTE con lo que ya tiene. Si no hay nada
          cubierto, no se pinta: `riesgos_hoy` SON los reason codes del #1 por definición, así que
          esta caja repetía palabra por palabra lo que ya dice WhyThis tres centímetros arriba. */}
      {yaCubierto.length > 0 && (
        <div className="pp-ledger">
          <div className="pp-col risk">
            <div className="pp-col-lbl">Riesgos hoy</div>
            {riesgos.length ? <ul>{riesgos.map((r, i) => <li key={i}>{r}</li>)}</ul> : <p className="pp-empty">—</p>}
          </div>
          <div className="pp-col cov">
            <div className="pp-col-lbl">Ya cubierto</div>
            <ul>{yaCubierto.map((c, i) => <li key={i}>{c.producto}</li>)}</ul>
          </div>
        </div>
      )}

      {/* PeerProof — tamaño REAL del segmento (honesto, sin fracción de compra inventada) */}
      {peer && peer.n > 0 && (
        <div className="pp-peer">
          No estás solo: hay <b>{peer.n.toLocaleString("es-CO")}</b> afiliados en tu mismo segmento ({peer.descripcion}) dentro de Colsubsidio.
        </div>
      )}

      {/* Traza auditable (RNF-6): "inspeccionable en pantalla — no caja negra". Es lo que convierte
          "confía en mí" en "míralo": el perfil que entró con la procedencia de cada campo, las
          reglas que aplicaron con su peso, y la versión del scorecard con la que se decidió. */}
      {traza && <TrazaDecision traza={traza} />}

      {/* Descartados — la pregunta de segundo orden: por qué NO lo otro */}
      {descartados.length > 0 && (
        <details className="pp-disc" open>
          <summary>Por qué NO te recomendé lo demás</summary>
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

/* ===== Traza auditable de la decisión (RNF-6) =====
   "Toda recomendación persiste {perfil, reglas, pesos, reason codes, cita de fuente};
   inspeccionable en pantalla (no caja negra)." Va colapsada: no es para el usuario común, es para
   quien pregunta "¿y por qué?" — un jurado, cumplimiento, o alguien que desconfía. Que exista y se
   pueda abrir es el punto. */
interface TrazaData {
  version_reglas: string;
  perfil: Record<string, any>;
  gate_asequibilidad: { categoria: string; prioriza_prima_baja: boolean };
  jerarquia_aplicada: boolean;
  peer: { afirmada: boolean; motivo: string };
  productos: Array<{
    id: string;
    nombre: string;
    score: number;
    resultado: string;
    senales: Array<{ feature: string; razon: string; peso: number }>;
  }>;
}

const RESULTADO_ETIQUETA: Record<string, string> = {
  recomendado: "recomendado",
  obligatorio: "obligatorio por ley",
  ya_cubierto: "ya lo tienes",
  descartado: "descartado",
  fuera_del_top: "no entró al top",
};

function TrazaDecision({ traza }: { traza: TrazaData }) {
  const origen = (traza.perfil?._origen ?? {}) as Record<string, string>;
  const campos = Object.entries(traza.perfil ?? {}).filter(([k]) => k !== "_origen" && k !== "enriquecido");
  const enr = Object.entries((traza.perfil?.enriquecido ?? {}) as Record<string, unknown>);

  return (
    <details className="tz">
      <summary>Ver cómo llegué a esto</summary>

      <div className="tz-lbl">Lo que supe de ti, y de dónde lo supe</div>
      <ul className="tz-perfil">
        {[...campos, ...enr.map(([k, v]) => [`enriquecido.${k}`, v] as [string, unknown])].map(([k, v]) => (
          <li key={k}>
            <code>{k}</code> = {Array.isArray(v) ? v.join(", ") : String(v)}
            <span className={`tz-org ${origen[k] ?? origen[`enriquecido.${k}`] ?? ""}`}>
              {origen[k] ?? origen[`enriquecido.${k}`] ?? "—"}
            </span>
          </li>
        ))}
        {campos.length === 0 && enr.length === 0 && <li>No tenía ningún dato tuyo.</li>}
      </ul>
      <p className="tz-nota">
        <b>base</b> = vino de Colsubsidio · <b>declarado</b> = lo dijiste y se verificó ·{" "}
        <b>inferido</b> = se dedujo, y por eso no habilita afirmaciones sobre la base.
      </p>

      <div className="tz-lbl">Las reglas que aplicaron, y cuánto pesó cada una</div>
      <div className="tz-tabla">
        {traza.productos.filter((p) => p.senales.length > 0).map((p) => (
          <div className="tz-prod" key={p.id}>
            <div className="tz-prod-top">
              <b>{p.nombre}</b>
              <span className="tz-score">{p.score}</span>
              <span className={`tz-res ${p.resultado}`}>{RESULTADO_ETIQUETA[p.resultado] ?? p.resultado}</span>
            </div>
            <ul>
              {p.senales.map((s, i) => (
                <li key={i}>
                  <span className="tz-peso">{s.peso > 0 ? `+${s.peso}` : s.peso}</span>
                  <code>{s.feature}</code> {s.razon}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="tz-lbl">Decisiones del motor</div>
      <ul className="tz-meta">
        <li>
          Gate de asequibilidad · categoría <code>{traza.gate_asequibilidad.categoria}</code> →{" "}
          {traza.gate_asequibilidad.prioriza_prima_baja ? "prioriza prima baja" : "sin prioridad de prima"}
        </li>
        <li>Jerarquía de protección · {traza.jerarquia_aplicada ? "aplicada (movió el orden)" : "no hizo falta"}</li>
        <li>Prueba social · {traza.peer.afirmada ? "afirmada" : "NO afirmada"}: {traza.peer.motivo}</li>
        <li>Versión del scorecard · <code>{traza.version_reglas}</code></li>
      </ul>
    </details>
  );
}

/* ===== Medición al cierre: esfuerzo (CES) y satisfacción (CSAT) =====
   Pedido del equipo de seguros: "esfuerzo y satisfacción, cómo fue su experiencia en la venta a
   través del agente". Dos toques, sin salir del chat. El esfuerzo va primero porque es el que
   predice si la persona volvería — y es el que este producto vino a bajar. */
function FeedbackCard({ data }: { data: Record<string, any> }) {
  const [esfuerzo, setEsfuerzo] = useState<number | null>(null);
  const [satisfaccion, setSatisfaccion] = useState<number | null>(null);
  const [listo, setListo] = useState(false);

  async function enviar(ces: number, csat: number) {
    setListo(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ces, csat, producto: data.producto ?? null }),
      });
    } catch {
      /* La medición nunca puede romper el cierre: si falla, se pierde el dato y nada más. */
    }
  }

  if (listo) {
    return (
      <div className="fbcard done">
        <b>Gracias 💛</b>
        <span>Con esto sabemos si de verdad te lo hicimos fácil.</span>
      </div>
    );
  }

  const ESFUERZO = [
    { v: 5, t: "Muy fácil" },
    { v: 4, t: "Fácil" },
    { v: 3, t: "Normal" },
    { v: 2, t: "Difícil" },
    { v: 1, t: "Muy difícil" },
  ];
  const SATISFACCION = [
    { v: 5, t: "😄 Muy bien" },
    { v: 4, t: "🙂 Bien" },
    { v: 3, t: "😐 Regular" },
    { v: 2, t: "🙁 Mal" },
  ];

  return (
    <div className="fbcard">
      <div className="fb-q">¿Qué tan fácil te resultó todo esto?</div>
      <div className="fb-row">
        {ESFUERZO.map((o) => (
          <button
            key={o.v}
            className={`fb-opt ${esfuerzo === o.v ? "on" : ""}`}
            onClick={() => setEsfuerzo(o.v)}
          >
            {o.t}
          </button>
        ))}
      </div>
      {esfuerzo !== null && (
        <>
          <div className="fb-q">¿Y cómo te sentiste con la atención?</div>
          <div className="fb-row">
            {SATISFACCION.map((o) => (
              <button
                key={o.v}
                className={`fb-opt ${satisfaccion === o.v ? "on" : ""}`}
                onClick={() => { setSatisfaccion(o.v); enviar(esfuerzo, o.v); }}
              >
                {o.t}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ===== Tarjetas ===== */
function EventCard({ event }: { event: UiEvent }) {
  const d = event.data;

  if (event.type === "propension") return <PropensionCard data={d} />;
  if (event.type === "impacto") return <ImpactoCard data={d} />;
  if (event.type === "feedback") return <FeedbackCard data={d} />;

  if (event.type === "quote") {
    const regulado = d.precio_tipo === "regulado";
    // Sin precio: la tarifa depende de datos que el chat no tiene. Se muestran las coberturas,
    // nunca un número — usar la tarifa de otra variante sería peor que no dar precio.
    const sinPrecio = d.precio_tipo === "requiere_datos" || d.prima == null;
    return (
      <div className="card">
        <h4>{sinPrecio ? "Coberturas" : "Cotización"} · {String(d.aseguradora)}</h4>
        {sinPrecio ? (
          <div className="big nop">Se cotiza con los datos de tu vehículo</div>
        ) : (
          <div className="big">
            ${Number(d.prima).toLocaleString("es-CO")} <span className="sub">/{String(d.periodicidad).replace("_", " ")}</span>
          </div>
        )}
        <div className="sub">{String(d.producto)}</div>
        {!sinPrecio && (
          <div className={`price-tag ${regulado ? "reg" : ""}`}>
            {regulado ? "Tarifa oficial regulada" : "Valor de referencia (el precio final lo confirma la aseguradora)"}
          </div>
        )}
        {d.nota_precio && <div className="price-note">{String(d.nota_precio)}</div>}
        {!sinPrecio && d.edad_usada == null && (
          <div className="price-note">Calculado sobre la tarifa base: el valor final varía con tu edad.</div>
        )}
        {/* De cuánto es la póliza. Si no lo sabemos, se dice — no se inventa. */}
        <div className="va-row">
          <span className="va-lbl">Valor asegurado</span>
          <span className="va-val">
            {typeof d.valor_asegurado === "number"
              ? `$${Number(d.valor_asegurado).toLocaleString("es-CO")}`
              : "Lo define la aseguradora según el plan"}
          </span>
        </div>
        {d.nota_valor_asegurado && <div className="price-note">{String(d.nota_valor_asegurado)}</div>}
        {/* Capa 2 — qué cubre / qué no: SIEMPRE visible (cumple Ley 1328 Art. 9, sin saturar) */}
        <div className="cov2">
          <p className="cov-lbl">Te cubre</p>
          <ul>{(d.coberturas as string[]).map((c, i) => <li key={i}>{c}</li>)}</ul>
          {Array.isArray(d.exclusiones) && d.exclusiones.length > 0 && (<>
            <p className="cov-lbl no">No te cubre</p>
            <ul>{(d.exclusiones as string[]).map((c, i) => <li key={i}>{c}</li>)}</ul>
          </>)}
        </div>
        {/* Capa 3 — términos completos a demanda: quedan a un clic, no enfrían la conversación */}
        <details className="cov">
          <summary>Ver términos completos</summary>
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
    // La tarjeta refleja lo que devolvió el adaptador, no un valor fijo: hoy es SIMULADA porque no
    // hay aseguradora conectada, y el día que la haya la UI dirá la verdad sin tocar nada.
    const simulada = String(d.estado ?? "SIMULADA") !== "ACTIVA";
    return (
      <div className="policycard">
        <div className="pc-top">
          <span className={`pc-badge ${simulada ? "sim" : ""}`}>
            {simulada ? "SIMULACIÓN · demo" : "✓ Póliza activa"}
          </span>
          <div className="pc-logo">
            <span className="pc-mono" style={{ background: ins.color }}>{ins.short.charAt(0)}</span>
            <span className="pc-brand" style={{ color: ins.color }}>{ins.short}</span>
          </div>
        </div>
        <div className="pc-product">{String(d.producto)}</div>
        <div className="pc-id">{String(d.policyId)}</div>
        <div className="pc-grid">
          <div><small>Tomador</small><b>{String(d.asegurado)}</b></div>
          <div><small>{simulada ? "Vigencia que tendría" : "Vigencia"}</small><b>{String(d.vigenciaMeses)} meses</b></div>
          <div><small>{simulada ? "Pagaría" : "Pagas"}</small><b>${Number(d.prima).toLocaleString("es-CO")} <span>/{per}</span></b></div>
          <div><small>Estado</small><b className={simulada ? "sim" : "ok"}>{simulada ? "Simulada" : "Activa"}</b></div>
        </div>
        <div className="pc-cert-label">{simulada ? "Certificado simulado" : "Certificado digital"}</div>
        <div className="cert">{String(d.certificado)}</div>
        {simulada && (
          <p className="pc-sim-note">
            Esta es una simulación del proceso completo. <b>No se emitió ninguna póliza</b> y no vas a
            recibir ningún correo.
          </p>
        )}
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
