# Backlog — Amparito+ (5 días)

> Tareas organizadas **por peso del jurado** (no por capa técnica) y por dueño. Deriva del
> [guion](./07-guion-demo.md) y el [PRD](./08-prd.md). Base = [Amparito](https://github.com/whoanperez/Amparito).
> Prioridad: 🔴 **demo-crítico** (sin esto no hay demo) · 🟡 **suma puntaje** · 🟢 **nice-to-have**.

## Roles (coreografía de 4 + autor de Amparito)
- **D1 · Datos/Propensión** — pipeline sin PII, scorecard, reason codes. *(Dueño del 25%.)*
- **D2 · Frontend/UX** — componentes visuales, entrada pull-first, modo jurado. *(Dueño de hacer visible el 45%.)*
- **D3 · Demo/Producto/Pitch** — guion, persona de Amparito, número de cierre, ensayo. *(Dueño del relato.)*
- **A · Autor de Amparito (whoanperez)** — integración, tools, system prompt, voz. *(Dueño del repo base.)*
- Integración **diaria**, no al final.

---

## ⚠️ Tarea 0 — HOY, antes de tocar código (humano, no técnico)
🔴 **Contrato de integración con el autor de Amparito.** Acordar: branch de trabajo, **contrato de las
tools** (firma de la nueva `calcular_propension` + nuevos `UiEvent`), y no pisar `lib/prompts.ts`
(system prompt). *Es el riesgo #1 del proyecto: sin esto, el merge nos mata el día 4.* — **D3 + A**

---

## Propensión (25%) — el corazón · Dueño D1
- 🔴 **Pipeline sin PII:** leer el CSV de 1,5M, **dropear `NOMBRE_COMPLETO` en el paso 1**, trabajar por
  `SERIE`. Salida limpia + distribuciones. → `data/pipeline/build_dataset.py`
- 🔴 **`weights.json`:** pesos del scorecard derivados de lift/tasas reales por `RANGO_EDAD ×
  SEGMENTO_GRUPO_FAMILIAR × CATEGORIA`, **cada peso con su cifra de respaldo**. Anclas externas
  (DANE mascotas 67%, Fasecolda) donde falte señal. → `data/pipeline/build_weights.py`
- 🔴 **`eventos_vida.json`:** matriz edad × grupo familiar → evento vital → productos gatillados.
- 🔴 **Scorecard aditivo** que reemplaza el matcher de keywords de `lib/catalog.ts`; devuelve ranking +
  **reason codes ponderados** + descartes con razón. Determinista, versionado. *(dep: weights, eventos)*
- 🔴 **Tool `calcular_propension(perfil)`** en `lib/tools.ts` (perfil estructurado). *(dep: contrato T0)*
- 🟡 **Regla anti-venta** en el scorecard: tope de suma por necesidad + detección de "ya cubierto".
- 🟢 Capa sintética de consumo cross-servicio (marcada ILUSTRATIVA) para narrativa del foso.

## Variación por perfil (20%) — Dueños D1 + D2
- 🔴 **Perfil estructurado:** afiliado → arranque caliente por `SERIE` (pre-carga hipótesis); no afiliado
  → 4-6 preguntas de enriquecimiento. *(dep: scorecard)*
- 🔴 **Las 3 personas** (Andrés/Carolina/Jaime) producen recomendaciones **visiblemente distintas**.
- 🟡 **Contraste lado a lado** (pantalla partida, motor corre en vivo, reason codes se voltean).

## Innovación (20%) — Dueños D2 + A
- 🔴 **Entrada pull-first:** tarjetas grandes tappables "¿Qué quieres proteger?" + "Prefiero hablar"
  (reemplaza la caja de chat). → `app/chat/page.tsx`, `components/Chat.tsx`
- 🔴 **Anti-venta como momento visible** (no solo `escalate_to_human`).
- 🟡 **Voz Gemini Live** como segundo front sobre las mismas 6 tools + fallback a chat.
  → `app/api/live/route.ts` + proxy WebSocket. *(solo si el flujo chat corre end-to-end)*
- 🟢 **Momento proactivo mockeado** ("Colsubsidio vio que sacaste crédito de vivienda → ¿aseguramos tu
  hogar?") — upside estratégico + bonus de timing/canal.

## Experiencia y confianza (15%) — Dueños D2 + D3
- 🔴 **`GapsLedger`** (dos columnas riesgos/cubierto) + **`WhyThis`** (semáforo + reason codes).
- 🔴 **`PeerProof`** (prueba social peer-group, trazable a la base).
- 🟡 **"Ver descartados"** (toggle con el porqué de lo no recomendado).
- 🟡 **Panel de trazabilidad inspeccionable** con cita a la URL de fuente real (Amparito ya las tiene en
  `catalog.json`).
- 🟡 **Persona/voz de Amparito:** 3-4 frases de firma, tono cálido y honesto en español colombiano.

## Flujo completo (20%) — mayormente REUSO de Amparito · Dueño A
- ✅ Ya existe: recomienda → cotiza → SÍ/NO cubre → consentimiento → certificado → escalamiento.
- 🔴 **Enganchar** los nuevos `UiEvent` (ledger, whythis, peerproof) al render de `components/Chat.tsx`.
- 🟡 **Instrumentar el funnel** (medir abandono por paso) — dato que Colsubsidio hoy no tiene.
- 🟢 Revisar `lib/sheets.ts` para que no persista PII sensible.

## Demo & pitch (transversal) — Dueño D3
- 🔴 **Guion de 3 min ensayado ≥ 10 veces** (ver [07](./07-guion-demo.md)).
- 🔴 **Redes de seguridad:** camino crítico local + respuestas de las 3 personas **pre-cacheadas** +
  video de respaldo del contraste lado a lado.
- 🔴 **Número de cierre + KPI de anti-venta** en el pitch.
- 🟡 **README** que levante en < 2 min.

---

## Secuencia por día
| Día | Foco | Hitos |
|---|---|---|
| **0/1** | Contrato T0 + datos | branch acordado · pipeline sin PII · `weights.json` · `eventos_vida.json` |
| **2** | Motor | scorecard + `calcular_propension` + reason codes corriendo por API |
| **3** | Flujo visible end-to-end (sin voz) | pull-first · GapsLedger · WhyThis · PeerProof · 3 personas |
| **4** | Wow + pulido | anti-venta · ver descartados · contraste lado a lado · (voz si da) · pre-cache |
| **5** | Demo | ensayo ×10 · redes de seguridad · README · pitch con el número |

**Regla de disciplina:** el flujo determinista en chat+pantalla corre end-to-end **antes** de tocar voz.
Voz y momento proactivo son 🟡/🟢 — se sacrifican primero si el tiempo aprieta. **Nunca** se sacrifica la
propensión explicable (el 25%).
