# Estado del proyecto — Amparito+ (LÉEME AL RETOMAR)

> **Documento de estado vivo.** Si retomas el proyecto (o una sesión nueva), empieza aquí: dice qué está
> hecho, qué falta y dónde vive todo. Actualízalo cada vez que avances. Última actualización: **24-jul-2026**.

## Dónde vive todo
- **Docs de estrategia y reto:** consolidados en **este repo Amparito** → [`docs/reto/`](./) (requerimiento,
  datos, catálogo, guion, PRD, backlog, contrato, brief oficial y análisis en [`estrategia/`](./estrategia/)).
  Copia original en `colsubsidio-hackathon/` (repo de estrategia, sin git). Ver [`README.md`](./README.md).
- **Código del MVP:** este repo **[Amparito](https://github.com/whoanperez/Amparito)**, en
  **`/Users/mauricio/dev/Amparito`**, rama de trabajo **`feature/amparito-plus`** (gh user = `maocaja`).
- **Plan técnico completo:** plan file del usuario (`~/.claude/plans/ancient-wishing-cookie.md`).
- **Data derivada sin PII (ya versionada):** [`../../data/`](../../data/) (`base_stats.json`, `weights.json`,
  `eventos_vida.json`) + pipeline en [`../../data/pipeline/`](../../data/pipeline/).
- **Base real de afiliados (PII):** `Usos_Productos_Afiliados_SIN_ID.csv` (~197 MB) vive **solo en la máquina
  local**, nunca en el repo. ⚠️ Trae `NOMBRE_COMPLETO`; el `.gitignore` lo bloquea. Solo salidas derivadas sin PII.

## Rumbo (una frase)
Adoptar **Amparito** (Next.js + Claude Haiku, ya funcional: 6 tools, catálogo real, cumplimiento) como
base e injertarle los 4 diferenciales que valen el 45% del puntaje: **propensión explicable con reason
codes · capa visual del porqué (GapsLedger/WhyThis/PeerProof) · pull-first + anti-venta · voz Gemini
Live**. Pesos del jurado: Propensión 25% · Variación 20% · Flujo 20% · Innovación 20% · Confianza 15%.

## ✅ Hecho
- [x] Decisión de reto (Seguros) y de alcance (**todas las líneas**; el jurado puede pedir cualquiera).
- [x] Panel de 5 expertos + investigación de mercado (23 fuentes) → síntesis y diferencial.
- [x] Docs de alineación demo-first: [`07-guion-demo.md`](./07-guion-demo.md),
      [`08-prd.md`](./08-prd.md), [`09-backlog.md`](./09-backlog.md),
      [`11-contrato-tools.md`](./11-contrato-tools.md) (contrato de tools para Juan).
- [x] Amparito clonado + rama `feature/amparito-plus` creada y pusheada (nada mergeado a `main`).
- [x] **Data enriquecida y commiteada** (derivada + priors con fuente, **sin PII**):
  - `data/pipeline/profile_base.py` — perfila 1,56M afiliados en ~8s, descarta `NOMBRE_COMPLETO`.
  - `data/base_stats.json` — distribuciones reales + **194 peer-groups** (para PeerProof).
    Dato estrella: segmento de Carolina (F, 36-45, monoparental, cat A) = **62.459 afiliadas reales**.
  - `data/weights.json` — scorecard documentado (16 productos, señales→peso→reason code) + priors.
  - `data/eventos_vida.json` — matriz edad × grupo familiar → evento vital → productos.
  - `.gitignore` bloquea el CSV crudo (PII).

## ✅ Desarrollo del alcance: COMPLETO (24-jul)
Todo construido y verificado en build (bitácora detallada en [`12-build-tracker.md`](./12-build-tracker.md)):
motor de propensión explicable · capa visual del porqué · pull-first/proactivo/selector jurado · anti-venta ·
gate de posesión · **voz Gemini Live** (tras feature flag apagado) · **modo demo offline** end-to-end ·
**calculadora de impacto + reframe gasto→protección** (Tier 1) · **tono generacional + disclosure en 3 capas
+ botón de asesor humano** (Tier 2). README de arranque <2 min: hecho.
**PR #1 MERGEADO a `main`** (todo Amparito+ base); **Tier 1 + Tier 2 en el PR #2** (abierto).

## ⬜ Qué falta de verdad (en orden)
1. **🔑 Validar EN VIVO** con `ANTHROPIC_API_KEY` (+ `GEMINI_API_KEY` para la voz). Casi todo el Tier 1/2 vive
   en el prompt → *build OK no garantiza el comportamiento del modelo*; habrá que afinar el prompt un par de
   vueltas con lo que se vea. **Es el pendiente #1** y necesita las keys.
2. **Ensayo del pitch** (×10) + **video de respaldo** del demo.
3. **Merge del PR #2** (decisión del equipo).

## Decisiones abiertas / pendientes de confirmar
- [x] ~~**Ajustar el guion:** mencionaba "Vida y Ahorro"~~ → **resuelto (24-jul)**. El guion ahora usa
      `vida_panamerican` ("Vida (Pan-American)", que cubre incapacidad total y permanente ≥50% → la frase
      "respaldo si te incapacitas" queda exacta) para Jaime, y **Salud (BMI)** como el producto descartado
      de Carolina. Nota: `03-catalogo-seguros.md` sí lista "Vida y Ahorro" (MetLife) porque es el catálogo
      **del reto**; Amparito no lo implementa, por eso el guion no debe nombrarlo.
- [ ] Confirmar convención de nombres de rama con el equipo.
- [ ] ¿Se usa "Data" (agente voz/texto, partner 30X) o Gemini Live directo para la voz?
- [ ] Significado de negocio de `PIRAMIDE_NUEVA` / `SEGMENTO_POBLACIONAL` (para reforzar el "por qué").

## Notas de rigor (no perder)
- **PII:** `NOMBRE_COMPLETO` fuera en el paso 1; nunca en repos/logs/UI (Ley 1581).
- **No es ML:** la base no tiene etiqueta de compra → scorecard **documentado + priors citados**, no
  modelo entrenado. Es el argumento que gana el "no caja negra", no una limitación.
- **Regla de oro:** el LLM conversa y **redacta** reason codes; el motor **calcula**; nunca el LLM
  inventa prima ni cobertura (function calling + guardrail).
