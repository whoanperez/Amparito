# Contrato de tools — Amparito+ (Tarea 0, para acordar con whoanperez)

> **Propósito.** Este documento es la coordinación técnica *antes de tocar código compartido*. Fija
> exactamente **qué agrego yo**, **qué toca Juan**, y **la firma** de la nueva tool y el nuevo evento de
> UI, para que ambas ramas encajen sin pisarse. Deriva del [guion](./07-guion-demo.md) (estrella polar) y
> del [estado](./10-estado.md). Es 1 página: se lee, se acuerda, se firma, y recién ahí se codifica.

## El cambio en una frase
Hoy `recommend_products(perfil, gatillos)` es un **matcher de keywords** (`lib/catalog.ts:48`). Lo
reemplazamos por un **motor scorecard documentado** que devuelve **ranking + reason codes + descartes con
razón + prueba social peer-group**. Eso alimenta la capa visual del "por qué" (WhyThis · GapsLedger ·
PeerProof) que vale ~45% del puntaje. **El motor calcula; el LLM solo redacta y conversa.** Nunca al revés.

---

## Contrato A · Nueva tool `calcular_propension`
Se agrega a `toolDefinitions` en `lib/tools.ts` (junto a las 7 actuales). **No borra `recommend_products`**
todavía: convive como fallback hasta que el motor esté probado.

**Input** (el LLM llena lo que sabe; el motor degrada con lo que falte):
```jsonc
{
  "perfil": {
    "serie": "string?",            // si hay arranque caliente por SERIE → jala segmento real de base_stats
    "edad": 39,                     // number?
    "grupo_familiar": "Monoparental",   // string? (valores reales de SEGMENTO_GRUPO_FAMILIAR)
    "categoria": "A",               // "A" | "B" | "C"?
    "ciudad": "Soacha",             // string?
    "dependientes": 1,              // number?
    "ya_cubierto": ["exequial_gea"] // string[]? productos que YA tiene → alimenta el ledger + anti-venta
  },
  "gatillos": ["familia", "hijo"]   // string[] detectados en la conversación
}
```

**Output** (fuente única de verdad; el LLM solo lo verbaliza):
```jsonc
{
  "recomendaciones": [
    { "id": "vida_panamerican", "nombre": "Seguro de Vida", "aseguradora": "Pan-American Life",
      "score": 70,
      "reason_codes": [                       // vienen de weights.json → señales[].razon (ya escritas)
        "Eres el sostén de un hogar monoparental: si te faltas, nadie más cubre el ingreso",
        "Tienes 1 hijo menor", "Categoría A → plan esencial"
      ] }
  ],
  "descartados": [                            // el beat "ver descartados" del guion
    { "id": "salud_bmi", "nombre": "Póliza de Salud",
      "motivo": "Tu prioridad hoy es proteger tu ingreso; ya cuentas con tu EPS" }
  ],
  "ledger": {                                 // GapsLedger: brechas
    "riesgos_hoy": ["Tu ingreso sostiene a 2 personas", "Sin respaldo si te faltas"],
    "ya_cubierto": [{ "producto": "Seguro Exequial", "via": "Colsubsidio" }]  // dispara anti-venta
  },
  "peer": {                                   // PeerProof: prueba social, de base_stats.peer_groups
    "fraccion": "8 de cada 10",
    "descripcion": "afiliadas como tú —mujer, 36-45, monoparental, cat A—",
    "n": 62459,                               // tamaño real del peer-group (mata la autoexclusión)
    "accion": "eligieron proteger su ingreso primero"
  }
}
```

**Invariantes (compuertas duras, en servidor):**
- Reason codes salen de `weights.json` (ya redactados); el LLM **no inventa** razones nuevas.
- Un producto con `ya_cubierto` **nunca** entra en `recomendaciones` → va al `ledger.ya_cubierto` (anti-venta).
- Un producto con `requiere_asesoria: true` no se cotiza (regla que ya existe en `quote_product`).

---

## Contrato B · Nuevo `UiEvent` `type: "propension"`
La unión actual es `"quote" | "policy" | "escalation" | "compliance" | "form"` (`Chat.tsx:7` y
`lib/tools.ts:120`). **Se agrega un solo tipo nuevo:** `"propension"`. Un evento, una `<PropensionCard>`,
un solo punto de integración en el front. `event.data` = el `output` de arriba, tal cual.

```ts
type: "quote" | "policy" | "escalation" | "compliance" | "form" | "propension"
```

La tarjeta renderiza 4 sub-bloques con los datos ya listos: **WhyThis** (`reason_codes`) · **GapsLedger**
(`ledger`) · **PeerProof** (`peer`) · **Descartados** (`descartados`, colapsable, se abre con "ver descartados").

---

## División de trabajo (para no pisarnos)
| Pieza | Archivo | Quién |
|---|---|---|
| Motor scorecard (lee los 3 JSON → ranking/reason/descartes/peer) | `lib/engine/*` (nuevo) | **Yo** |
| Handler `calcular_propension` + `type` nuevo en `UiEvent` | `lib/tools.ts` | **Yo** |
| Data derivada (ya commiteada: `weights/base_stats/eventos_vida`) | `data/*.json` | **Yo (hecho)** |
| `<PropensionCard>` que renderiza `event.type === "propension"` | `components/Chat.tsx` (`EventCard`, ~L397) | **Juan** |
| Estado 3 del guion del sistema: `recommend_products` → `calcular_propension` | `lib/prompts.ts:54,68` (2 líneas) | **Juan** |
| Entrada pull-first (tarjetas 🐶🏍️👪🏠) | front | **Juan** |

**Regla de no-colisión:** yo **no toco** `lib/prompts.ts` ni `components/Chat.tsx`; Juan **no toca**
`lib/engine/*` ni el handler. El único contrato entre ramas es el JSON de arriba.

## Para acordar en la reunión (checklist con Juan)
1. ¿`calcular_propension` **convive** con `recommend_products` (fallback) o lo **reemplaza** ya? → propongo convivir.
2. ¿El nuevo `type: "propension"` te sirve como **un** evento, o prefieres 3 eventos separados (why/ledger/peer)?
3. Nombre de rama y orden de merge (yo pusheo `lib/engine` + `tools.ts`; tú, `Chat.tsx` + `prompts.ts`).
4. ¿De dónde sale `perfil.serie` en el arranque caliente? (¿lookup a `base_stats` por SERIE, o lo inyecta el front?)
5. Confirmar la **regla de oro**: motor calcula, LLM redacta. ¿La dejamos como comentario-guardrail en ambos lados?
