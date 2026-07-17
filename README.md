# Amparito 🛡️

**La asistente que lleva a un afiliado de Colsubsidio de _"no sé qué seguro necesito"_ a _"ya quedé asegurado"_ — en una sola conversación, 24/7, sin intervención humana.**

Proyecto para el **Hackathon Colsubsidio × 30X** (julio 2026) · Reto 02: *Venta automatizada de seguros*.

---

## El problema (evidencia real)

Hoy, el flujo de seguros de Colsubsidio termina en un formulario que dice **"Déjanos tus datos y te contactaremos"**. Es captura de leads + llamada humana: no escala, no opera 24/7 y el afiliado que no sabe qué necesita queda igual de perdido. Verificamos además que **ninguna caja (Compensar, Cafam) ni aseguradoras como SURA cierran hoy la venta 100% digital sin humano** — todas derivan a asesor o WhatsApp. La regulación colombiana sí lo permite (canales no presenciales + productos estandarizados, Ley 1328/2009): el freno no es legal, es que nadie lo ha construido.

## La solución

Amparito reemplaza el "te contactaremos" por un cierre conversacional inmediato:

1. **Entiende la situación de vida** ("acabo de comprar una moto") en vez de mostrar un menú de productos.
2. **Recomienda** 1–2 productos del catálogo real de Colsubsidio, con el porqué.
3. **Cotiza al instante** (function-calling → motor de cotización).
4. **Cumple la ley en el flujo**: muestra qué cubre, qué NO cubre, precio y forma de cálculo (Art. 9, Ley 1328/2009) y pide autorización de datos (Ley 1581/2012) **antes** de capturar datos.
5. **Captura los datos como conversación** (el formulario, vuelto chat, validado campo a campo).
6. **Emite la póliza** y entrega el certificado digital en el mismo hilo.
7. **Escala a humano** lo que de verdad requiere asesoría (salud, todo riesgo, arrendamiento).

## Arquitectura

```
Usuario ⇄ UI (Next.js, look Colsubsidio)
            ⇄ /api/chat  →  Claude Haiku (system prompt "Amparito v2")
                              ⇅ tool-use (6 herramientas)
               get_catalog · recommend_products · get_product_details
               quote_product · issue_policy · escalate_to_human
                              ⇅
                        InsurerGateway  ←— contrato único de integración
                        └─ MockInsurerAdapter (hoy)
                        └─ MetLifeAdapter / BolivarAdapter… (producción)
```

Decisiones clave:

- **Claude Haiku** como cerebro (costo mínimo por conversación). El system prompt está escrito para Haiku: máquina de estados explícita, frases exactas, reglas si/entonces.
- **Cero alucinación por diseño:** todo precio/cobertura/exclusión sale de las tools (catálogo + gateway), nunca del texto libre del modelo.
- **Cumplimiento en servidor, no solo en prompt:** `issue_policy` **rechaza** la emisión sin `consentimiento: true` y sin datos completos, aunque el modelo lo intente.
- **Bloqueo anti-abuso:** compuerta de clasificación en el prompt (fuera de dominio / manipulación) con respuestas enlatadas y escalamiento a la 3ª insistencia.
- **Stateless:** el `quoteId` codifica la cotización (base64), así la emisión no depende de memoria compartida — robusto en serverless.

## Integración con aseguradoras reales

La simulación está **diseñada para ser reemplazada sin tocar nada más**:

1. Implementa `InsurerGateway` (`lib/insurer/gateway.ts`) para tu aseguradora:
   ```ts
   export class MetLifeAdapter implements InsurerGateway {
     async quote(productId, perfil) { /* llamada a la API real */ }
     async issue(quoteId, contacto)  { /* emisión real */ }
   }
   ```
2. Regístrala en `getInsurerGateway()` (`lib/insurer/mock-adapter.ts`).
3. Actívala con `INSURER_ADAPTER=metlife` en `.env`.

El system prompt, las tools y la UI **no cambian**. El contrato (`Quote`, `Policy`, `Contacto`) es el mismo que hoy devuelve el mock.

## Correr el proyecto

```bash
npm install
cp .env.example .env      # y pon tu ANTHROPIC_API_KEY
npm run dev               # http://localhost:3000
```

Deploy en Vercel: importa el repo, configura `ANTHROPIC_API_KEY` (y opcionalmente `ANTHROPIC_MODEL`, `INSURER_ADAPTER`) en Environment Variables, y listo.

## Estructura

```
amparito/
├─ app/
│  ├─ page.tsx              # landing (look pestaña Colsubsidio)
│  ├─ chat/page.tsx         # chat con Amparito
│  └─ api/chat/route.ts     # orquestador Claude Haiku + loop de tools
├─ components/Chat.tsx      # UI de conversación + tarjetas (cotización/póliza/escalamiento)
├─ lib/
│  ├─ prompts.ts            # SYSTEM_PROMPT Amparito v2 (autoría: Fable)
│  ├─ tools.ts              # 6 tools + compuertas de cumplimiento en servidor
│  ├─ catalog.ts            # catálogo + recomendador por gatillos de vida
│  └─ insurer/
│     ├─ gateway.ts         # InsurerGateway (contrato de integración)
│     └─ mock-adapter.ts    # simulación determinista de la aseguradora
├─ data/catalog.json        # 16 productos · 8 aseguradoras aliadas reales
└─ docs/                    # system prompt fuente + investigación
```

## Catálogo y gatillos

16 productos en 9 categorías (personal/familiar, movilidad, mascotas, hogar, arrendamiento, exequial, viajes, asistencias, créditos) con las aseguradoras aliadas reales de Colsubsidio: MetLife, Chubb, Pan-American Life, GEA, Seguros Bolívar, VetPlus, BMI y Seguros Mundial. Cada producto declara sus **gatillos de vida** (moto, hijo, mascota, viaje, desempleo, arriendo…) y si es **estandarizado** (el bot lo cierra solo) o **requiere asesoría** (escala a humano) — el criterio regulatorio de universalidad/sencillez/estandarización.

## Cumplimiento (por diseño)

- **Ley 1328 de 2009, Art. 9** — información mínima antes del cierre: características, coberturas, exclusiones, precio y forma de cálculo, consecuencias del no pago.
- **Ley 1581 de 2012 (habeas data)** — autorización explícita ANTES de capturar datos personales; compuerta dura en servidor.
- **Comercialización masiva** — solo productos estandarizados se venden sin humano; el resto escala (Decreto 2555/2010, C.E. 006/2025 SFC).

## Roadmap

- [ ] **Outreach proactivo:** script que cruza la base de afiliados + gatillos conocidos (subsidio de desempleo → renta; nuevo hogar → hogar) y envía un empujón personalizado con deep-link a Amparito con contexto. Une este reto con el de crédito hiperpersonalizado.
- [ ] Integración real vía `InsurerGateway` con las APIs de los aliados.
- [ ] Pasarela de pago y autenticación con la cuenta Colsubsidio.
- [ ] Canal WhatsApp (mismo cerebro, otro front).

---

*Construido con Claude (Anthropic) · Next.js · Vercel. La marca Colsubsidio se usa únicamente como concepto para el hackathon.*
