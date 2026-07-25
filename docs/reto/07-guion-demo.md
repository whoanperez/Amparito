# Guion de demo — Amparito (3 minutos) · v2

> **Reescrito el 25-jul** tras dos paneles de primera impresión y posicionamiento. Los dos, por
> separado, dijeron lo mismo: la mejor escena que el producto tiene **no estaba en el guion**, y las
> tres personas eran tres ventas. Esta versión abre con la escena que ningún otro equipo puede
> protagonizar. Los beats están verificados contra el código, no contra la intención.
>
> **Lo que cambió respecto a la v1** (por si alguien la recuerda): la entrada ya no son las 6
> tarjetas "¿qué quieres proteger?" —bajaron al turno 2— sino **una sola pregunta que pide el
> nombre**. El arranque caliente ya no es por `SERIE` (nadie se sabe su número de afiliado) sino
> **por nombre**, contra la base real. Y el cierre ya no dice "quedaste asegurado": dice la verdad.

## La tesis, en una frase (para el ascensor)

> *"El 34% que no compra no es que no pueda pagar: cree que esto no es para él. A esa gente no la
> mueve un descuento, la mueve creer. Y solo le cree a quien puede decirle que no. Colsubsidio es la
> única que puede hacerlo, porque es la única que cuando hoy no te puede vender, **todavía tiene qué
> darte**: subsidio al desempleo, agencia de empleo."*

"El único asesor que a veces te dice que NO" es el *tagline*. La tesis es ser **caja**, no aseguradora.

---

## El guion, beat por beat (≈3:00)

### 0:00–0:25 · Apertura: la pantalla donde Amparito NO vende

**Presentador:** *"Voy a empezar mostrándoles la conversación en la que Amparito no vende nada."*

Toca el chip **"Me quedé sin trabajo"** en la pantalla de entrada. Un toque, sin teclear.

→ Amparito para el cuestionario, reconoce lo que pasó, y en pantalla:

> **Hoy no te voy a vender nada**
> ✋ No te vendo un seguro hoy. Un seguro que no se pueda pagar el mes entrante no protege: aprieta.
> **Esto sí te sirve:** como afiliado de Colsubsidio te puede corresponder el subsidio al desempleo,
> y tienes la agencia de empleo. A eso sí se te puede apuntar hoy mismo.

**Presentador:** *"Ninguna aseguradora del país puede construir esta pantalla. No porque no sepa
hacerla: porque no tiene qué poner del otro lado. Nosotros sí, porque somos una caja de
compensación. Y todo lo que van a ver después —las recomendaciones, los precios, el cierre— lo van
a creer porque vieron esta primero."*

> **Por qué va de primero:** es la única escena que solo Colsubsidio puede protagonizar, y convierte
> el anti-venta de gesto simpático en **credencial que se cobra durante los tres minutos siguientes**.
> Y es un toque, no una frase que el presentador tenga que provocar.
>
> **Nota técnica (por si preguntan):** el motor devuelve cero productos por sí solo —lo decide el
> scorecard, no el modelo— y el servidor detecta la falta de ingreso del texto, sin depender de que
> el LLM ponga una bandera. Si además la persona tiene vehículo, **el SOAT sí se advierte**: no
> mencionarlo la dejaría expuesta a que se lo inmovilicen, y eso cuesta más que la prima. Advertir
> de una obligación legal es información, no una venta.

### 0:25–1:00 · Carolina — el foso: un nombre y ya la conocemos

- **Un toque** en la pastilla **"Carolina Ramírez"** (o el jurado teclea *"Soy Carolina Ramírez López"*).
- **Mensaje 2, cero preguntas:**
  > *"Bienvenida, Carolina. Veo que sostienes sola tu hogar. Con eso ya te preparé esto — si algo no
  > cuadra, me lo dices y lo ajusto al instante."*
- En la misma pantalla: **Seguro de Vida** (Pan-American) con sus reason codes visibles, y
  **"No estás sola: hay 62.459 afiliadas en tu mismo segmento"** — mujer, 36-45, monoparental,
  categoría A, dato real de `base_stats`.

**Presentador:** *"Escribió cinco palabras. No le preguntamos la edad, ni la categoría, ni cuántos
hijos tiene: eso ya lo sabe Colsubsidio. Y ese número de abajo no es una tasa de compra inventada —
es el tamaño real de su segmento en la base."*

> Aquí está el foso: **1.558.501 afiliados respondiendo en vivo a un nombre tecleado por el jurado.**
> Todos los equipos recibieron la misma base; la diferencia no es tenerla, es que **contesta dentro
> de la conversación**. Si el pitch dice "usamos la base", empatamos. Si dice "teclee un nombre",
> ganamos.

### 1:00–1:20 · El "¿y por qué NO lo otro?" — y la traza

- Los **descartados** están abiertos por defecto, con motivos **distintos** por producto (no la misma
  frase repetida).
- Si el jurado pregunta *"¿y cómo sé que eso no lo inventó el modelo?"* → se abre
  **"Ver cómo llegué a esto"**:

```
Seguro de Vida · score 55 · recomendado
   +45  [SEGMENTO_GRUPO_FAMILIAR]  Eres el sostén de un hogar monoparental: si te faltas,
                                   nadie más cubre el ingreso
   +10  [RANGO_EDAD]               Etapa de mayores responsabilidades familiares

procedencia: GENERO=base · RANGO_EDAD=base · CATEGORIA=base ·
             SEGMENTO_GRUPO_FAMILIAR=base · SEGMENTO_POBLACIONAL=base
versión del scorecard: v0.1
```

*(Salida real, copiada del motor con solo el nombre de Carolina. Si además cuenta que tiene un hijo,
entra `+25 [enriquecido.dependientes]` marcado como **inferido** y el score sube a 80 — y ahí se ve
la diferencia entre lo que Colsubsidio sabe y lo que ella acaba de contar.)*

> **La traza es munición, no un beat.** Va colapsada a propósito: no es para el usuario, es para
> quien pregunta. No la metan en el pitch — úsenla cuando la pregunta llegue, y ahí vale doble.
> Muestra **de dónde salió cada dato**, cuánto pesó cada regla, y con qué versión se decidió.

### 1:20–1:50 · Andrés — la ley antes que la recomendación

- Un toque en **"Andrés Gómez"**. Cuenta que compró una moto y trabaja en ella.
- **Banda propia, arriba del ranking:**
  > **Esto no es recomendación, es obligación**
  > **SOAT** — Sin él te pueden inmovilizar la moto y te multan. Si trabajas en ella, eso es quedarte
  > sin ingreso el mismo día. No lo pongo a competir: hay que tenerlo.
- Y debajo, la recomendación real: **Accidentes Personales**.
- **Anti-venta 1:** *"No te vendo un Seguro de Vida: hoy nadie depende de tu ingreso."*

**Presentador:** *"Distinguir 'la ley te obliga' de 'yo te sugiero' no es un detalle: es lo que
diferencia a un asesor de un catálogo. Y fíjense que a Andrés no le recomienda Vida, y a Carolina sí.
Misma máquina, mismo motor, dos vidas."*

### 1:50–2:20 · Jaime — el segundo NO y el cierre honesto

- Un toque en **"Jaime Ortiz"**. Ya tiene Exequial con Colsubsidio.
- **Anti-venta 2, como héroe:** *"Lo primero: el Exequial ya lo tienes con nosotros, así que no te lo
  vuelvo a ofrecer. Lo que sí te falta es respaldo si te incapacitas."*
- **Cotización:** $28.600 al mes, rotulado **valor de referencia**. Coberturas y exclusiones
  visibles (Ley 1328 Art. 9). Y si preguntan de cuánto es la póliza: *"el valor asegurado lo define
  la aseguradora según el plan"* — **no se inventa una cifra**.
- **Cierre:**
  > Con esto tu solicitud queda completa. Qué pasa de aquí en adelante: 1) Colsubsidio recibe tu
  > solicitud; 2) Pan-American Life expide la póliza; 3) te envía el certificado. **Si no te llega,
  > escríbeme y lo rastreo: no tienes que perseguirlo tú.**
  >
  > *Una aclaración: esto es una simulación del proceso. Hoy no se emitió ninguna póliza.*
- Y al cerrar, **dos preguntas**: qué tan fácil te resultó, y cómo te sentiste con la atención.

**Presentador:** *"El certificado dice SIMULACIÓN, porque no hay aseguradora conectada. Preferimos
que ustedes lo lean ahí que descubrirlo preguntando."*

### 2:20–2:40 · Modo jurado — les entregamos el control

*"Tecleen lo que quieran. Un nombre, un producto raro, una situación incómoda."*

> El brief lo pide explícitamente: el jurado recorre el flujo **sin apoyo del equipo**. Casi ningún
> equipo se atreve. Y las dos conversaciones desordenadas que tuvimos nosotros encontraron dos bugs
> que cuatro rondas de revisión no habían visto.

### 2:40–3:00 · Cierre

**Presentador:** *"En Colombia menos del 2% de las pólizas se venden por internet. No le estamos
quitando ventas a una máquina que vende: le estamos poniendo ventas a un canal que vende cero. Y el
freno medido no es el precio (8%) — es la autoexclusión, el 'esto no es para mí' del 34%. A esa
persona no la mueve un descuento: la mueve creer. Y solo le cree al que demostró poder decirle que
no. Eso es lo que acaban de ver."*

---

## Si preguntan "¿un bot que no vende? ¿y la meta comercial?"

Tres movimientos, en este orden:

1. **Aritmética, no moral.** El canal digital coloca **menos del 2%** y la web termina en "déjanos
   tus datos". Todo NO se lo decimos a alguien que **hoy no le compra a nadie**: el costo de
   oportunidad del anti-venta es **cero por construcción**.
2. **El NO es el mecanismo de conversión, no su freno.** El freno es la autoexclusión, no el precio.
   Y es medible antes de escalar: mismo motor, con y sin el bloque de anti-venta, midiendo conversión
   y esfuerzo percibido — el instrumento ya está construido (las dos preguntas del cierre).
3. **El NO tiene destino, no es una fuga.** Quien recibe el NO entra al subsidio al desempleo y a la
   agencia de empleo: es un **lead para otra línea de la caja**, no una venta perdida.

**La frase que cierra:** *"No estamos pidiendo permiso para vender menos. Estamos pidiendo permiso
para no vender lo que se cae en tres meses."* Una póliza colocada a quien no la puede pagar en el
mes 2 no es una venta: es persistencia negativa y una queja ante la SFC.

## Encuadre regulatorio (munición para preguntas del jurado)

- **Rol:** Colsubsidio **comercializa** (Decreto 034/2015, Circular 049/2016 SFC); la aseguradora
  aliada **emite y asume el riesgo**. Amparito hace el *match*.
- **Consumidor financiero:** coberturas, exclusiones y forma de pago **antes** de contratar
  (**Ley 1328/2009, Art. 9**) — visibles bajo la cotización, en tres capas.
- **Datos:** autorización previa, expresa e informada (**Ley 1581/2012**), en el formulario.
- **Onboarding:** **SARLAFT 4.0** admite vinculación simplificada para seguros masivos de bajo valor.
- **Asegurar a un tercero:** interés asegurable (art. 1137 C. de Comercio) y consentimiento del
  asegurado (art. 1138). *"Puedo asegurar a tu hijo; a tu vecino no, aunque quieras pagarlo."*

## Cifras del pitch (todas citables, ninguna inventada)

Venta online **<2%** de las pólizas (Fasecolda / La República) · autoexclusión **34%** (Fasecolda,
estudio de demanda) · precio como freno **8%** · penetración ≈**3,3%** del PIB (Fasecolda 2024) ·
**67%** de hogares con mascota (DANE 2023). Si preguntan la fuente, se muestra.

## Redes de seguridad (pre-mortem)

- **Los tres nombres del demo funcionan con y sin red.** Están sembrados en Turso *y* en el sample
  local sintético (`npm run seed-demo`); si Turso no responde, el adaptador local los reconoce igual.
- **Camino crítico sin red:** `/chat?offline=1` reproduce a las 3 personas end-to-end. **Es
  paracaídas, no modo de demo** — el brief castiga los flujos que requieren explicación adicional.
- **Voz (Gemini Live):** construida, **flag apagado**, nunca validada en vivo. En el pitch es una
  frase, no una demo.
- **Cero PII:** los tres nombres del demo son **sintéticos**. La base real se consulta desde el
  servidor y nunca llega al navegador.
- **Antes de presentar:** `npm run gates` (11 suites). Y correr una conversación en vivo con
  `ANTHROPIC_API_KEY` — es lo único que los gates no cubren: la redacción del modelo.

## Lo que este guion ya no necesita construir

Todo lo que toca existe y está verificado: entrada de una pregunta · reconocimiento por nombre contra
la base · motor con reason codes · banda de obligatorios · ledger · descartados con motivos propios ·
prueba social honesta · los cuatro NO · traza auditable · cierre rotulado · medición de esfuerzo y
satisfacción. Ver [15-especificacion-ejecucion.md](./15-especificacion-ejecucion.md).
