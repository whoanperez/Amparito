# Amparito

Asistente conversacional que lleva a un afiliado de Colsubsidio desde *"no sé qué seguro necesito"*
hasta una solicitud completa, en una sola conversación. La decisión de qué recomendar la toma un motor
determinista; el modelo de lenguaje conversa y redacta, no decide.

Next.js 14 (App Router) · TypeScript · Claude Haiku vía Anthropic SDK · SQLite/Turso.

---

## Correr

```bash
npm install
cp .env.local.example .env.local     # ANTHROPIC_API_KEY es lo único requerido
npm run dev                          # http://localhost:3000/chat
```

Sin `TURSO_DATABASE_URL`, el reconocimiento de afiliados usa un sample sintético de 6 registros
(`data/afiliados_muestra.json`). Con ella, consulta la base completa.

| Ruta / variable | Efecto |
|---|---|
| `/chat` | Flujo normal |
| `/chat?offline=1` | Reproduce 3 personas end-to-end sin red. Las frases son guionizadas; las tarjetas las produce el motor local |
| `/chat?evento=credito_vivienda` | Apertura proactiva por evento de vida (también `?evento=bebe`) |
| `NEXT_PUBLIC_VOICE_ENABLED=true` + `GEMINI_API_KEY` | Habilita voz (Gemini Live). Apagada por defecto; construida y **no validada en vivo** |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | Base de afiliados completa. Server-only |
| `SHEETS_WEBHOOK_URL` | Destino de emisiones y feedback. Sin ella se omite y queda solo en logs |

---

## Principio de arquitectura

> **El motor calcula y el servidor valida. El LLM narra y propone.**

El modelo no puede producir una prima, una cobertura, una razón ni un campo del perfil. Todo pasa por
compuertas deterministas en servidor. Lo que sigue documenta dónde están y qué bloquean, porque es
donde vive la garantía.

```
navegador ──► /api/chat ──► resolverIdentidad()   identidad, en código (no por tool-choice)
                        ──► detectarEstado()      qué bloque de prompt viaja este turno
                        ──► Claude Haiku + tools
                              └─► executeTool() ──► sanearPerfil()        compuerta de entrada
                                                ──► calcularPropension()  motor determinista
                                                ──► registrar()           traza auditable
```

### Motor de propensión · `lib/engine/`

Scorecard aditivo sobre `data/weights.json` (v0.1, 16 productos). Suma el peso de las señales que
aplican, resta redundancia, y aplica en este orden:

1. **Gate de posesión** (`requiere`) — un producto que exige carro, vivienda o moto no se considera si
   el perfil no la declara.
2. **Sin ingreso hoy** → cero productos de pago. Devuelve `no_venta` con motivo y la alternativa de la
   caja (subsidio al desempleo, agencia de empleo). La obligación legal **sí** sobrevive como
   advertencia: callar el SOAT a quien trabaja en su moto la deja expuesta a la inmovilización, que
   cuesta más que la prima.
3. **Obligatorios por ley** (`obligatorio_legal`) → banda propia. No compiten por cupo del ranking y
   no pueden caer en descartados.
4. **Jerarquía de protección** (`protege_ingreso`) → con dependientes, reemplazar el ingreso va antes
   que proteger un bien. Cambia el orden sin recalibrar ningún peso.
5. **Gate de asequibilidad** por categoría. Con categoría desconocida prioriza prima baja.

Salida: `recomendaciones`, `obligatorios`, `descartados` (motivo propio por producto), `ledger`,
`peer`, `no_venta?`, `jerarquia?`, `traza?`.

### Compuerta de entrada · `lib/engine/sanear.ts`

Valida el perfil propuesto por el modelo antes de que toque el motor.

| Campo | Regla |
|---|---|
| `CATEGORIA`, `SEGMENTO_POBLACIONAL` | Solo desde la base. Son datos administrativos: un modelo no puede deducirlos |
| `RANGO_EDAD` | Solo si la persona mencionó una edad |
| `GENERO` | Solo de base o declarado. No es feature de scoring; solo lo usa el peer-group |
| `SEGMENTO_GRUPO_FAMILIAR` | Se admite `inferido` (sale de lo que contó). Alimenta el score, no habilita afirmaciones sobre la base |
| `vivienda`, `tiene_vehiculo`, `tiene_mascota` | Verificados contra el texto de la persona. Habilitan productos, así que exigen evidencia |
| `sin_ingresos` | El servidor lo **fija** si hay evidencia y lo **descarta** si no la hay |
| `marca.*` | Rechazado desde la conversación: son datos de consumo de la base |

Cada campo queda marcado con su procedencia: `base` · `declarado` · `inferido`.

**Asimetría deliberada:** el servidor solo *añade* lo que protege (`sin_ingresos`) y solo *valida* lo
que habilita una venta. Originar una posesión ofrecería un producto no pedido; originar la falta de
ingreso evita vender a quien no puede pagar.

### Prompt por estado · `lib/prompts.ts`

El servidor calcula el estado y ensambla `BASE + un solo bloque`. Se deriva de lo observable
(historial + marcador `RECOMENDACION:`) porque `/api/chat` es stateless.

| Estado | Comportamiento |
|---|---|
| `SALUDO` | Pide nombre y motivo en una frase |
| `RECONOCIDO` | Prohibido perfilar. Recomienda en el mismo turno con el segmento de la base |
| `DESCUBRIENDO` | Máximo 2 preguntas antes de la primera tarjeta, una por turno |
| `ASESORANDO` | Cotiza, responde por el producto, confirma, abre formulario |

La voz usa el prompt completo concatenado: abre sesión larga y no puede reinyectarlo por turno.

Guarda adicional en el route: si una respuesta trae dos preguntas o encadena dos temas con "o", se
reintenta una vez. Detecta el patrón, no el signo — el caso que motivó la guarda tenía un solo `?`.

### Identidad · `lib/afiliados/`

Cascada por índice (~100 ms). Sin búsqueda por tokens: `LIKE '% x %'` no usa índice y escanea 1,5M
filas.

```
nombre exacto → 1                       → reconocido           (99,55% de los nombres)
              → varios, mismo segmento  → reconocido igual
              → varios, distintos       → pedir ciudad
              → 0, nombre corto         → pedir nombre completo
              → 0                       → se dice y se sigue atendiendo
```

El filtro de ciudad es tolerante (coincide *o* el registro no la tiene) porque el 58,2% de la base no
tiene ciudad; uno estricto excluiría a quien se busca. Si tras la ciudad sigue ambiguo, se usan solo
los ejes en que todos los candidatos coinciden. Tope de 3 búsquedas por conversación, en código.

La detección del nombre vive en código, no en una tool: la regla "cuando aparece un nombre, busca" es
determinista y un falso positivo no cuesta nada.

### Traza auditable · `lib/auditoria.ts`

Cada ejecución de tool se registra como comando y se notifica a los suscriptores. En
`PropensionResult` viaja además una `traza` con: procedencia de cada campo, señales aplicadas con su
peso, resultado de cada producto (incluidos los no recomendados), decisiones del gate y de la
jerarquía, por qué se afirmó o no la prueba social, y la versión del scorecard. Visible bajo
*"Ver cómo llegué a esto"*.

El registro sanea PII recursivamente: nombres, documentos, contacto y certificados no entran.

---

## Datos

| Archivo | Contenido |
|---|---|
| `data/weights.json` | Scorecard v0.1: señales, pesos, razones en español, gates |
| `data/catalog.json` | 16 productos con coberturas, exclusiones, Art. 9 y URL de la fuente |
| `data/base_stats.json` | 194 celdas de peer-group derivadas de la base real, sin PII |
| `data/afiliados_muestra.json` | 6 afiliados **sintéticos** para dev y demo |
| Turso (opcional) | 1.558.501 afiliados: nombre, ciudad y 5 campos de segmento. Nunca en el repo |

`npm run seed-demo` siembra los 6 sintéticos en Turso, para que los atajos funcionen con y sin la base
real. La carga completa es `scripts/load-afiliados.ts` (~8.500 filas/s con `INSERT` multi-fila).

**Certeza de cada cifra.** `prima_certeza` distingue `regulado` / `referencia` / `requiere_datos`. Los
productos con `requiere_asesoria` no se cotizan. `valor_asegurado` es `null` explícito donde no se
tiene, y entonces se responde que lo define la aseguradora. Una prima ≤ 0 lanza.

---

## Verificación

```bash
npm run gates    # 11 suites
npm run eval     # solo el eval de conversación
```

| Suite | Qué protege |
|---|---|
| `test-sanear` | Reproduce una conversación real: los 4 campos fabricados se caen y el top-1 cambia |
| `test-propension` | Las 3 personas · jerarquía de protección · obligatorios nunca en descartados |
| `test-prompt-estados` | Aislamiento entre estados: `RECONOCIDO` no trae el presupuesto de preguntas |
| `test-preguntas` | Doble cañón (incluido el caso con un solo `?`) y memoria de lo ya contado |
| `test-no-venta` | Cero productos de pago sin ingreso; la obligación legal sí se advierte |
| `test-auditoria` | Los pesos suman el score; la traza no contiene PII |
| `test-primer-toque` | Los atajos llegan al reconocimiento y al `no_venta` |
| `test-offline` | Flujo local completo, con prueba social y cierre rotulado |
| `test-identidad` | La cascada, en Turso y en el sample |
| `check-afiliados` | End-to-end base → gateway → motor |
| `eval-conversacion` | 61 aserciones sobre 9 escenarios |

El eval alimenta al servidor con la salida que **el modelo mandaría** —deliberadamente adversarial— y
verifica que las compuertas la neutralicen. Corre sin `ANTHROPIC_API_KEY`.

**Lo que los gates no cubren:** la redacción del modelo. Requiere una corrida en vivo con la key.

---

## Qué está simulado

No hay integración con aseguradoras. `MockInsurerAdapter` implementa el contrato `InsurerGateway` y
devuelve `estado: "SIMULADA"`; la UI refleja ese valor, no un texto fijo. El certificado lleva
encabezado de simulación y el cierre explica el handoff real sin prometer un correo.

Pendiente por ser dato de producto y no de código: los SLA de expedición (`lib/expedicion.ts`, campo
`sla` en `null`) y los valores asegurados. El copy los omite en vez de inventarlos.

Las 8 señales `marca.*` del scorecard no pueden activarse hoy: el cargador de Turso no sube esas
columnas del CSV.

---

## Cumplimiento

- **Ley 1328/2009, Art. 9** — coberturas, exclusiones y forma de cálculo antes del cierre, en tres
  capas: síntesis siempre visible, términos completos a un clic.
- **Ley 1581/2012** — autorización explícita antes de emitir. `issue_policy` **rechaza** la emisión sin
  `consentimiento: true` y sin datos completos: compuerta en servidor, no en prompt.
- **Arts. 1137 y 1138 C. de Comercio** — interés asegurable y consentimiento del asegurado para
  asegurar a un tercero.
- **Rol:** Colsubsidio comercializa; la aseguradora aliada emite y asume el riesgo.
- El CSV crudo de afiliados está en `.gitignore`. Solo se versionan datos derivados sin PII.

---

## Estructura

```
app/
  api/chat/route.ts        orquestador: identidad, estado, tool-loop, guarda de doble cañón
  api/issue/route.ts       emisión determinista, fuera del loop del LLM
  api/feedback/route.ts    CES + CSAT al cierre
  api/live-token · api/tool   voz (tras flag)
components/Chat.tsx        UI del chat y todas las tarjetas
lib/
  engine/                  motor, compuerta de entrada, peer-group, impacto
  afiliados/               gateway, adaptadores local/Turso, detección, cascada
  insurer/                 contrato de aseguradora + adaptador mock
  demo/                    modo offline (guiones + player)
  prompts.ts               base + bloque por estado
  tools.ts                 9 tools; punto único de ejecución y de registro
  auditoria.ts             traza de decisiones
data/                      catálogo, pesos, estadísticas derivadas, sample sintético
scripts/                   cargadores, 11 gates y el eval
docs/reto/                 especificación, hallazgos, guion, C4
```

## Documentación

- [`15-especificacion-ejecucion.md`](docs/reto/15-especificacion-ejecucion.md) — el QUÉ y el CÓMO:
  capacidades definidas por conducta observable y los bloques que las construyeron
- [`13-hallazgos-y-prioridades.md`](docs/reto/13-hallazgos-y-prioridades.md) — hallazgos con su
  evidencia y las decisiones tomadas
- [`14-flujos-ideales.md`](docs/reto/14-flujos-ideales.md) — los dos flujos y la matriz de capacidades
  de asesor
- [`08-prd.md`](docs/reto/08-prd.md) · [`07-guion-demo.md`](docs/reto/07-guion-demo.md) ·
  [`arquitectura-c4.html`](docs/reto/arquitectura-c4.html)

---

*La marca Colsubsidio se usa únicamente como concepto para el ejercicio.*
