# CHANGELOG — Amparito

Registro de cambios desde el **primer despliegue (v1.0)** hasta hoy. Proyecto para el Hackathon Colsubsidio × 30X 2026.

---

## v1.0 — Primer despliegue (base funcional)
El primer Amparito que se subió a Vercel y funcionó de punta a punta.
- App **Next.js** desplegable en **Vercel**; cerebro **Claude Haiku** como orquestador con **tool-use loop**.
- **6 tools:** `get_catalog`, `recommend_products`, `get_product_details`, `quote_product`, `issue_policy`, `escalate_to_human`.
- **InsurerGateway** con patrón adaptador (`MockInsurerAdapter`) — simulación lista para enchufar la API real.
- **Catálogo de 16 productos** (datos semilla) con las 8 aseguradoras aliadas reales.
- **Cumplimiento en servidor:** no se emite sin consentimiento ni con datos incompletos.
- **System prompt v2** (Fable → Haiku): identidad, compuerta anti-abuso (dominio / fuera de tema / manipulación), máquina de estados.
- UI de chat con identidad Colsubsidio (versión básica). Captura de datos por chat.

## v2.0 — Rediseño de landing + flujo híbrido
- **Landing rediseñada al 100%** con el look real de Colsubsidio: header de 3 niveles, **logo real**, tipografía **Poppins**, secciones *Servicios* / *Tus seguros a un clic* / *Aliados* y footer.
- **System prompt v3:** texto plano sin markdown (paréntesis en vez de guiones), "nombres y apellidos completos" en plural.
- **Flujo híbrido:** el chat entiende y recomienda; la captura de datos pasa a un **formulario/tabla**; **pantalla de transición** de 7 s en la emisión.
- **Disparadores desde la landing** (`/chat?interes=slug` → primer mensaje autocompletado).
- **Quick-replies** (convención `OPCIONES:`).
- **Tarjeta de cumplimiento** (Art. 9) renderizada.
- **Google Sheets:** hook `lib/sheets.ts` + endpoint `/api/issue` que registra cada póliza; guía en `docs/google-sheets-setup.md`.
- Nuevos: tool `collect_customer_data`, endpoint `/api/issue`, componente `SiteHeader`.

## v2.1 — Correcciones de UX
- **Quick-replies inline** (antes quedaban ocultos tras el input) que **prellenan la casilla** en vez de auto-enviar (para completar, ej. el presupuesto).
- **Fecha de nacimiento con "/" automáticos**; celular solo dígitos.
- **Tarjeta de póliza rediseñada:** ancha, grande, con "logo" de la aseguradora (monograma + color de marca) y grilla de datos.
- Carga de emisión ampliada a **7 s**.

## v2.2 — Data real + fix crítico de CSS
- **Bug crítico corregido:** el `@import` de Google Fonts tumbaba TODA la hoja de estilos si la fuente no cargaba (riesgo en vivo). Movido a `<link>` en `layout.tsx`.
- **Detalle real bajo la cotización:** `quote_product` expone coberturas, exclusiones, Art. 9 y fuente; la tarjeta trae un desplegable "Qué cubre y qué no" + etiqueta de precio ("valor de referencia" / "tarifa regulada").
- **Catálogo con data real:** investigación con **23 afirmaciones verificadas** contra clausulados oficiales → **7 productos con coberturas y exclusiones reales y fuente citada** (Accidentes MetLife, Vida y Vida-crédito Pan-American, Mascotas Bolívar, Prepagada VetPlus, Hogar Chubb) + **SOAT con tarifa real 2026** ($343.300 moto 100–200cc, Fasecolda). Fuentes en `docs/coberturas-reales-fuentes.md`.

## v2.3 — Onboarding + recomendación rica
- **Disparadores en la entrada directa** a Amparito (chips de arranque bajo el saludo: "Compré una moto", "Nació mi bebé", "Adopté una mascota"…).
- **Recomendación como tarjetas seleccionables** con una marcada **"★ Recomendado para ti"** (resaltada) y su **porqué** (convención `RECOMENDACION:`).
- **Nueva pantalla de carga** (~4 s) al evaluar opciones, antes de mostrar las recomendaciones.

## v2.4 — Explainer "detrás de cámaras"
- Al **entregar la póliza** se reproduce solo un **explainer animado** (`FlowVideo`), sin voz ni sonido, solo subtítulos, con la ruta del flujo. Se añade siempre (para el demo).
- **v2.4.1 (versión técnica, para jurado experto):** 14 escenas que intercalan capa **"Lo que ves"** e **"Por debajo · ingeniería"**, con **chips técnicos reales** (`POST /api/chat`, `tool: recommend_products`, `catalog.json`, compliance gate server-side, `POST /api/issue`, `InsurerGateway` adapter, `webhook → Google Sheets`, stack Haiku/Next/Vercel).
- **HTML standalone** `amparito_video_flujo.html` (doble clic, sin registro) + `docs/prompt-video-flujo.md` (prompt para Claude Design/Fable y ruta Figma).

## v2.5 — Landing fiel a Colsubsidio + links reales
- **Paleta con los tokens reales** de colsubsidio.com: azul `#0067B1`, amarillo `#FFD000`, gris de categorías `#36373B` (tomados del DevTools del sitio real). `scroll-padding-top: 106px` como el header fijo real.
- **Logo a la izquierda:** header a todo el ancho con contenedor de 1340px y poco padding, para que el isotipo + "Colsubsidio" queden pegados a la izquierda como en el sitio real. Se alinea el hero y las secciones al mismo ancho.
- **Menos bold:** títulos a peso 700 (antes 800) con menos interletra, se quita el bold de la frase larga del hero y se limpia el lockup del logo (isotipo + wordmark, sin duplicar texto en negrita).
- **Links reales de Colsubsidio** cableados en todo el header (antes eran `span` sin destino):
  - Topbar: Personas, Empresas, Transparencia.
  - Menú: Te ayudamos (ayuda.colsubsidio.com), Encuéntranos, Compra en línea, Afiliaciones, Beneficios (tusbeneficioscolsubsidio.com), Colsubsidio virtual (portal transaccional).
  - Categorías: Subsidios, Salud, Vivienda, Deportes (recreación), Educación, Clubes y BLOC, Turismo, Créditos y **Seguros** (marcada como activa, porque Amparito vive bajo Seguros).
  - Breadcrumb real: **Inicio / Seguros / Amparito** con enlaces a las páginas oficiales.
- Todos los enlaces externos abren en pestaña nueva (`target="_blank"`) para no perder la demo de Amparito.

---

### Estado actual: **v2.5** · build ✓
Pendiente opcional: módulo de **outreach proactivo** (cruzar base de afiliados + gatillos → empujón con deep-link al bot), documentado en el blueprint. Profundizar coberturas reales de los 9 productos que hoy usan data de referencia.

---

## Rama `feature/amparito-plus` — "Amparito+" (injertos que valen el 45% del puntaje)

> **Bitácora por commit** de nuestro trabajo sobre la base v2.5. **Convención: cada commit agrega aquí
> una entrada** (`hash` · fecha · qué se hizo · qué logra), más detallada que el mensaje de git. Objetivo
> de la rama: **propensión explicable con reason codes · capa visual del porqué (GapsLedger/WhyThis/
> PeerProof) · pull-first + anti-venta · voz Gemini Live**. Estado completo del proyecto en
> `colsubsidio-hackathon/reto-seguros/10-estado.md`. (Los commits solo-docs se pliegan en la siguiente entrada.)

### `f7c5431` · 2026-07-24 · Data: enriquecimiento de propensión derivado de la base real (sin PII)
**Qué se hizo:**
- `data/pipeline/profile_base.py` — perfila los **1.566.028 afiliados** de la base real en ~8 s;
  **descarta `NOMBRE_COMPLETO` en el paso 1** (PII, Ley 1581); sin dependencias (librería estándar).
- `data/base_stats.json` — distribuciones reales + **194 peer-groups** para la prueba social ("afiliados
  como tú"). Dato estrella: segmento de Carolina (F · 36-45 · monoparental · cat A) = **62.459 afiliadas reales**.
- `data/weights.json` — **scorecard documentado** (16 productos: señal → peso → *reason code*) + priors
  citados (DANE mascota 0,67 · Fasecolda · Superfinanciera autoexclusión 34%).
- `data/eventos_vida.json` — matriz edad × grupo familiar → evento vital → productos + slots conversacionales.
- `.gitignore` — bloquea el CSV crudo (PII) y builds.
**Qué logra:** la materia prima del **motor de propensión explicable** (25% del puntaje), 100% derivada
de datos reales + fuentes, **sin PII** y **sin ML** (la base no tiene etiqueta de compra → scorecard
documentado, no modelo entrenado; es el argumento del "no caja negra").
**Pendiente que habilita:** el motor en `lib/` que consume estos 3 JSON, la tool `calcular_propension`
y los componentes visuales.
