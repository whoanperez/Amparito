"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DetrasDeCamaras } from "./FlowVideo";
import { AVISO_SIMULACION, AVISO_PAGO_SIMULADO } from "@/lib/expedicion";
import { UMBRAL_PASOS, esperaRestante, indicadorDeEspera } from "@/lib/ui/espera";
import {
  ETIQUETA_ORIGEN,
  ETIQUETA_RESULTADO,
  SIN_PROCEDENCIA,
  etiquetaDeCampo,
  explicaGate,
  sumaDelPuntaje,
  valorLegible,
} from "@/lib/ui/traza";
import { voiceEnabled } from "@/lib/flags";
import { useGeminiLive } from "@/lib/voice/useGeminiLive";
import { SALUDO_INICIAL, esVinieta, textoDeVinieta, trozosDe } from "@/lib/estado/vista";
import type { Bloque, Rec, UiEvent, UiVista } from "@/lib/estado/tipos";

// `UiEvent` y `Rec` se IMPORTAN, ya no se copian. La copia existía porque el tipo vivía en
// `lib/tools.ts`, que arrastra el SDK de Anthropic al bundle del cliente. Ahora vive en
// `lib/estado/tipos.ts`, que no importa ni el SDK ni el cliente de la base — verificado: el
// bundle de /chat no crece.

interface ChatItem {
  /** "proteger" es la grilla de seis: ahora la decide el SERVIDOR y llega como un bloque más,
   *  en su posición. Antes el cliente la sacaba contando burbujas, sin saber que el agente
   *  acababa de hacer una pregunta abierta. */
  kind: "msg" | "event" | "recommend" | "video" | "proteger";
  role?: "user" | "assistant";
  text?: string;
  event?: UiEvent;
  recs?: Rec[];
  voice?: boolean; // ítem generado por la voz (para fusionar transcripts consecutivos)
}

/** Traduce lo que el servidor decidió pintar a los ítems del transcript. Sin decisiones propias:
 *  el orden y el contenido ya vienen resueltos. */
function bloquesAItems(bloques: Bloque[]): ChatItem[] {
  return bloques.map((b): ChatItem => {
    switch (b.t) {
      case "texto": return { kind: "msg", role: "assistant", text: b.contenido };
      case "tarjetas": return { kind: "recommend", recs: b.recs };
      case "evento": return { kind: "event", event: b.evento };
      case "elegir_proteccion": return { kind: "proteger" };
    }
  });
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
// El copy vive en el servidor, que es quien decide las fases. Se importa en vez de copiarse: dos
// literales iguales en dos archivos es cómo se arregla uno y se olvida el otro.
const GREETING = SALUDO_INICIAL;

// Chips de arranque: prellenan la casilla para que la persona complete y edite.
// El anti-venta es el momento que se recuerda tres horas después, y hoy había que provocarlo con
// la frase exacta. Con el chip se DESCUBRE, que vale el doble.
/**
 * Chips de arranque. La ETIQUETA y lo que se escribe son cosas distintas, y confundirlas producía
 * un botón que decía "Soy" a secas — una palabra suelta, sin sentido para quien la lee (#25).
 *
 * Y `completa` resuelve el #26: había cuatro familias de botón con la MISMA pinta y dos
 * comportamientos distintos —unos prellenaban, otros enviaban— así que no se podía predecir qué
 * hacía ninguno. La regla ahora es una sola y se lee en el propio botón:
 *
 *    completa: true  → es una respuesta entera  → ENVÍA
 *    completa: false → hay que terminarla       → PRELLENA, y lleva "…" para que se vea
 */
export interface Chip {
  etiqueta: string;
  texto: string;
  completa: boolean;
}

export const CHIPS_ENTRADA: Chip[] = [
  { etiqueta: "Soy…", texto: "Soy ", completa: false },
  { etiqueta: "Me quedé sin trabajo", texto: "Me quedé sin trabajo", completa: true },
  { etiqueta: "Prefiero no dar mi nombre", texto: "Prefiero no dar mi nombre", completa: true },
];

/**
 * Una opción del modelo que termina en espacio necesita completarse ("Vivo en ", "Tengo un
 * presupuesto de ") — así lo describe la tool `ofrecer_opciones`. El resto son respuestas
 * enteras.
 */
export const chipDeOpcion = (opcion: string): Chip =>
  /\s$/.test(opcion)
    ? { etiqueta: `${opcion.trim()}…`, texto: opcion, completa: false }
    : { etiqueta: opcion, texto: opcion, completa: true };

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
/**
 * La invitación que acompaña a las pastillas. Es copy con una propiedad verificable: NO puede
 * confesar que esto es un demo ni nombrar "la base". Se enmarca como lo que de verdad es —ver el
 * producto funcionando con alguien afiliado— y por eso tiene gate, como el saludo.
 */
export const INVITACION_EJEMPLO = "O mira cómo funciona con alguien afiliado:";

export const PERSONAS_DEMO = [
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

/*
 * Aquí vivían `clean`, `parseReply`, `recsDeEvento` y `PREGUNTAS_ASESOR`. Los cuatro eran el
 * cliente DERIVANDO lo que el servidor ya sabía:
 *
 *   · `parseReply` sacaba con regex dos protocolos de texto (`RECOMENDACION:` y `OPCIONES:`) que
 *     ya no existen — bastaba una tilde para que el sistema quedara mudo, y nunca tuvo cobertura.
 *   · `recsDeEvento` existía TRIPLICADA (aquí, en el player offline y dentro de un test), y la
 *     única versión cubierta era la copia que vivía en el test.
 *   · `clean` y `PREGUNTAS_ASESOR` son decisiones de presentación, y la presentación la arma
 *     ahora `lib/estado/vista.ts`, donde sí la cubre un gate.
 */

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
  /** El contacto del formulario, para que pagar no vuelva a pedirlo. */
  const contactoRef = useRef<Contacto | null>(null);
  const started = useRef(false);
  const offlineCancel = useRef(false);
  /**
   * El estado de la conversación, SELLADO y opaco. El cliente lo guarda y lo reenvía sin leerlo:
   * si pudiera leerlo empezaría a derivar de él, que es exactamente el problema que este trabajo
   * elimina. Aquí vivían `afiliadoRef` y `yaRecomendo` — dos booleanos con los que el navegador
   * intentaba representar una máquina de cuatro fases con slots, perfil y veredicto.
   */
  const estadoRef = useRef<string | undefined>(undefined);
  const endRef = useRef<HTMLDivElement>(null);
  /**
   * La barra de entrada es fija y su alto CAMBIA: el aviso legal envuelve distinto en cada ancho.
   * Se mide y se publica como variable CSS, en vez de reservarle un hueco fijo — que en móvil se
   * quedaba corto y le cortaba a la persona la tercera pastilla por la mitad, justo la que lleva
   * al arranque caliente.
   */
  const barraRef = useRef<HTMLDivElement>(null);
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

  /** Una sola puerta para los botones de texto: la completa se envía, la incompleta se prellena. */
  function tocarChip(c: Chip) {
    if (c.completa) { send(c.texto); return; }
    setInput(c.texto.endsWith(" ") ? c.texto : c.texto + " ");
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

    // Fuera del `try` a propósito: si la llamada revienta, el `finally` tiene que poder cancelar el
    // temporizador. Antes el camino de error no limpiaba `processing` y la tarjeta de pasos se
    // quedaba puesta encima de una conversación muerta.
    let escalar: ReturnType<typeof setTimeout> | undefined;

    try {
      const history = next.filter((i) => i.kind === "msg").map((i) => ({ role: i.role!, content: i.text! }));

      // Los pasos del motor aparecen solo si el turno se está demorando de verdad: no hay piso, hay
      // umbral (ver lib/ui/espera.ts). Un turno que solo pregunta la ciudad no ejecuta el motor y
      // ya no paga 2,2 s por narrar un trabajo que no hizo.
      let pasosDesde: number | null = null;
      escalar = setTimeout(() => {
        pasosDesde = Date.now();
        setProcessing("reco");
      }, UMBRAL_PASOS);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `origen` solo importa en el primer turno: le dice al servidor que la persona llegó
        // DICIENDO qué quiere, para que no le pregunte "¿qué te gustaría proteger?". Es lo único
        // de la pantalla que el servidor no puede deducir del mensaje, porque llega como texto
        // normal.
        body: JSON.stringify({
          messages: history,
          estado: estadoRef.current,
          origen: proactivo ? "evento" : interes ? "interes" : undefined,
        }),
      });
      const data = (await res.json()) as { ui: UiVista; estado: string };
      if (!data?.ui) throw new Error("respuesta sin vista");
      clearTimeout(escalar);
      // Si los pasos nunca aparecieron, esto es 0: la respuesta sale apenas llega.
      await sleep(esperaRestante(pasosDesde, Date.now()));
      setProcessing(null);
      // El estado viaja opaco: se guarda y se reenvía, nunca se interpreta.
      estadoRef.current = data.estado;

      // El cliente ya no decide NADA de lo que se pinta: el orden, si va una tarjeta antes del
      // texto, si aparece la grilla de proteger y qué sugerencias se ofrecen ya vienen resueltos.
      // Aquí solo se traducen a ítems del transcript.
      const nuevos = bloquesAItems(data.ui.bloques);
      for (const b of data.ui.bloques) {
        if (b.t === "evento" && b.evento.type === "quote") {
          lastQuote.current = String(b.evento.data.quoteId ?? lastQuote.current);
        }
      }

      setBusy(false);
      setProcessing(null);
      setItems((cur) => [...cur, ...nuevos]);
      setSuggestions(data.ui.sugerencias);
      setActiveForm(data.ui.entrada.formulario ?? null);
      return true;
    } catch {
      // silentFail: quien llama maneja el fallo (ej. cae al demo offline) sin mostrar el aviso.
      if (!opts?.silentFail) {
        setItems((cur) => [...cur, { kind: "msg", role: "assistant", text: "Se me trabó la conexión. ¿Intentamos de nuevo?" }]);
      }
      return false;
    } finally {
      clearTimeout(escalar);
      setProcessing(null);
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
    contactoRef.current = contacto;
    setActiveForm(null);
    // Este paso ya NO emite: solo prepara el pago. Narrar "consultando con la aseguradora" y
    // "generando tu certificado" aquí sería contar un trabajo que no ocurre — y encima cobrando
    // tres segundos por contarlo. El teatro se mudó a `pagar`, que es donde sí pasa algo.
    setBusy(true);
    let result: { event?: UiEvent; evento?: UiEvent; closing?: string; error?: string; feedback?: UiEvent } = {};
    try {
      const res = await fetch("/api/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: lastQuote.current, contacto, consentimiento: true }),
      });
      result = await res.json();
    } catch { result = { error: "No pudimos emitir en este momento." }; }
    setBusy(false);
    if (result.evento) {
      // Primero se paga. Antes esto iba directo a la póliza, así que lo que reemplazaba el
      // "te contactaremos" era un formulario — y quien lo llena sigue sin saber si quedó.
      setItems((cur) => [...cur, { kind: "event", event: result.evento! }]);
    } else if (result.event) {
      setItems((cur) => [...cur, { kind: "event", event: result.event },
        { kind: "msg", role: "assistant", text: result.closing ?? `Tu solicitud queda completa. ${AVISO_SIMULACION}` },
        { kind: "video" },
        // Medición al cierre (pedido del equipo de seguros): esfuerzo y satisfacción.
        ...(result.feedback ? [{ kind: "event" as const, event: result.feedback }] : [])]);
    } else {
      setItems((cur) => [...cur, { kind: "msg", role: "assistant", text: result.error ?? "No pudimos emitir. Inténtalo de nuevo." }]);
    }
  }

  /**
   * Pagar (simulado) y con eso emitir.
   *
   * Se guarda el contacto del formulario para no volver a pedirlo: el pago es un paso más de la
   * misma solicitud, no una solicitud nueva.
   */
  async function pagar() {
    const contacto = contactoRef.current;
    if (!contacto) {
      // Puede pasar si se recarga la pantalla con el pago en curso: el hilo se mantiene pero el
      // contacto vivía en memoria. Un botón que no hace nada es peor que uno que explica.
      setItems((cur) => [...cur, { kind: "msg", role: "assistant",
        text: "Se me perdieron tus datos al recargar. Dime que quieres avanzar y te abro el formulario otra vez." }]);
      return;
    }
    setProcessing("emision");
    const t0 = Date.now();
    let result: { event?: UiEvent; closing?: string; error?: string; feedback?: UiEvent } = {};
    try {
      const res = await fetch("/api/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: lastQuote.current, contacto, consentimiento: true, pagado: true }),
      });
      result = await res.json();
    } catch { result = { error: "No pudimos emitir en este momento." }; }
    await sleep(Math.max(0, 3000 - (Date.now() - t0)));
    setProcessing(null);
    if (result.event) {
      setItems((cur) => [...cur, { kind: "event", event: result.event },
        { kind: "msg", role: "assistant", text: result.closing ?? `Tu solicitud queda completa. ${AVISO_SIMULACION}` },
        { kind: "video" },
        ...(result.feedback ? [{ kind: "event" as const, event: result.feedback }] : [])]);
    } else {
      setItems((cur) => [...cur, { kind: "msg", role: "assistant", text: result.error ?? "No pudimos emitir. Inténtalo de nuevo." }]);
    }
  }

  useEffect(() => {
    const el = barraRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const publica = () =>
      document.documentElement.style.setProperty("--alto-barra", `${el.offsetHeight}px`);
    publica();
    const ro = new ResizeObserver(publica);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeForm]);

  const locked = busy || !!processing || !!activeForm;
  const showStarters = items.length === 1 && !interes && !proactivo && !locked;
  // `showProteger` vivía aquí: seis condiciones, tres de ellas contando ítems del array. El
  // cliente decidía si mostrar la grilla sin poder saber lo único que importaba —si el agente
  // acababa de hacer una pregunta abierta—, y por eso salían las seis tarjetas al lado de una
  // pregunta. Ahora lo decide el servidor y llega como un bloque más, en su posición.

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
            <div key={i} className={`msg ${item.role === "user" ? "user" : "bot"}`}>
              {item.role === "user" ? item.text : <TextoDeAmparito texto={item.text ?? ""} />}
            </div>
          ) : item.kind === "recommend" ? (
            <RecommendCards key={i} recs={item.recs!} onPick={(n) => send(`Quiero el ${n}`)} />
          ) : item.kind === "video" ? (
            <DetrasDeCamaras key={i} />
          ) : item.kind === "proteger" ? (
            <div key={i} className="pullfirst">
              <div className="pf-q">¿Qué te gustaría proteger?</div>
              <div className="pf-grid">
                {PROTEGER.map((p) => (
                  <button key={p.t} className="pf-card" onClick={() => send(p.msg)} disabled={locked}>
                    <span className="pf-ico">{p.ico}</span>
                    <span className="pf-t">{p.t}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Sin `onPagar` el botón queda deshabilitado, y eso es lo correcto en dos casos: mientras
               hay algo en curso —dos clics serían dos pólizas y dos filas en la hoja— y en el demo
               offline, donde la reproducción es guionizada y no hay a quién cobrarle. */
            <EventCard key={i} event={item.event!}
              onPagar={item.event!.type === "pago" && !locked && !offline ? pagar : undefined} />
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
                <button
                  key={c.etiqueta}
                  className={`pf-chip${c.completa ? "" : " incompleta"}`}
                  onClick={() => tocarChip(c)}
                >
                  {c.etiqueta}
                </button>
              ))}
            </div>
            {/*
              Estas pastillas son el ÚNICO camino de un toque al arranque caliente para alguien que
              llega solo con un enlace: si teclea su propio nombre no aparece como afiliado y solo ve el
              camino genérico, así que nunca llega al diferencial. Por eso van visibles siempre.

              Lo que sí sobraba era la etiqueta: decía "Prueba con uno de la base:", que le confiesa
              a quien mira que esto es un demo, en el primer frame y antes de haber demostrado nada
              (#27). Ahora se enmarcan como lo que de verdad son — una demostración honesta del
              producto con alguien que sí está afiliado.
            */}
            <div className="pf-ejemplo demo">
              <span className="pf-ejemplo-lbl">{INVITACION_EJEMPLO}</span>
              <div className="pf-ejemplo-row">
                {PERSONAS_DEMO.map((p) => (
                  <button key={p.n} className="pf-persona" onClick={() => startPersona(p)}>{p.n}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {suggestions.length > 0 && !locked && (
          <div className="qr-row">
            {suggestions.map(chipDeOpcion).map((c) => (
              <button
                key={c.etiqueta}
                className={`quick${c.completa ? "" : " incompleta"}`}
                onClick={() => tocarChip(c)}
              >
                {c.etiqueta}
              </button>
            ))}
          </div>
        )}

        {activeForm && <DataForm data={activeForm} onSubmit={submitForm} />}
        {/*
          UN indicador, no dos. `busy` y `processing` eran verdaderos a la vez, así que se veían
          simultáneamente la tarjeta de pasos y el "Amparito está escribiendo…" (#32).
        */}
        {indicadorDeEspera(busy, !!processing) === "pasos" && <ProcessingCard variant={processing!} />}
        {indicadorDeEspera(busy, !!processing) === "escribiendo" && (
          <div className="typing">Amparito está escribiendo…</div>
        )}
        <div ref={endRef} />
      </div>

      {!activeForm && (
        <div className="inputbar" ref={barraRef}>
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

/**
 * Lo que escribe Amparito, con la poca jerarquía que se le permite.
 *
 * Hasta ahora el texto salía como una cadena pelada: `{item.text}`. Y el servidor, además, borraba
 * las negritas y las viñetas antes de mandarlo. Entre las dos cosas, cada mensaje era un bloque
 * donde todo pesaba lo mismo — incluidos los que más peso tienen: por qué este seguro y no otro,
 * qué NO cubre.
 *
 * Construye NODOS, no HTML: no hay `dangerouslySetInnerHTML` por ninguna parte. Lo que llega ya
 * viene normalizado y con el énfasis topado en servidor (`MAX_ENFASIS`), así que aquí no se decide
 * nada — se pinta.
 */
function TextoDeAmparito({ texto }: { texto: string }) {
  const lineas = texto.split("\n");
  const bloques: Array<{ tipo: "p" | "ul"; lineas: string[] }> = [];
  for (const l of lineas) {
    const tipo = esVinieta(l) ? "ul" : "p";
    const ultimo = bloques[bloques.length - 1];
    // Las viñetas seguidas se agrupan en una sola lista; los párrafos van sueltos.
    if (ultimo && ultimo.tipo === "ul" && tipo === "ul") ultimo.lineas.push(l);
    else bloques.push({ tipo, lineas: [l] });
  }

  const pinta = (l: string, k: number) =>
    trozosDe(l).map((t, i) => (t.fuerte ? <strong key={i}>{t.texto}</strong> : <span key={i}>{t.texto}</span>));

  return (
    <>
      {bloques.map((b, i) =>
        b.tipo === "ul" ? (
          <ul className="msg-lista" key={i}>
            {b.lineas.map((l, j) => <li key={j}>{pinta(textoDeVinieta(l), j)}</li>)}
          </ul>
        ) : (
          <p className="msg-p" key={i}>{b.lineas.map((l, j) => pinta(l, j))}</p>
        )
      )}
    </>
  );
}

/* ===== Pantalla de transición ===== */
function ProcessingCard({ variant }: { variant: "emision" | "reco" }) {
  const SETS: Record<string, string[]> = {
    emision: ["Validando tu información…", "Consultando con la aseguradora…", "Personalizando tu cobertura…", "Generando tu certificado…"],
    /*
     * Los pasos son los REALES del motor, y por eso valen: no son relleno. Pero se dicen desde lo
     * que le pasa a la PERSONA, no desde la arquitectura.
     *
     * "Ordenando por propensión, de forma determinista" es una frase para un jurado técnico, no
     * para alguien que quiere saber qué lo protege. El producto que habla de su propio motor
     * mientras trabaja se parece a un mago explicando el truco a mitad.
     */
    reco: [
      "Leyendo lo que me contaste…",
      "Viendo qué te protege de verdad y qué no…",
      "Dejando fuera lo que hoy no te conviene…",
      "Ordenando por lo que más te cuida…",
      "Preparando el porqué de cada una…",
    ],
  };
  const steps = SETS[variant];
  /*
   * El subtítulo decía "Motor de propensión explicable · reglas que puedes auditar, no una caja
   * negra". Es el producto narrando su propia ingeniería dentro de la conversación (#31). La
   * explicabilidad NO se anuncia: está a un clic, en la traza, y ahí se comprueba. Anunciarla
   * mientras se espera es pedir que se confíe en vez de mostrar.
   */
  const sub = variant === "reco"
    ? "Vas a poder ver por qué, punto por punto."
    : "Estamos preparando tu solicitud con el respaldo de Colsubsidio.";
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
/**
 * Qué trae ya escrito el formulario, y de dónde salió.
 *
 * Nacía VACÍO por construcción —`useState({ nombre: "", ... })`— incluso para alguien a quien
 * Amparito acababa de reconocer y saludar por su nombre. El pitch del producto dice que "lo
 * acompaña hasta completar el proceso" y aquí le entregaba una hoja en blanco.
 *
 * SOLO EL NOMBRE, y conviene decirlo sin adornos: la base de afiliados tiene nombre, género, rango
 * de edad, categoría, grupo familiar y ciudad. NO tiene documento, ni fecha de nacimiento, ni
 * celular, ni correo. Prellenar esos cuatro sería inventarse una capacidad que Colsubsidio no nos
 * ha dado — la misma disciplina del sello de simulación.
 */
export function prellenado(conocido?: { nombre?: string; origen?: string }): Partial<Contacto> {
  return conocido?.nombre ? { nombre: conocido.nombre } : {};
}

/** De dónde salió lo que ya está escrito, para no atribuirle a Colsubsidio lo que dijo la persona. */
export const ETIQUETA_PRELLENO: Record<string, string> = {
  base: "de tu afiliación",
  declarado: "lo dijiste tú",
};

function DataForm({ data, onSubmit }: { data: any; onSubmit: (c: Contacto) => void }) {
  const conocido = data?.conocido as { nombre?: string; origen?: string } | undefined;
  const [f, setF] = useState<Contacto>({
    nombre: "", tipoDocumento: "CC", numeroDocumento: "", fechaNacimiento: "", celular: "", correo: "",
    ...prellenado(conocido),
  });
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
        <p>{conocido?.nombre ? "Ya escribí lo que sabía de ti. Falta lo demás." : "Es rápido. Con esto emitimos tu póliza al instante."}</p>
      </div>
      <label>
        Nombres y apellidos completos
        {/* Prellenado pero EDITABLE: el nombre de la base puede venir en mayúsculas o con una tilde
            distinta, y este dato acaba en un documento legal. Se ofrece hecho, no impuesto. */}
        {conocido?.nombre && (
          <span className="df-origen">{ETIQUETA_PRELLENO[conocido.origen ?? "declarado"]}</span>
        )}
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
  const resto = recs.slice(1);

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
          {/*
            El panel explicaba SOLO el #1 y abajo aparecían dos tarjetas: se leía como si hubiera
            una recomendación y luego salieran dos. Nombrar la segunda cuesta una línea y cierra la
            distancia entre lo que el panel dice y lo que la pantalla muestra.
          */}
          {resto.length > 0 && (
            <p className="pp-tambien">
              Y también, en segundo lugar: <b>{resto.map((r) => r.nombre).join(", ")}</b>.
            </p>
          )}
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

      {/*
        PeerProof — el mismo dato verificado, con otro destinatario.
        Decía: "No estás solo: hay 62.459 afiliados en tu mismo segmento (mujeres, 36 a 45,
        monoparental, categoría A)". Dos problemas a la vez. Uno, el prompt le PROHÍBE al modelo
        recitar el segmento como ficha de datos —"nada de mujer, 36 a 45, categoría A"— y este copy,
        quemado en el cliente, lo hacía igual: la regla se le exigía al LLM y la rompía el código.
        Dos, a quien va a pagar no le consuela que le digan que es un renglón de una tabla.
        El número sigue siendo oro, pero respalda el MÉTODO: que esto no es una corazonada.
      */}
      {peer && peer.n > 0 && (
        <div className="pp-peer">
          No es una corazonada: lo calculé sobre el perfil de <b>{peer.n.toLocaleString("es-CO")}</b>{" "}
          afiliados en tu misma situación, con reglas que se pueden revisar.
        </div>
      )}

      {/* Traza auditable (RNF-6): "inspeccionable en pantalla — no caja negra". Es lo que convierte
          "confía en mí" en "míralo": el perfil que entró con la procedencia de cada campo, las
          reglas que aplicaron con su peso, y la versión del scorecard con la que se decidió. */}
      {traza && <TrazaDecision traza={traza} />}

      {/*
        Aquí vivía "Por qué NO te recomendé lo demás", abierta por defecto. Era la TERCERA copia del
        mismo motivo en la misma pantalla: está en la traza (para auditar) y tiene que estar en lo
        que Amparito DICE (es uno de los cuatro NO, y el material se lo entrega el motor desde 5g).
        Una tercera en la UI no añadía nada y encima quedaba fuera del rótulo de demo, así que un
        bloque claramente técnico se leía como parte del producto.

        El NO honesto no es una sección de pantalla: es algo que se dice.
      */}
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
    /** Por qué NO entró, cuando el motor tiene un motivo escrito. */
    motivo?: string;
    senales: Array<{ feature: string; razon: string; peso: number }>;
  }>;
}

/*
 * La traza dejó de leer la estructura interna del motor (#28). Todo lo que aquí se pinta pasa por
 * `lib/ui/traza.ts`, que es puro y tiene gate: un campo nuevo del motor sale legible sin que nadie
 * tenga que acordarse de traducirlo, y `(vacío)` ya no puede llegar a la pantalla.
 */
/**
 * El orden de la traza es el de lo que PASÓ, no el del puntaje.
 *
 * Antes encabezaba el de mayor score, que muchas veces es un descarte: en un flujo real lo primero
 * que veía quien auditaba era "Seguro de Arrendamiento · 30", un producto que no se recomendó y
 * con una razón que a esa persona no le aplicaba.
 */
const ORDEN_RESULTADO: Record<string, number> = {
  recomendado: 0,
  obligatorio: 1,
  ya_cubierto: 2,
  descartado: 3,
  fuera_del_top: 4,
};

function TrazaDecision({ traza }: { traza: TrazaData }) {
  const origen = (traza.perfil?._origen ?? {}) as Record<string, string>;
  const campos = Object.entries(traza.perfil ?? {}).filter(([k]) => k !== "_origen" && k !== "enriquecido");
  const enr = Object.entries((traza.perfil?.enriquecido ?? {}) as Record<string, unknown>);
  const filas: Array<[string, unknown]> = [
    ...campos,
    ...enr.map(([k, v]) => [`enriquecido.${k}`, v] as [string, unknown]),
  ];

  return (
    <details className="tz demo">
      {/*
        EL RÓTULO VA EN EL RESUMEN, no dentro.
        Primero lo puse debajo del summary, y eso lo hacía inútil: solo se leía DESPUÉS de abrirlo,
        que es justo cuando ya no hace falta. Plegado se leía "Ver cómo llegué a esto", que suena a
        función del producto — exactamente lo contrario de lo que hay que decir. Quien mira la
        pantalla tiene que saber que esto es instrumentación de la demo SIN tener que abrirla.
      */}
      <summary className="tz-sum">Cómo llegué a esto · el detalle del cálculo</summary>
      <p className="tz-para-quien">
        Instrumentación para evaluar la demostración. En producción esto no se le muestra a la
        persona: quien compra un seguro no necesita ver los pesos del motor.
      </p>

      <div className="tz-lbl">Lo que supe de ti, y de dónde lo supe</div>
      <ul className="tz-perfil">
        {filas.map(([k, v]) => {
          const org = origen[k] ?? "";
          return (
            <li key={k}>
              <span className="tz-campo">{etiquetaDeCampo(k)}</span>
              <span className="tz-valor">{valorLegible(v)}</span>
              <span className={`tz-org ${org}`}>{ETIQUETA_ORIGEN[org] ?? SIN_PROCEDENCIA}</span>
            </li>
          );
        })}
        {filas.length === 0 && <li>No tenía ningún dato tuyo.</li>}
      </ul>
      <p className="tz-nota">
        Lo que vino <b>de la base</b> de Colsubsidio o <b>lo dijiste tú</b> está verificado. Lo que{" "}
        <b>se dedujo</b> puede mover el orden, pero no habilita ninguna afirmación sobre la base de
        afiliados — por eso la prueba social exige los cuatro ejes verificados.
      </p>

      <div className="tz-lbl">Las reglas que aplicaron, y cuánto pesó cada una</div>
      <div className="tz-tabla">
        {/*
          Ordenado por lo que PASÓ, no por puntaje. Antes encabezaba el de mayor score, que muchas
          veces es un descarte: lo primero que veía quien auditaba era un producto que no se
          recomendó, con una razón que no aplicaba.
        */}
        {traza.productos
          .filter((p) => p.senales.length > 0)
          .slice()
          .sort((a, b) => (ORDEN_RESULTADO[a.resultado] ?? 9) - (ORDEN_RESULTADO[b.resultado] ?? 9))
          .map((p) => (
          <div className="tz-prod" key={p.id}>
            <div className="tz-prod-top">
              <b>{p.nombre}</b>
              <span className="tz-score" title={sumaDelPuntaje(p) ?? undefined}>{p.score}</span>
              <span className={`tz-res ${p.resultado}`}>{ETIQUETA_RESULTADO[p.resultado] ?? p.resultado}</span>
            </div>
            <ul>
              {p.senales.map((s, i) => (
                <li key={i}>
                  <span className="tz-peso">{s.peso > 0 ? `+${s.peso}` : s.peso}</span>
                  <span className="tz-razon">{s.razon}</span>
                  <span className="tz-campo-min">{etiquetaDeCampo(s.feature)}</span>
                </li>
              ))}
            </ul>
            {/* El puntaje deja de ser un número mágico: es la suma de lo que está arriba, y se
                puede verificar a ojo. Solo se afirma cuando de verdad cuadra. */}
            {sumaDelPuntaje(p) && <div className="tz-suma">{sumaDelPuntaje(p)}</div>}
            {p.motivo && <div className="tz-motivo">{p.motivo}</div>}
          </div>
        ))}
      </div>

      <div className="tz-lbl">Decisiones del motor</div>
      <ul className="tz-meta">
        <li>{explicaGate(traza.gate_asequibilidad)}</li>
        <li>
          {traza.jerarquia_aplicada
            ? "Primero lo que reemplaza tu ingreso, aunque otro producto puntúe más alto."
            : "El orden es el del puntaje: no hizo falta moverlo."}
        </li>
        <li>
          {traza.peer.afirmada ? "Prueba social afirmada" : "Prueba social NO afirmada"}:{" "}
          {traza.peer.motivo}
        </li>
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
function EventCard({ event, onPagar }: { event: UiEvent; onPagar?: () => void }) {
  // El tipo compartido declara `data: Record<string, unknown>`, que es lo correcto en el
  // servidor. Aquí se relaja a propósito y en UN solo punto: estas tarjetas leen el payload
  // crudo de cada tool, y darle un tipo real a cada uno es parte de construir la capa de
  // presentación que hoy no existe — hoy la estructura interna del motor ES el view-model, y
  // eso es trabajo del bloque 4 (#28), no de este paso.
  const d = event.data as Record<string, any>;

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
          // Una sola fuente: el mismo sello que firma el cierre y contra el que se contrasta el
          // video. Estaba escrito aquí a mano y no tenía forma de enterarse si el otro cambiaba.
          <p className="pc-sim-note">{AVISO_SIMULACION}</p>
        )}
      </div>
    );
  }

  if (event.type === "pago") {
    const prima = typeof d.prima === "number" ? d.prima : null;
    return (
      <div className="pagocard">
        <div className="rotulo-pago">Pago · PSE o tarjeta</div>
        <div className="pg-linea">
          <span>{String(d.producto ?? "Tu seguro")} · primer mes</span>
          {/* Si el adaptador no supo leer la cotización, se muestra el paso SIN importe en vez de
              inventarlo. Un número equivocado en una pantalla de pago es peor que ningún número. */}
          <b>{prima !== null ? `$${prima.toLocaleString("es-CO")}` : "—"}</b>
        </div>
        {/* El sello va ENCIMA del botón, no debajo: nadie debe poder tocarlo creyendo que se le
            cobra. Debajo se lee después de haber decidido. */}
        <p className="pg-sello"><span className="sello-sim">{AVISO_PAGO_SIMULADO}</span></p>
        <button className="pg-btn" onClick={onPagar} disabled={!onPagar}>
          {prima !== null ? `Pagar $${prima.toLocaleString("es-CO")} →` : "Continuar →"}
        </button>
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
