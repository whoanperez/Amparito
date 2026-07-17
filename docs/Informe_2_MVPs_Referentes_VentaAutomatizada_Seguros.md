# Informe 2 — MVPs y referentes de venta automatizada de seguros
### Insumo para el Hackathon Colsubsidio × 30X · Reto "Venta Automatizada de Seguros"

> **Metodología y nivel de confianza.** Investigación con harness de verificación adversarial: 5 ángulos de búsqueda → 22 fuentes leídas → 105 afirmaciones extraídas → 25 sometidas a votación 3-a-1 → **23 confirmadas, 2 descartadas**. A lo largo del informe se marca el nivel de evidencia:
> - **[VERIFICADO]** — afirmación que sobrevivió verificación adversarial (2/3 o 3/3 votos).
> - **[REPORTADO]** — aparece en fuentes pero no entró al set verificado; tratar como indicativo.
> - **[CRITERIO PROPIO]** — no hay fuente verificada; es diseño/juicio nuestro, marcado como supuesto.
>
> Fecha: 16 julio 2026.

---

## 1. Resumen ejecutivo

El mundo automatiza la venta de seguros con **tres patrones convergentes** que el reto Colsubsidio puede combinar:

1. **Venta directa 100% digital con underwriting ligero** — el usuario aplica en minutos con pocas preguntas, un motor algorítmico decide y la póliza se emite sin agente ni examen médico. Referente limpio: **Ladder** (vida a término, decisión en minutos, hasta US$3M sin examen). [VERIFICADO]
2. **Seguros embebidos en el punto de necesidad** — una plataforma no-aseguradora integra vía API a aseguradoras licenciadas y hace *quote → bind → pay → emisión* instantánea dentro de su propio flujo. Referentes: **Rappi + Chubb Studio** (el más relevante políticamente, porque 30X es la venture builder de Andrés Bilbao, cofundador de Rappi), y en LatAm el **+123 de 123Seguro**. Orquestadores de infraestructura: Cover Genius (XCover), Qover, bolttech. [VERIFICADO]
3. **Agentes conversacionales RAG** que mapean *necesidad → recomendación de producto*, ya en producción sobre **Claude** (caso **InsuranceDekho**, Claude Haiku vía Amazon Bedrock). Arquitectura validada además en literatura peer-reviewed (Nature/Scientific Reports, dic-2025). [VERIFICADO]

El **anti-patrón** más claro a evitar lo encarna la app de **SURA Colombia**: separa el asesor/servicing de la compra — la app gestiona pólizas ya adquiridas pero la cotización/venta vive en otro canal. El usuario rebota entre canales. [VERIFICADO]

**Diferenciador propuesto para Colsubsidio:** fusionar el frente conversacional tipo "Maya" (elicitación estructurada de necesidades con Claude) **con** la emisión embebida instantánea estilo Rappi/Chubb, cerrando la venta en el mismo hilo de chat. Esa unión —asesor conversacional + cierre embebido sin cambiar de canal— es justo lo que las insurtechs en Colombia todavía **no** han integrado bien, y Colsubsidio tiene el activo perfecto para hacerlo: una base de afiliados masiva y de confianza donde embeber la oferta. [CRITERIO PROPIO, apoyado en los 3 patrones verificados]

**Dos advertencias importantes** que salieron de la verificación: (a) ninguna fuente verificada aborda la **frontera regulatoria colombiana "información vs. asesoría"** — es exactamente lo que resuelve la Investigación 1; y (b) se **descartaron por refutación** dos estadísticas de MAPFRE sobre penetración de embedded en LatAm (17% / 42%) y el claim de "compra en dos clics": **no usar esas cifras** en el pitch.

---

## 2. Tabla comparativa de referentes

| Jugador | Mercado | Modelo | Qué automatiza | Qué copiar |
|---|---|---|---|---|
| **Ladder** | EE.UU. | Directo digital (vida a término) | Cotización → preguntas de salud → underwriting acelerado → decisión en minutos → e-sign → activación | Flujo need→quote→issue sin humano; underwriting ligero por cuestionario; escalar a health-check solo en coberturas altas [VERIFICADO] |
| **Lemonade** (bot "Maya") | EE.UU./global | Directo digital conversacional (hogar, vida, mascotas) | Elicitación conversacional → cotización personalizada → pago, en <90s; >90% de pólizas vendidas por bot | UX conversacional de onboarding; velocidad como argumento; **cuidado** con el riesgo reputacional de "IA que discrimina" (ver §8) [REPORTADO] |
| **Root** | EE.UU. | Directo digital (auto) | Onboarding, cambios de póliza, siniestros — todo in-app | Journey 100% en un solo canal/app [REPORTADO] |
| **Rappi + Chubb** (Chubb Studio) | LatAm (México) | Embebido en super-app | Contratación 100% digital de micro-seguros (celular, hogar, fraude online, robo de identidad); siniestros digitales | **Blueprint que 30X reconocerá**: distribución embebida white-label + micro-productos contextuales de emisión instantánea [VERIFICADO] |
| **123Seguro (+123)** | LatAm/Colombia | Plataforma B2B embebida (agregador) | Integra 50+ aseguradoras en canales de bancos/comercios; gestión de auto totalmente online | Patrón agregador multi-aseguradora embebido en canal de un tercero con base de clientes — **análogo directo a Colsubsidio** [VERIFICADO] |
| **SURA** (app Colombia) | Colombia | Servicing digital | Gestión de pólizas existentes (citas, reembolsos, SOAT, pago de primas) | **ANTI-PATRÓN**: no cierra venta en el mismo canal; separa servicing de compra [VERIFICADO] |
| **Cover Genius (XCover) / Qover / bolttech** | Global | Infraestructura embebida (orquestadores) | API única → muchas aseguradoras/productos; quote-bind-pay dentro del journey del partner | Patrón de **function-calling a un motor de quote/bind/pay** detrás de una sola API (en el hackathon se **simula**) [VERIFICADO] |
| **InsuranceDekho** | India | Soporte a agentes con RAG sobre Claude | Chat asistente RAG + clasificador de intención (Claude Haiku) + vector DB + caché semántico | **Prueba de producción del stack Claude+RAG+intent-routing** — valida que lo que construiremos es viable [VERIFICADO] |

---

## 3. Fichas breves — referentes globales

**Ladder [VERIFICADO].** Seguro de vida a término, 100% digital, "no doctors, no needles, no paperwork". Aplicación en minutos con pocas preguntas de salud; underwriting acelerado/algorítmico con decisión en minutos; sin examen médico hasta US$3M. Es el ejemplo más limpio del flujo *necesidad → cotización → emisión* sin intervención humana, con escalamiento a examen solo para coberturas altas.
Fuentes: ladderlife.com, support.ladderlife.com, ethos.com, policygenius.com.

**Lemonade / bot "Maya" [REPORTADO].** Bot conversacional que conduce todo el flujo (recopilar necesidad → cotización personalizada → pago) en menos de 90 segundos; se reporta que **>90%** de sus pólizas se venden vía bot. Es el arquetipo de la elicitación conversacional que inspira nuestro frente. *Nota:* estos números provienen de fuentes secundarias/blogs y **no** entraron al set verificado adversarialmente; úsense como referencia direccional, no como dato duro. Además arrastra un antecedente reputacional (§8).
Fuentes: getperspective.ai, insurnest.com, trixlyai.com.

**Root [REPORTADO].** Seguro de auto totalmente in-app: cotización, cambios, asistencia y siniestros sin agencias físicas, para bajar costo de distribución y ganar velocidad. Refuerza el principio de "un solo canal de punta a punta".
Fuente: canvasbusinessmodel.com.

> *Pendientes de verificar (openQuestions del harness):* mecánicas de **Kin, Getlife, Wefox** no quedaron cubiertas por claims sobrevivientes. Si se necesitan para el pitch, requieren una pasada adicional.

---

## 4. Fichas breves — referentes LatAm / Colombia

**Rappi + Chubb (Chubb Studio) [VERIFICADO].** Alianza que vende seguros embebidos 100% digitales dentro de la super-app vía **Chubb Studio**, plataforma white-label con múltiples APIs y siniestros 100% digitales. Micro-productos lanzados en México (mayo 2021): robo/daño de celular, compras fraudulentas online, robo de identidad, hogar/contenidos — contratables 100% digital desde la app. Chubb Studio sigue activo (motor de embedded con IA anunciado nov-2025). **Es el referente más estratégico para este jurado.**
Fuentes: chubb.mediaroom.com, news.chubb.com, milenio.com, chubb.com/partners.

**123Seguro — plataforma "+123" [VERIFICADO].** Plataforma B2B de seguros embebidos: bancos, financieras y comercios integran y promueven seguros en **sus propios canales**. Los partners ofrecen pólizas de auto de 50+ aseguradoras (30+ en el snapshot 2021), gestión rápida totalmente online. Modelo agregador/exchange multi-aseguradora embebido — el análogo más directo a Colsubsidio como distribuidor con base afiliada.
Fuentes: larepublica.co, 123seguro.com/partners, 100seguro.com.ar.

**SURA (app Colombia) — ANTI-PATRÓN [VERIFICADO].** La app se centra en **gestionar pólizas ya adquiridas** (agendar citas, reembolsos, pagar primas, SOAT digital); **no** expone flujo de compra ni cotización dentro de la app — eso vive en un canal web separado (suraenlinea.com). *Matiz clave:* SURA **sí** vende 100% digital, pero en otro canal; el problema es de **fricción de journey** (rebote entre canales), no de falta de capacidad.
Fuentes: sura.co/seguros/app, Google Play, sura.co/seguros/digitales.

**Contexto regulatorio insurtech Colombia [REPORTADO].** A 2020 no existía norma específica que regulara la actividad insurtech en Colombia (lo que no impidió operar), y había ~10 insurtechs en el país. Dato antiguo y de blog legal — direccional, a validar con la Investigación 1.
Fuente: estudiolegalhernandez.com.

> *Pendientes de verificar:* **Nubank Seguros, Betterfly, Mango Life** no quedaron cubiertos por claims verificados.

---

## 5. Seguros embebidos y APIs relevantes

**Mecánica canónica [VERIFICADO].** El seguro embebido digital es una póliza ofrecida **dentro del flujo de uso o checkout de otro producto**. Una plataforma no-aseguradora se integra vía APIs con una aseguradora licenciada; motores de underwriting automatizados evalúan riesgo; si el cliente acepta, **la póliza se emite de inmediato** con documentos digitales generados sin intervención manual. Esto reduce brechas de cobertura al vender en el momento de necesidad.
Fuentes: stripe.com, chubb.com.

**Orquestadores "una integración → muchas aseguradoras" [VERIFICADO].**
- **Cover Genius (XCover):** API REST única, licencias en 60+ países y 50 estados US, tecnología carrier-agnostic (sin vendor lock-in), "go live in weeks".
- **Qover:** capa API que automatiza todo el ciclo de la póliza; arquitectura compacta config-driven ("integrate once, configure forever").
- **bolttech:** API embebida quote-bind-pay dentro del journey; una integración conecta a ~180 aseguradoras; cotizaciones instantáneas en el punto de necesidad.

*Caveat de verificación:* la evidencia es **copy de vendor** — demuestra la **capacidad y el patrón**, no velocidad de emisión auditada. **No son integrables comercialmente en 5 días.** Sirven como el patrón a **simular** en la demo: nuestro agente hace *function-calling* a un motor de cotización/emisión que en el hackathon mockeamos.
Fuentes: covergenius.com, qover.com/api, bolttech.io, docs.qover.com.

---

## 6. Patrones de arquitectura de agente de IA

**Arquitectura multi-módulo validada [VERIFICADO]** (Nature/Scientific Reports dic-2025, prototipo RAG de seguros de salud) + **caso de producción sobre Claude [VERIFICADO]** (InsuranceDekho vía Amazon Bedrock):

Componentes:
1. **Clasificador de intención** (Claude Haiku en InsuranceDekho) — enruta cada mensaje: consulta general vs. declaración de necesidad vs. intención de cotizar/comprar.
2. **Chatbot conversacional** para consultas generales.
3. **Motor de recomendación de pólizas** — RAG + embeddings semánticos + FAISS que mapea la necesidad declarada (situación, presupuesto, cobertura) a un producto. *(Caveat 2-1: el paper hace recomendación/retrieval, no pricing real ni emisión; "necesidad→cotización" es mapeo interpretativo del funnel.)*
4. **Recuperación documental** para respuestas a nivel de cláusula (qué cubre, exclusiones).
5. **Agente Evaluador de calidad** — puntúa relevancia, precisión, claridad y utilidad de cada respuesta. Diferenciador barato de confianza/QA, muy vistoso en demo en vivo.

Stack off-the-shelf citado por el paper: LLaMA 3, all-MiniLM-L6-v2, industry-bert-insurance, FAISS IndexFlatL2. Para nuestro build lo traducimos a **Claude API** (generación + intent) + embeddings + un vector store simple.

Diagrama conceptual:

```
                         ┌───────────────────────────────┐
   Usuario ──mensaje──►  │  Clasificador de intención     │  (Claude Haiku)
                         │  info | necesidad | cotizar    │
                         └───────────────┬───────────────┘
                     ┌───────────────────┼────────────────────┐
                     ▼                   ▼                    ▼
             ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
             │ Chat general │   │ Motor de         │   │ Cotizar / Emitir │
             │ RAG catálogo │   │ recomendación    │   │ function-calling │
             │ (cláusulas)  │   │ embeddings+FAISS │   │ → motor (MOCK)   │
             └──────┬───────┘   └────────┬─────────┘   └────────┬─────────┘
                    │                    │                      │
                    ▼                    ▼                      ▼
             ┌───────────────────────────────────────────────────────┐
             │   Generación de respuesta (Claude) — un solo hilo      │
             └───────────────────────────┬───────────────────────────┘
                                         ▼
                          ┌──────────────────────────────┐
                          │  Agente Evaluador de calidad  │  (QA / confianza)
                          └──────────────────────────────┘
```

Patrón de latencia para demo: **caché semántico** (Redis/ElastiCache en InsuranceDekho) para que las respuestas repetidas del guion salgan instantáneas ante el jurado. [VERIFICADO]
Fuentes: nature.com/articles/s41598-025-31038-6, aws.amazon.com (InsuranceDekho), zenml.io.

---

## 7. Patrones de UX ganadores

> **Aviso de confianza:** el harness **no** encontró claims verificados sobre UX de reducción de fricción; esta sección es **[CRITERIO PROPIO]**, derivada de los referentes y de una fuente de escalamiento (Xemplar). Tratar como hipótesis de diseño, no como dato.

- **Elicitación estructurada tipo "Maya":** una pregunta a la vez, en lenguaje natural, empezando por el disparador de vida ("acabo de comprar carro", "nació mi hija") en vez de por el producto. El agente traduce la situación a necesidad de cobertura.
- **Divulgación progresiva:** no mostrar 20 productos; recomendar 1–2 con una razón clara ("porque tienes un hijo y mencionaste que eres el único ingreso").
- **Señales de confianza:** mostrar aseguradora respaldante, qué cubre / qué no en lenguaje simple, y precio total sin letra chica. La confianza es la barrera #1 de compra de seguros.
- **Cierre en el mismo hilo:** cotizar, pagar y recibir la póliza sin salir del chat (lo opuesto al anti-patrón SURA).
- **Emisión instantánea con documento digital** al aceptar, como cierre tangible del flujo.

---

## 8. Anti-patrones y modos de falla

> **Aviso de confianza:** salvo el anti-patrón SURA [VERIFICADO], los modos de falla provienen de fuentes no incorporadas al set verificado; marcados **[REPORTADO]**.

- **Separar asesor de compra (SURA) [VERIFICADO].** Rebotar al usuario a otro canal para cerrar mata la conversión. Nuestro agente debe cotizar y emitir en el mismo hilo.
- **"IA que discrimina" / caja negra reputacional [REPORTADO].** Lemonade tuvo que retractarse públicamente en 2021 tras insinuar que su IA analizaba video de los clientes para siniestros, ante acusaciones de discriminación (Forbes). Lección: transparencia sobre qué hace la IA y por qué recomienda; nada de decisiones opacas sobre precio/riesgo.
- **Bots "off-script" [REPORTADO].** El sector reconoce un riesgo nuevo de chatbots que se salen del guion (Insurance Business Mag). Lección: acotar el dominio del agente, usar el Agente Evaluador y disclaimers.
- **No saber cuándo escalar a humano [REPORTADO].** Guías de servicio híbrido (Xemplar) definen disparadores de escalamiento: complejidad de cobertura, frustración detectada, momentos de alto valor emocional/monetario. Aunque el reto pide "sin humano", **diseñar el disparador de escalamiento** (aunque sea a un buzón) es señal de madurez ante el jurado.

---

## 9. Síntesis — qué copiamos + diferenciador

**Qué copiamos (patrones verificados):**
1. **Flujo directo sin humano con underwriting ligero** (Ladder): pocas preguntas → decisión → emisión.
2. **Distribución embebida white-label + micro-productos contextuales** (Rappi/Chubb, 123Seguro): vender en el punto de necesidad, dentro del canal de confianza.
3. **Function-calling a un motor de quote/bind/pay** detrás de una API única (Cover Genius/Qover/bolttech) — **simulado** en la demo.
4. **Stack Claude + intent-routing + RAG + caché** (InsuranceDekho) — probado en producción.
5. **Agente Evaluador de calidad** (Nature) como capa de confianza demostrable.

**Qué evitamos:**
1. Separar asesor de compra (SURA).
2. IA opaca sobre precio/riesgo (Lemonade 2021).
3. Bot sin límites de dominio ni disparador de escalamiento.

**Diferenciador propuesto para Colsubsidio:**
> Un **asesor conversacional (Claude) que hace elicitación estructurada por disparadores de vida y cierra con emisión embebida instantánea, todo en un solo hilo** — la fusión de "Maya" (frente conversacional) + "Rappi/Chubb" (cierre embebido) que las insurtechs colombianas aún no unen. El activo diferencial de Colsubsidio es su **base de afiliados masiva y de confianza** y el conocimiento de su momento de vida (subsidio, vivienda, crédito, educación), que permite ofrecer el seguro correcto en el momento correcto. El "wow" de demo: pasar de "no sé qué necesito" a "tengo mi póliza en pantalla" en una sola conversación, en vivo.

---

## 10. Implicaciones para el esqueleto técnico

Componentes mínimos para el MVP demostrable (todos replicables en 5 días con Claude API + Vercel):

1. **Frente conversacional** (Vercel, Next.js) — chat de un solo hilo.
2. **Clasificador de intención** (Claude) — info / necesidad / cotizar.
3. **Catálogo de productos de seguros** como datos estructurados + **RAG** para cláusulas/coberturas (empezar con catálogo mockeado de productos Colsubsidio realistas).
4. **Motor de recomendación** por reglas + embeddings — mapea disparador de vida → producto.
5. **Motor de cotización/emisión MOCK** invocado por **function-calling** — devuelve prima y "emite" una póliza con documento digital simulado.
6. **Agente Evaluador de calidad** — capa de confianza/QA visible.
7. **Caché** de respuestas del guion para latencia en demo.
8. **Capa de disclaimers/"información vs. asesoría"** — pendiente de la Investigación 1; es diferenciador de cumplimiento.

*El detalle de este esqueleto se define en el Prompt 3, ya con la Investigación 1 (regulación + portafolio real Colsubsidio) en mano.*

---

## 11. Fuentes citadas

**Primarias / verificadas:**
- Ladder — https://www.ladderlife.com/ · https://support.ladderlife.com/What-is-Ladder
- Chubb (Rappi alianza) — https://chubb.mediaroom.com/20211104-Rappi-y-Chubb-amplian-su-alianza... · https://news.chubb.com/2021-5-4-Rappi-and-Chubb-Launch-Digital-Insurance-Offering-in-Mexico · https://www.chubb.com/us-en/partners/technology.html
- 123Seguro — https://www.123seguro.com/partners · https://www.larepublica.co/finanzas/insurtech-123seguros-facilitara-integracion-de-ofertas-de-seguros-de-bancos-y-comercios-3245547
- SURA — https://www.sura.co/seguros/app · https://www.sura.co/seguros/digitales
- Cover Genius — https://covergenius.com/ · Qover — https://www.qover.com/api · https://docs.qover.com/ · bolttech — https://bolttech.io/sales/embedded-insurance-api/
- Embedded (mecánica) — https://stripe.com/resources/more/digital-embedded-insurance · https://www.chubb.com/us-en/businesses/resources/what-is-embedded-insurance.html
- Arquitectura RAG — https://www.nature.com/articles/s41598-025-31038-6 · https://pmc.ncbi.nlm.nih.gov/articles/PMC12796391/
- InsuranceDekho/Claude — https://aws.amazon.com/blogs/machine-learning/how-insurancedekho-transformed-insurance-agent-interactions-using-amazon-bedrock-and-generative-ai/ · https://www.zenml.io/llmops-database/transforming-insurance-agent-support-with-rag-powered-chat-assistant

**Secundarias / blogs (direccional, no verificado adversarialmente):**
- Lemonade/Maya — https://getperspective.ai/blog/lemonade-case-study-conversational-ai-insurance · https://insurnest.com/blog/lemonade-insurance-case-study/ · https://www.trixlyai.com/blog/our-blog-1/agentic-ai-insurance-lemonade-case-study-28
- Root — https://canvasbusinessmodel.com/blogs/how-it-works/root-insurance-how-it-works
- Insurtech Colombia — https://estudiolegalhernandez.com/insurtech-en-colombia-la-nueva-era-de-los-seguros/
- Arquitectura chatbot — https://www.paiteq.com/blog/insurance-chatbot-build-guide/
- Modos de falla/UX — https://www.xemplarengage.com/resources/hybrid-digital-service-insurance/ · https://www.insurancebusinessmag.com/us/news/cyber/when-chatbots-go-offscript... · https://www.forbes.com/sites/carlieporterfield/2021/05/26/insurance-unicorn-lemonade-backtracks...

**Descartado por refutación (NO USAR):**
- MAPFRE — estadísticas "17% embedded / 42% distribución digital en LatAm" y "compra en dos clics" (votación 0-3). https://www.mapfre.com/en/insights/innovation/insurtechs-latin-america-to-move-mountains/

---

## Vacíos que cubre la Investigación 1 (en curso)

El harness marcó explícitamente que **ninguna fuente verificada** cubrió: (a) la **frontera regulatoria colombiana "información vs. asesoría"** de la SFC; (b) el portafolio y modelo de venta **real** de Colsubsidio. Ambos son el objeto de la Investigación 1, que se está ejecutando. Con ella cerramos el diagnóstico y pasamos al **Prompt 3 — diseño del esqueleto**.
