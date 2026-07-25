# 15 — Especificación de ejecución · el QUÉ y el CÓMO

> **Documento de ejecución. Reemplaza la deliberación por decisiones.** Consolida los 5 paneles de
> expertos, la revisión de front, el feedback del equipo de seguros y las mediciones sobre la base
> real. Deriva de [13-hallazgos](./13-hallazgos-y-prioridades.md) y
> [14-flujos-ideales](./14-flujos-ideales.md); esos quedan como evidencia, este es el plan.
> Estados: ⬜ pendiente · 🔨 en curso · ✅ hecho.

**Regla que gobierna todo:** *lo determinista va en código; el LLM narra y propone, nunca decide ni
inventa.* Cada bloque del CÓMO existe para sostener esa regla en un punto donde hoy se rompe.

---

# PARTE 1 · EL QUÉ — diez capacidades

Cada capacidad se define por **la conducta observable**, no por su implementación. Si no se puede
verificar mirando la pantalla, no es una capacidad: es una intención.

## C1 · Identidad progresiva, sin peaje

Amparito atiende a cualquiera. Identificarse es **siempre opcional** y **nunca es un muro**.

| Nivel | Cómo se llega | Qué desbloquea |
|---|---|---|
| **Anónimo** | por defecto | Todo el recorrido. Motor con lo declarado. Sin prueba social |
| **Nombrado** | dice su nombre | Trato por su nombre. Nada de la base |
| **Reconocido** | su nombre coincide en la base | Arranque caliente: segmento, prueba social, grupo familiar |
| **Identificado** | documento + contacto, en el cierre | Expedición |

**Principio:** *conversar es libre; **expedir** exige identidad.* La fricción va donde la persona ya
tiene intención de compra y **espera** que se la pidan — no en el saludo.

**Conducta observable:**
- Nombre completo reconocido → bienvenida y recomendación, sin preguntas de perfilamiento
- Nombre corto o ambiguo → **una** pregunta (nombre completo o ciudad), nunca dos
- Nombre que no está → se dice claro y se sigue atendiendo completo
- Nunca se recita el segmento como ficha de datos

**Medición que la sustenta:** de 1.551.282 nombres, el **99,55% es único**. La ciudad solo hace falta
en el 0,40% y resuelve el 100% de esos casos. El 58,2% de la base **no tiene ciudad**, así que el
filtro por ciudad debe ser tolerante o excluye a la persona que busca.

## C2 · Valor antes que preguntas

La recomendación aparece **antes** del interrogatorio, no después. Cada pregunta posterior refina algo
que ya está en pantalla.

**Conducta observable:**
- Reconocido: tarjeta en el **mensaje 2**, con **una sola** escritura del usuario
- No reconocido: **máximo 2** preguntas antes de la primera tarjeta
- Toda respuesta posterior **mueve visiblemente** la tarjeta

**Por qué:** verificado contra el motor real — para Carolina, `Seguro de Vida` es el #1 **con cero
preguntas**, y sigue siendo el #1 después de cinco. Hoy la tarjeta llega en el mensaje 13 (reconocido)
y 18 (anónimo).

## C3 · Solo se pregunta lo que cambia la respuesta

Ninguna pregunta existe si su respuesta no altera la recomendación.

**Medición (swing calculado contra el motor):**

| | Variables que cambian el top-1 |
|---|---|
| Reconocido (4 ejes de la base) | **1 de 7** (`tiene_mascota`) |
| Anónimo (cero datos) | **6 de 7**; las de mayor swing: `tiene_vehiculo` (3 top-1 distintos), `dependientes` |

**Conducta observable:** una pregunta por turno, nunca dos temas unidos con "o", y nunca se repite algo
ya respondido.

**Frase que habilita para el pitch:** *"no preguntamos porque sí; preguntamos lo que más cambia la
respuesta"* — y se puede mostrar corriendo.

## C4 · El motor solo recibe datos con procedencia

El motor es determinista y acierta. Lo que hoy falla es **lo que entra**. Cada campo del perfil lleva
su origen y el servidor es el dueño del perfil.

| Origen | Significado |
|---|---|
| `base` | vino del reconocimiento del afiliado |
| `declarado` | la persona lo dijo, y el servidor **verificó** sus palabras |
| `inferido` | el modelo lo supuso → **no habilita productos ni afirmaciones** |

**Conducta observable:**
- `CATEGORIA` y `RANGO_EDAD` no existen si no vienen de `base` o `declarado`
- Un producto con gate de posesión (`vivienda`, `tiene_vehiculo`) **no se ofrece** con un dato `inferido`
- La prueba social **no se afirma** sin los 4 ejes verificados; en su lugar va una invitación honesta

**Es el RNF-7 del PRD**, que pide un *guardrail* y solo se implementó del lado de la salida.

## C5 · Ninguna cifra sin certeza declarada

Toda cifra en pantalla lleva su nivel de certeza, y el sistema **se niega a producir la que no tiene**.

| Certeza | Qué se muestra |
|---|---|
| `regulado` | la cifra exacta, con su fuente |
| `referencia` | la cifra, rotulada como valor de referencia |
| `requiere_cotizacion` | **ningún número**: "este seguro se cotiza caso por caso" + asesor |

Igual para el valor asegurado: cifra real, rango, o `null` con la respuesta honesta — *"lo define la
aseguradora según el plan que elijas"*. **Los valores asegurados reales no se inventan:** son dato de
producto y deben venir de Colsubsidio o del clausulado.

**Conducta observable:** ninguna prima de $0. Ninguna tarifa de moto mostrada a un carro con el sello
"Tarifa oficial regulada". Y por primera vez, respuesta a *"¿y de cuánto es la póliza?"*.

## C6 · La obligación legal va antes que la recomendación

Amparito distingue *"la ley te obliga"* de *"yo te sugiero"*, y lo obligatorio **nunca compite** por un
cupo del ranking ni cae en descartados.

**Conducta observable:** a quien tiene vehículo y no tiene SOAT, el SOAT aparece en banda propia, arriba
del ranking, con sus topes reales y sus exclusiones. Nunca *"esto lo puedes sumar más adelante"*.

## C7 · Los cuatro NO

El anti-venta deja de ser una funcionalidad y se vuelve el comportamiento del sistema.

| NO | Cuándo | Estado hoy |
|---|---|---|
| *No te lo vendo, ya lo tienes* | `ya_cubierto` | existe |
| *No te lo vendo, hoy no te sirve* | sin ingresos | **falta** |
| *No te lo afirmo, no lo sé* | sin ejes verificados; sin valor asegurado; precio que requiere estudio | **falta** |
| *No te lo puedo asegurar, la ley no me deja* | tercero sin consentimiento | **falta** |

**Conducta observable:** en toda sesión aparece **al menos un NO**. Ante una señal de vulnerabilidad
(desempleo, enfermedad, duelo) el cuestionario **se detiene**, se reconoce en una frase propia, y si no
hay capacidad de pago **no se recomienda ningún producto de pago** — se ofrece lo que la caja sí tiene:
subsidio al desempleo, agencia de empleo.

## C8 · Capacidad de asesor

Amparito responde lo que un asesor humano responde, con la fuente detrás. De las doce cosas que hace un
asesor, hoy puede ocho.

| Puede hoy | Se añade |
|---|---|
| Qué cubre · qué NO cubre · cómo se calcula la prima · qué pasa si dejas de pagar · carencias · citar clausulado · escalar a humano | **De cuánto es la póliza** (C5) · **cuándo no comprar** (C7) |
| | *Fuera de alcance, se escala:* cómo reclamar un siniestro · derecho de retracto |

**Conducta observable:** ofrece las exclusiones **antes** de que se las pidan (*"¿te digo qué no cubre?
prefiero que lo sepas antes y no después"*), y usa munición real del clausulado que hoy se
desperdicia — el Seguro de Vida cubre *"por cualquier causa, incluye homicidio y suicidio, sin periodos
de carencia"*, y la cobertura de **incapacidad ≥50%** es la que más pesa para quien trabaja en su moto.

## C9 · Cierre honesto y medido

**Conducta observable:**
- Lo simulado se ve simulado: certificado, "póliza activa" y correo llevan sello de demo
- El handoff a la aseguradora se explica: **qué** se envía, **a quién**, **cuánto tarda**, y **qué hacer si no llega**
- Al cerrar se miden dos cosas: **esfuerzo percibido** (CES) y **satisfacción** (CSAT)

## C10 · Verificable antes de presentar

Existe un comando que corre ~10 conversaciones con aserciones y falla si el comportamiento se rompió.

**Por qué es una capacidad y no un lujo:** la regla de empatía existía en el prompt v2 y **desapareció
en el v3 sin que nadie lo notara**. Sin evals, cada cambio de prompt es una apuesta y las regresiones
son invisibles.

---

# PARTE 2 · EL CÓMO — once bloques

## B0 · Máquina de estados en código, prompt por estado · ~2 h · ⬜

**Problema.** `lib/prompts.ts` tiene 120+ líneas donde compiten simultáneamente: clasificador de
mensajes, ESTADO 1/2/3, reglas de tono, adaptación generacional, catálogo de gatillos y reglas de
disclosure. Está probado que compiten: el bloque de arranque caliente que inyecta
`app/api/chat/route.ts:36-42` **pierde** contra ESTADO 2 porque ESTADO 2 es más específico y numerado.
Y `prompts.ts:35` ("una sola pregunta por turno") se violó 3 veces en una conversación.

**Mecanismo.** El **servidor** decide el estado y ensambla el system prompt con **solo** las
instrucciones de ese estado.

```
estado = f(perfil del servidor, eventos ya emitidos)
  SALUDO          → identidad y motivo
  RECONOCIDO      → prohibido perfilar; recomendar ya
  DESCUBRIENDO    → máx 2 preguntas, una por turno
  RECOMENDADO     → responder por el producto, refinar
  COTIZADO        → coberturas, exclusiones, Art. 9
  CIERRE          → consentimiento, expedición, feedback
```

Base común ~30 líneas (identidad, tono, prohibiciones) + bloque del estado.

**Por qué va primero.** B5, B6 y B7 se apoyan en él. Sin B0, esos bloques son siete reglas nuevas
apiladas en un prompt que ya no se obedece.

**Archivos.** `lib/prompts.ts` (partir en base + estados) · `app/api/chat/route.ts` (calcular estado y
ensamblar).

**Aceptación.** El prompt enviado en un turno de estado `RECONOCIDO` **no contiene** las instrucciones
de `DESCUBRIENDO`.

## B1 · Rotular lo simulado · ~15 min · ⬜

**Problema.** `mock-adapter.ts` produce "✓ Póliza activa", `AMP-XXXXX`, "Vigencia 12 meses", y
`app/api/issue/route.ts:53-55` promete *"tu certificado llegará al correo en las próximas horas"*. No
hay aseguradora conectada: no se emite nada y no sale ningún correo.

**Mecanismo.** Sello visible de simulación en el certificado y en la tarjeta de póliza; el copy del
cierre se reemplaza por el de B9 (no dos promesas distintas).

**Archivos.** `components/Chat.tsx:722-746` · `lib/insurer/mock-adapter.ts:46-54` ·
`app/api/issue/route.ts:53-55`.

**Aceptación.** Ningún texto afirma que hay una póliza vigente ni que llegará un correo.

## B2 · Certeza de cifras · ~1,5 h · ⬜

**Problemas verificados.**
- `arrendamiento_mundial.prima_regla.base = 0` → **se cotiza en $0/mes** (ejecutado)
- `soat_mundial`: `base = 343300` con nota *"para moto de 100 a 200cc"*, pero la señal dispara para
  `["carro","moto"]`, y `Chat.tsx:678-680` le pone el sello **"Tarifa oficial regulada"**
- `valor_asegurado` **no existe en ninguno** de los 16 productos, aunque `art9.forma_calculo` de Vida
  lo menciona
- `mock-adapter.ts:17` usa `perfil.edad ?? 30`: la edad la aporta el LLM sin validar, y el default
  silencioso hace indistinguible "no sé" de "tiene 30"

**Mecanismo.**
1. `prima_certeza: "regulado" | "referencia" | "requiere_cotizacion"` por producto
2. El adaptador **devuelve `prima: null`** si es `requiere_cotizacion` (Salud, Todo Riesgo Carro,
   Arrendamiento) → la tarjeta dice *"se cotiza caso por caso"* + asesor. Nunca un número
3. Guarda dura: `if (prima <= 0) throw` — cotizar en cero no es un resultado válido
4. SOAT: partir en `soat_moto` / `soat_carro`, o bajar a `referencia` y decir que depende del cilindraje
5. `valor_asegurado: number | {min,max} | null`; con `null`, respuesta honesta

**Archivos.** `data/catalog.json` · `data/weights.json` · `lib/insurer/mock-adapter.ts` ·
`components/Chat.tsx:678-680` · `lib/tools.ts:122-129`.

**Aceptación.** Ningún producto cotiza ≤ $0. Ningún producto con `requiere_asesoria` muestra un número.
El SOAT no muestra tarifa de moto a un carro.

## B3 · El servidor es dueño del perfil · ~3 h · ⬜

**Problema.** `lib/tools.ts:229` es `const perfil = (input.perfil ?? {}) as Perfil` — un *cast*, sin
validación en runtime. Y `/api/chat` es stateless, así que el modelo **re-deduce el perfil del historial
crudo** en cada turno. De ahí salen: el `vivienda:"propia"` fabricado que decidió la venta, la
`CATEGORIA:"B"` que apagó `prioriza_prima_baja` a alguien sin ingresos, y las preguntas duplicadas.

**Mecanismo.** El perfil vive en el servidor. El LLM **propone deltas**, no reconstruye:

```
{ campo, valor, evidencia: "las palabras textuales de la persona" }
```

`sanearPerfil()` valida antes de que el motor vea nada:
1. Rechaza valores fuera de enum
2. Descarta `CATEGORIA` y `RANGO_EDAD` que no sean `base` o `declarado`
3. Para campos con gate `requiere` (`vivienda`, `tiene_vehiculo`): **el servidor verifica que la
   evidencia aparezca de verdad** en los mensajes del usuario. Si no aparece, el campo se cae
4. Marca `_origen` por campo
5. El perfil acumulado se reinyecta como contexto → mata los duplicados

Y se corrige `lib/prompts.ts:63`, que **hoy pide activamente** "edad, categoría" — le estamos pidiendo
que invente.

**Efecto gratis.** La prueba social falsa desaparece sin tocar la UI: `peer.ts:37` ya exige los 4 ejes y
`CATEGORIA` ya no estará. Se sustituye por la invitación de C4.

**Archivos.** `lib/tools.ts:229` · `lib/engine/types.ts` · `lib/prompts.ts:63` · `app/api/chat/route.ts`.

**Aceptación.** Reproducir la conversación de Mauricio: el perfil que llega al motor **no** trae
`CATEGORIA` ni `vivienda`, y el top-1 es `Seguro de Vida` (no `Hogar`).

## B4 · Banda de obligatorios · ~45 min · ⬜

**Problema.** El motor ordena por score y toma 2 (`MAX_RECOMENDACIONES`). El SOAT compitió, perdió, y
`motivoDescarte()` (`scorecard.ts:173-181`) le puso *"Hoy tu prioridad es seguro de vida; esto lo puedes
sumar más adelante"* — a alguien sin SOAT que trabaja en su moto, sobre un seguro obligatorio por Ley
769/2002. En la misma tarjeta el reason code dice *"Es obligatorio para tu vehículo"*: **se contradice
sola**. Y los 4 descartados tienen la misma frase.

**Mecanismo.**
1. `obligatorio_legal: true` en `weights.json` para `soat_mundial`
2. Tercer bucket `obligatorios` en `PropensionResult`: si es obligatorio y no está en `ya_cubierto`,
   **no compite por cupo y nunca va a descartados**
3. Banda propia arriba del ranking en `PropensionCard`, con el peso visual del banner de anti-venta
4. `motivo_descarte` específico por producto (plantilla actual como fallback) y `MAX_DESCARTADOS = 2`

**Archivos.** `data/weights.json` · `lib/engine/types.ts` · `lib/engine/scorecard.ts:25,173-181` ·
`components/Chat.tsx`.

**Aceptación.** Perfil con moto y sin SOAT → el SOAT aparece en `obligatorios`, **no** en `descartados`.
Re-correr `test-propension.ts`.

## B5 · Identidad y arranque · ~4 h · ⬜

**Mecanismo — la cascada. Solo búsquedas por índice (~100 ms). Nada de escaneos.**

```
1 · exacto por nombre_norm
      1 resultado    → BIENVENIDA (99,55% de los casos)
      varias         → pedir ciudad · FILTRO TOLERANTE
                       (coincide la ciudad O el registro no la tiene)
                       si sigue ambiguo → usar solo los ejes en que coinciden
      0 resultados   ↓
2 · "¿me das tu nombre completo, como aparece en tu documento?"
      exacto otra vez
      1 resultado    → BIENVENIDA
      0 resultados   → copy A
```

**Prohibido: búsqueda por tokens** (`LIKE '% x %'`). No usa índice, escanea 1,5M filas y se pasó de 5
minutos en pruebas. El 92% de fallo por nombre corto se resuelve **preguntando**, no escaneando.

**Piezas.**
1. La detección del nombre y el disparo de la búsqueda van **en código**, no a criterio del modelo (hoy
   no existe ningún camino del chat al gateway: por eso *"soy Mauricio Cajamarca"* cayó al vacío)
2. `buscar()` con `COUNT` real, reemplazando `porNombre[0]` (`local-adapter.ts:28`) y `LIMIT 1`
   (`turso-adapter.ts:31`), que hoy **atribuyen a una persona el segmento de otra en silencio**
3. Persistir el hallazgo: evento `{type:"afiliado"}` → `afiliadoRef`, porque `Chat.tsx:199` filtra
   `kind === "msg"` y los resultados de tools **no sobreviven entre mensajes** (sin esto: amnesia en el
   turno 3)
4. Estado `RECONOCIDO` de B0: prohibido perfilar. Quitar el `¿Es así?` de `route.ts:41`
5. Pantalla de una sola pregunta: *"Dime tu nombre y qué te trae por aquí. Si estás afiliado te
   reconozco y nos saltamos el interrogatorio."* Se borra el botón "Prefiero contarte con mis palabras"
   (solo hace `inputRef.focus()` y el input ya tiene `autoFocus`); las 6 tarjetas bajan al turno 2 del
   camino anónimo; el selector del jurado va al pie, degradado
6. Matar el `send("Hola")` fantasma (`Chat.tsx:135,356`)
7. Tope de **3 búsquedas por conversación**, en código
8. Nunca recitar el segmento como ficha: **una** señal humana

**Copys.**
- Reconocido (género desde la base): *"**Bienvenida, Carolina** 👋 Veo que sostienes sola tu hogar. Con
  eso ya te preparé esto — si algo no cuadra, me lo dices y lo ajusto al instante."*
- Ambiguo: *"Mucho gusto, Julio. Hay varios Julio Marroquín en Colsubsidio. ¿Me das tu nombre completo,
  como aparece en tu documento?"*
- **No encontrado (copy A, decidido):** *"No apareces en la base de afiliados de Colsubsidio. Te atiendo
  completo igual, solo te hago un par de preguntas más."*

**Aceptación.** Desde un nombre reconocido: **tarjeta en el mensaje 2 con una sola escritura del
usuario**. Nombre inventado: copy A y la conversación sigue sin errores en pantalla.

## B6 · Presupuesto de preguntas por swing · ~1 h · ⬜

**Mecanismo.** El estado `DESCUBRIENDO` de B0 lleva el presupuesto y el orden ya medido:
- Reconocido → **máx 1** pregunta (solo `tiene_mascota` cambia el top-1)
- Anónimo → **máx 2**, priorizando `tiene_vehiculo` y `dependientes`
- Una pregunta por turno, con ejemplo negativo explícito: *prohibido unir dos temas con "o"*
- Guarda en `route.ts:94-98`: si el `reply` trae más de un `?`, reintentar

**Por qué importa.** La pregunta de doble cañón *"¿tienes vehículo, **o** tu vivienda es propia?"* →
"propio" → `vivienda:"propia"` → vendió Hogar. Reproducido contra el motor.

**Archivos.** `lib/prompts.ts` (estado `DESCUBRIENDO`) · `app/api/chat/route.ts:94-98`.

**Aceptación.** Ninguna respuesta de Amparito contiene dos `?`. Ninguna pregunta se repite.

## B7 · Los cuatro NO · ~1,5 h · ⬜

**Mecanismo.**
1. Regla de empatía, **recuperada** de `docs/system_prompt_amparito_v2.md:64`: *"si la persona cuenta
   algo difícil, PARA el cuestionario y reconócelo en una frase propia. 'Entiendo' y 'está bien' no son
   reconocer: son despachar."*
2. Caso límite **sin ingreso hoy**: no recomendar ningún producto de pago, ni el barato, ni el SOAT.
   Ofrecer subsidio al desempleo y agencia de empleo. Lo decide el **motor** (`no_venta`), no el LLM
3. El **NO legal**: *"puedo asegurar a tu hijo o a tu mamá; a tu vecino no, aunque quieras pagarlo"*
   (arts. 1137 y 1138 C. de Comercio + Ley 1581 art. 9). Solo capacidad conversacional, **sin** tocar el
   modelo de datos
4. Qué muestra la `PropensionCard` cuando no hay anti-venta — hoy media tarjeta dice *"YA CUBIERTO —
   Nada aún"* y el banner héroe `.pp-antiventa` **nunca se renderiza**

**Archivos.** `lib/prompts.ts:30-40,100-106` · `lib/engine/` (`no_venta`) · `components/Chat.tsx`.

**Aceptación.** Conversación con "no tengo ingresos" → **cero** productos de pago recomendados, y
aparece la alternativa de la caja.

## B8 · Jerarquía visual · ~1 h · ⬜

**Problema.** Tres anchos apilados y el hero es el más pequeño: mensajes 82%≈623 px
(`globals.css:203`), **PropensionCard 470 px** (`:339`), recomendaciones 430 px (`:324`). La tarjeta que
vale 25%+15% de la rúbrica es más angosta que un mensaje de chat.

**Mecanismo.** `.propcard` y `.recos` al ancho del hilo · quitar la duplicación interna (los reason
codes del #1 se imprimen en *WhyThis* y otra vez en *RIESGOS HOY*; el nombre del producto aparece 3
veces) · quitar uno de los dos títulos apilados · la tarjeta **antes** de la pregunta que la comenta.

## B9 · Cierre y medición · ~1,5 h · ⬜

**Mecanismo.**
1. Claridad de tiempos (pedido del equipo de seguros): qué se envía, a quién, cuánto tarda, qué hacer si
   no llega. Una sola promesa, coordinada con B1
2. `CES` + `CSAT` al cierre: evento `feedback` + tarjeta de 2 toques

## B10 · Evals de conversación · ~2 h · ⬜

**Mecanismo.** `scripts/eval-conversacion.ts` con ~10 conversaciones y aserciones verificables:

| Caso | Aserción |
|---|---|
| Nombre reconocido | tarjeta en mensaje 2 · 0 preguntas de perfilamiento |
| Nombre inventado | copy A · la conversación continúa |
| Anónimo | ≤ 2 preguntas antes de la tarjeta |
| "no tengo ingresos" | 0 productos de pago · aparece la alternativa de la caja |
| Moto sin SOAT | SOAT en `obligatorios`, no en `descartados` |
| Sin categoría verificada | prueba social ausente |
| Cualquier turno | un solo `?` por respuesta |
| Producto con `requiere_asesoria` | ningún número de prima |

**Aceptación.** Un comando, salida verde/roja, corre antes de cada demo.

---

# PARTE 3 · Orden, dependencias y gates

| Orden | Bloque | Depende de | Riesgo de romper |
|:--:|---|---|---|
| 1 | **B1** rotulado | — | nulo |
| 2 | **B2** certeza de cifras | — | nulo (dato) |
| 3 | **B4** obligatorios | — | bajo (re-correr gate del motor) |
| 4 | **B0** estados en código | — | medio (toca el prompt entero) |
| 5 | **B3** servidor dueño del perfil | B0 | medio |
| 6 | **B5** identidad y arranque | B0, B3 | medio |
| 7 | **B6** presupuesto por swing | B0, B5 | bajo |
| 8 | **B7** los cuatro NO | B0 | bajo |
| 9 | **B10** evals | B5, B6, B7 | nulo |
| 10 | **B8** jerarquía visual | — | nulo |
| 11 | **B9** cierre y medición | B1 | bajo |

**Total ≈ 18,5 h.** Los tres primeros son **2,5 h** y cierran todo lo indefendible sin tocar el flujo.

**Gates entre bloques:** `npx tsx scripts/test-propension.ts` · `scripts/test-offline.ts` ·
`scripts/check-afiliados.ts` · `npx tsc --noEmit` · `npm run build`. Desde B10, también
`eval-conversacion.ts`.

---

# PARTE 4 · Decisiones

## Tomadas

| Decisión | |
|---|---|
| **PII al Google Sheet** | No se apaga. El marco de autorización existe (dueño del producto, 24-jul) |
| **Verificación de identidad** | Sin reto de año de nacimiento: bloquearía al jurado que teclea un nombre que sabe que está en la base. Nombre solo |
| **Copy de no encontrado** | **A** — *"No apareces en la base de afiliados de Colsubsidio…"* |
| **Búsqueda por tokens** | Descartada: no usa índice, escanea 1,5M filas |
| **Maquinaria de escenas / director en runtime** | No se construye. Se rescata el criterio de *swing* (B6) |
| **Tomador ≠ Asegurado** | Solo capacidad conversacional (B7). El modelo de datos, después del demo |
| **Hiperpersonalización de producto** | No es alcanzable con el catálogo actual (productos fijos, sin coberturas modulares). Se entrega personalización de recomendación y de argumento |
| **RNF-1 (offline)** | Paracaídas invisible, no modo de demo. Se demuestra en vivo |

## Pendientes

**1 · Guarda de ranking.** Verificado: Carolina —sostén único, categoría A— que menciona un perro
obtiene `#1 Seguro de Mascotas (57)` sobre `#2 Seguro de Vida (55)`. Arreglarlo toca el ranking (que los
paneles pidieron no tocar) y obliga a re-correr los gates. Recomendación: hacerlo — *"¿es sostén único y
le recomienda primero asegurar al perro?"* es una pregunta que un jurado hace.

**2 · Valores asegurados reales.** Dato de producto; deben venir de Colsubsidio o del clausulado.
Mientras no lleguen, `null` + respuesta honesta.

## No se hace

Voz · modo offline como demo · avatar · antifraude · escenas en runtime · modelo de datos
tomador/asegurado/beneficiario · más documentos · más paneles · más tiers de copy · recalibrar pesos
(salvo la decisión 1) · streaming (queda anotado: `/api/chat` corre hasta 8 rondas y devuelve todo
junto; el RNF-4 pide < 2 s percibidos).
