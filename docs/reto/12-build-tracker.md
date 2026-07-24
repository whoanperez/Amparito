# 12 — Build tracker (Amparito+) · el QUÉ, el CÓMO y el control

> **Documento vivo de ejecución.** El QUÉ (qué construimos) y el CÓMO (cómo lo construimos), con un
> checklist por bloque y una bitácora al final. Se actualiza en cada avance. Deriva del
> [guion](./07-guion-demo.md), el [PRD](./08-prd.md) y el [contrato de tools](./11-contrato-tools.md).
> Estados: ⬜ pendiente · 🔨 en curso · ✅ hecho · ⏸️ pospuesto.

## Contexto de trabajo (decidido)
- **Somos autónomos**, en la rama `feature/amparito-plus`. Sin coordinar con terceros, sin cronograma de
  hackathon. Decidimos y construimos nosotros. (El "contrato para Juan" queda como registro de diseño.)
- **Alcance v1:** Bloques **1 + 2 + 3**. La **voz (Bloque 4) se pospone** a una segunda pasada.
- **Orden de construcción:** **motor primero (de adentro hacia afuera).** Validamos el 25% por API con
  las 3 personas del guion **antes** de montar UI.
- **Regla de oro (guardrail):** el **motor calcula**, el **LLM redacta** los reason codes. El LLM nunca
  inventa prima, cobertura ni razón fuera de las que da el motor.
- **PII:** cero. Todo corre sobre `data/*.json` derivados sin PII.

## El QUÉ — los 4 injertos sobre Amparito
Amparito ya trae (reuso, no tocamos): flujo end-to-end, cotización determinista, catálogo vivo,
cumplimiento en servidor → eso ya cubre **Flujo 20%**. Nosotros construimos el 45% diferencial:

| Bloque | Qué | Peso | Estado |
|---|---|:--:|:--:|
| **1** | Motor de propensión explicable (scorecard → ranking + reason codes + descartados) | **25%** | ✅ |
| **2** | Capa visual del porqué (`PropensionCard`: WhyThis · GapsLedger · PeerProof · Descartados) | **15%** + | ✅ |
| **3** | Pull-first + anti-venta (entrada tappable + "te digo que NO" visible) | **20%**+**20%** | ✅ |
| **4** | Voz Gemini Live (construida, **detrás de flag APAGADO**) | bonus | ✅🔒 |

---

## CÓMO · Bloque 1 — Motor de propensión (empezamos aquí)

**Enfoque:** motor puro y determinista en `lib/engine/`, testeado con 3 fixtures (las personas del
guion) por consola/API, antes de tocar UI. Reemplaza el matcher de `lib/catalog.ts` en el flujo de
recomendación (convive con `recommend_products` como fallback).

**Contrato de entrada — `Perfil` estructurado** (los namespaces salen de `weights.json`):
```ts
interface Perfil {
  GENERO?: "F" | "M";
  RANGO_EDAD?: string;               // "20 a 35 años" | "36 a 45 años" | "Mayor de 55 años" | ...
  CATEGORIA?: "A" | "B" | "C" | "";
  SEGMENTO_GRUPO_FAMILIAR?: string;  // "Monoparental" | "Nuclear integral" | "Pareja conyugal" | "Sin grupo familiar" | ...
  SEGMENTO_POBLACIONAL?: string;     // "Alto" | "Medio" | "Bajo"
  enriquecido?: {                    // de la conversación
    dependientes?: number; tiene_vehiculo?: string[]; tiene_mascota?: string[];
    vivienda?: "propia" | "arriendo"; necesidad_salud?: boolean; viaja?: boolean;
    tiene_credito?: boolean; mascota_veterinario_frecuente?: boolean;
  };
  marca?: Record<string, "SI" | "NO">;  // DROGUERIA, VIVIENDA, AGENCIAS, HOTELES, PISCILAGO (~10% la tiene)
  ya_cubierto?: string[];            // ["exequial","vida","soat",...] → dispara redundancia + ledger + anti-venta
}
```

**Algoritmo** (por cada producto en `weights.productos`):
1. Sumar `peso` de cada `señal` que aplica; matchers: `en` (∈ lista / intersección si el feature es
   array), `op`+`valor` (numérico), `es` (igualdad, `true` o `"SI"`). Recolectar su `razon` → reason codes.
2. Señales `prior.*` siempre aplican su peso (tasa base), marcadas como *prior* + fuente.
3. `redundancia`: si `ya_cubierto` incluye `si_tiene` → suma el peso (−100) y marca el producto como
   **ya cubierto** (sale de recomendaciones, entra al `ledger.ya_cubierto` = anti-venta).
4. Gate de asequibilidad por `CATEGORIA`: cat A → prioriza prima baja (desempate) + activa framing
   "desde $X al día". Productos `requiere_asesoria: true` → se marcan (no cierran solos; escalan).
5. Ordenar por score desc. Top 2 con score>0 → `recomendaciones`. Los demás con señal → `descartados`
   con `motivo`.

**Contrato de salida — `PropensionResult`** (única fuente de verdad; el LLM lo verbaliza):
```ts
interface PropensionResult {
  recomendaciones: Array<{ id; nombre; aseguradora; linea; score; reason_codes: string[]; requiere_asesoria }>;
  descartados: Array<{ id; nombre; motivo }>;
  ledger: { riesgos_hoy: string[]; ya_cubierto: Array<{ producto; via; razon }> };
  peer?: { fraccion: string; descripcion: string; n: number; pct: number; accion: string };
}
```
- `riesgos_hoy` = reason codes del #1 (las exposiciones que justifican la recomendación).
- `peer` = lookup en `base_stats.peer_groups.celdas` (194 celdas por GÉNERO×EDAD×GRUPO_FAMILIAR×CATEGORÍA)
  → `n` y `pct` reales del segmento. (Ej. Carolina: F·36-45·Monoparental·A.)

**Archivos:**
- `lib/engine/types.ts` — `Perfil`, `PropensionResult`, tipos de señal.
- `lib/engine/scorecard.ts` — `calcularPropension(perfil): PropensionResult` (motor puro).
- `lib/engine/peer.ts` — lookup de peer-group en `base_stats`.
- `lib/engine/fixtures.ts` — las 3 personas del guion como `Perfil` (Andrés/Carolina/Jaime).
- `lib/tools.ts` — nueva tool `calcular_propension` + `event.type` `"propension"` + `UiEvent` union.
- `lib/prompts.ts` — Estado 3 usa `calcular_propension` (deja `recommend_products` como fallback).
- `scripts/test-propension.ts` — corre las 3 fixtures e imprime el resultado (gate de validación).

**Checklist Bloque 1:** ✅ COMPLETO
- [x] 1.1 · `lib/engine/types.ts` (Perfil + PropensionResult)
- [x] 1.2 · `lib/engine/scorecard.ts` (motor: señales, redundancia, gate, ranking, descartados)
- [x] 1.3 · `lib/engine/peer.ts` (peer-group lookup)
- [x] 1.4 · `lib/engine/fixtures.ts` (3 personas)
- [x] 1.5 · `scripts/test-propension.ts` + correrlo → **GATE OK** (las 3 personas cumplen)
- [x] 1.6 · tool `calcular_propension` en `lib/tools.ts` + `UiEvent` `"propension"`
- [x] 1.7 · `lib/prompts.ts` Estado 3 → `calcular_propension` (+ verbaliza anti-venta si hay ya_cubierto)
- [x] 1.8 · `npx tsc --noEmit` limpio (tras `npm install`)

---

## CÓMO · Bloque 2 — Capa visual del porqué  ✅ COMPLETO
`PropensionCard` en `components/Chat.tsx` renderiza `event.type === "propension"` con 4 sub-bloques:
**WhyThis** (✓ + reason_codes del #1) · **GapsLedger** (2 columnas riesgos_hoy vs ya_cubierto) ·
**PeerProof** (peer.n/pct/descripcion — framing honesto "hay N como tú") · **Descartados** (`<details>`).
Estilos `.propcard/.pp-*` en `app/globals.css` reusando los tokens del diseño.
- [x] 2.1 · `PropensionCard` (4 sub-bloques) · [x] 2.2 · estilos · [x] 2.3 · enganche (via `EventCard`, el loop ya lo empuja)

## CÓMO · Bloque 3 — Pull-first + anti-venta  ✅ COMPLETO
Entrada `pullfirst` en `Chat.tsx` (reemplaza el bloque `starters`): tarjetas grandes "¿Qué quieres
proteger?" 👪🏍️🐶🏠💳✈️ + "Prefiero contarte con mis palabras". Anti-venta visible = columna
`ya_cubierto` (verde) del GapsLedger + Descartados + verbalización en el prompt (Estado 3).
- [x] 3.1 · entrada pull-first (`PROTEGER` + `.pf-*`) · [x] 3.2 · anti-venta como momento visible

## Arranque caliente por afiliado (el foso) — usa la base real, sin filtrar nombres
Cuando un afiliado se identifica (por **nombre + ciudad**, porque nadie conoce su SERIE), Amparito busca
su **segmento real** y arranca caliente ("veo que eres cabeza de hogar con un hijo, ¿es así?"), saltándose
preguntas. **Siempre opcional:** sin identificarse, todo sigue por el flujo conversacional (default completo).
- `lib/afiliados/gateway.ts` (contrato `lookup(nombre,ciudad)→segmento` + `norm`) · `local-adapter.ts`
  (sample sintético `data/afiliados_muestra.json`, dev) · `turso-adapter.ts` (Turso, deploy) · `index.ts`
  (elige por `TURSO_DATABASE_URL`).
- `/api/chat` acepta `afiliado {nombre,ciudad}` → busca **en el servidor** (los nombres nunca llegan al
  navegador) → inyecta el segmento como contexto de arranque caliente.
- UI: entrada "Soy afiliado" (nombre+ciudad) en el pull-first. `scripts/load-afiliados.ts` carga TODA la
  base a Turso (nombre+ciudad+segmento, bota el resto; índice por nombre). `.env.local.example` documenta Turso.
- **Datos/PII:** el índice tiene nombres → vive local (sample sintético) o en Turso (acceso solo-backend,
  temporal, coordinado con Colsubsidio). Nunca al repo público. La base se **consulta**, no se embebe.
- **Verificado:** lookup local OK (Carolina por nombre con/sin tildes), tsc + build limpios. Turso: a validar
  al crear la BD (código listo).

## Bloque 4 — Voz Gemini Live, 100% detrás de un feature flag APAGADO  ✅🔒 (construido, sin validar en vivo)
**Decisión (usuario):** Gemini Live (voz real-time de Google), como en los docs. Gemini es el cerebro de
voz, configurado con nuestro system prompt + las mismas tools (function calling) → mismas capacidades que
el chat. **Prime directive: no dañar nada.** Flag apagado (default) ⇒ comportamiento byte-idéntico; el
chat Haiku, `/api/chat`, `/api/issue` y el motor NO se tocan.

**Arquitectura (resuelve 2 restricciones reales):**
- **Vercel no soporta WS server** → el navegador se conecta **directo** a Gemini Live (WSS de Google).
- **No exponer la key** → tokens efímeros: `/api/live-token` mintea un token corto con `GEMINI_API_KEY`
  (server-only, NO `NEXT_PUBLIC`); el cliente se conecta con el token. Seguro + Vercel-compatible.
- Las **function calls** de Gemini se ejecutan vía `/api/tool` (stateless) que reusa `executeTool` — misma
  fuente de verdad que el chat (sin duplicar lógica de producto/motor). Los eventos (tarjetas) se reusan.

**CÓMO (todo aditivo y gated):**
- `lib/flags.ts` — `voiceEnabled = process.env.NEXT_PUBLIC_VOICE_ENABLED === "true"` (OFF por defecto).
- `lib/voice/geminiTools.ts` — mapea `toolDefinitions` (formato Anthropic) → `functionDeclarations` (Gemini).
- `app/api/live-token/route.ts` — mintea token efímero (server, `GEMINI_API_KEY`). 404/disabled si flag off.
- `app/api/tool/route.ts` — POST stateless: corre `executeTool(name,input)` → `{result, event}`. Solo voz.
- `lib/voice/useGeminiLive.ts` — hook: fetch token → WS a Gemini Live → captura mic (PCM16 16kHz base64) →
  streaming → recibe audio (24kHz) + function calls → bridge a `/api/tool` → reproduce audio. **Inerte si
  `enabled=false`** (no conecta, no pide mic). Feature-detected, SSR-safe.
- `components/Chat.tsx` — botón de voz SOLO si `voiceEnabled`; transcript → items del chat; eventos → EventCard.
- `app/globals.css` — estilos del control de voz.
- `.env.local.example` — `ANTHROPIC_API_KEY` + `GEMINI_API_KEY` (server) + `NEXT_PUBLIC_VOICE_ENABLED=false`.

**Invariante de seguridad:** flag OFF ⇒ no se renderiza el control de voz, el hook no conecta ni pide micrófono,
las rutas `/api/live-token` y `/api/tool` responden deshabilitado. `next build` compila con el flag apagado;
gate del motor sigue OK. **No probable en vivo hasta tener `GEMINI_API_KEY` + `ANTHROPIC_API_KEY`** → se
valida al prender el flag.

**Checklist Bloque 4:**
- [x] V1 · `lib/flags.ts` (feature flag, OFF por defecto)
- [x] V2 · `lib/voice/geminiTools.ts` (tools Anthropic → Gemini functionDeclarations)
- [x] V3 · `app/api/tool/route.ts` (ejecuta executeTool; gated)
- [x] V4 · `app/api/live-token/route.ts` (token efímero; gated)
- [x] V5 · `lib/voice/useGeminiLive.ts` (hook: WS + audio + function-call bridge; inerte si off)
- [x] V6 · `components/Chat.tsx` (control de voz gated + transcript + eventos)
- [x] V7 · `app/globals.css` (estilos del control de voz)
- [x] V8 · `.env.local.example` (keys + flag)
- [x] V9 · docs (tracker + nota en el guion) + verificación (tsc + build flag OFF + gate + inercia) + commit

---

## RONDA 2 · Ajustes del panel de 3 expertos (UX · estrategia · rigor técnico)
Panel convocado 24-jul. Coincidencias fuertes (varios expertos): dato "8 de 10" inventado (honestidad),
anti-venta enterrada (momento wow), modo jurado frágil, prior mascotas para todos, poblacional roto.
Decisiones del usuario: contraste = versión ligera secuencial; extras = timing/canal + consolidar tarjeta.

**Tanda 1 · Rigor & honestidad**
- [x] R1 · Guion: quitar "8 de cada 10 eligieron" → prueba social = tamaño real del segmento (`07-guion-demo.md`)
- [x] R2 · PeerProof: guarda `n≥1000` en `peer.ts`; copy honesto (segmento, no tasa de compra) en la card
- [x] R3 · Prior mascotas: un producto con SOLO señales `prior.*` no entra al ranking ni a descartados (`scorecard.ts`)
- [x] R4 · Desempate determinista (prima → id) para todos, no solo cat A (`scorecard.ts`)
- [x] R5 · `SEGMENTO_POBLACIONAL`: enum real Básico/Medio/Joven/Alto (`types.ts`, `tools.ts` schema)

**Tanda 2 · Robustez modo jurado**
- [x] R6 · Guardas anti-crash: `getProduct` seguro en `scorecard.ts`; peer degrada sin romper (ya guardado)
- [x] R7 · Score 0 → el prompt pide 1 dato de enriquecimiento en vez de callar (`prompts.ts`)

**Tanda 3 · UX del demo**
- [x] R8 · Anti-venta a HÉROE: banner "✋ No te vendo X" fuera del colapsable + descartados abierto por defecto
- [x] R9 · Tipografía legible en la propcard (reason codes/ledger/peer/descartados ~14px)
- [x] R10 · Bajar spinners (reco 4s→2.5s, emisión 7s→3s) (`Chat.tsx`)

**Tanda 4 · Extras (aprobados)**
- [x] R11 · Consolidar tarjeta: quitar la duplicación (reason codes en la propcard; RecommendCards = solo selección)
- [x] R12 · Momento timing/canal: apertura proactiva por evento de vida (`?evento=` → Chat.tsx) + beat en el guion
- [x] R13 · Contraste ligero secuencial: reescribir el beat 1:35–2:05 del guion (Andrés→Carolina, "misma máquina")

**Gate Ronda 2:** ✅ `test-propension.ts` OK · `tsc` limpio · `next build` compila · dump confirma (Mascotas
fuera de descartados, peer con guarda n≥1000).

**Hallazgo RESUELTO (24-jul):** gate de posesión. Nuevo campo `requiere` en `weights.json` (tipo `Matcher[]`,
OR: basta una posesión) + filtro en `scorecard.ts`. Un producto que exige una posesión no se considera si
el perfil no la declara. Aplicado a Todo Riesgo Carro (carro), Hogar (vivienda propia|marca), Moto (moto),
Bici/Patineta (bici|patineta), Asistencias Múltiples (vivienda). Los boosters (poblacional, grupo familiar)
siguen aplicando solo entre quienes sí tienen la posesión. Verificado: descartados de las 3 personas ya no
muestran Carro/Hogar/Bici sin posesión; moto_asistencia sí aparece para Andrés (tiene moto). Gate + build OK.

---

## Gates de validación (cómo sabemos que va bien)
**Gate del motor (fin de Bloque 1)** — correr las 3 fixtures y confirmar:
- **Andrés** (28, moto, sin grupo familiar) → top = accidentes/movilidad; **Vida NO recomendada** (anti-venta 1).
- **Carolina** (39, monoparental, 1 hijo, cat A) → top = `vida_panamerican`; reason codes de sostén/dependientes; peer real (F·36-45·Monoparental·A).
- **Jaime** (58, pareja, `ya_cubierto:["exequial"]`) → `exequial` en `ledger.ya_cubierto` (anti-venta 2); Vida (incapacidad) recomendada.

**Gate de UI (fin de Bloque 2-3):** las 3 personas producen tarjetas visiblemente distintas end-to-end en el navegador.

---

## Bitácora (append-only — qué hicimos y cuándo)
- **24-jul-2026** — Arreglado el guion (Vida y Ahorro → productos reales). Escrito el contrato de tools.
  Consolidada la doc del reto en `docs/reto/` (sin PII, commit local `6dd8c17`). Cerrado el QUÉ y el CÓMO;
  creado este tracker.
- **24-jul-2026** — **Bloque 1 COMPLETO.** Motor `lib/engine/*` (types, scorecard, peer, fixtures) +
  `scripts/test-propension.ts` → **GATE OK** (Andrés: Vida NO / Carolina: Vida #1 + peer 62.459 real /
  Jaime: Exequial ya-cubierto). Tool `calcular_propension` + `UiEvent "propension"` en `lib/tools.ts`;
  `lib/prompts.ts` Estado 3 usa el motor y verbaliza anti-venta. `npm install` + `tsc --noEmit` limpio.
  Rigor: PeerProof reporta el tamaño REAL del segmento (no una fracción de compra inventada — la base no
  tiene etiqueta de compra).
- **24-jul-2026** — **Bloques 2 y 3 COMPLETOS.** `PropensionCard` (WhyThis+GapsLedger+PeerProof+Descartados)
  + estilos `.propcard/.pp-*`; entrada pull-first `.pf-*` que reemplaza los starters; anti-venta visible en
  la columna "Ya cubierto" + prompt. `npx tsc --noEmit` limpio y **`npm run build` compila** (7 páginas).
  Sin API key en el entorno → validación conversacional en vivo queda para el usuario con su key; se dejó un
  **review visual** (artifact) con la salida real del motor para las 3 personas. Scripts de apoyo:
  `scripts/test-propension.ts` (gate) y `scripts/dump-propension.ts` (export).
  **Alcance v1 (Bloques 1+2+3) COMPLETO.** Siguiente opcional: Bloque 4 (voz) o pulir personas/copys.
- **24-jul-2026** — **Fix del hallazgo** (gate de posesión) + **Bloque 4 (voz Gemini Live) CONSTRUIDO detrás
  de feature flag APAGADO.** Arquitectura: cliente↔Gemini directo (Vercel no soporta WS server), token
  efímero vía `/api/live-token` (key server-only), function-calls vía `/api/tool` (reusa `executeTool`),
  hook `useGeminiLive` (SDK `@google/genai` en dynamic import → fuera del bundle si el flag está off).
  Mismas tools + prompt que el chat (sin duplicar el cerebro). `.env.local.example` documenta las keys.
  Con el flag apagado: byte-idéntico al chat actual (verificado: tsc + build OK, botón no se renderiza,
  SDK no carga). **NO validado en vivo** — falta `GEMINI_API_KEY` + `ANTHROPIC_API_KEY`; se valida al prender.
- **24-jul-2026** — **RONDA 3 (2º panel de 3 expertos, con verificación web).** A) Cifras del pitch: el
  "0,24%" (no verificable) → "<2% de pólizas online" (Fasecolda/La República); 34% atribuido a Fasecolda;
  nota de fuentes citables en el guion. B) **Voz Gemini corregida contra la doc vigente:** modelo default
  `gemini-2.5-flash-native-audio-preview-12-2025` (el 2.0 se apagó 1-jun-2026), `apiVersion` v1beta (el
  token efímero lo exige), token vía SDK `authTokens.create` con `liveConnectConstraints`, guarda de
  mismo-origen en `/api/live-token` y `/api/tool`, comentario Vercel corregido (sí soporta WS). C) Encuadre
  regulatorio: disclaimer con Ley 1328 Art.9 + 1581 + SARLAFT vinculación simplificada + rol comercializador;
  nota de munición regulatoria en el guion. D) Modo jurado: selector de personas (Andrés/Carolina/Jaime) en
  `/chat` + spinners convertidos en "teatro de explicabilidad" (pasos reales del motor). tsc + gate + build OK.
  Veredicto del panel: **proyecto de podio**; los flancos de cifras quedaron cerrados.
- **24-jul-2026** — **Modo demo offline (RNF-1) — la última pieza de desarrollo.** `/chat?offline=1` (o
  auto-fallback si la API en vivo falla) reproduce las 3 personas end-to-end **sin red**: las frases de
  Amparito son guionizadas (`lib/demo/scripts.ts`) pero las tarjetas (propensión, cotización, póliza+cert)
  las produce `executeTool` en LOCAL — mismo motor + gateway mock del vivo, cero duplicación. Player en
  `lib/demo/player.ts` (dynamic import → fuera del bundle normal). `import type Anthropic` en tools.ts saca
  el SDK del cliente. En modo normal (`/chat`) todo idéntico. Verificado: `scripts/test-offline.ts` →
  propensión+cotización+póliza OK; tsc + build limpios. **Todo el desarrollo del alcance está COMPLETO.**
- **24-jul-2026** — **Panel de comportamiento (3 expertos + web) → Tier 1 "hacer sentir la protección".**
  El equipo de seguros pidió menos tecnificación, más emoción, y reframe "gasto→protección". Los 3 expertos
  convergen: la aversión a la pérdida fija el foco en la PRIMA (pérdida presente), no en el patrimonio; el
  giro es mover el foco a **el ingreso familiar**. Construido: (1) **calculadora de impacto de ingreso** —
  `lib/engine/impacto.ts` + tool `calcular_impacto_ingreso` + `UiEvent "impacto"` + `ImpactoCard` (cálida,
  cuidado no miedo, con nota de referencia y control del usuario); (2) **reframe en `prompts.ts`**: regla de
  gasto→protección ("menos que un tinto al día"), resumen emocional antes del consentimiento, consentimiento
  como "confirmar tu protección", framing de cuidado. Se añadió el beat de impacto al guion offline de
  Carolina (el momento emocional del demo). tsc + gates (motor + offline con impacto) + build OK.
  Docs C4 (markdown+HTML) también en el repo. (PR #1 MERGEADO a main; Tier 1 en PR #2.)
- **24-jul-2026** — **Tier 2 "quitar el miedo a la letra menuda + hablar como cada generación".**
  (1) **Tono adaptativo por generación** en `prompts.ts` (sección 2b): detecta señales de lenguaje y ajusta
  registro/ejemplos/calidez sin preguntar la edad (<30 informal+anécdota; 30-45 aspiracional; +50 cálido+
  respaldo+ofrecer asesor). (2) **Disclosure en 3 capas** en la tarjeta de cotización: síntesis "cubre/no
  cubre" SIEMPRE visible (cumple Art.9) + "Ver términos completos" colapsado (antes todo abierto). (3) **Botón
  "Que me llame un asesor"** en el encabezado (reusa escalate_to_human) — puente híbrido para la desconfianza
  de +50. tsc + gates + build OK. Todo en la rama del PR #2.
- **24-jul-2026** — **RONDA 2 COMPLETA** (ajustes del panel de 3 expertos, 13 tareas R1–R13). Rigor: guion
  sin el "8 de 10" inventado + prueba social = tamaño real; PeerProof con guarda n≥1000; prior de mascotas
  ya no rankea solo; desempate determinista; `SEGMENTO_POBLACIONAL` alineado a la base. Robustez: guardas
  anti-crash; score 0 pide 1 dato. UX: **anti-venta a HÉROE** (banner oscuro), tipografía a 14px, spinners
  4s→2.5s / 7s→3s, tarjeta de recomendación sin duplicar el porqué. Extras: **momento proactivo**
  (`?evento=credito_vivienda`/`bebe`) + contraste secuencial en el guion. Gate OK, tsc limpio, build compila.
