# Reto 2 — Venta automatizada de seguros

> Llevar al cliente desde "no sé qué seguro necesito" hasta "ya quedé asegurado" **sin interacción
> humana**, reemplazando el modelo dependiente de asesores. Panel: **UX · Ingeniería/IA ·
> Producto/insurtech**.
>
> **Calificación: Aplicabilidad 9/10 · Construibilidad 7.5/10.**
> Volver a [síntesis](./00-sintesis-y-ranking.md) · fuentes en [`fuentes.md`](./fuentes.md).

## Productos que ya existen
- **Sure** — quote/rate/bind vía API, llamada de agente o embed móvil; soporte MCP para agentes IA.
- **Cover Genius / XCover** — protección embebida (Uber, Amazon, Ryanair); IA BrightWrite para
  precio/recomendación en tiempo real; 60+ países.
- **bolttech — AI Quoting Assistant** — navega portales de aseguradoras "como un humano".
- **Lemonade / Maya** — agente IA autónomo, journey completo cotización→póliza en <90 seg. **El
  benchmark más cercano al objetivo estricto del reto.**
- **Colombia:** Agentemotor (B2B para intermediarios, **NO self-service**), 123seguro (comparador).
- **Hueco:** el "sin interacción humana end-to-end para consumidor" en español/Colombia está poco
  resuelto.

---

## 1. Comprensión profunda del problema

**El reto mezcla dos problemas distintos, y confundirlos mata el proyecto:**
- **Negocio (Colsubsidio):** baja penetración de seguros voluntarios entre afiliados; costo alto del
  canal asesor (comisiones + no escala + rotación); base cautiva de +4.7 millones que ya tienen
  relación de crédito/subsidio/salud. El asesor humano no escala a millones ni atiende al afiliado de
  estrato 2–3 en municipio pequeño, para quien el ticket es bajo y la comisión no justifica el tiempo.
- **Cliente (afiliado):** "no sé qué necesito"; desconfianza (percibe que el asesor le vende lo que
  más comisiona); jerga (deducible, carencia, preexistencia, suma asegurada); miedo a la letra
  chica/exclusiones; fricción del pago; y a menudo **baja alfabetización digital**.

**Portafolio real de Colsubsidio (verificado):** vida individual/familiar, **exequial** (con aliados
Grupo Recordar/Bolívar), vida+ahorro, salud (alianza Colsanitas), hogar, colectivos. Colsubsidio actúa
como **tomador/comercializador/aliado de aseguradoras**, no como aseguradora — matiz regulatorio clave.

> **Insight guía:** el "asesor" que la IA reemplaza no es un vendedor de pólizas, es un **traductor de
> vida a cobertura**. La gente no quiere "un seguro exequial"; quiere "que mi familia no quede
> endeudada si me muero". El reto no es cotizar rápido (eso ya lo hace Lemonade); es **descubrir la
> necesidad con confianza en un contexto de baja educación financiera y en español coloquial**.

**Cliché a evitar:** "democratizamos los seguros con IA". Vacío. El diferencial es **traducción de
necesidad + confianza**.

---

## 2. Lente UX

**Reto central:** convertir "no sé qué necesito" en "confío en esta recomendación" — sin abrumar y sin
manipular.

**Diseño de la conversación (needs-discovery):**
- **No preguntar por productos, preguntar por la vida.** Nada de "¿vida o exequial?". Sí: "¿Quién
  depende de tus ingresos?", "¿Si faltaras, quién cubriría los gastos?", "¿Tienes deudas que
  dejarías?". El LLM mapea a coberturas.
- **Progresiva y ramificada, máx. 4–6 preguntas**, cada una justificada ("te pregunto esto porque…").
- **Recomendación con "por qué"** — incluida la del *descarte* ("te recomiendo exequial y no
  vida-ahorro porque no mencionaste dependientes con deudas grandes"). Explicar el descarte genera
  más confianza que explicar lo elegido.

**Confianza y transparencia (aquí está el oro):**
- **Transparencia radical de exclusiones ANTES de pagar**, no en letra chica. "Esto NO cubre: X, Y,
  Z. ¿Te sirve igual?". Contraintuitivo comercialmente, pero es lo que el modelo asesor-comisión no
  hace, y el mayor generador de confianza.
- **Anti-venta como feature:** el agente debe poder decir **"no necesitas este seguro"** o "con lo que
  ya tienes por Colsubsidio, estás cubierto". Un asesor de IA que a veces dice que NO es infinitamente
  más creíble — y es la defensa ética central.
- **Momento de pago:** separar "entender/decidir" de "pagar". Resumen simple, confirmación explícita,
  y débito desde la relación existente (nómina/tarjeta multiservicios) reduce fricción vs. pedir
  tarjeta.

**Voz vs. chat — recomendación: VOZ como diferencial, chat como fallback.** El evento promueve Gemini
Live API (voz nativa, baja latencia, español). Para población de baja alfabetización digital, hablar
es más natural que escribir. **Riesgo honesto de la voz:** peor para mostrar cifras/exclusiones/
consentimiento legal (efímera, mala para "letra chica" que debe quedar registrada). **Solución: voz
para descubrir/explicar, pantalla para confirmar/pagar** (multimodal). Nunca cerrar una venta regulada
solo por audio sin respaldo visual/registro.

**Riesgo ético (criterio de jurado):** una IA con objetivo de conversión puede volverse un manipulador
perfecto. Optimizar **"cobertura adecuada"**, no "venta cerrada". La IA nunca sube la suma asegurada
por encima de la necesidad declarada.

---

## 3. Lente Ingeniería / IA

**Arquitectura de referencia (4 capas):**
1. **Needs-discovery conversacional (LLM):** diálogo → JSON de perfil (`dependientes`, `deudas`,
   `ingreso`, `prioridad`, `edad`). El LLM es excelente aquí.
2. **Mapeo necesidad → producto (reglas + LLM):** matriz determinística "perfil → producto(s)
   elegible(s)". El LLM propone y explica; **las reglas deciden la elegibilidad**.
3. **Motor de cotización (reglas/tarifas, NO LLM):** tabla de tarifas por edad/suma/producto.
   Determinístico, auditable.
4. **Bind/emisión:** póliza + registro de consentimiento + medio de pago.

**Regla de oro:**
- **SÍ (LLM):** conversar, extraer necesidades, explicar en lenguaje simple, traducir jerga, resumir
  exclusiones, empatizar, manejar dudas.
- **NO (jamás):** calcular primas, decidir tarifas, evaluar riesgo, inventar coberturas o exclusiones.
  **Un LLM que "estima" una prima es un pasivo legal.**

**Anti-alucinaciones en dominio regulado:**
- **RAG estricto sobre condicionados** reales/sintéticos: el LLM solo habla de coberturas/exclusiones
  recuperadas del documento, con cita. Nada de conocimiento paramétrico.
- **Function calling** para cotizar: el LLM llama a `cotizar(producto, edad, suma)` y **repite** el
  número que devuelve la herramienta.
- **Grounding + guardarraíles:** validar que el producto existe; bloquear afirmaciones de cobertura no
  presentes en el condicionado.
- **Trazabilidad:** cada recomendación guarda perfil, regla aplicada y fragmento citado → auditable
  ante SFC.

**Realista en 5 días (con productos/tarifas sintéticos):** un solo producto acotado (exequial), 3–5
preguntas, matriz de reglas simple, tarifa sintética en tabla, Gemini + Live API para voz, RAG sobre
1–2 condicionados, "emisión" simulada que genera un PDF/certificado y registra consentimiento. Todo el
flujo, un producto, extremo a extremo.

---

## 4. Lente Producto + regulación

**Propuesta de valor:** *"Un asesor de seguros por voz, en español claro, que te dice qué necesitas
—y qué NO— y te asegura en minutos, sin venderte de más."*

**Métricas (no vanity):** tasa de comprensión (mini-quiz post-recomendación); conversión
descubrimiento→emisión balanceada con **tasa de "adecuación"** y **tasa de anti-venta** (casos donde
la IA dijo "no lo necesitas"); CAC vs. canal asesor; persistencia (cancelaciones tempranas = venta
inadecuada); NPS.

**Marco regulatorio colombiano (crítico):**
- Supervisa la **SFC**. Rigen el **deber de información** y la **protección al consumidor financiero
  (SAC)**; para intermediación, la **idoneidad** (Circular Externa 050/2015).
- **¿Se puede vender "sin interacción humana"? Sí, con matices — y ese matiz define el alcance:**
  - Los **seguros masivos/inclusivos/microseguros** están pensados para canales alternativos/digitales
    simplificados. Ahí la venta automatizada es viable.
  - El punto delicado es el **deber de asesoría/idoneidad**. **Lectura ganadora:** posicionar el agente
    como **herramienta de información y ayuda a la decisión** con **transparencia total de comisión y
    exclusiones** y registro de consentimiento informado. Productos **previsionales/vida compleja** no
    son el caso para el MVP.
- **Límites:** habeas data (Ley 1581) para usar datos del afiliado (requiere autorización); constancia
  de consentimiento; información veraz y suficiente (la transparencia radical juega a favor legal, no
  solo de UX).

**Conclusión de producto:** la venta 100% automatizada es defendible **para productos simples/masivos**
(exequial, microseguros) con consentimiento y transparencia; **no** para toda la gama. Acotar a ese
subconjunto es correcto, no una limitación.

---

## 5. Alcance para hackathon (MVP 5 días)

**Producto-caso: SEGURO EXEQUIAL** (o un microseguro de accidentes como alternativa aún más simple).
Por qué exequial: emocionalmente universal en Colombia, simple, prima baja, exclusiones acotadas,
encaja en venta masiva/digital, y Colsubsidio ya lo ofrece (creíble para el jurado).

**Qué se construye (un producto, extremo a extremo):**
1. **Agente de voz en español (Gemini Live API)** — needs-discovery: 4–5 preguntas sobre
   vida/familia/prioridad.
2. **Motor de reglas** perfil→recomendación + **explicación del porqué y del descarte**.
3. **Cotización determinística** desde tabla de tarifas sintética por edad/plan.
4. **Transparencia radical:** qué cubre y qué NO, en pantalla, antes de confirmar.
5. **"Emisión" simulada:** consentimiento explícito + certificado/póliza PDF + confirmación. Pago
   mockeado.
6. **RAG** sobre 1 condicionado sintético para no alucinar coberturas.

**Stack:** Gemini 2.5/Live API (voz + LLM) con function calling; frontend web multimodal (voz +
tarjetas de confirmación); backend ligero (Python/Node) con reglas + tabla de tarifas + RAG; generación
de PDF. Datos 100% sintéticos.

**Guion del demo (3 min):** usuario habla ("no sé qué seguro necesito, tengo dos hijos y una deuda del
carro") → IA pregunta 4 cosas → recomienda con justificación → **momento wow: "no te vendo el plan
premium, con tu situación te basta el familiar"** → muestra exclusiones sin letra chica → confirma por
voz+pantalla → aparece el certificado. Cierre: *"de 'no sé' a 'asegurado' en 3 minutos, sin asesor y
sin que me vendan de más."*

**Out of scope:** pago real/pasarela, integración con core de aseguradora, KYC real, múltiples
productos, tarifas actuariales reales, cumplimiento SFC productivo.

---

## 6. Factor diferencial vs. lo existente

Lemonade/Maya ya hace el journey autónomo <90s **en inglés, hogar/mascotas, EE.UU.**. Copiar eso
pierde. Candidatos:
- **A — Asesor por VOZ en español colombiano coloquial (Gemini Live), para baja alfabetización
  digital.** El canal (voz natural) *es* la inclusión: llega a la abuela en Fusagasugá, no solo al
  millennial urbano.
- **B — Transparencia radical + anti-venta como núcleo de confianza.** El agente que te dice qué NO
  necesitas y lee las exclusiones antes de cobrar. Ataca el dolor de desconfianza que el modelo de
  comisión estructuralmente no puede resolver.
- **C — Needs-discovery con datos reales de la vida del afiliado Colsubsidio** → recomendación
  hiper-contextual y débito desde la relación existente. **Foso estructural** que ningún insurtech
  global replica. Pero **no demoable en 5 días** (integración + habeas data) → úsalo como narrativa de
  escalamiento.

**El más fuerte — el panel elige (A)+(B), con (C) como visión:**
> El ganador es **"asesor de confianza por voz en español que a veces te dice que no compres"**.

(A) solo es "Maya en español" (replicable). (A)+(B) es construible en el hackathon, emocionalmente
diferenciado, defendible legalmente (transparencia = cumplimiento del deber de información), y atacar
la desconfianza es lo que el modelo asesor-comisión no puede.

**Cliché a matar en el pitch:** "reemplazamos al asesor" → mejor **"reemplazamos el conflicto de
interés del asesor por transparencia"**.

---

## 7. Calificación

- **Aplicabilidad: 9/10.** Colsubsidio tiene el problema exacto (baja penetración, base masiva de
  bajos ingresos, canal asesor que no escala), ya vende exequial/vida/microseguros, y la relación con
  el afiliado es un activo único. Pierde 1 porque la venta 100% automatizada tiene fronteras
  regulatorias reales (asesoría en productos complejos) → aplica al segmento masivo/simple, no a todo.
- **Construibilidad: 7.5/10.** Un MVP acotado a **un** producto (exequial) con tarifas/condicionados
  sintéticos es abarcable. Riesgos que bajan la nota: (1) **Gemini Live API** en vivo puede dar
  latencia/interrupciones/español regional — **fallback a chat obligatorio**; (2) tentación de
  múltiples productos o pago real; (3) el RAG anti-alucinación necesita curaduría fina. Disciplina de
  alcance = éxito.

**Veredicto:** gana el equipo que resista "hacer un Lemonade" y construya el asesor por voz,
transparente y que a veces dice "no compres" — un solo producto, extremo a extremo, con el momento
anti-venta como clímax. La diferenciación no está en la velocidad ni en la IA (ya existe); está en
**traducir vida a cobertura con confianza, en español y por voz**.
