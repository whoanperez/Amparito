# `docs/reto/` — Contexto del reto Colsubsidio × 30X (Amparito+)

> **Al retomar, lee primero [`10-estado.md`](./10-estado.md)** (estado vivo: qué está hecho, qué falta,
> dónde vive todo). Esta carpeta consolida en el repo de código la documentación de estrategia y
> requerimiento del **Reto de Seguros** (venta automatizada de seguros, Reto 03 oficial del Hackathon
> Colsubsidio × 30X, 22–26 jul 2026). Origen: repo de estrategia `colsubsidio-hackathon/` (sin git).

## Tesis central (respétala al diseñar)
> **El LLM conversa, extrae y explica. Las reglas deterministas deciden. Los datos son sintéticos/derivados.
> Gemini Live (voz) es el "wow" opcional, nunca la dependencia crítica.**

- **Nunca dejes que el LLM calcule lo regulado** (primas, coberturas, elegibilidad). Es determinístico y
  auditable → *function calling* hacia un motor de reglas; el LLM solo comunica el resultado con empatía.
- **El foso es el dato único de Colsubsidio** (categoría A/B/C, grupo familiar, afiliación) + una IA
  honesta ("a veces te digo que NO" = anti-venta). No competir donde los incumbentes ya ganaron.
- **Rol de Colsubsidio:** sponsor / canal comercializador — **no** asegurador ni diseñador de pólizas.
  Solo hace el *match* persona ↔ seguro ↔ aseguradora aliada. Fuera de alcance: integración real con
  aseguradoras (se mockea), pasarela de pago, firma legal, siniestros/renovaciones.

## Pesos del jurado (mandan el diseño — fuente: [`brief/brief-4-evaluacion-pesos.png`](./brief/brief-4-evaluacion-pesos.png))
**Lógica de propensión 25% · Variación por perfil 20% · Flujo completo 20% · Innovación 20% ·
Experiencia/confianza 15%.** → El 45% vive en la **recomendación explicable y personalizada** ("no caja
negra" es no-negociable).

## Mapa de la carpeta
| Archivo | Qué es |
|---|---|
| [`10-estado.md`](./10-estado.md) | **Estado vivo. Empieza aquí.** Qué está hecho, qué falta, dónde vive todo. |
| [`01-requerimiento.md`](./01-requerimiento.md) | Requerimiento consolidado (slides + Q&A). Pesos oficiales del jurado. |
| [`02-datos-afiliados.md`](./02-datos-afiliados.md) | La base real (1.566.028 afiliados): esquema, alertas de datos y de **PII**. |
| [`03-catalogo-seguros.md`](./03-catalogo-seguros.md) | Catálogo del reto (colsubsidio.com/seguros). *Ojo:* el `data/catalog.json` implementado difiere. |
| [`07-guion-demo.md`](./07-guion-demo.md) | **La estrella polar.** Guion de demo 3 min (Andrés/Carolina/Jaime). Todo se construye hacia atrás desde aquí. |
| [`08-prd.md`](./08-prd.md) | PRD lean: RF/RNF mapeados a los pesos del jurado. |
| [`09-backlog.md`](./09-backlog.md) | Backlog por peso y por dueño, secuencia de 5 días. |
| [`11-contrato-tools.md`](./11-contrato-tools.md) | **Contrato para whoanperez:** firma de `calcular_propension` + nuevo `UiEvent`, división de trabajo. |
| [`notas-negocio.md`](./notas-negocio.md) | Transcripción de la explicación en voz del equipo Colsubsidio. |
| [`brief/`](./brief/) | Los **6 slides oficiales** del reto (misión, pregunta, buen resultado, pesos, quote, no-negociable). |
| [`estrategia/`](./estrategia/) | Por qué Seguros: [síntesis y ranking](./estrategia/00-sintesis-y-ranking.md), [análisis del reto](./estrategia/02-reto-seguros.md), [fuentes](./estrategia/fuentes.md). |

## Procedencia y qué se dejó fuera (a propósito)
- **Traído** de `colsubsidio-hackathon/`: los docs de `reto-seguros/` + los 6 screenshots del brief +
  (de `docs/`) la síntesis, el análisis de seguros y las fuentes.
- **NO traído — PII:** `Usos_Productos_Afiliados_SIN_ID.csv` (~197 MB, columna `NOMBRE_COMPLETO`). Vive
  solo en la máquina local; el [`.gitignore`](../../.gitignore) bloquea `*.csv` y `Usos_Productos_Afiliados*`.
  En el repo solo viven **salidas derivadas sin PII** en [`../../data/`](../../data/).
- **NO traído — fuera de alcance:** los análisis de los 3 retos no elegidos (crédito, vivienda, cocina)
  siguen en `colsubsidio-hackathon/docs/`. Los enlaces a `01/03/04-reto-*.md` en la síntesis apuntan allá.

## Nota de mantenimiento
`10-estado.md` es un **documento vivo**. Ahora existe copia aquí y en el repo de estrategia → **elijan un
único hogar canónico** (recomendado: este repo, que es lo que ships) para evitar que diverjan.
