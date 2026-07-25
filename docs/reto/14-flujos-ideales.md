# 14 — Flujos ideales (afiliado y no afiliado) + capacidades de asesor

> **Especificación de implementación, no documentación.** Define turno por turno cómo deberían
> sentirse los dos caminos, con **datos reales** de `data/catalog.json`, y qué debe saber responder
> Amparito para estar a la altura de un asesor humano. Complementa el backlog de
> [13-hallazgos-y-prioridades.md](./13-hallazgos-y-prioridades.md).

---

## Parte 1 · ¿Está el backlog alineado con el PRD?

Sí en su mayoría — y en tres puntos **el que está desalineado es el PRD**, no el backlog.

### Ajustes que son requisitos del PRD que nunca se implementaron

| Ajuste | Requisito PRD | Estado real |
|---|---|---|
| **P1-1 · `sanearPerfil()`** | **RNF-7 · Regla de oro:** *"guardrail que bloquea cifras/coberturas sin origen en una tool"* | El PRD pide un **guardrail**, no una instrucción. Nunca se construyó del lado de la entrada. P1-1 no es alcance nuevo: **es RNF-7 pendiente** |
| **P1-2 · procedencia por campo** | **RNF-6 · Explicabilidad auditable:** *"toda recomendación persiste {perfil, reglas, pesos, reason codes, cita de fuente}"* | Nada persiste hoy. Sin saber de dónde salió cada campo del perfil, la auditoría es incompleta |
| **P3-2 · SOAT obligatorio** | **RF-9 · Catálogo vivo** + no-negociable *"lógica explicable"* | El dato correcto ya está en `weights.json` y en `catalog.json`; el motor lo pisa |

**Conclusión:** el grueso de P1 no compite con el PRD. Lo completa.

### Tres desalineaciones donde hay que corregir el PRD

**1 · RNF-3 vs. Turso.** El PRD dice *"Cero PII: `NOMBRE_COMPLETO` se dropea en el paso 1 del pipeline;
**nombres del demo = sintéticos**"*. Hoy hay 1.558.501 nombres reales en Turso y el arranque caliente
busca por nombre real. **La feature contradice frontalmente el RNF-3 escrito.** Es una decisión
tomada conscientemente, pero el PRD debe decirlo: o se acota el RNF-3 ("cero PII en repo, logs y
navegador; el índice de nombres vive en base administrada con acceso solo-backend"), o la feature no
es defendible cuando el jurado cite el propio PRD.

**2 · RF-2 y las "4-6 preguntas".** El PRD especifica *"no afiliado: 4-6 preguntas"*. La evidencia de
las dos conversaciones reales dice que 5 y 8 preguntas producen tarjetas en el mensaje 13 y 18, y que
**el #1 no cambia**. La recomendación de los paneles es **máximo 2** antes de la primera tarjeta.
El PRD está escrito contra una intuición que los datos desmintieron. Actualizarlo.

**3 · RF-5 y el "eligieron".** El PRD todavía dice *"Afiliados como tú **eligieron**…"*. La base **no
tiene etiqueta de compra** — la Ronda 2 ya corrigió el copy del producto por eso mismo, pero la línea
quedó viva en el PRD. Es exactamente la afirmación que se eliminó. Corregir a *"cuántos afiliados hay
en tu mismo segmento"*.

### Una tensión que hay que decidir, no resolver en el papel

**RNF-1 (camino crítico sin red, respuestas pre-cacheadas) vs. RNF-5 (el jurado recorre el flujo
solo).** El panel de jurado fue explícito: demostrar con personas guionizadas se lee como un riel, y
el brief castiga *"flujos que requieran explicación adicional"*. Las dos conversaciones reales
—desordenadas, en vivo— encontraron dos bugs que cuatro rondas de paneles no vieron. **Recomendación:
RNF-1 se conserva como paracaídas invisible, no como modo de demo.**

---

## Parte 2 · Lo que hace un asesor humano

Un asesor de seguros no "recomienda un producto". Hace doce cosas. Esta es la matriz contra lo que
Amparito puede hoy — y aquí aparece el hallazgo más importante de este documento.

| # | Lo que hace un asesor | ¿Puede Amparito? | Fuente / brecha |
|:--:|---|:--:|---|
| 1 | Escucha la situación y la traduce a riesgo | ✅ | Motor + reason codes |
| 2 | Dice **qué cubre** | ✅ | `get_product_details` → `coberturas` |
| 3 | Dice **qué NO cubre** (expectativa realista) | ✅ | → `exclusiones` |
| 4 | Explica **cómo se calcula la prima** | ✅ | → `art9.forma_calculo` |
| 5 | Explica **qué pasa si dejas de pagar** | ✅ | → `art9.consecuencias_no_pago` |
| 6 | Dice si hay **periodos de carencia** | ✅ | Está dentro del texto de coberturas |
| 7 | Cita la **fuente / clausulado** | ✅ | → `fuente` (URL real) |
| 8 | Dice **cuándo NO comprar** | ⚠️ parcial | Solo si `ya_cubierto`. Falta el "hoy no te sirve" (P2-6) |
| 9 | Escala a un humano cuando hay duda seria | ✅ | `escalate_to_human` + botón en el header |
| 10 | **Dice de cuánto es la póliza (valor asegurado)** | ❌ **NO** | **No existe en el catálogo** |
| 11 | Explica **cómo se reclama** (proceso de siniestro) | ❌ **NO** | No existe en el catálogo |
| 12 | Menciona el **derecho de retracto** | ❌ **NO** | No existe. Venta digital → aplica |

### La brecha #10 es la grave

`vida_panamerican.art9.forma_calculo` dice literalmente *"Prima mensual según edad y **valor
asegurado**"* — **un valor que el sistema nunca fija, nunca muestra y no tiene en ninguna parte.**

Es la primera pregunta que cualquier persona le hace a un asesor: *"¿y de cuánto es?"*. Amparito hoy
no puede responderla. Y agrava P5-1: la ImpactoCard muestra *"💛 Lo que proteges: $240.000.000"*
junto a una póliza de $28.600/mes cuya suma asegurada es desconocida. Un usuario razonable entiende
que la póliza paga esos $240 millones.

### Auditoría de los 16 productos — qué cifra es determinable y cuál no

No todas las pólizas se comportan igual, y el sistema hoy las trata a todas como si sí. Auditoría
completa sobre `data/catalog.json`:

**Cuánto PAGA la póliza (valor asegurado / topes):**

| Nivel | Productos | Situación |
|---|---|---|
| **Cuantificado y verificable** | SOAT | 3 topes reales y regulados: gastos médicos **$36.749.788**, incapacidad **$10.505.430**, muerte y funerarios **$43.772.625** |
| **Cuantificado parcialmente** | Hogar y Contenidos | Hurto de contenidos en tres niveles (**$5,6M / $11,2M / $22,4M**) — pero **no se dice cuál aplica** ni de qué depende |
| **Sin cuantificar** | **los otros 14** | Las coberturas describen *qué* eventos cubren, nunca *cuánto* pagan |

**`valor_asegurado` como campo: no existe en ningún producto.** 0 de 16.

**Cuánto CUESTA la póliza (prima):**

| Certeza | Productos | Qué puede decir Amparito |
|---|---|---|
| **Regulado** | SOAT | Cifra exacta — **pero hoy es la de moto 100-200cc y se aplica también a carros** (P3-1) |
| **Referencia calculable** | 12 productos | Un número plausible desde `prima_regla`, honestamente rotulado "valor de referencia" |
| **No determinable** | Salud · Todo Riesgo Carro · **Arrendamiento** | `requiere_asesoria: true`: *"las condiciones exactas las define la aseguradora"*, *"requiere inspección"*, *"requiere estudio y aprobación"* |

### El bug: el sistema cotiza igual los que no se pueden cotizar

`MockInsurerAdapter.quote()` (`lib/insurer/mock-adapter.ts:17-19`) calcula prima para **cualquier**
producto, ignorando `requiere_asesoria`. Verificado ejecutándolo:

```
arrendamiento_mundial      prima = $0 / mensual        ← prima_regla.base = 0
salud_bmi                  prima = $147.000 / mensual  ← "requiere asesoría"
todo_riesgo_carro_chubb    prima = $193.500 / mensual  ← "requiere inspección"
```

**El Seguro de Arrendamiento se cotiza en $0 al mes.** Si alguien lo pide, Amparito le dice que es gratis.

### Dónde falla el guardrail actual

**RNF-7 dice:** *"el LLM nunca produce una prima ni una cobertura de su cabeza; guardrail que bloquea
cifras sin origen en una tool"*. Eso **se cumple**: el LLM llama la tool y repite.

El problema es que **la tool produce cifras que no debería producir**. El guardrail está un nivel más
abajo de donde hace falta: no basta con que la cifra venga de una tool — la tool tiene que saber
**cuándo no tiene cifra** y decirlo. Es el mismo defecto que `sanearPerfil()` corrige en la entrada,
pero en la salida.

### `P3-8` (revisado) — certeza explícita por cifra

1. **Campo `prima_certeza`** por producto: `"regulado"` · `"referencia"` · `"requiere_cotizacion"`.
2. **El adaptador se niega a inventar:** si es `requiere_cotizacion` → devuelve `prima: null`, y la UI
   muestra *"Este seguro se cotiza caso por caso"* + botón de asesor. Nunca un número.
3. **Guarda dura:** `if (prima <= 0) throw` — cotizar en cero nunca es un resultado válido.
4. **Campo `valor_asegurado`:** número, rango, o `null` explícito. Cuando es `null`, Amparito responde
   la verdad: *"El valor asegurado lo define la aseguradora según el plan que elijas; te lo confirma un
   asesor."* Eso **no es una brecha, es una respuesta honesta** — y es lo que diría un asesor real.

> ⚠️ **Los valores asegurados reales no se inventan.** Son dato de producto que debe venir de
> Colsubsidio o del clausulado. Mientras no lleguen, `null` + la frase honesta. Rellenarlos "para que
> el demo luzca" sería cometer exactamente el error que este documento viene a cerrar.

Esfuerzo: 45 min (3 campos + guarda en el adaptador + copy). Prioridad **alta**: sin esto los flujos se
caen en el turno del precio, y hay un producto que se cotiza en cero.

Las brechas #11 y #12 son de menor urgencia para el demo, pero un jurado de la caja puede preguntarlas.
Dos campos más en el catálogo (`como_reclamar`, `retracto`) y quedan cubiertas.

---

## Parte 3 · Flujo ideal — AFILIADA

**Persona:** mujer, 36-45, monoparental, categoría A, Bogotá. Segmento real de la base.
**Meta:** tarjeta en el **mensaje 2**. Luego, asesoría de verdad.

---

**T0 · Pantalla**

> ¡Hola! Soy Amparito, la asistente de seguros de Colsubsidio 💛
> **Dime tu nombre y qué te trae por aquí. Si estás afiliado te reconozco y nos saltamos el interrogatorio.**

---

**T1 · Ella**

> soy Carolina Ramírez

→ El modelo llama `identificar_afiliado("Carolina Ramírez")` → `unico` → en el **mismo turno** llama
`calcular_propension` con el segmento. Sin preguntar ciudad. Sin pedir confirmación bloqueante.

---

**T2 · Amparito** *(mensaje 2 — aquí ya hay valor en pantalla)*

> Hola, Carolina 👋 Ya te ubiqué: veo que sostienes sola tu hogar. Con eso ya te preparé esto — si algo no cuadra, me lo dices y lo ajusto al instante.

**[TARJETA DE PROPENSIÓN]**
- ✓ **Seguro de Vida** · Pan-American Life — *"Eres el sostén de un hogar monoparental: si te faltas, nadie más cubre el ingreso"*
- **Riesgos hoy:** hay personas que dependen de tu ingreso
- **Ya cubierto:** *(vacío → ver P4-3: qué mostrar aquí)*
- **62.459 afiliadas** en tu mismo segmento *(dato real, 4 ejes verificados desde la base)*
- **Por qué NO te recomendé lo demás** — 2 motivos específicos, no 4 plantillas

---

**T3 · Ella** — *la pregunta que define si esto es un asesor o un recomendador*

> ¿y eso qué cubre exactamente?

**T4 · Amparito** → `get_product_details("vida_panamerican")`

> Te cuento en cristiano, y son dos cosas:
>
> **1 · Si faltas** — paga por **cualquier causa**: muerte natural o accidental. Y algo que casi ningún seguro dice tan claro: **incluye homicidio y suicidio, y no tiene periodos de carencia.** O sea, cubre desde el día uno, no a los dos años.
>
> **2 · Si quedas incapacitada** — si pierdes el 50% o más de tu capacidad laboral (lo dictamina la ARL, tu fondo de pensiones o la Junta de Calificación), también paga. Esta es la que la gente olvida, y es la que más se usa.
>
> ¿Te digo qué **no** cubre? Prefiero que lo sepas antes y no después.

> **OPCIONES:** Sí, dime qué no cubre | ¿Cuánto cuesta? | ¿De cuánto es la póliza?

---

**T5 · Ella**

> sí, qué no cubre

**T6 · Amparito**

> Tres cosas, y son las mismas en toda la industria:
>
> · **Guerra**, invasión, rebelión o asonada
> · **Accidentes nucleares** — radiación, contaminación radiactiva
> · **Si ocultas o falseas información al contratar** (arts. 1058 y 1158 del Código de Comercio). Esta es la única que depende de ti: responde con la verdad y no hay problema.
>
> Nada de "letra menuda" escondida. El clausulado completo está [aquí]({fuente}) si lo quieres leer.

---

**T7 · Ella**

> y cuánto me cuesta

**T8 · Amparito** → `quote_product("vida_panamerican", perfil)`

**[TARJETA DE COTIZACIÓN]**
> **$28.600 al mes** · valor de referencia
>
> Menos de mil pesos al día — más o menos un tinto.
>
> **Cómo se calcula:** prima mensual según tu edad y el valor asegurado. A los 39 años te sale así; sube un poquito cada año.
>
> **Si dejas de pagar:** la póliza se cancela por mora y pierdes la cobertura **y la antigüedad**. Eso último importa: si vuelves después, entras como nueva.
>
> ▸ *Ver términos completos* (colapsado)

---

**T9 · Ella** — *la pregunta que hoy no tiene respuesta*

> ¿y de cuánto es? o sea cuánto le pagan a mi hijo

**T10 · Amparito** *(requiere `P3-8`)*

> El valor asegurado es de **$XX.XXX.XXX**. Eso es lo que recibiría tu hijo, en un solo pago.
>
> *(Sin `P3-8` Amparito no puede responder esto, y el cierre se cae justo aquí.)*

---

**T11 · Ella**

> ok y si me pasa algo mañana, ¿cómo hace mi hijo para cobrar?

**T12 · Amparito** *(requiere `como_reclamar` en el catálogo — brecha #11)*

> *(Hoy: solo puede escalar a un asesor. Es una salida digna, pero es una salida.)*
> Esa te la respondo bien con un asesor de carne y hueso, que te acompaña el trámite. ¿Te llamo?

---

**T13 → cierre** — consentimiento como *"confirmar tu protección"* → certificado (**rotulado como
simulación**, P0-3).

**Preguntas totales de Amparito antes de la tarjeta: 0.** Preguntas de ella: todas las que quiso.

---

## Parte 4 · Flujo ideal — NO AFILIADO

**Persona:** hombre, 28, compró moto, la usa para trabajar, sin SOAT, su mamá depende de él.
**Meta:** máximo **2 preguntas** antes de la primera tarjeta. Y resolver primero lo que la ley exige.

---

**T1 · Él**

> compré una moto

*(No dio nombre. No se le vuelve a pedir.)*

---

**T2 · Amparito** — *pregunta 1 de 2*

> ¡Felicidades por esa moto! 🏍️ Una sola cosa y te muestro lo tuyo: **¿alguien depende de tu ingreso?**
>
> **OPCIONES:** Sí, mis papás | Sí, mis hijos | No, solo yo

---

**T3 · Él**

> mi mamá

---

**T4 · Amparito** → `calcular_propension` — *aquí manda el orden, no el score*

> Andrés, antes de recomendarte nada: **¿ya tienes el SOAT?** Te lo pregunto de primero porque no es
> una recomendación mía, es la ley.

**T5 · Él**

> no, de cero

---

**T6 · Amparito** *(requiere `P3-2` — banda de obligatorios)*

**[BANDA · ESTO NO ES RECOMENDACIÓN, ES OBLIGACIÓN]**
> **SOAT** — Obligatorio por ley para tu moto. Sin él te la pueden **inmovilizar** y te multan. Y si trabajas en ella, eso es quedarte sin ingreso el mismo día. No lo pongo a competir con lo demás: hay que tenerlo.
>
> **Cubre** (topes 2026, tarifa regulada por el Gobierno):
> · Gastos médicos por accidente de tránsito — hasta **$36.749.788**
> · Incapacidad permanente — hasta **$10.505.430**
> · Muerte y gastos funerarios — hasta **$43.772.625**
> · Transporte de las víctimas
>
> **No cubre:** daños a tu moto, ni daños a bienes de terceros. Para eso es otro seguro, y te lo digo por si creías que estabas cubierto.
>
> ⚠️ *La tarifa depende del cilindraje — te la confirmo con la placa.* **(P3-1)**

**[TARJETA DE PROPENSIÓN]**
> ✓ **Seguro de Vida** — *"Tu mamá depende de tu ingreso"*
> Opción: **Accidentes Personales** — *"Te mueves en moto: mayor exposición"*
> *(Sin prueba social: no está identificado, no se inventan los ejes — **P1-1**)*

En su lugar, donde iba el peer:

> 💡 Si eres afiliado a Colsubsidio y me dices tu nombre, te digo cuántas personas como tú hay — y afino esto con lo que ya sabemos de ti.

---

**T7 · Él**

> el de vida cubre si me mato en la moto?

**T8 · Amparito** → `get_product_details("vida_panamerican")`

> Sí. Cubre fallecimiento **por cualquier causa** — natural o accidental. Un accidente en moto entra, y no hay periodo de carencia: cubre desde que arranca.
>
> Y hay una cobertura que en tu caso pesa más que la de muerte: si quedas **incapacitado** y pierdes el 50% o más de tu capacidad laboral, también paga. Trabajando en moto, ese es el riesgo más probable — no el peor, pero sí el más probable.
>
> Lo que **no** cubre: guerra, accidentes nucleares, y ocultar información al contratar.

---

**T9 → cierre.** Preguntas de Amparito: **2** (dependientes, SOAT). La segunda no era de perfilamiento:
era de obligación legal.

---

## Parte 5 · Las 8 reglas que hacen esto un asesor y no un formulario

1. **Valor antes que preguntas.** Tarjeta primero, refinamiento después. Con algo en pantalla, cada pregunta pasa de *"supera este examen"* a *"ayúdame a afinar esto"*.
2. **Toda pregunta cambia algo visible.** Si la respuesta no mueve la tarjeta, la pregunta sobra. Se preguntó por el SOAT y la respuesta se ignoró: eso enseña que responder no sirve.
3. **Lo obligatorio va antes que lo recomendado.** Distinguir *"la ley te obliga"* de *"yo te sugiero"* es criterio, y luce más que un ranking.
4. **El "no cubre" se ofrece, no se esconde.** Amparito propone decir las exclusiones antes de que se las pidan. Eso es lo que hace un buen asesor y ninguna landing page.
5. **Siempre una cifra con su origen.** Prima → `prima_regla`. Topes → clausulado. Nunca de la cabeza del modelo (RNF-7).
6. **Nunca se recita el segmento como ficha.** Nada de *"mujer, 36-45, categoría A, monoparental"*. Se traduce a una señal humana: *"veo que sostienes sola tu hogar"*. Es UX y contención de fuga a la vez.
7. **Cuando no sabe, lo dice y escala.** *"Esa te la respondo bien con un asesor"* es mejor respuesta que una inventada — y es el mismo músculo del anti-venta, aplicado al conocimiento.
8. **Cuando no conviene comprar, no vende.** Incluido el caso sin ingresos, donde lo correcto es ofrecer el subsidio al desempleo y la agencia de empleo (P2-6). Colsubsidio es una caja, no una aseguradora: esa carta no la tiene nadie más.

---

## Parte 6 · Qué habilita cada flujo (dependencias del backlog)

| Momento del flujo | Depende de |
|---|---|
| Tarjeta en el mensaje 2 (afiliado) | **P2-1, P2-2, P2-3** |
| Máximo 2 preguntas (no afiliado) | **P2-9, P2-7** |
| SOAT en banda de obligatorios, antes del ranking | **P3-2** |
| Tarifa del SOAT no marcada como "oficial" para carros | **P3-1** |
| Sin prueba social inventada + CTA de identificación | **P1-1, P1-2** |
| Responder "¿de cuánto es la póliza?" | **P3-8 (nuevo)** |
| Responder "¿cómo reclamo?" | brecha #11 (nuevo, opcional) |
| Certificado rotulado como simulación | **P0-3** |

**Ajuste nuevo que sale de este ejercicio:** `P3-8 · valor asegurado en el catálogo` (30 min, alta
prioridad). Sin él, los dos flujos se rompen en el turno del precio.
