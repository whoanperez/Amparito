/**
 * La capa de presentación de la traza (#28).
 *
 * QUÉ TENÍA MAL. La traza es la promesa central del producto —"inspeccionable en pantalla, no una
 * caja negra"— y no tenía capa de presentación: la estructura interna del motor ERA el view-model.
 * Lo que se veía en la pantalla era esto, literal:
 *
 *     enriquecido.tiene_mascota = perro          declarado
 *     prior.prob_mascota_hogar  +12
 *     Gate de asequibilidad · categoría (vacío) → prioriza prima baja
 *     Seguro de Accidentes Personales   55   descartado
 *
 * El problema no es que sea feo. Es que una traza que solo entiende quien escribió el motor NO ES
 * UNA TRAZA: es un volcado. Y este producto le pide a quien la abre —cumplimiento, un jurado,
 * alguien que desconfía— que la lea para confiar. Si al abrirla se encuentra `(vacío)` y nombres de
 * variable, el efecto es el contrario del buscado: parece que se muestra todo justamente porque
 * nadie va a poder leerlo.
 *
 * Tres cosas, entonces:
 *
 * 1 · Los nombres internos no salen a pantalla. Y el que no tenga etiqueta escrita a mano igual
 *     sale legible: la alternativa —un diccionario que hay que acordarse de actualizar— es la
 *     misma trampa de las listas sincronizadas a mano que ya nos costó dos bugs. Aquí el
 *     diccionario es el atajo y el respaldo es automático.
 *
 * 2 · `(vacío)` deja de ser un valor. Que no sepamos la categoría de afiliación ES una decisión con
 *     consecuencia —se prioriza prima baja por precaución— y se dice con esas palabras.
 *
 * 3 · El puntaje deja de ser un número mágico: se muestra que es la SUMA de las señales listadas.
 *     Esa propiedad ya era cierta y era invisible, que es la peor forma de tener una garantía.
 *
 * Funciones puras, sin JSX: por eso tienen gate.
 */

/** Etiquetas escritas a mano para los campos que se ven a diario. El resto cae al respaldo. */
const ETIQUETAS: Record<string, string> = {
  GENERO: "Género",
  RANGO_EDAD: "Edad",
  CATEGORIA: "Categoría de afiliación",
  SEGMENTO_GRUPO_FAMILIAR: "Grupo familiar",
  SEGMENTO_POBLACIONAL: "Segmento",
  ya_cubierto: "Lo que ya tienes cubierto",
  "enriquecido.dependientes": "Personas que dependen de ti",
  "enriquecido.tiene_vehiculo": "Cómo te mueves",
  "enriquecido.tiene_mascota": "Mascota",
  "enriquecido.vivienda": "Tu vivienda",
  "enriquecido.necesidad_salud": "Necesidad de salud",
  "enriquecido.viaja": "Viajas",
  "enriquecido.tiene_credito": "Tienes un crédito",
  "enriquecido.mascota_veterinario_frecuente": "Vas seguido al veterinario",
  "enriquecido.sin_ingresos": "Hoy no tienes ingresos",
  "prior.prob_mascota_hogar": "Dato de contexto (DANE)",
};

/**
 * El respaldo: quita el espacio de nombres interno y vuelve legible lo que quede. Una etiqueta
 * mediocre pero en español es mejor que `enriquecido.foo_bar`, y sobre todo NO se olvida.
 */
function respaldo(clave: string): string {
  const sinNamespace = clave.replace(/^(enriquecido|marca|prior|ya_cubierto)\./, "");
  const palabras = sinNamespace.replace(/_/g, " ").toLowerCase().trim();
  return palabras.charAt(0).toUpperCase() + palabras.slice(1);
}

export function etiquetaDeCampo(clave: string): string {
  return ETIQUETAS[clave] ?? respaldo(clave);
}

/** Los valores del perfil son datos crudos: `true`, `["perro"]`, `2`. Nadie habla así. */
export function valorLegible(v: unknown): string {
  if (v === true) return "sí";
  if (v === false) return "no";
  if (v === null || v === undefined || v === "") return "sin dato";
  if (Array.isArray(v)) return v.length ? v.map((x) => String(x)).join(", ") : "sin dato";
  return String(v);
}

/**
 * La procedencia va en una pastilla pequeña y en mayúsculas, así que tiene que caber: la frase
 * larga vive en la nota de abajo, no repetida en cada fila.
 *
 * "sin procedencia" no es un caso decorativo: hoy `ya_cubierto` es el único campo del perfil que
 * `sanearPerfil` acepta sin registrar de dónde salió. Que se vea es correcto — es un hueco real, y
 * taparlo con un guion era lo que impedía notarlo.
 */
export const ETIQUETA_ORIGEN: Record<string, string> = {
  base: "de la base",
  declarado: "lo dijiste tú",
  inferido: "se dedujo",
};

export const SIN_PROCEDENCIA = "sin procedencia";

export const ETIQUETA_RESULTADO: Record<string, string> = {
  recomendado: "te lo recomendé",
  obligatorio: "obligatorio por ley",
  ya_cubierto: "ya lo tienes",
  /*
   * Decía "no entró, y te dije por qué". La etiqueta NO PUEDE SABER si se lo dijo — en un flujo
   * real el motivo estaba aquí y en la conversación no se mencionó nunca, así que afirmaba algo
   * falso sobre lo que había pasado. Ahora señala dónde está el motivo, que es lo único que sí
   * sabe.
   */
  descartado: "no entró · el motivo, aquí",
  fuera_del_top: "no entró",
};

/**
 * El gate de asequibilidad, en una frase.
 *
 * `categoria` llega como `"(vacío)"` cuando la persona no se identificó contra la base. No
 * saberla no es un hueco decorativo: cambia la decisión —se prefiere la prima más baja— y eso es
 * justo lo que hay que poder auditar.
 */
export function explicaGate(g: { categoria: string; prioriza_prima_baja: boolean }): string {
  const sinDato = !g.categoria || g.categoria === "(vacío)";
  const quien = sinDato
    ? "No sé tu categoría de afiliación (no te identificaste contra la base)"
    : `Tu categoría de afiliación es ${g.categoria}`;
  const efecto = g.prioriza_prima_baja
    ? "así que primero te muestro lo de prima más baja"
    : "así que no priorizo por precio";
  return `${quien}, ${efecto}.`;
}

/**
 * ¿El puntaje es exactamente la suma de las señales que se están mostrando?
 *
 * Se comprueba en vez de afirmarse. Si algún día el motor suma algo que no lista —una redundancia,
 * un ajuste—, la pantalla deja de prometer una aritmética que ya no cuadra, en lugar de mentir con
 * confianza. Es la misma regla del sello: se muestra lo que se puede sostener.
 */
export function cuadraElPuntaje(p: { score: number; senales: Array<{ peso: number }> }): boolean {
  if (!p.senales.length) return false;
  return p.senales.reduce((a, s) => a + s.peso, 0) === p.score;
}

/**
 * La aritmética, escrita: "35 + 25 = 60". Solo se pinta si cuadra.
 *
 * Los pesos negativos —la regla de anti-venta le resta 100 a lo que ya tienes— se escriben como
 * restas. "10 + -100" es la operación correcta escrita como no la escribe nadie.
 */
export function sumaDelPuntaje(p: { score: number; senales: Array<{ peso: number }> }): string | null {
  if (!cuadraElPuntaje(p)) return null;
  const [primero, ...resto] = p.senales;
  const cuerpo = resto.reduce(
    (acc, s) => `${acc} ${s.peso < 0 ? "−" : "+"} ${Math.abs(s.peso)}`,
    String(primero.peso)
  );
  const total = p.score < 0 ? `−${Math.abs(p.score)}` : String(p.score);
  return `${cuerpo} = ${total}`;
}
