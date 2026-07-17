"use client";

import { useEffect, useRef, useState } from "react";

interface UiEvent {
  type: "quote" | "policy" | "escalation" | "compliance";
  data: Record<string, unknown>;
}

interface ChatItem {
  kind: "msg" | "event";
  role?: "user" | "assistant";
  text?: string;
  event?: UiEvent;
}

const GREETING =
  "¡Hola! Soy Amparito, tu asistente de seguros de Colsubsidio 😊 Cuéntame: ¿qué cambió en tu vida o qué te tiene pensando en protegerte?";

export default function Chat() {
  const [items, setItems] = useState<ChatItem[]>([
    { kind: "msg", role: "assistant", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");

    const next: ChatItem[] = [...items, { kind: "msg", role: "user", text }];
    setItems(next);
    setBusy(true);

    try {
      // Historial de mensajes (solo msg, los eventos son presentación)
      const history = next
        .filter((i) => i.kind === "msg")
        .map((i) => ({ role: i.role!, content: i.text! }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = (await res.json()) as { reply: string; events: UiEvent[] };

      const additions: ChatItem[] = [];
      for (const ev of data.events ?? []) {
        if (ev.type !== "compliance") additions.push({ kind: "event", event: ev });
      }
      if (data.reply) additions.push({ kind: "msg", role: "assistant", text: data.reply });

      setItems((cur) => [...cur, ...additions]);
    } catch {
      setItems((cur) => [
        ...cur,
        { kind: "msg", role: "assistant", text: "Se me trabó la conexión 😅 ¿Intentamos de nuevo?" },
      ]);
    } finally {
      setBusy(false);
    }
  }

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
            <div key={i} className={`msg ${item.role === "user" ? "user" : "bot"}`}>
              {item.text}
            </div>
          ) : (
            <EventCard key={i} event={item.event!} />
          )
        )}
        {busy && <div className="typing">Amparito está escribiendo…</div>}
        <div ref={endRef} />
      </div>

      <div className="inputbar">
        <form onSubmit={send}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escríbele a Amparito…"
            disabled={busy}
            autoFocus
          />
          <button type="submit" disabled={busy || !input.trim()}>
            Enviar
          </button>
        </form>
        <p className="disclaimer">
          Amparito es una asistente virtual de Colsubsidio. Tus datos se tratan según la Ley 1581 de 2012.
        </p>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: UiEvent }) {
  const d = event.data as Record<string, any>;

  if (event.type === "quote") {
    return (
      <div className="card">
        <h4>Cotización · {String(d.aseguradora)}</h4>
        <div className="big">
          ${Number(d.prima).toLocaleString("es-CO")}{" "}
          <span className="sub">/{String(d.periodicidad).replace("_", " ")}</span>
        </div>
        <div className="sub">{String(d.producto)}</div>
        <ul>
          {(d.coberturas as string[]).slice(0, 4).map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (event.type === "policy") {
    return (
      <div className="card policy">
        <span className="badge">PÓLIZA ACTIVA</span>
        <h4>
          {String(d.producto)} · {String(d.aseguradora)}
        </h4>
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
        <h4>Derivado a un asesor</h4>
        <div className="big">{String(d.ticket)}</div>
        <div className="sub">Un asesor de Colsubsidio te contactará. Motivo: {String(d.motivo)}</div>
      </div>
    );
  }

  return null;
}
