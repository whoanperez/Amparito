# Requerimiento — Reto de Seguros (Colsubsidio × 30X)

> **Documento de requerimiento consolidado.** Fuente: slides oficiales del reto + explicación en voz y
> Q&A del equipo Colsubsidio (23-jul-2026). Notas crudas en
> [`notas-negocio.md`](./notas-negocio.md); slides oficiales del brief en [`brief/`](./brief/).
> Este documento se enriquece de forma iterativa.

---

## 1. El reto en una frase

> *"El reto no es vender un seguro. El reto es lograr que una persona **encuentre, entienda y contrate
> la protección adecuada** sin necesidad de hablar con un asesor."*

**Reto oficial:** Venta automatizada de seguros (Reto 03).

## 2. La pregunta (textual, oficial)

> **¿Cómo podemos lograr que una persona identifique, entienda, seleccione y adquiera el seguro más
> adecuado para su perfil, de forma completamente autónoma, personalizada y confiable, sin
> intervención de un asesor comercial?**

Los 4 verbos = el flujo objetivo: **identificar → entender → seleccionar → adquirir.**

## 3. Misión

Llevar al potencial cliente desde **"no sé qué seguro necesito"** hasta **"ya quedé asegurado"**, sin
que tenga que hablar con nadie. Experiencia **100% digital, personalizada y autogestionada**.

**El arco de valor:** DESDE un cotizador inteligente HASTA un flujo completo que **detecte el momento,
presente la oferta y cierre la venta.**

## 4. Contexto de negocio

- **Hoy** adquirir un seguro exige hablar con un asesor que detecta la necesidad, cotiza, explica y
  cierra. **No escala** (un asesor atiende a uno a la vez), **no es 24/7** (si lo necesitas un sábado
  10pm, esperas al lunes), y genera **experiencias inconsistentes** (cada asesor explica, ofrece y
  cierra distinto).
- **Colsubsidio actúa como SPONSOR — no es asegurador ni intermediario:** no diseña ni emite pólizas;
  **facilita el acceso** a seguros de distintas aseguradoras. El flujo **no diseña el seguro**: ayuda
  a la persona a **encontrar el adecuado dentro de la oferta existente** y a **vincularse** a él.
  (Término oficial en el brief escrito = *sponsor*; en las slides apareció como *intermediario/
  distribuidor* — usar **sponsor**.)
- **No hay cultura de aseguramiento** en Colombia/LatAm: la gente se asegura por obligación, no por
  convicción. Reto = **anticipar la necesidad** que el cliente aún no tiene clara y transmitirla con
  claridad ("mejor tenerlo y no necesitarlo…").
- **Público:** afiliados **y** no afiliados. Muchos ni saben que Colsubsidio ofrece seguros.
- **Estado operativo:** sin CRM, todo en **Excel**; colocación **manual**; canal inbound reactivo y de
  bajo volumen (dejan datos → los llaman).
- **Precios:** no todos son automáticos (los de vehículo dependen de validación) → en el MVP se usan
  **tarifas sintéticas**.

## 5. Productos en alcance (catálogo oficial)

**Mascotas · Hogar · Crédito · Movilidad · Personal y Familiar.**

- Más vendidos / con más "pull" hoy: **mascotas**, **movilidad** (carro, y **bicicletas/patinetas** en
  auge). El "del carro" es el que la gente siente que no le puede faltar.

### 5.1 ⭐ DECISIÓN DE ALCANCE (confirmada por el equipo): TODAS las líneas

> **El sistema trabaja con las CINCO categorías y todo el catálogo real, no con un solo producto.** En
> la demo, el jurado debe poder **pedir/llegar a cualquiera de los seguros que existen hoy** — no un
> subconjunto hardcodeado. Esto **revierte** la sugerencia del análisis inicial (`docs/02-reto-seguros.md`,
> que proponía un único producto exequial extremo a extremo).
>
> **Implicaciones para el build (importante — sube la exigencia):**
> - El **motor de propensión** mapea a las 5 categorías / todos los productos del
>   [catálogo real](./03-catalogo-seguros.md), con su "por qué" para cada uno.
> - El **cotizador** necesita una entrada de tarifa (tabla "desde" real + factor por edad/suma) para
>   **cada** producto, no solo uno.
> - El **flujo completo** (identificar→entender→seleccionar→adquirir) debe cerrar para **cualquier**
>   producto que el usuario/jurado elija, no solo el "recomendado".
> - Las **coberturas/exclusiones** (para la transparencia) deben existir para todos los productos que se
>   quieran demostrar → curar un condicionado sintético por producto.
> - Táctica de demo: aunque el sistema soporta todo, se **guionan 2–3 personas contrastantes** para
>   lucir la "variación por perfil" (20%) — pero el jurado puede salirse del guion y pedir cualquier
>   otro seguro, y el sistema responde.

## 6. Cómo se ve un buen resultado (6 criterios)

1. **Identifica quién necesita** — qué seguro y **por qué**.
2. **Personalizar la oferta** — abierta a afiliados y no afiliados, **según el perfil**.
3. **Ajustar, comparar y resolver dudas** — **sin asistencia humana**.
4. **Completar el proceso** — aceptación y **vinculación**.
5. **Seguro en el momento y canal correcto.**
6. **Función autogestionada** — el jurado recorre el flujo **sin apoyo del equipo**.

## 7. ⭐ Cómo se evalúa (pesos oficiales — esto manda el diseño)

| Criterio | Peso | Qué significa para el build |
|---|:---:|---|
| **Lógica de propensión** | **25%** | El motor que decide *qué seguro y por qué* para ese perfil. Es lo de mayor peso → el corazón del proyecto. |
| **Variación por perfil** | **20%** | La oferta debe cambiar de forma visible entre perfiles distintos. Demostrar con 2–3 personas contrastantes. |
| **Flujo completo funcional** | **20%** | De inicio a confirmación, corriendo de verdad, sin intervención. |
| **Innovación** | **20%** | El "wow" / diferencial (voz, anticipación, transparencia…). |
| **Experiencia y confianza** | **15%** | Cercanía, lenguaje claro, transparencia; que se sienta confiable. |

> **Lectura estratégica:** 45% del puntaje (propensión + variación por perfil) vive en **la lógica de
> recomendación explicable y personalizada**. Ahí se gana o se pierde. El flujo funcional y la
> innovación pesan 20% cada uno; la experiencia 15%.

### 7.1 Qué es la "lógica de propensión" (el criterio de más peso)
- **Identificar qué tipo de persona tiene mayor propensión a necesitar un seguro, y por qué.** Decidir
  a quién mostrarle vida vs. hogar vs. mascotas **debe basarse en variables reales**: número de
  beneficiarios, edad, eventos de vida, tipo de empleo, hábitos/consumo.
- **Pregunta del jurado:** *"¿por qué a esta persona le mostraste este seguro y no otro?"* Si la
  respuesta es "porque sí" / "aleatorio", **el criterio no se cumple**.
- **Insumo real:** la base de ~1.5M afiliados anonimizada (ver [`02-datos-afiliados.md`](./02-datos-afiliados.md)).
  La propensión se construye sobre esas variables.

### 7.2 Timing y canal (opcional, pero suma puntaje estratégico)
- Detectar **cuándo** y **por dónde** contactar: tras un **evento de vida**, tras **X días sin
  interacción**, tras **consultar cierto servicio**. Eleva mucho el puntaje estratégico aunque no es
  obligatorio.

## 8. Lo NO negociable (obligatorio)

- ✅ **Lógica documentada** que explica **por qué** se recomienda un seguro a determinada persona.
- ✅ **La oferta cambia según el perfil** del usuario.
- ✅ El **flujo funciona de inicio a confirmación sin intervención del equipo**.
- ✅ La experiencia **transmite confianza y cercanía**.
- ✅ **Lógica explicable — NO se aceptan soluciones tipo "caja negra".**

## 9. Lo que definitivamente NO queremos (fuera de alcance)

- ❌ Recomendaciones **aleatorias o sin justificación**.
- ❌ **Integración real con aseguradoras** (se mockea).
- ❌ Experiencias frías tipo **formulario estándar**.
- ❌ Flujos que requieran **explicación adicional del equipo** para entenderse.
- ❌ **Gestión de siniestros, renovaciones y pasarela de pago real** (el pago es otro espacio).
- ❌ **Firma electrónica con validez legal.**
- ❌ **Flujo multi-aseguradora en producción.**
- ❌ Propuestas de **negociación con otras aseguradoras**.
- ❌ (Aclarado en Q&A) **Dashboard/BI interno** no es requisito.

## 10. Entregables

- **Solución funcional** — formato libre: aplicación, chatbot, experiencia digital, flujo guiado o
  cualquier otro mecanismo. **Debe correr de verdad**, no ser un mockup.
- **DEMO navegable por el jurado** (ejecutable / recorrible en vivo, sin apoyo del equipo).
- **README** — documentación que permita **ejecutar la solución en menos de 2 minutos**.
- **Pitch** corto.

## 11. Datos y perfilamiento (definiciones del equipo)

- **Enriquecer el perfil durante la conversación es DESEADO** — hacer preguntas adicionales, no
  limitarse a la base de datos (ejemplo "Carolina": saber cómo se mueve, qué le gusta, qué le falta).
- **Afiliado:** algo de data previa (perfil + consumo/recibos ligados) + enriquecimiento conversacional.
- **No afiliado:** sin data previa → perfil **100% declarado en la conversación**.
- Paralelo confirmado con el reto de **hiperpersonalización de crédito**: presentarle a cada persona
  su(s) **seguro(s) ideal(es)**.

## 12. Insumo de datos

Base real de **~1.5M afiliados anonimizada** (por número de serie) es el insumo principal para la
propensión. Esquema, distribuciones y sus implicaciones en **[`02-datos-afiliados.md`](./02-datos-afiliados.md)**.
Hallazgos clave: propensión se apoya en variables demográfico-familiares (el 90% no tiene marcas de
consumo); ⚠️ el archivo trae `NOMBRE_COMPLETO` (PII) pese a decirse anónimo → descartar esa columna.

## 13. Pendientes / preguntas abiertas

- [x] **Inbound vs outbound:** el flujo núcleo es **autogestionado (la persona lo recorre)**; el
      **timing/canal outbound** (contactar tras evento de vida / inactividad) es el **bonus opcional**.
- [x] **Catálogo real** documentado en [`03-catalogo-seguros.md`](./03-catalogo-seguros.md): 5
      categorías → productos reales, **coberturas reales**, **aseguradoras aliadas** (Bolívar, Sura,
      HDI, Mundial, Chubb, MetLife, Pan American, Grupo Recordar, GEA) y **precios "desde" reales**
      (Vida $12k, Vida-Ahorro/Asistencias $20k, Exequial $26k). El cotizador usa esos "desde" + factor
      por edad/suma (no se inventan cifras).
- [ ] **"Data" (agente de voz y texto, partner 30X):** ¿lo usamos como motor conversacional? Confirmar
      acceso y capacidades.
- [ ] Definir las **personas/perfiles demo** contrastantes para lucir la "variación por perfil"
      (ej. soltero sin hijos vs. casado con 3 hijos).
- [ ] Generar **copia de la base sin `NOMBRE_COMPLETO`** para desarrollo.
