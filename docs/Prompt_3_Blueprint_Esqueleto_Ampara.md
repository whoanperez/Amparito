# Prompt 3 — Blueprint del Esqueleto
### Producto: **"Ampara"** · agente conversacional de seguros para Colsubsidio
### Hackathon Colsubsidio × 30X · Reto "Venta Automatizada de Seguros"

> **Qué es este documento.** El plano completo del producto — pensado *antes* de codificar, como acordamos. Reúne las decisiones cerradas, el flujo estrella, la arquitectura, el modelo de datos, la API simulada, la capa de cumplimiento, el stack, la estructura del repo y el plan de 5 días. Sirve como blueprint de construcción y como especificación reutilizable.
>
> **Base:** Informe 1 (problema Colsubsidio + regulación) + Informe 2 (MVPs/referentes) + teardown de los pantallazos reales de la web de Seguros Colsubsidio.
>
> **Nombre tentativo:** "Ampara" (de *amparar* = proteger/cubrir); agente/persona **"Sol"** (guiño al amarillo de Colsubsidio). Renombrable en 1 minuto.
>
> Fecha: 17 julio 2026 · Estado: borrador para revisión de Juan.

---

## 1. Concepto en una frase

> **Ampara** es un agente conversacional (Claude) que lleva a un afiliado de Colsubsidio desde *"no sé qué seguro necesito"* hasta *"ya quedé asegurado"* en una sola conversación, 24/7 y sin intervención humana — entendiendo su situación de vida, recomendando el producto correcto del catálogo real, cotizando al instante y emitiendo la póliza con la información mínima legal desplegada.

---

## 2. El "por qué" — teardown del estado actual (evidencia de campo)

Los pantallazos de la web de Seguros Colsubsidio revelan que **ya existen 3 de las 4 piezas**, y falta la decisiva:

| Pieza | ¿Existe hoy? | Evidencia |
|---|---|---|
| Catálogo de productos | ✅ Sí | Carrusel "Tus seguros a un clic": exequial, viajes, accidentes, hogar, arrendamiento, carro, moto, bici/patineta, mascotas, salud, vida, SOAT |
| Aseguradoras aliadas | ✅ Sí | GEA, Pan-American Life, Seguros Bolívar, MetLife, VetPlus, BMI, Seguros Mundial (+ Chubb del Informe 1) |
| Formulario / captura | ✅ Sí | "Cotiza tu seguro de accidentes personales – MetLife" con datos + habeas data + captcha |
| **Cerebro + cierre 24/7 sin humano** | ❌ **NO** | El formulario dice *"Déjanos tus datos y **te contactaremos** para ofrecerte la mejor opción"* → es **captura de lead + llamada humana**, no una venta automatizada |

**La pistola humeante:** el botón dice "a un clic", pero el flujo real es "formulario → espera a que alguien te llame". No es 24/7, depende de una persona, y el afiliado que *no sabe qué necesita* queda igual de perdido (el catálogo es un menú, no un asesor). **Ampara reemplaza ese "te contactaremos" por un cierre conversacional inmediato.**

Además, la web ya tiene un onboarding "Personaliza tu experiencia" (nombre, para ti/familia, familiaridad digital, género) — pero es **perfilado genérico desconectado** de recomendación/cotización/emisión. Ampara conecta ese entendimiento con el cierre real.

---

## 3. Alcance del MVP (decisiones cerradas)

- **Flujo estrella:** *multi-producto → cierre en uno*. El agente razona sobre varias categorías, entiende la situación y recomienda + cierra el producto más pertinente. (Es lo que mejor encarna el "no sé qué necesito".)
- **Nivel de cierre:** *emisión simulada completa* — termina en "ya quedaste asegurado" con **certificado/póliza en pantalla** y la información mínima del **Art. 9** desplegada.
- **API de aseguradora:** *mockeada* (motor de cotización/emisión simulado invocado por function-calling). La integración real vía APIs de aliados es la ruta de producción del pitch, no del build de 5 días.
- **Idea 1 (outreach proactivo):** **en alcance pero se detalla al final**, después de estabilizar la idea principal y el cerebro. Queda como módulo separado (§12). *No olvidar.*
- **UI:** con identidad Colsubsidio, para que se vea como una pestaña nativa de su web (§11).

Fuera de alcance del MVP: integración real con aseguradoras, pasarela de pago real, autenticación con la cuenta Colsubsidio real, y persistencia en base de datos productiva (se usa estado en sesión + catálogo semilla).

---

## 4. Flujo estrella — guion conversacional (escenario de demo)

Persona: *afiliado que acaba de comprar una moto*. Objetivo: mostrar en vivo el paso completo de "no sé" a "asegurado" en < 2 minutos.

```
1. ENTRADA
   Sol: "Hola, soy Sol de Colsubsidio. En un par de minutos te ayudo a encontrar
         el seguro que sí necesitas — sin llamadas ni esperas. Cuéntame:
         ¿qué cambió en tu vida o qué te preocupa hoy?"

2. ELICITACIÓN (situación, no catálogo)
   Afiliado: "Acabo de comprar una moto y me da miedo un accidente."
   Sol: [detecta gatillo: moto + riesgo accidente] Hace 1–2 micro-preguntas:
        "¿La usas para trabajar o para domicilios?" · "¿Alguien depende de tus ingresos?"

3. RECOMENDACIÓN (del catálogo real, con el porqué)
   Sol: "Por lo que me cuentas te conviene un Seguro de Accidentes Personales (MetLife)
         y una Asistencia para moto. Te lo recomiendo porque usas la moto a diario y
         eres el ingreso principal de tu casa — si te lesionas, ambos te cubren."

4. COTIZACIÓN INSTANTÁNEA (mock API)
   Sol: [tool: quote_product] "Quedaría en $X/mes. Cubre A, B y C. No cubre D ni E."
        [Tarjeta de cotización en pantalla: prima, coberturas, exclusiones]

5. CAPA DE CUMPLIMIENTO (Art. 9 + habeas data)
   Sol: Despliega info mínima obligatoria (características, coberturas, exclusiones,
        precio y cómo se calcula, consecuencias) + casilla de autorización de datos.

6. CIERRE / EMISIÓN SIMULADA
   Afiliado: "Sí, actívalo."
   Sol: [tool: issue_policy] "¡Listo! Quedaste asegurado. 🎉
         Aquí está tu certificado: Póliza #AMP-0001, vigencia 12 meses."
        [Tarjeta de póliza/certificado en pantalla]

7. (Opcional) UPSELL / ESCALAMIENTO
   Para productos que exigen asesoría compleja → Sol ofrece agendar humano
   (demuestra criterio regulatorio, no todo se fuerza a automatizar).
```

Variantes de demo listas por si el jurado pide otra: *"nació mi hija"* → vida/educativo; *"tengo un perro"* → mascotas (Bolívar/VetPlus); *"me quedé sin empleo"* → renta/desempleo.

---

## 5. Arquitectura del cerebro (server-side)

Módulos (validados en Informe 2: Nature RAG + caso InsuranceDekho sobre Claude):

```
                          ┌─────────────────────────────────┐
  Afiliado ──mensaje──►   │  Orquestador (Claude, tool-use)  │
   (web tab / push)       │  System prompt "Sol"             │
                          └───────────────┬─────────────────┘
                    ┌─────────────────────┼──────────────────────┐
                    ▼                     ▼                      ▼
          ┌──────────────┐     ┌────────────────────┐   ┌──────────────────┐
          │ Elicitación  │     │ Recomendador       │   │ Cotizar / Emitir │
          │ de necesidad │     │ (catálogo + reglas │   │ function-calling │
          │ (gatillos)   │     │  + gatillos)       │   │ → API MOCK       │
          └──────┬───────┘     └────────┬───────────┘   └────────┬─────────┘
                 │                      │                        │
                 ▼                      ▼                        ▼
          ┌─────────────────────────────────────────────────────────────┐
          │  Capa de cumplimiento (Art. 9 + habeas data + escalamiento)  │
          └───────────────────────────┬─────────────────────────────────┘
                                       ▼
                        ┌──────────────────────────────┐
                        │  Respuesta de Sol (un hilo)   │  + tarjetas UI
                        └──────────────────────────────┘
```

Herramientas (tools) que expone el orquestador a Claude:
- `get_catalog()` → devuelve categorías/productos disponibles.
- `recommend_products(perfil, gatillos)` → 1–2 productos con razón.
- `get_product_details(productId)` → coberturas, exclusiones, requisitos, Art. 9.
- `quote_product(productId, perfil)` → prima, coberturas, quoteId.
- `issue_policy(quoteId, consent)` → policyId, certificado, vigencia.
- `escalate_to_human(motivo)` → registra handoff (para productos complejos).

Decisión de RAG: el catálogo es pequeño → para el MVP basta **catálogo estructurado en JSON + razonamiento de Claude** (con `get_product_details`); RAG con embeddings queda como mejora opcional si el catálogo crece.

---

## 6. Modelo de datos (catálogo semilla)

Cada producto:

```json
{
  "id": "accidentes_personales_metlife",
  "nombre": "Accidentes Personales",
  "categoria": "personal",
  "aseguradora": "MetLife",
  "estandarizado": true,
  "requiere_asesoria": false,
  "gatillos_vida": ["moto", "trabajo de riesgo", "único ingreso", "deporte"],
  "coberturas": ["Muerte accidental", "Incapacidad", "Gastos médicos"],
  "exclusiones": ["Preexistencias", "Actos ilícitos"],
  "prima_regla": { "base": 15000, "por_edad": 200 },
  "art9": { "forma_calculo": "Prima base + factor edad", "consecuencias_no_pago": "Suspensión de cobertura" }
}
```

Catálogo semilla (mock realista, basado en aliados verificados): Accidentes Personales (MetLife), Exequial (GEA/aliado), Vida (Pan-American Life/BMI), Mascotas + Asistencia (Seguros Bolívar / VetPlus), Hogar, Arrendamiento, Movilidad (carro/moto/bici), Asistencia de viajes, Póliza de salud / Asistencia médica familiar. Marcar `estandarizado`/`requiere_asesoria` para gobernar qué cierra el bot solo y qué escala.

---

## 7. Motor de cotización/emisión MOCK (spec de la "API")

Simula la API de la aseguradora. Dos endpoints internos:

```
POST /api/insurer-mock/quote
  in:  { productId, perfil }
  out: { quoteId, prima, periodicidad, coberturas[], exclusiones[], art9{} }

POST /api/insurer-mock/issue
  in:  { quoteId, consentimiento:true, contacto{} }
  out: { policyId, certificadoUrl, vigencia, estado:"ACTIVA" }
```

Determinístico y rápido (para latencia de demo): prima calculada por regla del catálogo; `policyId` incremental; certificado renderizado en la UI (tarjeta/póliza). En el pitch se explica que este contrato es idéntico al que expondría una API real de aliado (patrón Cover Genius/Qover/bolttech del Informe 2).

---

## 8. Capa de cumplimiento (el diferenciador) — Informe 1 §5

**Compliance by design**, basado en la regulación verificada:

- **Solo automatiza productos estandarizados** (`estandarizado:true`, criterios de universalidad/sencillez/estandarización). Los `requiere_asesoria:true` → `escalate_to_human`.
- **Despliega el contenido mínimo del Art. 9 (Ley 1328/2009)** antes de cerrar: características, coberturas, exclusiones, **precio y forma de cálculo**, consecuencias del incumplimiento.
- **Deber de información y transparencia** en lenguaje simple (no "caja negra" — lección Lemonade 2021, Informe 2 §8).
- **Habeas data (Ley 1581):** casilla de autorización en el hilo antes de emitir; registrar consentimiento.
- **Escalamiento:** disparadores (producto complejo, frustración, monto alto) → ofrecer humano. Mostrar esto en la demo = madurez que el jurado financiero valora.

Componente `compliance.ts`: construye el bloque Art. 9 desde el producto y bloquea `issue_policy` si falta consentimiento.

---

## 9. Stack técnico

- **Front + back:** Next.js (App Router) desplegado en **Vercel**.
- **Cerebro:** **Claude API** (Messages + tool-use). Modelo rápido para intent/latencia, modelo mayor para razonamiento de recomendación.
- **Estado:** en sesión (memoria/servidor); sin base de datos productiva en el MVP.
- **Catálogo:** JSON semilla en `/data`.
- **Sin** pasarela de pago real, **sin** login real (mock).
- **Latencia de demo:** caché de respuestas del guion (patrón InsuranceDekho) para que el flujo estrella salga fluido en vivo.

---

## 10. Estructura del repositorio (GitHub-ready)

```
ampara/
├─ app/
│  ├─ page.tsx                 # landing con look de pestaña Colsubsidio
│  ├─ chat/page.tsx            # UI de conversación con Sol
│  └─ api/
│     ├─ chat/route.ts         # orquestación Claude + tool-use
│     └─ insurer-mock/route.ts # quote + issue simulados
├─ lib/
│  ├─ prompts.ts               # system prompt de "Sol"
│  ├─ tools.ts                 # definición de las 6 tools
│  ├─ catalog.ts               # carga del catálogo
│  └─ compliance.ts            # Art. 9 + consentimiento + escalamiento
├─ components/
│  ├─ Chat.tsx  QuoteCard.tsx  PolicyCard.tsx  CompliancePanel.tsx
├─ data/
│  └─ catalog.json             # productos semilla + aseguradoras
├─ .env.example                # ANTHROPIC_API_KEY=
├─ README.md                   # pitch, arquitectura, cómo correr
└─ package.json
```

Al terminar: inicializar git, README con diagrama y guion de demo, `.env.example` (nunca subir la key), y push a GitHub.

---

## 11. UI — "parece una pestaña de Colsubsidio"

Marca: amarillo/azul Colsubsidio, tipografía y encabezado similares a su web. La pantalla de Ampara debe leerse como la sección "Seguros" nativa con un chat en vez del formulario "te contactaremos". Tarjetas de cotización y de póliza con el look de sus componentes. (Detalle fino de branding = fase de pulido, sábado.)

---

## 12. Módulo Idea 1 — Outreach proactivo (⚠️ DETALLAR AL FINAL — no olvidar)

Placeholder reservado. Concepto: script que cruza la base de afiliados + gatillos de vida conocidos (subsidio de desempleo → renta; nuevo hogar → hogar; cupo de crédito activo → upsell) y **puntúa** quién probablemente necesita qué; envía un empujón personalizado (WhatsApp/email) con **deep-link al bot** (Sol ya con contexto). Une este reto con el de *crédito hiperpersonalizado*. **Habeas data:** requiere autorización previa (Ley 1581); apoyarse en el consentimiento existente. Se diseña en detalle **después** de estabilizar la idea principal y el cerebro.

---

## 13. Plan de construcción (mapa a los 5 días + preparación)

- **Pre-evento (Vie–Mar):** scaffold Next.js + catálogo semilla + system prompt de Sol + API mock. Llegar el miércoles con el esqueleto vivo.
- **Miércoles (kickoff virtual):** armar equipo, cerrar reto, congelar el flujo estrella.
- **Jueves:** cerebro (Claude + las 6 tools) + conversación núcleo funcionando.
- **Viernes:** flujo end-to-end (elicitación→recomendación→cotización→emisión) + deploy en Vercel.
- **Sábado:** capa de cumplimiento visible, UI marca Colsubsidio, métricas, guion de demo, deck.
- **Domingo:** demo final. (Idea 1 se detalla aquí si sobra tiempo, o como slide de visión.)

---

## 14. Métricas y guion de pitch

Qué medir y decir en vivo: **tiempo de "no sé" a "asegurado"** (< 2 min), **24/7**, **0 humanos en el cierre**, **N categorías** cubiertas, **Art. 9 desplegado** (cumplimiento visible), y el diferenciador de mercado: *"ni Colsubsidio, ni Compensar, ni Cafam, ni SURA cierran hoy sin humano — nosotros sí"* (Informe 1 §6). Cierre del pitch: la ruta de producción (APIs reales de aliados) + el growth loop (Idea 1) que conecta con el reto de crédito.

---

## 15. Riesgos y mitigaciones

- **Latencia en vivo** → caché del guion + modelo rápido para intent.
- **Alucinación de coberturas/precios** → todo sale de tools deterministas sobre el catálogo, no del texto libre del modelo.
- **Sobre-prometer "sin humano"** → escalamiento explícito para productos complejos (y es un plus regulatorio).
- **Branding** → dejar el pulido de marca para el final; no bloquear la lógica.

---

## 16. Preguntas abiertas / decisiones pendientes

1. **Nombre definitivo:** ¿"Ampara"/"Sol" o prefieres otro?
2. **Persona de demo principal:** ¿la moto, o cambiamos a otro gatillo (hija, mascota, desempleo)?
3. **¿Arranco ya el scaffold** (repo + catálogo + system prompt + API mock) o quieres revisar/editar este blueprint primero?
4. Madurez digital granular de afiliados (dato [PARCIAL] del Informe 1) — ¿lo buscamos para el pitch o lo dejamos así?
