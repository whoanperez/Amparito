# Notas de negocio — Reto Seguros (contexto del equipo/cliente)

> Capturado de una explicación en voz del equipo. Contexto de negocio que matiza y confirma el
> análisis de [`docs/02-reto-seguros.md`](../../docs/02-reto-seguros.md).

## Cultura de seguros en Colombia / LatAm
- **No hay cultura de aseguramiento.** La gente no se asegura por convicción, sino porque se lo
  **obligan o imponen** (p. ej. seguros atados a un requisito).
- Por eso el objetivo del modelo es lograr que la persona quiera el seguro **porque de verdad lo
  considera importante**, no porque se lo impongan. Ese es el cambio de comportamiento que buscamos:
  pasar de venta impuesta a **necesidad genuina reconocida**.

## Qué es Colsubsidio en seguros (matiz regulatorio/rol clave)
- **Colsubsidio NO fabrica (no asegura) seguros.** En Colombia se alía con **compañías aseguradoras**
  que son las que proveen los productos.
- Colsubsidio se encarga de montar el **canal de comercialización** para que la gente acceda a ellos.
  → Rol = **comercializador / tomador / aliado**, no aseguradora. (Coincide con el análisis previo.)

## A quién se le puede vender
- Los seguros se ofrecen **tanto a afiliados a la caja como a NO afiliados.** Este es un componente
  importante: el público no se limita a afiliados.
- Muchas personas/afiliados **desconocen** que Colsubsidio ofrece seguros.

## El dolor operativo actual (por qué duele la venta hoy)
- Para cerrar una venta de seguro (con subsidio) hoy **hay que hablar con cada persona**, escucharla y
  entender su necesidad, uno por uno.
- Todo es **muy asistido / manual**, depende de la persona que esté detrás → servicio **anticuado**,
  no escala.
- Resultado: **la colocación de seguros no es fácil** por esa dependencia del asesor humano.

## ⭐ Pregunta oficial del reto (textual)
> **¿Cómo podemos lograr que una persona identifique, entienda, seleccione y adquiera el seguro más
> adecuado para su perfil, de forma completamente autónoma, personalizada y confiable, sin
> intervención de un asesor comercial?**

Los 4 verbos son el flujo objetivo: **identificar → entender → seleccionar → adquirir.**

## Rol exacto de Colsubsidio: solo el MATCH
- **No diseñamos, no emitimos pólizas.** Colsubsidio solo hace el **match**: persona que necesita un
  seguro ↔ encontrar el seguro que le sirve ↔ llevarlo con la **aseguradora que más se ajuste a su
  necesidad**. (Refuerza el rol de intermediario/comercializador.)
- Frase guía del valor del seguro: **"mejor tenerlo y no necesitarlo, que necesitarlo y no tenerlo"**,
  visto en escenarios cotidianos: **hogar, familia, mascotas, carro, etc.**

## Alcance técnico confirmado
- **100% digital, sin intervención humana**, en **lenguaje natural**, que permita cierre de venta
  digital.
- **El pago NO está incluido en el reto** (no hay pasarela / no se cobra) → confirma que la "emisión" y
  el pago van mockeados en el MVP.
- Énfasis pedido: hacer **claridad de lo que la persona NO tiene cubierto hoy** con su situación actual
  (evidenciar los huecos de cobertura como gancho de necesidad).

## Productos reales (dónde están)
- En **colsubsidio.com → sección Crédito y Seguros → Seguros** aparece el link con los seguros que
  Colsubsidio comercializa.
- Mencionados: **movilidad personal y familiar**, entre otros. (Pendiente: listar el catálogo real
  exacto con coberturas/tarifas cuando el equipo lo suba a `material/`.)

## Cómo se hace hoy (proceso actual)
- Muestran descuentos / asistenciales; la persona va a la página, entra en la entidad…
- **Canal inbound actual:** algunos clientes **sí llaman por interés propio** (son **pocos**). Entran a
  la página, **dejan sus datos / solicitan que los llamen** a un número determinado, y esperan el
  **callback** de un asesor. → Es reactivo, manual y de bajo volumen.

## Q&A con el equipo Colsubsidio (hallazgos sueltos)
- **¿Los clientes llaman por interés?** Sí, pero pocos; el flujo es dejar datos → que los llamen.
- **Seguros con más "pull" natural:** el **del carro** es el que la gente siente que "no le puede
  faltar"; **bicicleta** también está entrando como categoría.
- **Dashboard NO es requisito.** Tienen algo de procesos con datos automáticos, pero la **colocación es
  muy manual**. No esperan un dashboard; si aparece "maravilloso", pero lo que necesitan es **algo
  funcional y digital para la gente**. (Prioridad = experiencia de usuario, no BI interno.)
- **¿Los precios son automáticos? NO del todo.** En la URL de seguros, **algunos productos NO tienen
  precio automático** — sobre todo los ligados a aseguradora / saldo / **vehículo**, porque el precio
  **depende de validar el vehículo y demás**. Otros sí tienen precio. → **implicación MVP: para el
  cotizador podemos usar tarifas sintéticas/tabla; no hay pricing en tiempo real universal.**
- **Colsubsidio NO trabaja con TODAS las aseguradoras** — solo con **unas puntuales** que aparecen en
  la página. El catálogo real es acotado.
- **PENDIENTE — ¿el sistema contacta a las personas (outbound) o las personas contactan al sistema
  (inbound)?** *(pregunta de Nel; falta la respuesta — define si el flujo es pull o push.)*

## Estado de datos / sistemas (crítico para el diseño)
- **NO hay CRM.** Toda la operación vive en **hojas de Excel.** (Sin sistema central → el MVP no se
  integra a nada; usamos datos propios/sintéticos.)
- **Seguros que MÁS venden hoy:** **mascotas**, **patinetas y bicicletas** (micromovilidad), y
  movilidad/vehículo. (Coinciden con los de más "pull" natural.)
- **Tasa de abandono / permanencia:** hoy **no se mide bien**; hay tiempos de permanencia. Oportunidad:
  **medir el abandono dentro del propio flujo de compra** (quién recorre el proceso y al final dice no)
  → dato que la solución podría capturar y entregar.

## Perfilamiento y datos del usuario (respuestas clave del equipo)
- **SÍ se debe ENRIQUECER el perfil durante la conversación** — no limitarse a la base de datos.
  Ejemplo textual: *"tengo a Carolina con sus datos y recibos ligados, pero quiero saber cómo se mueve,
  qué le gusta y qué le hace falta, para llenarlo con el seguro adecuado."* → hacer **preguntas
  adicionales** para robustecer el perfil es **deseado**, no solo permitido.
- **Afiliados:** hay algo de data previa (perfil + recibos/consumo ligado) **+** enriquecimiento en
  conversación.
- **No afiliados:** **no hay data previa** → el perfilamiento se arma **100% con lo que la persona
  declare en la conversación.** Están **abiertos a atender a ambos** (afiliados y no afiliados).
- **Paralelo confirmado:** este reto es **similar a la hiperpersonalización de crédito** — la esencia
  es **presentarle a la persona su(s) seguro(s) ideal(es)** según su perfil.

## Marketing / canales actuales (cómo llegan a la gente hoy)
- **Todos los canales:** llamadas, **email**, **WhatsApp**, comunicaciones dirigidas, **redes
  sociales**, **tomas empresariales**, y acompañamiento en **ferias** (ej. la **feria hipotecaria**).
- Refuerza el criterio "llegar por el **canal correcto**": hoy la difusión está dispersa y la gente no
  sabe que tiene seguros por Colsubsidio.

## Herramientas / partners del evento
- **"Data"** = un **agente de voz y texto**; hay **partnership con ellos en 30X** (posible herramienta
  disponible para el hackathon — confirmar capacidades/acceso).

## ✅ Cómo se ve un BUEN resultado (criterios de éxito del reto)
1. **Identificar quién necesita qué seguro y por qué** — poder decir "esta persona necesita este
   seguro por estas razones" (con justificación explícita).
2. **Personalizar la oferta según el perfil** (aplica a afiliados y no afiliados). Ejemplo dado: no es
   lo mismo ofrecerle a alguien de **30 años, soltero, sin hijos** que a alguien **casado con dos hijos
   por entrar a la universidad** — sus necesidades de seguro son muy distintas.
3. **Usuario en el centro** (principio rector): experiencia que le permita **ajustar, comparar y
   resolver dudas** sobre los seguros que visualiza, y **completar el proceso** (el **pago será un
   espacio/desarrollo aparte**, no en este reto).
4. **Seguro correcto, en el convenio correcto, por el canal correcto.** La **experiencia y la
   comunicación son clave.** Dolor actual: **hoy no está publicado / la gente no sabe que por
   Colsubsidio tiene seguros**; como son *partner*, no basta una web genérica donde el mundo entre a
   explorar — **hay que llegar por el canal correcto** al cliente correcto.
5. **Autogestión total** — la función se autogestiona, **sin intervención humana**.

## 🚫 Lo que NO queremos (fuera de alcance / no deseado)
- **Recomendaciones de seguros aleatorias, sin justificación.** (Todo lo recomendado debe estar
  razonado.)
- **Integración real con las aseguradoras.** No la esperan: Colsubsidio es el canal, y una integración
  real tomaría mucho más tiempo del que da el hackathon. → **APIs de aseguradora se mockean.**
- **Redes sociales (Instagram, etc.)** — no es el foco del canal.
- **Formularios largos/estáticos ("de establo").** A nivel de experiencia dan por hecho que eso ya
  debe funcionar; no es el reto.
- **Que requiera explicación adicional del equipo para funcionar.** El usuario debe poder **recorrerlo
  solo en web**, sin acompañamiento.
- **Seguimiento, renovaciones y pasarela de pago.** No se esperan en este proceso.
- **Propuestas de negociación con aseguradoras.** Eso lo revisa alguien más en campo; no es parte del
  reto.

## ⭐ Lo que SÍ queremos — NO NEGOCIABLE
- **Lógica documentada y explicada** de **por qué se recomienda un seguro a determinada persona.**
  (Transparencia del razonamiento = requisito, no opcional.)
- **La oferta CAMBIA según el perfil:** edad, si es papá, número de hijos, estado civil, profesión,
  experiencia laboral, etc. Ej.: 30 años sin hijos ≠ papá casado con dos hijos por entrar a la U →
  ofertas distintas.
- **Confianza y cercanía:** que el usuario sienta la propuesta como **cercana, confiable y útil** —
  hoy le cuesta porque **no entiende** los seguros. Traducir a lenguaje claro.
- **Entrega 100% digital** con el **seguro correcto, el documento correcto y por el canal correcto.**

## 📦 Entregables esperados
- **Una solución FUNCIONAL** (que de verdad corra, no un mockup bonito). El **formato es abierto**:
  aplicación, chatbot / chat, experiencia digital, el mecanismo que se les ocurra — libertad total de
  formato, pero **tiene que funcionar**.
- **Replicable e instalable** (que se pueda correr sin inconvenientes / fácil de levantar).
- **Un demo navegable / ejecutable en vivo** para que el jurado lo pueda usar.
- **Documentación** que permita ajustar la solución.
- **Un pitch** (de pocos minutos).

## 🏆 Cómo se evalúa (criterios del jurado)
- **La lógica / justificación:** ¿por qué le estoy ofreciendo ESTE seguro, de ESTA manera, a ESTA
  persona? → validez respecto al perfil.
- **Funcionalidad real:** que **no se quede en "algo presentado bonito"** sino que el jurado lo vea
  **funcionar de verdad**.
- **Valor para el cliente** + **valor para el negocio / legal** ("importante para nuestro abogado").
- **Grado de innovación.**

## Misión / objetivo del reto (por qué aceptaron este reto del hackathon)
- **Meta central:** llevar a una persona **desde "no sé qué seguro necesito" hasta "ya quedé
  asegurado" SIN necesidad de hablar con nadie**, de forma **clara y precisa**.
- Colsubsidio se define como **intermediario / plan de comercialización** apoyado en distintas
  aseguradoras para crecer los seguros; **hoy lo hacen de forma manual** — ese es el estado actual que
  quieren superar.
- **Espectro de solución esperado:** desde un **cotizador inteligente** hasta un **flujo completo** que
  actúa en el **momento de la colocación** y logra **generar el cierre de la venta**.
- Quieren que sea **100% digital, personalizado y autogestionado** (self-service).

## El corazón del reto: anticipar la necesidad
- Como no hay cultura de aseguramiento, **el cliente muchas veces NO tiene clara su necesidad** — solo
  reacciona cuando ya pasó algo malo/inesperado.
- La idea es **identificar esa necesidad con anticipación** (antes de que ocurra el evento), llevarle
  **el seguro adecuado**, y **acompañarlo en su vinculación** (onboarding/enrolamiento).
- Nota de precio: **la oferta es aún muy barata/accesible** — el reto NO es el precio; es la
  identificación de necesidad + el cierre digital.

## Implicaciones para el MVP (derivadas de estas notas)
- El agente de IA debe **generar la convicción**, no imponer: traducir necesidad → cobertura para que
  el cliente sienta el valor real (refuerza el diferencial "traducción de vida a cobertura + confianza").
- Debe funcionar para **afiliados y no afiliados** (no asumir que todos tienen relación previa con la
  caja; el flujo no puede depender solo del dato del afiliado).
- Debe **reemplazar el 1-a-1 asistido** por un asesor automatizado que escuche y entienda la necesidad
  → ataca directamente el cuello de botella de "hablar con cada persona".
- Mantener el encuadre de Colsubsidio como **canal de comercialización de aseguradoras aliadas**, no
  como aseguradora (importante para el pitch y para el marco regulatorio SFC).
