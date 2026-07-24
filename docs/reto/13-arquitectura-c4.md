# 13 — Arquitectura C4 · Amparito base (v1) → Amparito+ (v2)

> Documenta la arquitectura en el modelo **C4** (Contexto → Contenedor → Componente) comparando la
> **primera versión** de Amparito (el MVP base, matcher por palabras clave) con la **versión resultante**
> tras los cambios de esta rama (`feature/amparito-plus`). Versión visual: `docs/reto/arquitectura-c4.html`.
> Convención: **gris = ya existía (base v1)** · **azul = nuevo o modificado en Amparito+ (v2)**.

## En una frase
**v1 (base):** un chat con Claude Haiku que recomienda por **coincidencia de palabras clave** y cierra la
venta end-to-end (cotiza, cumplimiento Art. 9, certificado mock). **v2 (Amparito+):** el mismo flujo, pero
la recomendación la produce un **motor de propensión explicable** (scorecard sobre datos reales), se hace
**visible el porqué** (capa de tarjetas), se agrega **entrada pull-first + anti-venta**, **voz Gemini Live**
(tras feature flag apagado) y un **modo demo offline**. El backend del chat no se rompió: todo es aditivo.

---

## C4 — Nivel 1 · Contexto del sistema
```mermaid
flowchart TB
  afiliado["👤 Afiliado / No afiliado<br/>(quiere un seguro)"]
  jurado["⚖️ Jurado del hackathon<br/>(recorre el demo solo)"]
  amparito(("🛡️ Amparito+<br/>venta automatizada<br/>de seguros"))
  haiku["🤖 Claude Haiku<br/>Anthropic · conversa y orquesta"]
  gemini["🎙️ Gemini Live<br/>Google · voz en tiempo real"]
  aseg["🏢 Aseguradoras aliadas<br/>(integración mockeada)"]
  sheets["📄 Google Sheets<br/>captura de leads"]

  afiliado --> amparito
  jurado --> amparito
  amparito -->|function calling| haiku
  amparito -.->|tras feature flag| gemini
  amparito -->|cotiza / emite| aseg
  amparito -->|persiste sin PII| sheets

  classDef base fill:#eef1f5,stroke:#9aa3b2,color:#1d1d1f;
  classDef nuevo fill:#dbeafe,stroke:#0067b1,color:#00344f,stroke-width:2px;
  class afiliado,haiku,aseg,sheets base;
  class jurado,gemini,amparito nuevo;
```
*Nuevo en v2:* el actor **Jurado** (modo autogestión) y el sistema externo **Gemini Live** (voz, apagada por defecto).

---

## C4 — Nivel 2 · Contenedores
```mermaid
flowchart TB
  subgraph cliente["Navegador"]
    ui["Chat UI + Landing<br/>(Next.js / React)"]
  end
  subgraph server["Next.js — API routes"]
    chat["/api/chat<br/>orquestador tool-use"]
    issue["/api/issue<br/>emisión"]
    tool["/api/tool<br/>bridge de tools (voz)"]
    token["/api/live-token<br/>token efímero Gemini"]
  end
  subgraph logica["Lógica (lib/)"]
    base_lib["catalog · tools · prompts<br/>insurer(mock) · sheets"]
    engine["engine/ · motor de propensión"]
    voice["voice/ · Gemini Live"]
    demo["demo/ · modo offline"]
    flags["flags"]
  end
  subgraph datos["Datos (JSON derivado, sin PII)"]
    cat["catalog.json"]
    prop["weights · base_stats · eventos_vida"]
  end

  ui --> chat --> base_lib
  ui --> issue
  ui -.voz.-> token
  ui -.voz.-> tool --> base_lib
  base_lib --> cat
  chat --> engine --> prop
  voice --> token
  demo --> base_lib

  classDef base fill:#eef1f5,stroke:#9aa3b2,color:#1d1d1f;
  classDef nuevo fill:#dbeafe,stroke:#0067b1,color:#00344f,stroke-width:2px;
  class ui,chat,issue,base_lib,cat base;
  class tool,token,engine,voice,demo,flags,prop nuevo;
```
*Base (v1):* `ui`, `/api/chat`, `/api/issue`, `catalog.json`, la lógica base y el gateway mock.
*Nuevo (v2):* `/api/tool`, `/api/live-token`, `lib/engine`, `lib/voice`, `lib/demo`, `lib/flags` y el uso real de `weights/base_stats/eventos_vida`.

---

## C4 — Nivel 3 · Componentes (el antes / después)

### v1 · Amparito base
```mermaid
flowchart TB
  chatui["Chat UI<br/>EventCards: quote · policy<br/>compliance · escalation · form"]
  orq["Orquestador<br/>(loop de tool-use con Haiku)"]
  tools7["7 tools<br/>get_catalog · recommend_products<br/>get_product_details · quote_product<br/>collect_customer_data · issue_policy · escalate"]
  matcher["recommend_products<br/>= matcher por PALABRAS CLAVE"]
  cat["catalog.json (16 productos)"]
  gate["Compuertas de cumplimiento<br/>(Art. 9 · consentimiento) en servidor"]
  mock["Insurer gateway (mock)"]

  chatui --> orq --> tools7
  tools7 --> matcher --> cat
  tools7 --> gate
  tools7 --> mock

  classDef base fill:#eef1f5,stroke:#9aa3b2,color:#1d1d1f;
  class chatui,orq,tools7,matcher,cat,gate,mock base;
```

### v2 · Amparito+ (todo lo de v1, **+** lo azul)
```mermaid
flowchart TB
  chatui["Chat UI (pull-first · proactivo · selector jurado<br/>tono generacional · botón asesor humano)"]
  orq["Orquestador (loop tool-use)"]
  toolsN["9 tools (+ calcular_propension<br/>+ calcular_impacto_ingreso)"]
  motor["MOTOR DE PROPENSIÓN<br/>scorecard · peer · gates · reason codes"]
  prop["weights · base_stats · eventos_vida"]
  card["PropensionCard<br/>WhyThis · GapsLedger · PeerProof<br/>Descartados · anti-venta (héroe)"]
  impacto["Calculadora de impacto<br/>ImpactoCard (gasto→protección)"]
  voz["Voz Gemini Live (flag APAGADO)"]
  off["Modo offline (?offline=1)"]
  base["Base v1: matcher(fallback) · catalog<br/>cotización 3 capas · cumplimiento · issue"]

  chatui --> orq --> toolsN
  toolsN --> motor --> prop
  toolsN --> impacto --> chatui
  toolsN --> base
  motor --> card --> chatui
  voz -.-> toolsN
  off -.-> base

  classDef base fill:#eef1f5,stroke:#9aa3b2,color:#1d1d1f;
  classDef nuevo fill:#dbeafe,stroke:#0067b1,color:#00344f,stroke-width:2px;
  class chatui,orq base;
  class toolsN,motor,prop,card,impacto,voz,off nuevo;
```

---

## Tabla resumen — qué cambió
| Capa | v1 (base) | v2 (Amparito+) |
|---|---|---|
| **Recomendación** | Matcher por palabras clave (`recommend_products`) | **Motor de propensión** explicable (scorecard + reason codes + gates) — `recommend_products` queda de fallback |
| **Datos** | `catalog.json` | + `weights.json` · `base_stats.json` · `eventos_vida.json` (usados por el motor) |
| **UI del porqué** | Tarjetas de cotización/póliza/cumplimiento | + **PropensionCard** (WhyThis · GapsLedger · PeerProof · Descartados · anti-venta héroe) |
| **Emoción (gasto→protección)** | — | + **calculadora de impacto de ingreso** + **ImpactoCard** + reframe (prompt) |
| **Generación** | Un solo tono | + **tono adaptativo** por señales (<30 / 30-45 / +50) sin preguntar la edad |
| **Letra menuda** | Todo abierto de golpe | + **disclosure en 3 capas** (síntesis visible = Art.9; términos completos a un clic) |
| **Confianza (+50)** | — | + botón **"que me llame un asesor"** (reusa `escalate_to_human`) |
| **Entrada** | Caja de chat + starters | + **pull-first** ("¿Qué quieres proteger?") + **momento proactivo** + **selector de persona (jurado)** |
| **Voz** | — | **Gemini Live** tras feature flag apagado (`/api/live-token`, `/api/tool`, `lib/voice`) |
| **Robustez demo** | Depende de la red | + **modo offline** (`?offline=1`) end-to-end + auto-fallback |
| **Tools** | 7 | 9 (+ `calcular_propension`, `calcular_impacto_ingreso`) |
| **Backend del chat** | `/api/chat`, `/api/issue` | **intactos** (todo lo nuevo es aditivo) |

## Archivos por versión
- **Solo v1 (base, sin cambios):** `lib/insurer/*`, `lib/sheets.ts`, `lib/catalog.ts`, `components/FlowVideo.tsx`, `SiteHeader.tsx`, `app/api/issue`, `app/layout.tsx`.
- **Modificados en v2:** `lib/tools.ts` (+ tool, `import type`), `lib/prompts.ts` (Estado 3), `components/Chat.tsx` (capa visual + entradas + voz + offline), `app/globals.css`, `app/chat/page.tsx`.
- **Nuevos en v2:** `lib/engine/*` · `lib/voice/*` · `lib/demo/*` · `lib/flags.ts` · `app/api/tool` · `app/api/live-token` · `scripts/*`.
