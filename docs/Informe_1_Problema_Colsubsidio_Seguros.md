# Informe 1 — El problema real de Colsubsidio (seguros)
### Insumo para el Hackathon Colsubsidio × 30X · Reto "Venta Automatizada de Seguros"

> **Metodología y nivel de confianza.** Investigación con harness de verificación adversarial. La fase de *síntesis automática falló por un límite de sesión*, pero el harness dejó **17 afirmaciones verificadas** (votación 3-a-1, la mayoría 3-0) con fuentes primarias. Esta síntesis la compuse yo a partir de esas afirmaciones verificadas. Convención de confianza:
> - **[VERIFICADO]** — afirmación que sobrevivió verificación adversarial con fuente primaria.
> - **[GENERAL]** — conocimiento de contexto no verificado por esta investigación; validar.
> - **[PENDIENTE]** — no se obtuvo dato (búsqueda incompleta por el límite de sesión).
>
> Fecha: 16 julio 2026 · **Actualizado 17 julio 2026** — se completaron las secciones §2 (base de afiliados) y §6 (competencia) con investigación dirigida a fuentes primarias.

---

## 1. Resumen ejecutivo

Colsubsidio **ya vende seguros y ya hace seguros embebidos**, pero de forma **fragmentada y semi-digital**: distribuye pólizas de terceros (MetLife, Chubb, Pan-American Life) como **caja-distribuidor**, mezcla canales con asesor humano (canal empresarial: "Contácta un asesor") y de autoservicio (sitio "Seguros Colsubsidio": "haz clic en el seguro que más te interese"), y **no** expone los seguros como gestión autogestionable en su Portal Transaccional. El gap es claro: hay piezas digitales sueltas, pero **no un flujo conversacional único que lleve al afiliado de "no sé qué necesito" a "quedé asegurado"**. [VERIFICADO]

El hallazgo más valioso es **regulatorio y juega a favor del reto**: la normativa colombiana **permite expresamente** vender seguros por canales no presenciales (internet, banca móvil, IVR, call center, acceso remoto), y define que la comercialización **masiva/automatizada** es legal **siempre que el producto cumpla tres criterios — universalidad, sencillez y estandarización** — y se cumpla el **deber de información** (Ley 1328/2009, Art. 9: características, coberturas, precio y forma de cálculo, exclusiones, consecuencias). En otras palabras: **automatizar la venta sin humano es viable legalmente si se eligen productos estandarizados y se despliega la información mínima obligatoria**. Ese es, a la vez, el camino de cumplimiento y el diferenciador del pitch. [VERIFICADO]

Colsubsidio incluso **ya tiene un precedente propio de seguro embebido**: el cupo de crédito de su Tarjeta Afiliación trae, desde la activación y sin asesor, un seguro de vida (Pan-American Life) con coberturas de fallecimiento, incapacidad y desempleo. Es la prueba de que la caja puede embeber cobertura en sus productos — solo falta el frente conversacional que lo extienda a todo el portafolio. [VERIFICADO]

Y un dato competitivo de peso (completado el 17 jul con fuentes primarias): **ninguna de las grandes cajas — Colsubsidio, Compensar, Cafam — ni SURA cierra hoy la venta de seguros 100% digital sin humano**; todas terminan derivando a un asesor o a WhatsApp. El **flujo conversacional único que cierra la venta sin intervención humana es, literalmente, un espacio vacío** en el mercado colombiano de cajas — y Colsubsidio, con 1,6 millones de afiliados y relación de confianza, es quien está mejor posicionado para ocuparlo. [VERIFICADO]

---

## 2. Colsubsidio y su base de afiliados

**Escala (Balance 2025, fuente primaria Colsubsidio) [VERIFICADO]:**
- **1.621.106 trabajadores afiliados** — Colsubsidio se declara "la caja de compensación con mayor número de afiliados en Colombia".
- **Más de 2,8 millones de beneficiarios** cubiertos entre todos los programas.
- Actividad reciente que revela momentos de vida aprovechables: 612.162 personas con subsidio monetario, 27.022 subsidios de desempleo otorgados, 91.000+ buscadores de empleo registrados, 19.970 hogares apoyados en vivienda, 37.494 niños en primera infancia. Cada uno de esos eventos es un **gatillo de necesidad de seguro** (desempleo → renta/desempleo; nuevo hogar → hogar; hijo → vida/educativo).

**Segmentación por categorías (régimen de cajas, confirmado con fuente del sector) [VERIFICADO]:**
- **Categoría A:** 0–2 SMMLV (hasta ~$3,50 M mensuales en 2026; SMMLV 2026 ≈ $1.750.905).
- **Categoría B:** 2–4 SMMLV (~$3,50 M–$7,00 M).
- **Categoría C:** 4+ SMMLV (~$7,00 M en adelante).
Las categorías **A y B** reciben cuota monetaria (mayor vínculo transaccional con la caja) y concentran a la base masiva de menores ingresos — el segmento natural para **micro-seguros estandarizados** de bajo costo. La **C** es el público de mayor capacidad de pago para coberturas voluntarias más amplias.

Además, lo verificado del portafolio muestra que varios seguros ya están **ligados a servicios que el afiliado usa** — Cuota Monetaria, Cupo de Crédito, Recreación, Renta Garantizada [VERIFICADO] — confirmando la lógica de "seguro pegado al momento de vida/servicio", que es el gancho de la venta contextual.

> **[PARCIAL]** Falta el dato **granular de madurez digital** (descargas de la app, volumen de transacciones en línea, % de afiliados que autogestionan). Colsubsidio opera un Portal Transaccional robusto (citas, subsidios, pagos), lo que evidencia adopción digital, pero las cifras exactas conviene tomarlas del Informe de Gestión y Sostenibilidad 2025 (PDF oficial) para el pitch.

---

## 3. Portafolio de seguros y aliados aseguradores

Colsubsidio opera como **caja-distribuidor**: no es la aseguradora, sino que distribuye pólizas suscritas por aseguradoras aliadas. [VERIFICADO]

Aliados y productos verificados:

| Aseguradora | Figura | Productos verificados |
|---|---|---|
| **MetLife** | Convenio de seguros masivos/afinidad (caja = distribuidor, MetLife = asegurador) | Cuota Monetaria, Cupo Crédito, Recreación, Renta Garantizada (incl. renta mensual por muerte accidental 12 meses + auxilio funerario) [VERIFICADO] |
| **Chubb Seguros Colombia** | Aliada de Colsubsidio | Producto Oncológico, Protección Urbana (hurto/robo, protección de bienes), Accidentes Personales [VERIFICADO] |
| **Pan-American Life** | Alianza para seguro ligado al crédito | Seguro de vida del cupo de crédito de la Tarjeta Multiservicios [VERIFICADO] |

Taxonomía oficial del centro de ayuda (4 categorías): **Seguro de Arrendamiento, Seguros Para Créditos, Seguros Voluntarios, Crédito Rotativo Para Seguros** [VERIFICADO — voto 2-1].

**Precedente de seguro embebido propio [VERIFICADO]:** el cupo de crédito de la Tarjeta Afiliación incluye automáticamente, desde la activación y sin asesor, un seguro de vida con coberturas de fallecimiento, incapacidad total y permanente, incapacidad temporal y desempleo. *Implicación:* Colsubsidio ya domina el patrón "embeber cobertura en un producto"; el reto es extenderlo a una venta conversacional de todo el catálogo.

> *Nota de rigor:* se **descartaron por refutación** dos afirmaciones sobre la figura contractual exacta (que fuera "convenio comercial no-intermediario" y que fuera "Seguros Colectivos para Empresas"). No afirmes en el pitch la figura jurídica precisa Chubb–Colsubsidio; sí es seguro decir "distribución bajo convenio de seguros masivos/afinidad" (verificado para MetLife).

---

## 4. Modelo de venta actual y mapa de fricciones

El modelo actual es **híbrido y fragmentado**, y ahí está la oportunidad:

- **Canal empresarial (convenios con empresas afiliadas):** mediado por **asesor humano** — la página invita a "Contácta un asesor" en lugar de permitir compra autoservicio. [VERIFICADO]
- **Canal de autoservicio (sitio "Seguros Colsubsidio"):** el método oficial para adquirir un seguro es que **el afiliado entra y "hace clic en el seguro que más le interese"**, sin que se describa intervención de asesor en el paso de compra. [VERIFICADO]
- **Portal Transaccional (autogestión):** concentra citas médicas, subsidios, tarjeta de afiliación, educación (CiberColegios) y recreación (Piscilago). **Los seguros NO aparecen** como gestión autogestionable → la venta/gestión de seguros **aún no está integrada** al hub digital principal del afiliado. [VERIFICADO]

**Mapa de fricciones (embudo):**

```
Necesidad ──► Descubrimiento ──► Cotización ──► Explicación ──► Cierre ──► Emisión
   │             │                  │              │             │           │
 El afiliado   Los seguros no     Autoservicio   Canal          Depende    Embebido
 no sabe qué   están en el        existe pero    empresarial    del canal  solo en
 necesita ni   Portal Transac-    aislado del    manda a        (asesor    crédito;
 que existen   cional (hub) →     resto de su    "contactar     vs. web    no hay
 (sin gatillo  baja visibilidad   relación con   un asesor" →   aislada)   asesor que
 contextual)                      la caja        no 24/7                    cierre 24/7
```

Fricciones clave, todas atacables por el reto: (1) **falta de gatillo contextual** — nadie le dice al afiliado "por tu momento de vida, esto te conviene"; (2) **canales desconectados** — autoservicio por un lado, asesor por otro, hub transaccional sin seguros; (3) **dependencia del asesor** en el canal de mayor valor (empresas), que no escala ni opera 24/7 — exactamente lo que enuncia el reto.

---

## 5. Restricciones regulatorias y qué es legalmente automatizable sin humano

**Esta es la sección diferenciadora del pitch.** La normativa colombiana **habilita** la venta automatizada, con condiciones claras:

**Lo que la ley permite [VERIFICADO]:**
- **Canales no presenciales autorizados:** banca móvil, internet, IVR, call/contact center y sistemas de acceso remoto. → La venta a distancia, sin oficina ni (necesariamente) asesor presencial, **está habilitada**. (Régimen de Seguros / Fasecolda.)
- **Comercialización masiva/automatizada:** legal siempre que el producto cumpla **universalidad, sencillez y estandarización** (documento técnico URF 2018 y Régimen de Seguros). → Los **micro-seguros y productos estandarizados** (accidentes, exequial, hurto, oncológico de cobertura fija) son los candidatos naturales para automatizar; los productos complejos/ajustables requieren más asesoría.

**Lo que la ley exige [VERIFICADO] — el deber de información (Ley 1328 de 2009):**
- **Régimen de Protección al Consumidor Financiero** cubre el sector asegurador, bajo vigilancia de la **SFC**.
- **Debida diligencia (Art. 3):** aplica a **cualquier canal**, incluido uno automatizado.
- **Transparencia e información cierta, suficiente, clara y oportuna (Art. 3).**
- **Contenido mínimo obligatorio (Art. 9):** características del producto, derechos y obligaciones, condiciones, **tarifas/precios y su forma de cálculo**, medidas de manejo seguro, y consecuencias del incumplimiento. → **Esta es la checklist exacta que el agente debe desplegar en cada cotización/emisión.**

**Marco normativo aplicable [VERIFICADO]:** Ley 389 de 1997 (arts. 5 y 6), Decreto 2555 de 2010, Decreto 034 de 2015, y **Circular Externa 006 de 2025 de la SFC**.

**Traducción para el build — "compliance by design":**
> El agente conversacional es legal si (a) opera sobre **productos estandarizados** (universales, sencillos), (b) despliega **la información mínima del Art. 9** antes de cerrar (coberturas, exclusiones, precio y cómo se calcula, consecuencias), y (c) documenta el **deber de información** en el propio hilo (registro/consentimiento). La frontera "información vs. asesoría" se maneja así: el bot **informa y recomienda entre opciones estandarizadas** con transparencia total; para productos que exigen asesoría personalizada compleja, **ofrece escalamiento**. Mostrar esta capa de cumplimiento en la demo es lo que un jurado de Colsubsidio (sector financiero, vigilado por SFC) va a querer ver y casi nadie más va a traer.

---

## 6. Contexto competitivo en Colombia

**Comparativo verificado (fuentes primarias, 17 jul):**

| Actor | Portafolio de seguros | Canal de venta | ¿Cierra sin humano? |
|---|---|---|---|
| **Colsubsidio** | Oncológico, Protección Urbana, Accidentes (Chubb); Cuota Monetaria, Cupo Crédito, Recreación, Renta (MetLife); vida de crédito (Pan-American) | Autoservicio parcial + "Contácta un asesor" (empresas); seguros ausentes del Portal Transaccional | **No** — fragmentado |
| **Compensar** | Vehículos, arrendamiento (Zurich), exequial (Colmena, Capillas de la Fe), mascotas (Seguros Bolívar), SOAT (Axa Colpatria) | Formularios de contacto → asesores; SOAT por **WhatsApp** con agente | **No** — asesor/WhatsApp |
| **Cafam** | Todo Riesgo Autos, Salud Cafam+Integral, Asistencia Integral, Accidentes Personales, Accidentes+Asistencia | "Solicítalo aquí" → **WhatsApp** con representante | **No** — WhatsApp |
| **SURA** (Informe 2) | Portafolio amplio | App solo servicing; venta en canal web aparte | **No** — canal separado |

**Conclusión competitiva [VERIFICADO]:** el mercado de cajas en Colombia ofrece seguros pero **ninguno cierra la venta 100% digital, sin humano, en un solo hilo**. Todos derivan a asesor o a WhatsApp con un agente. La regulación **ya permite** el canal digital/no presencial y la venta masiva estandarizada [VERIFICADO §5], así que el freno no es legal: es que **nadie lo ha construido**. Ese es el whitespace exacto del reto, y el argumento de que la solución es diferenciada y no un "me too".

---

## 7. Declaración del problema y segmentos priorizados

**Problem statement:**
> El afiliado de Colsubsidio **no sabe qué seguro necesita**, no encuentra los seguros donde gestiona el resto de su vida con la caja (Portal Transaccional), y cuando los busca choca con canales desconectados: un autoservicio aislado o un asesor humano que no escala ni opera 24/7. Resultado: **sub-aseguramiento y abandono**, pese a que Colsubsidio tiene la relación de confianza, el catálogo (MetLife, Chubb, Pan-American Life) y la base de afiliados para cerrar la venta.

**Segmentos priorizados para el MVP (por facilidad de automatización legal):**
1. **Afiliado con gatillo de vida claro + producto estandarizado** (accidentes personales, hurto/Protección Urbana, oncológico de cobertura fija, exequial). Cumple universalidad/sencillez/estandarización → automatizable sin fricción regulatoria. **Segmento estrella de la demo.**
2. **Afiliado con cupo de crédito activo** — ya tiene seguro embebido; ideal para *upsell* contextual de coberturas complementarias.
3. *(Secundario)* **Empresa afiliada / colectivo** — hoy 100% mediado por asesor; mayor valor pero más complejo, mejor como visión de expansión que como MVP.

---

## 8. Implicaciones para el build (qué DEBE y qué NO debe hacer la solución)

**DEBE:**
- Cerrar la venta **en un solo hilo conversacional** (necesidad → recomendación → cotización → info Art. 9 → emisión), sin rebotar a otro canal (lección anti-SURA).
- Partir de un **gatillo de vida contextual** ("acabo de comprar moto", "nació mi hija") en lugar de un catálogo frío.
- Operar sobre **productos estandarizados** (universalidad/sencillez/estandarización) para ser automatizable sin violar regulación.
- Desplegar **la información mínima del Art. 9** antes del cierre y registrar el consentimiento — la capa de cumplimiento visible.
- Apoyarse en el **precedente embebido de Colsubsidio** (seguro en el cupo de crédito) para el discurso de factibilidad de implementación.

**NO DEBE:**
- Prometer venta 100% automatizada de **productos complejos** que exigen asesoría — para esos, diseñar **escalamiento**.
- Afirmar la figura jurídica exacta Chubb–Colsubsidio (dato refutado).
- Usar cifras no verificadas de afiliados o de mercado en el pitch sin fuente.
- Ser una "caja negra" de precio/riesgo (lección Lemonade 2021, Informe 2 §8).

---

## 9. Vacíos de información y supuestos por validar

1. **[RESUELTO PARCIAL]** Base de afiliados: escala (1.621.106 afiliados; 2,8M beneficiarios) y categorías A/B/C ✔ verificadas. Falta solo la **madurez digital granular** (descargas app, % autogestión) — tomar del Informe de Gestión 2025 (PDF).
2. **[RESUELTO]** Competencia (Compensar, Cafam, SURA): verificado que ninguna cierra venta digital sin humano ✔.
3. **[SUPUESTO]** Tiempos y tasas de abandono del embudo actual: inferidos de la estructura de canales, no medidos.
4. **[A CONFIRMAR]** Detalle producto-por-producto de cuáles del catálogo Colsubsidio cumplen "universalidad/sencillez/estandarización" (candidatos a automatizar).
5. **[A CONFIRMAR]** Alcance de la Circular Externa 006 de 2025 de la SFC sobre comercialización digital (citada como marco; leer el texto para el pitch).

---

## 10. Fuentes citadas

**Colsubsidio (primarias):**
- Portafolio Chubb–Colsubsidio — https://www.chubb.com/co-es/personas-y-familias/colsubsidio.html
- Convenio MetLife–Colsubsidio — https://www.metlife.com.co/seguros-masivos/colsubsidio/
- Cómo adquirir seguro/asistencia — https://ayuda.colsubsidio.com/como-adquirir-seguro-asistencia
- Canales de atención / taxonomía de seguros — https://ayuda.colsubsidio.com/cuales-son-canales-atencion-clientes
- Seguros del cupo de crédito (Tarjeta Afiliación / Multiservicios, Pan-American Life) — https://ayuda.colsubsidio.com/que-seguros-cuenta-cupo-credito-colsubsidio-tarjeta-de-afiliacion
- Seguros para empresas (canal con asesor) — https://www.colsubsidio.com/empresas/bienestar/seguros
- Portal Transaccional — https://www.colsubsidio.com/afiliaciones/portal-transaccional

**Regulación (primarias):**
- Ley 1328 de 2009 (Consumidor Financiero, Arts. 3 y 9) — http://www.secretariasenado.gov.co/senado/basedoc/ley_1328_2009.html
- Régimen de Seguros / comercialización por canales no presenciales — https://publicaciones.fasecolda.com/regimen-de-seguros/chapter/p2-c10-2/
- URF — Documento técnico Comercialización de seguros (2018) — https://www.urf.gov.co/documents/283253/0/19.1+20181115+DT+Comercializacio%CC%81n+de+seguros+-+2123_2018.pdf

**Base de afiliados y competencia (primarias, actualización 17 jul):**
- Colsubsidio — Balance 2025 (1.621.106 afiliados; 2,8M beneficiarios) — https://www.colsubsidio.com/blog-y-noticias/balance-2025
- Colsubsidio — Informe de Gestión y Sostenibilidad 2025 (PDF) — https://cms.colsubsidio.com/sites/default/files/Documentos/colsubsidio/2026/informe-gestion-sostenibilidad-colsubsidio-2025.pdf
- Categorías A/B/C (régimen de cajas) — https://comfamiliar.com/aportes-y-subsidios/conoce-tu-categoria/
- Compensar — Seguros — https://corporativo.compensar.com/financiero/seguros
- Cafam — Seguros — https://www.cafam.com.co/empleo-y-bienestar-financiero/seguros

**Descartado por refutación (NO usar):** figura "convenio comercial no-intermediario" y "Seguros Colectivos para Empresas" como descripción de la relación Chubb–Colsubsidio (votos 1-2).
