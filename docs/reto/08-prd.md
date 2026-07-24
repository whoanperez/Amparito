# PRD lean — Amparito+ (Reto 03 · Venta automatizada de seguros)

> **PRD deliberadamente corto (demo-first).** No es un catálogo enciclopédico de requerimientos; es lo
> mínimo que alinea al equipo. Se deriva del [guion de demo](./07-guion-demo.md) y del
> [requerimiento oficial](./01-requerimiento.md). Ejecución → [backlog](./09-backlog.md).

## 1. Problema
La venta de seguros de Colsubsidio depende hoy de un asesor humano 1-a-1: no escala, no es 24/7, y la
web termina en *"déjanos tus datos y te llamamos"*. El afiliado que **no sabe qué necesita** queda igual
de perdido. El freno real del colombiano no es el precio (8%) sino la **autoexclusión "esto no es para
mí" (34%, Superfinanciera)** y la desconfianza. El canal digital de seguros está **vacío (0,24% de las
ventas)**.

## 2. La apuesta ganadora
> **"El único asesor de seguros que a veces te dice que NO."** Un motor de propensión **explicable**
> (reglas deciden, LLM conversa) que pregunta por la **vida** (no por el producto), muestra en pantalla
> el **porqué** y las **brechas** de cobertura, se apoya en el **dato único de Colsubsidio** (arranque
> caliente) y en la **prueba social** de la base de 1,5M para vencer la autoexclusión. Base técnica =
> [Amparito](https://github.com/whoanperez/Amparito) (ya funcional); nosotros injertamos lo que falta.

## 3. Personas
Ver [guion §Personas](./07-guion-demo.md): **Andrés (28, moto)**, **Carolina (39, monoparental)**,
**Jaime (58, ya tiene exequial)**. Contraste máximo → lucen "variación por perfil".

## 4. Requerimientos funcionales = capacidades demo-críticas
> Cada capacidad existe **solo** porque ataca un peso del jurado. Si no mapea a un peso, no va.

| # | Capacidad funcional | Qué hace | Peso que ataca |
|---|---|---|:--:|
| RF-1 | **Motor de propensión con reason codes** | Scorecard aditivo sobre variables demográfico-familiares → ranking + desglose ponderado en español. Determinista, versionado. | **Propensión 25%** |
| RF-2 | **Perfil estructurado + variación visible** | Afiliado: arranque caliente desde la base; no afiliado: 4-6 preguntas. La oferta cambia visiblemente entre las 3 personas. | **Variación 20%** |
| RF-3 | **Ledger de brechas** | Dos columnas: "riesgos hoy" vs "ya cubierto". La brecha resaltada = la recomendación. | Propensión + Confianza |
| RF-4 | **"Ver descartados"** | Muestra el porqué de lo NO recomendado (pregunta de segundo orden del jurado). | **Propensión 25%** |
| RF-5 | **Prueba social peer-group** | "Afiliados como tú eligieron…", trazable a la base. Vence autoexclusión. | Confianza + Innovación |
| RF-6 | **Anti-venta explícito** | El sistema dice "no lo necesitas / ya lo tienes". Clímax de demo. | **Innovación 20%** + Confianza |
| RF-7 | **Flujo completo end-to-end** | Situación → recomienda → cotiza → SÍ/NO cubre → consentimiento → certificado. *(Ya en Amparito.)* | **Flujo 20%** |
| RF-8 | **Cotización determinística** | Prima desde tabla/`prima_regla`; el LLM llama y repite, nunca calcula. *(Ya en Amparito.)* | Flujo + Confianza |
| RF-9 | **Catálogo completo vivo** | Responde a cualquier producto que pida el jurado (modo jurado). *(Ya en Amparito.)* | Flujo + Innovación |
| RF-10 | **Voz Gemini Live (opcional)** | Segundo front sobre las mismas tools; inclusión + wow. | **Innovación 20%** |

## 5. Requerimientos no funcionales (mínimos que sí importan)
- **RNF-1 · Camino crítico sin red:** el flujo del guion corre local; respuestas de las 3 personas
  pre-cacheadas. Ninguna API en vivo es dependencia crítica del demo.
- **RNF-2 · Fallback de voz:** si Gemini Live falla, degrada a chat+tarjetas sin perder estado.
- **RNF-3 · Cero PII:** `NOMBRE_COMPLETO` se dropea en el paso 1 del pipeline; nunca en logs ni UI
  (Ley 1581). Nombres del demo = sintéticos.
- **RNF-4 · Latencia percibida:** respuesta < ~2 s (streaming); nunca pantalla en blanco.
- **RNF-5 · Modo jurado:** el jurado recorre el flujo solo, sin apoyo del equipo (criterio del brief).
- **RNF-6 · Explicabilidad auditable:** toda recomendación persiste {perfil, reglas, pesos, reason
  codes, cita de fuente}; inspeccionable en pantalla ("no caja negra").
- **RNF-7 · Regla de oro:** el LLM nunca produce una prima ni una cobertura de su cabeza; guardrail que
  bloquea cifras/coberturas sin origen en una tool.

## 6. Alcance
**Dentro:** las 3 personas pulidas + catálogo completo respondiendo · propensión explicable · ledger ·
descartados · prueba social · anti-venta · cierre con certificado · voz opcional.
**Fuera (no negociable):** pago real / pasarela · firma con validez legal · integración real con
aseguradoras (se mockea) · siniestros / renovaciones · dashboard/BI · entrenar un modelo de ML (el CSV
no tiene etiqueta de compra → scorecard interpretable, no ML).

## 7. Criterios de éxito (= los 5 pesos oficiales)
Propensión 25% · Variación por perfil 20% · Flujo completo 20% · Innovación 20% · Experiencia y
confianza 15%. **El 45% (propensión + variación) es donde ponemos el esfuerzo diferencial**; el flujo y
el cumplimiento ya vienen de Amparito.
