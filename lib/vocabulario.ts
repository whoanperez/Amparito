/**
 * El vocabulario del dominio, en UN solo sitio (#43).
 *
 * ── EL PROBLEMA DE LAS TRES LISTAS ─────────────────────────────────────────
 *
 * "moto" vivía escrita tres veces, con tres propósitos distintos y sin que ninguna supiera de las
 * otras: posesión que hay que verificar (`sanear.ts`), tema de pregunta para detectar el doble
 * cañón (`prompts.ts`), y palabra que no puede ser parte de un nombre (`deteccion.ts`).
 *
 * Los tres propósitos son legítimos. Lo que no lo es: que ya habían divergido. "scooter" estaba
 * solo en una, "patineta" y "camioneta" solo en otra, "monopatín" en ninguna de las que importaban.
 * Quien agregue mañana un tipo de vehículo va a acertar en una lista de tres.
 *
 * Aquí está el vocabulario; cada archivo se lo lleva en la forma que necesita.
 *
 * ── EL PROBLEMA QUE APARECIÓ AL JUNTARLAS ──────────────────────────────────
 *
 * Las tres comparaban con `texto.includes(termino)`, sin límite de palabra. Comprobado contra el
 * código de producción, no en teoría:
 *
 *     "sí, autorizo"                 → tiene_vehiculo: ["carro"]    ("auto" ⊂ "autorizo")
 *     "soy casado y tengo dos hijos" → vivienda: "propia"           ("casa" ⊂ "casado")
 *     "tengo un motor viejo"         → tiene_vehiculo: ["moto"]     ("moto" ⊂ "motor")
 *
 * El primero es el grave: `textoUsuario` es el join de TODOS los mensajes de la persona, y
 * "autorizo" es lo que se escribe en la compuerta de consentimiento. O sea, en cualquier
 * conversación que llegue al formulario, el modelo podía afirmar un carro y la compuerta —la pieza
 * que existe justamente para no creerle— lo aprobaba.
 *
 * Y el segundo cae exactamente donde dolió: la conversación real que motivó toda esta compuerta
 * falló porque `vivienda:"propia"` entró sin evidencia y decidió la venta.
 *
 * ── LA REGLA ───────────────────────────────────────────────────────────────
 *
 * Cada término declara cómo se compara, porque el español no permite una sola regla:
 *
 *     "casa"      → palabra exacta   ·  casa, Casa   ·  NO casado
 *     "arriend*"  → prefijo de palabra ·  arriendo, arriendan  ·  NO "desarriendo"
 *
 * El `*` es la excepción explícita, no el modo por defecto: si algo se compara de forma laxa, se
 * ve en la lista.
 */

/** Compara un término contra el texto normalizado (minúsculas, sin tildes). */
export function coincide(texto: string, termino: string): boolean {
  const prefijo = termino.endsWith("*");
  const raiz = (prefijo ? termino.slice(0, -1) : termino).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // El límite por la IZQUIERDA siempre: ni el prefijo puede empezar a mitad de palabra.
  return new RegExp(prefijo ? `\\b${raiz}` : `\\b${raiz}\\b`).test(texto);
}

/** ¿El texto menciona alguno de estos términos? */
export function menciona(texto: string, terminos: readonly string[]): boolean {
  return terminos.some((t) => coincide(texto, t));
}

/**
 * Vehículos, por tipo. El tipo importa: `tiene_vehiculo: ["moto"]` solo se acepta si la persona
 * nombró una moto, no un vehículo cualquiera.
 *
 * "auto" va como palabra exacta a propósito — es la que abría la puerta a "autorizo".
 */
export const VEHICULOS: Record<string, readonly string[]> = {
  // "vehiculo*" cuenta como carro: es una APROXIMACIÓN deliberada, no un descuido. Quien entra por
  // ?interes=movilidad dice "un seguro para mi vehículo" y sin esto el motor se queda sin señal y
  // sin recomendación. Afinarlo —preguntar de qué tipo— es una decisión de producto, no de #43.
  carro: ["carro*", "automovil*", "auto", "autos", "camioneta*", "vehiculo*"],
  moto: ["moto", "motos", "motocicleta*", "scooter", "scooters"],
  bici: ["bici", "bicis", "bicicleta*"],
  patineta: ["patineta*", "monopatin*", "scooter electric*"],
};

export const MASCOTAS: Record<string, readonly string[]> = {
  perro: ["perro*", "perra*", "perrit*", "cachorr*", "mascota*"],
  gato: ["gato", "gatos", "gata", "gatas", "gatic*", "michi*", "mascota*"],
};

/**
 * Vivienda. "casa" es palabra exacta por "casado"/"casada", que es de lo primero que alguien
 * cuenta de sí mismo.
 */
export const VIVIENDA: readonly string[] = [
  "casa", "casas", "apartamento*", "apto", "aptos", "vivienda*",
  "arriend*", "arrend*", "inmueble*", "finca*", "propiedad*", "vivo en",
];

/** Todos los términos de un mapa, aplanados. */
export const aplanar = (m: Record<string, readonly string[]>): string[] =>
  Array.from(new Set(Object.values(m).flat()));

/** La raíz de un término, sin el `*`: la forma en que se escribe dentro de un nombre o un tema. */
export const raiz = (t: string): string => (t.endsWith("*") ? t.slice(0, -1) : t);
