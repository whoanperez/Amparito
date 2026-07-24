# Amparito 🛡️

**La asistente que lleva a un afiliado de Colsubsidio de _"no sé qué seguro necesito"_ a _"ya quedé asegurado"_ — en una sola conversación, 24/7, sin intervención humana. Y que a veces te dice que NO.**

Proyecto para el **Hackathon Colsubsidio × 30X** (julio 2026) · Reto: *Venta automatizada de seguros*.

---

## ▶️ Correr en < 2 minutos

```bash
npm install
cp .env.local.example .env.local     # pon tu ANTHROPIC_API_KEY
npm run dev                          # http://localhost:3000
```

Abre **http://localhost:3000/chat** y cuéntale a Amparito qué cambió en tu vida.

**Atajos para el jurado / demo:**
- **Modo jurado:** en `/chat`, toca un perfil del demo (Andrés / Carolina / Jaime) — corre solo, sin guía.
- **Modo demo offline** (por si falla la red del salón): `/chat?offline=1` — las 3 personas corren end-to-end **sin conexión** (el motor y la cotización son locales).
- **Momento proactivo:** `/chat?evento=credito_vivienda` — Amparito abre la conversación tras un evento de vida.
- **Voz (Gemini Live, opcional):** en `.env.local` pon `NEXT_PUBLIC_VOICE_ENABLED=true` + `GEMINI_API_KEY`, reinicia, y aparece el micrófono. **Apagada por defecto.**

Deploy en Vercel: importa el repo y configura `ANTHROPIC_API_KEY` (y opcionalmente `ANTHROPIC_MODEL`, `GEMINI_API_KEY`, `NEXT_PUBLIC_VOICE_ENABLED`).

---

## El problema (evidencia real)

Hoy el flujo de seguros de Colsubsidio termina en **"déjanos tus datos y te contactaremos"**: no escala, no opera 24/7, y el afiliado que no sabe qué necesita queda igual de perdido. En Colombia **menos del 2% de las pólizas se venden online** (Fasecolda) y **el 34% no compra por autoexclusión** ("esto no es para mí"). El freno no es legal ni de producto — es de **percepción**: el seguro se vive como un *gasto técnico y aburrido que me obligan*, no como *protección que yo elijo*.

## La solución

Amparito reemplaza el "te contactaremos" por un cierre conversacional inmediato, y ataca la percepción:

1. **Entiende la situación de vida** (no muestra un menú de productos). Entrada *pull-first*: "¿Qué quieres proteger?".
2. **Recomienda con un motor de propensión explicable** (no un matcher de keywords): scorecard determinista sobre datos reales → ranking + **reason codes** + descartados con razón. "No caja negra".
3. **Hace visible el porqué**: tarjeta con WhyThis · ledger de brechas · prueba social honesta · "ver descartados".
4. **Anti-venta honesta**: no recomienda lo que no necesitas y no revende lo que ya tienes ("el Exequial ya lo tienes con Colsubsidio").
5. **Hace sentir la protección**: calculadora de **impacto de ingreso** ("cuánto ingreso protege tu familia") y reencuadre *gasto → protección*, en clave de cuidado.
6. **Cotiza al instante** y muestra qué cubre / qué no en **3 capas** (síntesis visible = cumple Art. 9; términos completos a un clic, sin saturar).
7. **Se adapta a cada generación** (tono/ejemplos) y ofrece **"que me llame un asesor"** para quien desconfía de lo digital.
8. **Emite la póliza** con consentimiento explícito (Ley 1581) y entrega el certificado en el mismo hilo.

## Arquitectura

```
Usuario ⇄ UI (Next.js, look Colsubsidio)
            ⇄ /api/chat  →  Claude Haiku (system prompt "Amparito")
                              ⇅ tool-use (9 herramientas)
   get_catalog · calcular_propension · calcular_impacto_ingreso · recommend_products(fallback)
   get_product_details · quote_product · collect_customer_data · issue_policy · escalate_to_human
                              ⇅
   Motor de propensión (lib/engine, scorecard + gates)   ·   InsurerGateway (mock → producción)

Extras tras flag/param (no tocan el flujo normal):
   Voz Gemini Live  →  /api/live-token (token efímero) + /api/tool     [NEXT_PUBLIC_VOICE_ENABLED]
   Modo demo offline →  lib/demo (guiones + player, motor local)        [?offline=1]
```

Decisiones clave:
- **El motor calcula, el LLM redacta.** Todo precio/cobertura/**razón** sale de las tools (motor + gateway), nunca del texto libre del modelo.
- **Cumplimiento en servidor, no solo en prompt:** `issue_policy` **rechaza** la emisión sin `consentimiento: true` y sin datos completos.
- **Propensión auditable ("no caja negra"):** scorecard documentado con priors citados + gate de posesión + gate de asequibilidad; cada peso trazable a `data/weights.json`.
- **Cero PII:** solo se versionan datos derivados (`data/*.json`); el CSV crudo de afiliados está en `.gitignore`.

## Estructura

```
amparito/
├─ app/
│  ├─ page.tsx · chat/page.tsx        # landing + chat
│  └─ api/ chat · issue · tool · live-token
├─ components/Chat.tsx                # UI + tarjetas (propensión, impacto, cotización, póliza…)
├─ lib/
│  ├─ prompts.ts · tools.ts · catalog.ts
│  ├─ engine/    # motor de propensión (scorecard, peer, gates) + impacto de ingreso
│  ├─ voice/     # Gemini Live (tras feature flag)
│  ├─ demo/      # modo offline (guiones + player)
│  ├─ flags.ts   # feature flags
│  └─ insurer/   # InsurerGateway (contrato) + mock-adapter
├─ data/         # catalog.json + weights/base_stats/eventos_vida (derivados, sin PII)
├─ scripts/      # gates de verificación (test-propension, test-offline)
└─ docs/reto/    # requerimiento, guion, PRD, tracker, contrato, arquitectura C4
```

## Cumplimiento (por diseño)
- **Ley 1328/2009, Art. 9** — coberturas, exclusiones, precio y forma de cálculo antes del cierre (visible en la tarjeta).
- **Ley 1581/2012 (habeas data)** — autorización explícita antes de emitir; compuerta dura en servidor.
- **SARLAFT 4.0** — vinculación simplificada para seguros masivos de bajo valor.
- **Rol de Colsubsidio:** comercializador (la aseguradora aliada emite y asume el riesgo).

## Documentación
Todo el detalle vive en [`docs/reto/`](docs/reto/): [estado vivo](docs/reto/10-estado.md) · [guion de demo](docs/reto/07-guion-demo.md) · [tracker de build](docs/reto/12-build-tracker.md) · [arquitectura C4](docs/reto/13-arquitectura-c4.md).

---

*Construido con Claude (Anthropic) · Next.js · Vercel. La marca Colsubsidio se usa únicamente como concepto para el hackathon.*
