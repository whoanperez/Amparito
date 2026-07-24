# Hackathon Colsubsidio × 30X — Síntesis y ranking de los 4 retos

> Documento maestro. Análisis de los cuatro retos del hackathon para decidir cuál atacar, con qué
> alcance y con qué factor diferencial. Cada reto tiene su archivo detallado; las fuentes están en
> [`fuentes.md`](./fuentes.md).
>
> **Nota (consolidación en Amparito):** de los 4 análisis por reto, aquí solo se trajo el elegido
> ([`02-reto-seguros.md`](./02-reto-seguros.md)). Los 3 no elegidos (crédito, vivienda, cocina) quedaron
> en el repo de estrategia `colsubsidio-hackathon/docs/` — los enlaces `01/03/04-reto-*.md` de abajo
> apuntan allá, no a este repo.

**Evento:** Hackathon Colsubsidio × 30X · 22–26 julio 2026 · Bogotá (Club La Colina), modalidad
híbrida · equipos de 3–5 personas · 5 días.
**Foco tecnológico del evento:** IA generativa — sesiones de "vibe coding", "cómo construir tu MVP
con IA" y **Gemini Live API** (voz en tiempo real). Se espera un MVP funcional construido en pocos
días apalancando LLMs.

**Los cuatro retos:**
1. [Crédito hiperpersonalizado](./01-reto-credito.md)
2. [Venta automatizada de seguros](./02-reto-seguros.md)
3. [Perfilamiento inteligente de leads (vivienda)](./03-reto-vivienda.md)
4. [Captura inteligente en operaciones de cocina](./04-reto-cocina.md)

---

## ✅ DECISIÓN TOMADA (23-jul-2026): se construye el Reto 2 — Seguros

> El ranking de abajo se conserva como el análisis que llevó a la decisión, pero **el equipo ya
> eligió: se construye la _venta automatizada de seguros_** (Reto 03 oficial del hackathon). El
> material de build vive en [`reto-seguros/`](../reto-seguros/) (requerimiento oficial con pesos de
> evaluación, base real de 1.566.028 afiliados y catálogo real). Aunque el ranking situaba a Cocina y
> Vivienda como finalistas por construibilidad/foso, la decisión final fue Seguros. **El foco ya no es
> elegir, sino especificar y construir el MVP de seguros.**

---

## 1. El patrón que comparten los 4 retos (léelo primero)

Los cuatro análisis convergen en la **misma arquitectura ganadora**. Entenderla vale más que
cualquier reto individual:

> **El LLM conversa, extrae y explica. Las reglas deterministas deciden. Los datos son sintéticos.
> Gemini Live (voz) es el "wow" opcional, nunca la dependencia crítica.**

La regla de oro repetida en los cuatro: **nunca dejes que el LLM calcule lo regulado** (primas,
riesgo, montos de subsidio, elegibilidad crediticia). Eso es determinístico y auditable. El LLM
*conduce la conversación y traduce*; las funciones deciden; el LLM *comunica con empatía* el
resultado. Patrón técnico: **function calling / tool use** desde el LLM hacia un motor de reglas.

Y el **factor diferencial es el mismo en los cuatro**: no competir donde los incumbentes globales ya
ganaron (el motor/OCR/scoring), sino apalancar:
- **El dato único de Colsubsidio** (nómina, categoría A/B/C, subsidio, afiliación, consumo
  cross-servicio) — un activo que ningún competidor global puede replicar.
- **Una IA éticamente honesta** ("a veces te digo que NO"): no sobre-endeudar, no vender de más,
  decir la verdad cuando no calificas. Es lo que una **caja de compensación** (misión social, no
  maximización de margen) quiere premiar.

---

## 2. Ranking cruzado

| Reto | Aplicabilidad | Construible 5 días | Demoable en vivo | Foso inimitable | ROI medible |
|---|:---:|:---:|:---:|:---:|:---:|
| **4 · Cocina (voz)** | 9 | **9** | 🔥 altísima | Medio | 🔥 duro (food cost) |
| **3 · Vivienda (subsidio)** | 9 | 8 | Alta | 🔥 máximo | Alto |
| **1 · Crédito** | 9 | 8 | Media | Alto | Medio |
| **2 · Seguros** | 9 | 7.5 | Alta | Medio | Medio |

Los cuatro tienen aplicabilidad real (por eso Colsubsidio los eligió). La diferencia está en
**construibilidad + demoabilidad + defensibilidad**. Se separan dos finalistas: **Cocina** y
**Vivienda**.

---

## 3. Veredicto: hay dos apuestas, ambas buenas

### 🥇 Para GANAR el hackathon → Reto 4: Captura por voz en cocina
- **Mejor casado con las herramientas del evento**: Gemini Live API (voz en tiempo real) es
  literalmente su showcase perfecto.
- **ROI más duro**: food cost es 28–35% de los costos de una operación de F&B; ahorro medible de
  3–5%. Tiene un número financiero al final; muchos retos de hackathon no.
- **El más memorable en vivo**: alguien con guantes puestos suelta una frase desordenada con jerga
  colombiana ("quedan 15 cebollas cabezona, se me dañó una caja de tomate, y mándame aceite") y en
  pantalla aparecen tres registros estructurados —conteo, merma, requisición— y el sistema confirma
  por voz.
- **Riesgo**: es de ejecución de demo (STT con ruido/jerga en vivo). Se mitiga con push-to-talk,
  catálogo pequeño curado, buen micrófono y fallback de texto.

### 🏆 Para MÁXIMO valor estratégico → Reto 3: Precalificación de subsidio en vivienda
- **Único foso verdaderamente inimitable**: Colsubsidio **ES la fuente del subsidio** y dueño del
  dato de afiliación. Structurely y todos los competidores califican leads preguntando "¿tienes
  pre-aprobación?"; ninguno puede decirle al comprador *a cuánto subsidio tiene derecho*.
- **Timing inmejorable**: Mi Casa Ya se quedó **sin presupuesto en 2026**, así que el subsidio de
  caja es *el* protagonista del año.
- **El movimiento clave**: convertir la calificación de un interrogatorio en un servicio. El
  comprador da sus datos y en 2 minutos recibe: *"Por tu categoría B calificas a un subsidio de hasta
  ~$35M; para este proyecto te faltarían ~$X de cuota inicial; estás listo para hablar de cierre."*
- **Riesgo**: no quemar 2 de 5 días peleando con la aprobación de WhatsApp Business API → demostrar
  con widget web estética WhatsApp.

### Recomendación
- Equipo con perfil fuerte de **demo/frontend que quiere el trofeo** → **Cocina**.
- Equipo con perfil de **producto/negocio que quiere impacto que Colsubsidio adopte** → **Vivienda**.
- En igualdad de condiciones: **Cocina para ganar el evento** (menor riesgo de alcance, máxima
  demoabilidad, encaja como anillo al dedo con Gemini Live); **Vivienda como el de mayor upside
  estratégico**.

---

## 4. Por qué NO los otros dos (aunque son buenos)

- **Reto 1 (Crédito):** aplicabilidad altísima y el mejor foso de datos, pero es el **campo más
  saturado del mundo** (FICO, Zest, OfferFit) y el más fácil de terminar en un MVP genérico. El
  ángulo salvable —"crédito justo" que incluye al que la banca rechaza y protege al que no debe
  endeudarse— es potente pero difícil de hacer *wow* en 3 minutos. Alto riesgo de perderse
  construyendo un modelo de ML que con datos sintéticos no prueba nada.
- **Reto 2 (Seguros):** el más bonito conceptualmente, pero **la construibilidad más baja (7.5)** por
  fronteras regulatorias reales (deber de asesoría/idoneidad SFC) y porque el benchmark
  —Lemonade/Maya— ya hace el journey autónomo. Hay que acotarlo mucho (un solo producto, exequial)
  para que sea viable.

---

## 5. Metodología

Este análisis se produjo en dos capas:
1. **Investigación de mercado verificada** (deep-research: 23 fuentes, 25 afirmaciones verificadas de
   forma adversarial con 3 votos cada una) para mapear productos reales que ya resuelven cada reto.
2. **Panel de expertos por reto** (UX + ingeniería + producto), con investigación web propia, marco
   regulatorio colombiano, propuesta de MVP y calificación honesta.

Todas las fuentes en [`fuentes.md`](./fuentes.md).
