/**
 * Resolución de identidad del afiliado — la cascada.
 *
 *   1 · nombre exacto → 1 resultado                → RECONOCIDO (99,55% de los casos)
 *       nombre exacto → varios, mismo segmento     → RECONOCIDO igual (da lo mismo cuál sea)
 *       nombre exacto → varios, segmentos distintos→ pedir CIUDAD, una sola vez
 *       nombre exacto → 0 resultados               → pedir NOMBRE COMPLETO, y si nada, copy A
 *
 * Todo por índice (~100 ms). Nada de búsquedas por tokens: `LIKE '% x %'` no usa índice, escanea
 * 1,5M de filas y se pasó de 5 minutos en pruebas. El 92% de fallo por nombre corto se resuelve
 * PREGUNTANDO, no escaneando.
 */
import { getAffiliateGateway } from "./index";
import type { AfiliadoSegmento } from "./gateway";
import { detectarCiudad, detectarNombre } from "./deteccion";

/**
 * Tope de búsquedas por conversación. Bloqueo real de enumeración, en código y no en prompt.
 * La constante vive en `lib/estado/tipos.ts` porque la aplican DOS capas —el reducer decide si
 * vale la pena consultar y esta corta si igual se consulta— y con una copia en cada lado,
 * cambiar una no cambiaba la otra.
 */
export { MAX_BUSQUEDAS } from "../estado/tipos";
import { MAX_BUSQUEDAS } from "../estado/tipos";

export type EstadoIdentidad =
  | "sin_intento"
  | "reconocido"
  | "ambiguo"
  | "no_encontrado"
  | "tope_alcanzado";

export interface Identidad {
  estado: EstadoIdentidad;
  segmento?: AfiliadoSegmento;
  /** Bloque de contexto para el prompt del turno. */
  contexto?: string;
  /** Lo que el cliente debe recordar para los siguientes turnos. */
  persistir?: { nombre: string; ciudad: string };
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export async function resolverIdentidad(
  messages: Msg[],
  afiliado?: { nombre?: string; ciudad?: string }
): Promise<Identidad> {
  const delUsuario = messages.filter((m) => m.role === "user");
  const ultimo = delUsuario[delUsuario.length - 1]?.content ?? "";

  // Nombre a buscar: el ya persistido manda; si no, se detecta en el último mensaje.
  const yaPersistido = afiliado?.nombre?.trim();
  const detectado = yaPersistido ? null : detectarNombre(ultimo, delUsuario.length <= 1);
  const nombre = yaPersistido || detectado;
  if (!nombre) return { estado: "sin_intento" };

  // Tope de enumeración: cuenta cuántos mensajes distintos trajeron un nombre.
  const intentos = delUsuario.filter((m) => detectarNombre(m.content, false)).length;
  if (!yaPersistido && intentos > MAX_BUSQUEDAS) {
    return { estado: "tope_alcanzado" };
  }

  // La ciudad puede venir persistida o venir en el mensaje de este turno (respuesta a "¿en qué
  // ciudad estás?"). Solo se usa como dato adicional; nunca es obligatoria.
  const ciudad = afiliado?.ciudad?.trim() || (yaPersistido ? detectarCiudad(ultimo) ?? undefined : undefined);

  const h = await getAffiliateGateway().buscar(nombre, ciudad);

  if (h.estado === "unico") {
    return {
      estado: "reconocido",
      segmento: h.segmento,
      contexto: contextoReconocido(h.segmento),
      persistir: { nombre, ciudad: ciudad ?? "" },
    };
  }

  if (h.estado === "ambiguo") {
    return {
      estado: "ambiguo",
      contexto:
        `## IDENTIFICACIÓN AMBIGUA\n` +
        `Hay ${h.n} personas registradas con ese nombre y su situación es distinta, así que no se ` +
        `puede saber cuál es. Pídele SOLO la ciudad, con calidez y UNA sola vez, por ejemplo: ` +
        `"Mucho gusto, [primer nombre]. Hay varios [nombre] en Colsubsidio 😅 ¿En qué ciudad estás y te ubico bien?" ` +
        `y añade una línea OPCIONES: Vivo en\n` +
        `NUNCA le ofrezcas ciudades para escoger: que ella la escriba. No listes personas ni datos de nadie.\n` +
        (h.comun
          ? `Lo único cierto sin importar cuál sea: ${describirComun(h.comun)}. Puedes usar esos campos y nada más.`
          : `No hay ningún dato común entre esas personas, así que no asumas nada de su segmento.`),
      // Se persiste el nombre para poder combinarlo con la ciudad en el siguiente turno.
      persistir: { nombre, ciudad: ciudad ?? "" },
    };
  }

  // No encontrado. Si el nombre era corto, primero se pide el completo; si ya dio uno largo, copy A.
  const tokens = nombre.split(" ").length;
  return {
    estado: "no_encontrado",
    contexto:
      tokens <= 2
        ? `## NO SE ENCONTRÓ (nombre corto)\n` +
          `No hay coincidencia con "${nombre}". Antes de descartarlo, pídele el nombre completo una ` +
          `sola vez: "Mucho gusto, [nombre] 😊 ¿Me das tu nombre completo, como aparece en tu documento? ` +
          `Con eso te ubico bien y arrancamos." Si tampoco aparece, sigue con normalidad y no vuelvas a insistir.`
        : `## NO SE ENCONTRÓ EN LA BASE\n` +
          `Dilo claro y sigue atendiendo, en el MISMO mensaje que hace la siguiente pregunta útil: ` +
          `"No apareces en la base de afiliados de Colsubsidio. Te atiendo completo igual, solo te hago ` +
          `un par de preguntas más." NUNCA digas "no eres afiliado": puede estar registrada con el nombre ` +
          `escrito distinto. No vuelvas a mencionar el tema de la identificación en el resto de la conversación.`,
  };
}

function describirComun(s: AfiliadoSegmento): string {
  const partes = [
    s.genero === "F" ? "es mujer" : s.genero === "M" ? "es hombre" : null,
    s.rango_edad ? `está en el rango ${s.rango_edad}` : null,
    s.categoria ? `es categoría ${s.categoria}` : null,
    s.grupo_familiar ? `su grupo familiar es ${s.grupo_familiar}` : null,
  ].filter(Boolean);
  return partes.join(", ");
}

function contextoReconocido(seg: AfiliadoSegmento): string {
  const primerNombre = seg.nombre.split(" ")[0];
  const saludo = seg.genero === "F" ? "Bienvenida" : seg.genero === "M" ? "Bienvenido" : "Bienvenido(a)";
  return (
    `## SEGMENTO VERIFICADO DE ESTE AFILIADO (viene de la base de Colsubsidio, no lo preguntes)\n` +
    `Primer nombre: ${primerNombre}. Saluda con "${saludo}, ${primerNombre}".\n` +
    // Los 4 ejes del peer-group van COMPLETOS: `lookupPeer` los exige para ubicar la celda.
    `Género = ${seg.genero ?? "?"}; grupo familiar = ${seg.grupo_familiar ?? "?"}; ` +
    `rango de edad = ${seg.rango_edad ?? "?"}; categoría = ${seg.categoria ?? "?"}; ` +
    `segmento poblacional = ${seg.poblacional ?? "?"}; ciudad = ${seg.ciudad ?? "?"}.\n` +
    `El servidor ya le pasa este segmento al motor: NO lo repitas en la llamada a la tool y no lo ` +
    `preguntes de nuevo. Si la persona te corrige, mandan sus palabras.`
  );
}
