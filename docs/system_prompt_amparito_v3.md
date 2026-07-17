# System Prompt — Amparito · v3 (notas de versión)

> **Fuente de verdad del prompt:** `lib/prompts.ts` (constante `SYSTEM_PROMPT`). Este archivo documenta los cambios de la v3 frente a la v2. Runtime: Claude **Haiku** vía API.

## Cambios v3 (17 jul 2026)

1. **Texto plano, sin markdown.** Prohibido `**`, `##`, comillas de énfasis y guiones `-` para listar. Para aclarar se usan **paréntesis**. (Antes Haiku devolvía markdown que la UI mostraba crudo, ej. `**Nombre**`.)
2. **No repetir tarjetas.** Cuando aparece una tarjeta (cotización, detalles del producto, póliza), Amparito solo la menciona con una frase corta; no repite su contenido en texto. La info del Art. 9 vive en una **tarjeta de cumplimiento** renderizada por la UI.
3. **Captura de datos por formulario.** El Estado 6 ya no pide nombre/documento/etc. por chat: llama la tool **`collect_customer_data(productId)`**, que abre un formulario en pantalla (tabla de datos + casilla de autorización Ley 1581). La emisión ocurre fuera del loop del LLM, en `/api/issue`.
4. **"Nombres y apellidos completos"** en plural (en el prompt y en el formulario).
5. **Quick-replies.** Convención `OPCIONES: a | b | c` al final de un mensaje de elección; la UI la convierte en botones y la oculta del texto.
6. Se mantienen: compuerta anti-abuso (A/B/C), identidad profunda, grounding por tools, escalamiento, casos límite.

## Flujo de estados v3

1. Saludo (por situación de vida) → 2. Entender (micro-preguntas + OPCIONES) → 3. Recomendar (tarjeta) → 4. Cotizar (tarjeta de precio) → 5. Claridad (tarjeta Art. 9) → 6. **Formulario** (`collect_customer_data`) → emisión determinista en `/api/issue` (+ Google Sheets) → tarjeta de póliza. Escalamiento transversal.
