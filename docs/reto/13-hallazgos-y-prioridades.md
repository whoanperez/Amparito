# 13 — Hallazgos consolidados y prioridades

> **Backlog único de ajustes.** Consolida los 4 paneles de expertos del 24-jul-2026 (jurado ·
> rigor/cumplimiento · UX conversacional · flujo de arranque), la revisión de front y los hallazgos
> propios. Agrupado por **ajuste** —cada fila es algo que se hace— con trazabilidad al hallazgo.
> Estados: ⬜ pendiente · 🔨 en curso · ✅ hecho · ⏸️ decidido no hacer.

## Cómo leer esto

Los expertos coincidieron en un diagnóstico de fondo: **el motor está bien; lo que falla es lo que
entra y lo que se muestra.** El scorecard es determinista, auditable y acierta. El problema está
(a) en que nadie audita el perfil que le llega, (b) en que el flujo cobra 13–18 mensajes antes de
dar valor, y (c) en dos errores deterministas del catálogo que no tienen nada que ver con el LLM.

Contexto de negocio: **Colsubsidio no es una aseguradora, es una caja de compensación.** Eso abre
una respuesta que ninguna aseguradora puede dar (P2-6) y sube el listón de lo que es defendible.

---

## P0 · Riesgo vivo — no depende de ninguna decisión de producto

| # | Ajuste | Dónde | Cierra | Esfuerzo | Est. |
|---|---|---|---|:--:|:--:|
| ~~**P0-1**~~ | ~~Apagar el envío de PII a Google Sheets.~~ **DECIDIDO NO HACER (24-jul, dueño del producto).** El marco de autorización existe: los afiliados autorizaron a Colsubsidio el tratamiento de sus datos, y es Colsubsidio quien compartió la base para este trabajo. La captación del formulario opera dentro de ese marco. | `app/api/issue/route.ts:37-51`, `lib/sheets.ts` | — | — | ⏸️ |
| **P0-2** | **Cerrar el lookup de afiliados.** Sin autenticación: cualquiera escribe nombre + ciudad de una persona real y obtiene su género, rango de edad, **categoría (proxy de ingreso)**, composición familiar y ciudad, sobre 1.558.501 personas. `route.ts:37` además le dice al modelo que "ya inició sesión", lo cual es falso. Whitelist de nombres del demo, o reto ligero de un campo. | `lib/afiliados/turso-adapter.ts:24-36`, `app/api/chat/route.ts:31-43` | Contradice **RNF-3 · Cero PII** del PRD. Es el flanco que mata el pitch si el jurado pregunta *"¿y si escribo el nombre de mi vecino?"* | 30 min | ⬜ |
| **P0-3** | **Rotular lo simulado como simulado.** "✓ Póliza activa", "Estado: Activa", "CERTIFICADO DE SEGURO — Póliza No. AMP-…", "Vigencia 12 meses" y "Tu certificado llegará al correo en las próximas horas" los emite un mock. Nadie va a recibir nada. | `Chat.tsx:722-746`, `lib/insurers/mock-adapter.ts:46-54`, `app/api/issue/route.ts:53-55` | Hoy inocuo (no se emite nada); en producción sería emisión sin aseguradora. Barato y elimina que alguien quede esperando | 15 min | ⬜ |

---

## P1 · Integridad del dato — la tesis del producto

> El guardrail *"el motor calcula, el LLM redacta"* protege la **salida**. Nadie protege la
> **entrada**: el LLM también escribe el perfil que alimenta al motor. El motor, determinista,
> convierte una alucinación en un número con apariencia institucional.

| # | Ajuste | Dónde | Cierra | Esfuerzo | Est. |
|---|---|---|---|:--:|:--:|
| **P1-1** | **`sanearPerfil()` — compuerta dura en servidor.** Hoy `lib/tools.ts:229` es `input.perfil as Perfil`: un cast, cero validación. Debe: rechazar valores fuera del enum; para no identificados **descartar `CATEGORIA` y `RANGO_EDAD`**; descartar los campos de `enriquecido` que activan un gate `requiere` (`vivienda`, `tiene_vehiculo`) si el LLM no adjunta la cita textual que los soporta. **Compuerta, no instrucción de prompt** — el precedente correcto es el gate de consentimiento de `tools.ts:326`. | `lib/tools.ts:229` | 4 hallazgos de un golpe: `vivienda:"propia"` fabricada que **decidió la venta**; `CATEGORIA` fabricada que **apagó `prioriza_prima_baja`** a alguien sin ingresos; `RANGO_EDAD` fabricada; peer con ejes inventados. El peer cae solo, sin tocar UI | 2-3 h | ⬜ |
| **P1-2** | **Marcar procedencia por campo.** `Perfil._origen: Record<campo, "declarado"\|"base"\|"inferido">`, generado por el **servidor** (que ya sabe qué vino de Turso), no por el LLM. Con ello: el peer solo afirma con los 4 ejes verificados, y la tarjeta puede etiquetar la fuente. | `lib/engine/types.ts`, `app/api/chat/route.ts:31-43` | Habilita P1-1 y P1-3. **Convierte el flanco en momento de marca:** *"aquí Amparito no sabe mi categoría, así que no me muestra la prueba social — prefiere callarse antes que inventar"* | 1 h | ⬜ |
| **P1-3** | **Corregir el prompt que empuja a inventar.** `lib/prompts.ts:63` **instruye activamente** a pasar "edad, categoría" — datos inconocibles para un no-afiliado. Cambiar por *"si no lo sabes, omite el campo: el motor está diseñado para funcionar con datos parciales"*. Endurecer los `description` de `tools.ts:53-64`. | `lib/prompts.ts:63`, `lib/tools.ts:53-64` | Refuerzo de P1-1. **Por sí solo no basta**: un `description` es una petición probabilística, no una garantía | 15 min | ⬜ |
| **P1-4** | **Segmento verificado con precedencia, sin pasar por el LLM.** Hoy el segmento real de Turso se inyecta como texto y el modelo lo **retranscribe** a la tool. Un error de transcripción produce un peer falso con la misma apariencia de verdad. El servidor debe cachear el segmento verificado y fusionarlo con precedencia sobre lo que el LLM proponga. | `app/api/chat/route.ts:35-42`, `lib/tools.ts:229` | Elimina la clase entera de bugs también para el afiliado identificado | 45 min | ⬜ |
| **P1-5** | **`describir()` debe describir la celda encontrada, no el perfil pedido.** `peer.ts:45-51` construye el texto desde el `perfil` de entrada. Hoy no diverge (igualdad estricta en `peer.ts:39`), pero cualquier futuro *fallback* haría que la tarjeta describa el segmento pedido y no el hallado, sin que nada falle. | `lib/engine/peer.ts:45-51` | Blindaje de una línea | 5 min | ⬜ |
| **P1-6** | **La prima no puede depender de una edad inventada.** `mock-adapter.ts:17-19` usa `perfil.edad ?? 30`, y la edad la aporta el LLM sin enum ni validación. Con `por_edad: 400`, una edad inventada de 40 vs. la real de 28 cambia la prima en $4.000/mes. El default silencioso hace indistinguible "no sé" de "tiene 30". | `lib/insurers/mock-adapter.ts:17-19`, `lib/tools.ts:122-129` | Mismo patrón del hallazgo principal, en otra tool | 20 min | ⬜ |

---

## P2 · El arranque y el flujo — la fricción

> Un experto verificó que, para un afiliado identificado, **el motor produce la misma recomendación
> #1 con cero preguntas que después de cinco**. Preguntar antes de recomendar es puro costo.
> La tarjeta aparece hoy en el mensaje **13** (afiliado) y **18** (no afiliado).

| # | Ajuste | Dónde | Cierra | Esfuerzo | Est. |
|---|---|---|---|:--:|:--:|
| **P2-1** | **Tool `identificar_afiliado`.** Hoy el lookup solo existe como efecto secundario del formulario: **no hay ningún camino desde el chat hacia el gateway**, por eso "soy Mauricio Cajamarca" cayó al vacío. Convertirlo en tool que el modelo llama en el mismo turno en que aparece un nombre propio. | `lib/tools.ts`, `lib/afiliados/gateway.ts` | **La prioridad del arranque.** Arregla los dos casos reales: sin formulario, sin botón, sin peaje | 1,5 h | ⬜ |
| **P2-2** | **Persistir el hallazgo.** `Chat.tsx:199` reconstruye el historial con `kind === "msg"`: **los resultados de tools no sobreviven entre mensajes**. Sin esto, Amparito identifica en el turno 1 y en el turno 3 no sabe quién es — amnesia en pleno demo. Emitir evento `{type:"afiliado"}` → `afiliadoRef` (mismo patrón que `form`). | `lib/tools.ts`, `components/Chat.tsx:210-214` | **Trampa de implementación.** Si se omite, P2-1 parece funcionar y falla en vivo | 45 min | ⬜ |
| **P2-3** | **Ruta caliente en la máquina de estados.** El arranque caliente es hoy un apéndice inyectado que **pierde** contra ESTADO 2 ("haz 1 a 3 micro-preguntas"), que es más específico y numerado. Nuevo ESTADO 2-B con prohibición explícita de perfilar a quien ya está identificado. Quitar el `¿Es así?` de `route.ts:41` — es el turno de ceremonia que hay que borrar. | `lib/prompts.ts:75-84`, `app/api/chat/route.ts:36-42` | **Criterio de aceptación medible:** desde un nombre reconocido, la tarjeta aparece en el **mensaje 2**, con **una** escritura del usuario | 1 h | ⬜ |
| **P2-4** | **Pantalla de entrada de una sola pregunta.** Hoy compiten cuatro CTAs sin jerarquía. Nuevo saludo: *"Dime tu nombre y qué te trae por aquí. Si estás afiliado te reconozco y nos saltamos el interrogatorio."* Las 6 tarjetas bajan al turno 2 (solo no identificados); el selector del jurado baja al pie en gris; **el botón "Prefiero contarte con mis palabras" se borra** (solo hace `inputRef.focus()` y el input ya tiene `autoFocus`). | `components/Chat.tsx:30-31, 339-368` | La fricción de arranque | 1 h | ⬜ |
| **P2-5** | **Matar el `send("Hola")` fantasma.** Le pinta al usuario un mensaje que nunca escribió, tras un saludo genérico ya pintado. Si el formulario se conserva como atajo del jurado, que **prellene el input** (`pickSuggestion`, `Chat.tsx:183`) en vez de autoenviar. | `components/Chat.tsx:135, 356` | 3 turnos de ceremonia → 0 | 20 min | ⬜ |
| **P2-6** | **Empatía + caso "hoy no te vendo nada".** La regla existía en v2 (*"si la persona cuenta algo difícil, empatiza en UNA frase antes de continuar"*) y **se perdió** en v3. Añadir además el caso límite "sin ingreso hoy": no recomendar ningún producto de pago, y ofrecer lo que la **caja** sí tiene — subsidio al desempleo, agencia de empleo. Idealmente que sea el **motor** quien decida no vender (`no_venta`), no el LLM. | `lib/prompts.ts:30-40, 100-106`, `lib/engine/` | Alguien dijo "no tengo trabajo" y "no tengo ingresos", recibió *"Entiendo"* y *"Está bien"*, y terminó con una recomendación de ~$343.300/año. **Es el segundo tipo de NO, el que de verdad emociona** | 1 h | ⬜ |
| **P2-7** | **Una pregunta por turno.** `prompts.ts:35` ya lo dice, y se violó 3 veces en una conversación — está en una lista de formato, donde se lee como estilo. Subirla al ESTADO 2 con ejemplo negativo. + guarda barata en el route: si el `reply` trae más de un `?`, reintentar. | `lib/prompts.ts:35, 77`, `app/api/chat/route.ts:94-98` | **Causó el bug de la vivienda:** *"¿tienes vehículo, **o** tu vivienda es propia?"* → "propio" (el carro) → `vivienda:"propia"` → vendió Hogar | 30 min | ⬜ |
| **P2-8** | **Perfil acumulado reinyectado cada turno.** `/api/chat` es stateless y el modelo reconstruye el perfil del historial crudo, por eso repitió dos preguntas literalmente. Devolver el perfil acumulado y reinyectarlo: *"Ya sabes: grupo=X, carro=sí, vivienda=?. No preguntes lo que ya está lleno."* | `app/api/chat/route.ts` | Duplicados + refuerza P1-1 | 1 h | ⬜ |
| **P2-9** | **Presupuesto de preguntas.** Máx. **2** antes de la primera tarjeta (hoy 5 y 8). Lo que falte se afina **después** de mostrarla: con la tarjeta en pantalla, cada pregunta pasa de "supera este examen" a "ayúdame a afinar esto". | `lib/prompts.ts:77` | Sin esto no se llega al cierre en 3 min, y el flujo vale 20% | 20 min | ⬜ |
| **P2-10** | **Ciudad solo si hay ambigüedad; primero el apellido.** Si dieron un solo token, lo que falta no es la ciudad: *"¿Mauricio qué más?"*. La ciudad se pregunta **una vez por sesión** y solo con homónimos reales. **Nunca ofrecer ciudades como botones** — convierte el chat en un buscador de dónde vive la gente. | `lib/afiliados/gateway.ts`, `lib/prompts.ts` | Quita un campo del arranque | 30 min | ⬜ |
| **P2-11** | **Homónimos: `buscar()` con `COUNT`, no `LIMIT 1`.** `local-adapter.ts:28` (`porNombre[0]`) y `turso-adapter.ts:31` (`LIMIT 1`) hacen que ante dos homónimos **el sistema atribuya a una persona el segmento de otra, en silencio**. | `lib/afiliados/local-adapter.ts:28`, `turso-adapter.ts:31` | Bug de producto **y** fuga de privacidad. En demo se ve como *"me dijo que tengo hijos y no tengo"* | 45 min | ⬜ |
| **P2-12** | **"No te encontré" cálido y ambiguo.** Acuse dentro del mismo mensaje que ya hace la siguiente pregunta útil. **Nunca decir "no eres afiliado"** (el sistema no lo sabe, y es la frase de exclusión que el PRD viene a matar). Un reintento como opción, jamás como exigencia; si falla, el tema se cierra para siempre. | `lib/prompts.ts` | Efecto lateral: no distingue "no está" de "está con otro nombre" → no sirve para averiguar membresías | 20 min | ⬜ |
| **P2-13** | **Tope de 3 búsquedas por conversación**, en `executeTool` (código, no prompt). | `lib/tools.ts` | Bloqueo real de enumeración. Mitiga parcialmente P0-2 | 15 min | ⬜ |
| **P2-14** | **Ingreso por rangos, nunca como peaje.** Hoy: *"antes de mostrarte los precios, necesito que sientas esto: ¿cuánto ganas al mes?"* — la pregunta más invasiva del flujo, condicionando el precio, hecha por un asistente que ya conoce la categoría. Primero el precio; después, opcional, el impacto; con `OPCIONES` de rango; y **nunca** a quien dijo que no tiene ingresos. | `lib/prompts.ts:84` | Es el patrón "déjanos tus datos" que el PRD viene a matar | 20 min | ⬜ |

---

## P3 · Errores deterministas — baratos y sin LLM de por medio

| # | Ajuste | Dónde | Cierra | Esfuerzo | Est. |
|---|---|---|---|:--:|:--:|
| **P3-1** | **SOAT: se cotiza tarifa de moto a quien tiene carro, marcada "Tarifa oficial regulada".** `prima_regla.base = 343300` con `nota_precio: "…para moto de 100 a 200cc"`, pero la señal dispara para `["carro","moto"]`, y la UI muestra el badge de máxima confianza. Un carro cuesta 60–80% más. **Determinista, 100% de los casos.** Bajar a `"referencia"` o separar `soat_moto`/`soat_carro`. | `data/catalog.json`, `data/weights.json`, `Chat.tsx:678-680` | **El peor error cuantitativo del sistema**, y la única cifra que se presenta como exacta y vinculante | 15 min | ⬜ |
| **P3-2** | **SOAT obligatorio en banda propia, nunca en descartados.** A alguien que dijo *"compré una moto, la uso para trabajar, no tengo SOAT"* se le respondió *"Hoy tu prioridad es seguro de vida; esto lo puedes sumar más adelante"* — sobre un seguro **obligatorio por ley** (769/2002). Y en la misma tarjeta el reason code dice *"Es obligatorio para tu vehículo"*: **se contradice a sí misma**. Nuevo bucket `obligatorios`, fuera de la competencia por el ranking. | `data/weights.json`, `lib/engine/types.ts`, `lib/engine/scorecard.ts:25, 173-181`, `Chat.tsx` | Único hallazgo con exposición legal **y** reputacional. Agravado porque los descartados están **abiertos por defecto** (R8) | 30 min | ⬜ |
| **P3-3** | **Motivos de descarte específicos + bajar `MAX_DESCARTADOS` a 2.** `motivoDescarte()` genera la misma plantilla para todos: cuatro viñetas idénticas. El guion promete motivos específicos. Dos motivos distintos convencen; cuatro idénticos delatan. | `lib/engine/scorecard.ts:173-181`, `data/weights.json` | El beat "ver descartados" hoy subraya el problema en vez de responderlo | 30 min | ⬜ |
| **P3-4** | **Guardas de plausibilidad en el impacto.** `ingreso_mensual` llega directo del LLM con único filtro `Math.max(0,…)`. `anos = 10` es arbitrario y no declarado en ningún doc, y multiplica el resultado por 10. `dependientes` se pide, se recibe… y la tarjeta nunca lo usa. | `lib/engine/impacto.ts:23, 28`, `lib/tools.ts:98, 241`, `Chat.tsx:558-572` | Fricción sin valor + tarjeta con número absurdo sin alarma | 30 min | ⬜ |
| **P3-5** | **`MIN_N`: subir a ~20.000 o cambiar el copy.** Es un umbral de **persuasión**, no de estadística (el propio comentario lo dice). 63% de las celdas que pasan representan <0,5% de la base. *"No estás solo: hay 3.654"* sobre 1,5M **es el 0,23%** — el dato demuestra lo contrario del mensaje. Además `pct` se calcula, viaja en el evento y **nunca se muestra**: se enseña el numerador y se esconde el denominador. | `lib/engine/peer.ts:27, 42`, `Chat.tsx:643` | Inconsistente con el propio estándar del equipo, que eliminó el "8 de cada 10" por esto mismo | 20 min | ⬜ |
| **P3-6** | **SARLAFT: matizar la afirmación.** *"Vinculación simplificada bajo SARLAFT"* sin listas restrictivas, PEP ni debida diligencia en el repo. Cambiar a *"En producción, vinculación simplificada bajo SARLAFT"*. | `app/page.tsx:169`, `Chat.tsx:403` | Afirmación de cumplimiento sin implementación | 5 min | ⬜ |
| **P3-7** | **`/api/tool` antes de encender la voz.** Ejecuta cualquier tool con cualquier input, protegido solo por el flag y un `sameOrigin` que su propio comentario reconoce insuficiente. Con la voz encendida, un cliente podría llamar `issue_policy` con `consentimiento:true`. La compuerta de `tools.ts:326` valida el **campo**, no la **procedencia** del consentimiento. | `app/api/tool/route.ts:28`, `lib/voice/guard.ts` | Contenido por el flag apagado. **Anotar antes de prender la voz** | — | ⏸️ |

---

## P4 · Front — cómo se ve el diferenciador

| # | Ajuste | Dónde | Cierra | Esfuerzo | Est. |
|---|---|---|---|:--:|:--:|
| **P4-1** | **El hero es lo más pequeño de la pantalla.** Tres anchos apilados: mensajes 82%≈623px, **PropensionCard 470px**, recomendaciones 430px. La tarjeta que vale 25%+15% de la rúbrica es **más angosta que un mensaje de chat** y aparece tras 18 mensajes. Que `.propcard` y `.recos` sean el elemento más ancho del hilo. | `app/globals.css:203, 324, 339` | Escalera visual que angosta justo cuando el contenido importa más | 20 min | ⬜ |
| **P4-2** | **La tarjeta dice todo dos veces.** Los reason codes del #1 se imprimen en *WhyThis* y otra vez, palabra por palabra, en *RIESGOS HOY* (son el mismo dato por definición). El nombre del producto aparece 3 veces. R11 quitó la duplicación **entre** tarjetas; queda la de **dentro**. | `components/Chat.tsx` (PropensionCard) | Se lee como relleno | 30 min | ⬜ |
| **P4-3** | **"YA CUBIERTO — Nada aún": media tarjeta anunciando que no hay nada.** El banner héroe de anti-venta (`.pp-antiventa`) **no se renderiza nunca** si `ya_cubierto` está vacío — y estuvo vacío en las dos conversaciones reales. Decidir qué muestra la tarjeta cuando no hay anti-venta. | `app/globals.css:348`, `Chat.tsx` | El posicionamiento entero es *"el asesor que a veces te dice que NO"*, y en pantalla eso es hoy una caja vacía | 30 min | ⬜ |
| **P4-4** | **La pregunta llega antes que la respuesta.** El mensaje *"¿Quieres que te cuente cómo funciona el de Hogar, o prefieres empezar por el SOAT?"* aparece **encima** de la tarjeta que presenta Hogar y SOAT. + dos títulos apilados que dicen lo mismo (`POR QUÉ ESTO ES PARA TI` / `Así analicé tu protección`). | `components/Chat.tsx` | Orden del stream | 20 min | ⬜ |

---

## P5 · Decisiones de guion — qué NO mostrar

| # | Decisión | Por qué |
|---|---|---|
| **P5-1** | **Sacar la ImpactoCard del guion.** Los tres paneles coincidieron por separado. `impacto_total = ingreso × 12 × años`: sin descuento, sin inflación, sin netear el ingreso del cónyuge, y **sin ninguna relación con la suma asegurada** — que el catálogo nunca fija. Se muestra una cifra de nueve dígitos rotulada *"💛 Lo que proteges"* junto a una póliza cuya suma asegurada es desconocida. Un jurado con background de seguros pregunta por ella y no hay respuesta. **Dejarla en el código, no mostrarla.** Si se muestra, cambiar el rótulo a *"Lo que tu familia dejaría de recibir"*, que es lo que el número mide. |
| **P5-2** | **Demostrar en vivo, con el jurado tecleando.** El instinto ha sido defensivo (offline, personas guionizadas), y va **en contra** de lo que se califica: el brief pide que el jurado recorra el flujo sin apoyo del equipo. Las dos conversaciones reales encontraron dos bugs que cuatro rondas de paneles no vieron. Modo offline = paracaídas invisible. |
| **P5-3** | **La voz queda apagada.** Construida, nunca validada en vivo. Vale cero puntos hoy; prenderla sin probar vale negativo. En el pitch, una frase: *"está construida detrás de un flag"*. |

---

## P6 · Feedback del equipo de seguros (24-jul, tarde)

> El equipo de seguros de Colsubsidio revisó el producto funcionando. Su feedback llega desde la
> operación real, no desde la rúbrica — por eso vale doble: **son ellos quienes saben qué pasa
> después del "Elegir este"**.

### Lo que convergió con hallazgos que ya teníamos

**Validación de identidad para no afiliados** (*"quién eres y no eres un robot"*). Es el mismo
problema de **P0-2**, visto desde el otro lado: nosotros lo detectamos como riesgo de enumeración;
ellos lo piden como requisito de producto. Converge en la misma solución.

**"Hay afiliados que ni siquiera se loguean en la página."** Este dato **valida el diseño actual** y
cierra una discusión: no se puede depender de sesión autenticada de Colsubsidio, ni como atajo ni
como solución "correcta" a futuro. El camino nombre + ciudad no era un parche: es el único que
alcanza a la población real.

**El principio que resuelve la tensión:** *conversar es libre; **expedir** exige identidad.* No se
pone fricción en la entrada (P2-4), se pone donde ya hay intención de compra y la persona **espera**
que se la pidan. `collect_customer_data` ya recoge documento: la validación va ahí, no en el saludo.

| # | Ajuste | Cierra | Esfuerzo | Est. |
|---|---|---|:--:|:--:|
| **P6-1** | **Reto ligero antes de revelar personalización de la base.** Para el afiliado identificado: un solo campo —año de nacimiento o últimos 4 del documento— entre `estado:"unico"` y la entrega del segmento al modelo. Sin login, sin OTP, sin infraestructura nueva (una columna más en la base). | **P0-2** por la vía correcta. Y responde el *"quién eres"* del equipo | 1 h | ⬜ |
| **P6-2** | **Identidad y anti-bot en el cierre, no en la entrada.** Rate limiting + el tope de 3 búsquedas (P2-13) cubren el bot durante la conversación. La verificación fuerte va en la expedición. | *"no eres un robot"* sin matar el arranque | 45 min | ⬜ |

### Lo que es nuevo y no teníamos

| # | Ajuste | Por qué importa | Esfuerzo | Est. |
|---|---|---|:--:|:--:|
| **P6-3** | **Claridad de tiempos en la expedición.** *"Justo cuando se va a expedir se va a la aseguradora principal"* — hay un handoff real, con demora real, y el usuario debe saber qué pasa y cuánto tarda. Hoy decimos *"tu certificado llegará al correo en las próximas horas"*: vago y sin respaldo. Debe decir qué se envía, a quién, cuánto tarda, y qué pasa si no llega. | Es **el momento de mayor ansiedad** de toda la venta y hoy está resuelto con una frase de relleno. Complementa **P0-3** | 45 min | ⬜ |
| **P6-4** | **Medir esfuerzo y satisfacción (CES + CSAT).** *"¿cómo fue su experiencia en la venta a través del agente?"* Dos preguntas al cierre: esfuerzo percibido (*"¿qué tan fácil fue?"*) y satisfacción. Un evento `feedback` + tarjeta de 2 toques. | **Completamente nuevo.** Y encaja con la rúbrica: *Experiencia y confianza 15%*. Además da la métrica que el PRD nunca definió para saber si el flujo funciona | 1 h | ⬜ |
| **P6-5** | **Tomador ≠ Asegurado ≠ Beneficiario.** *"Una persona compra un seguro para otra persona."* Hoy `Perfil` asume que quien conversa, quien paga y quien está asegurado son la misma persona. Ver análisis abajo. | **Gap estructural.** Y a la vez, la mejor oportunidad de anti-venta que queda sin explotar | ver abajo | ⬜ |

### P6-5 en detalle — comprar para otra persona

Es el cambio de mayor alcance de todo el backlog, y también el de mayor retorno.

**Qué rompe hoy:**

| Pieza | Problema |
|---|---|
| `Perfil` | Es un solo objeto. No distingue de quién es el riesgo y de quién es la plata |
| `gate_affordability` (`CATEGORIA`) | Debe seguir al **tomador** — es quien paga |
| Señales de riesgo (moto, vivienda, dependientes) | Deben seguir al **asegurado** |
| Prima por edad (`mock-adapter.ts:17`) | Debe usar la edad del **asegurado**, no la de quien conversa |
| Gate de posesión (`requiere`) | "No tienes moto" es falso si la moto es de tu hijo |
| Peer-group | Es del asegurado, no del comprador |

**El límite legal, que es la oportunidad.** No se puede asegurar la vida de cualquiera:
**art. 1137 C. de Comercio** (interés asegurable: la propia vida, la de quienes dependen
económicamente, y aquellas cuya muerte cause perjuicio económico) y **art. 1138** (se requiere el
consentimiento del asegurado). Más **Ley 1581 art. 9**: entregar datos de un tercero exige la
autorización de ese tercero.

Eso es un **anti-venta legítimo, citable y demostrable en vivo**:

> *"Puedo asegurar a tu hijo o a tu mamá — tienes interés asegurable. A tu vecino no, aunque quisieras
> pagarlo: la ley pide que la persona lo sepa y lo autorice (art. 1138 del Código de Comercio). Y sus
> datos me los tiene que dar él, no tú."*

Es exactamente el posicionamiento del producto, aplicado a un caso que el equipo de seguros trajo
del mundo real.

**El enganche con la base que ya tenemos:** `SEGMENTO_GRUPO_FAMILIAR` dice si hay grupo familiar.
Para una afiliada monoparental, Amparito puede ofrecer proteger al dependiente **sin preguntar nada**,
porque la base ya lo dice. Eso es hiperpersonalización real con datos que ya están cargados.

**Alcance recomendado:** partirlo en dos.
- **P6-5a (demo, ~3 h):** soportar el caso *afiliado asegura a alguien de su grupo familiar declarado*,
  con la verificación de interés asegurable visible y el anti-venta legal. Cubre el 90% del caso real
  y luce.
- **P6-5b (post-demo):** modelo completo tomador/asegurado/beneficiario en `Perfil`, con `_origen` por
  persona. Es rediseño de contrato, no cabe antes del demo.

### Sobre "hiperpersonalización de producto" — hay que aterrizarlo

Con el catálogo actual **la hiperpersonalización de producto no es alcanzable, y prometerla sería el
mismo error que venimos cerrando.** Los 16 productos son fijos: no hay coberturas modulares, no hay
niveles de suma asegurada, no hay deducibles configurables, y `valor_asegurado` ni siquiera existe
(P3-8). No hay nada que ensamblar.

Lo que **sí** es real, ya está construido y se puede llamar por su nombre:

1. **Personalización de la recomendación** — el scorecard produce ranking y reason codes distintos por
   persona. Verificado en vivo con dos conversaciones reales.
2. **Personalización del argumento** — y esta está sin explotar. Para el motociclista que trabaja en su
   moto, la cobertura que importa no es fallecimiento: es **incapacidad ≥50%**, que es el riesgo *más
   probable*. El dato está en el clausulado y ningún flujo lo usa. Elegir **con qué cobertura se
   encabeza** según el perfil es personalización real, cuesta poco y se nota.
3. **Personalización por grupo familiar** — P6-5a.

Ajuste asociado → **P6-6 · encabezar con la cobertura que le importa a esa persona** (`weights.json`
gana un mapa perfil→cobertura destacada). Esfuerzo: 45 min. Es la forma honesta de responder a la
petición de hiperpersonalización.

---

## STOP — qué dejar de hacer (coincidencia de los 4 paneles)

1. **No más paneles de expertos.** Van cuatro rondas. Cada una genera tareas, no puntos — y ese bucle *es* la causa de la sensación de dispersión.
2. **No más documentos.** Ya sobra documentación (este backlog es la excepción y es el último).
3. **No más "tiers" de tono y copy.** No hay Tier 3. La evidencia dice que el problema no está en las palabras, está en la **secuencia**.
4. **No tocar el motor** (`lib/engine/*`, `weights.json`, calibración). Es determinista, auditable y **acierta**: en la conversación 2 tenía Vida (70) como #1 y lo que falló fue el perfil que le llegó. Únicas excepciones: P3-2 (bucket obligatorios) y P3-3.
5. **No tocar la voz, el modo offline ni Turso.** Terminados y fuera del camino crítico.
6. **No recalibrar pesos la noche antes.** Rompe los gates y no gana un punto.
7. **No abrir de nuevo el disclosure en 3 capas** (Tier 2). Resuelto y cumple.

---

## Veredicto de partida

Contra los pesos reales del PRD, el jurado estimó **≈6.8/10** — "buen proyecto, no ganador". Lo
diferencial real y defendible: `weights.json` como artefacto auditable abrible en pantalla, el
peer-group sobre 194 celdas de la base real, la variación demostrada en vivo (no guionada) y la
tarjeta del porqué. Con P0 + P1 + P2 cerrados, la estimación sube a ~8 y compite por podio.

**Si solo se hace una cosa de cada bloque:** P0-1 · P1-1 · P2-1 · P3-1.
