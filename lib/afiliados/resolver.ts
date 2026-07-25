/**
 * Ejecución de la consulta de identidad contra la base.
 *
 *   1 · nombre exacto → 1 resultado                → RECONOCIDO (99,55% de los casos)
 *       nombre exacto → varios, mismo segmento     → RECONOCIDO igual (da lo mismo cuál sea)
 *       nombre exacto → varios, segmentos distintos→ AMBIGUO
 *       nombre exacto → 0 resultados               → NO ENCONTRADO
 *
 * Todo por índice (~100 ms). Nada de búsquedas por tokens: `LIKE '% x %'` no usa índice, escanea
 * 1,5M de filas y se pasó de 5 minutos en pruebas. El 92% de fallo por nombre corto se resuelve
 * PREGUNTANDO, no escaneando.
 *
 * QUÉ DEJÓ DE HACER ESTE MÓDULO, y por qué. Antes husmeaba el historial y decidía por su cuenta:
 * leía el nombre ya persistido, llamaba a `detectarCiudad` cuando le parecía y contaba los
 * intentos sobre todos los mensajes. Eso era tener tres dueños del mismo estado — y producía el
 * bucle sin salida al corregir el nombre (el persistido ganaba sobre el nuevo) y la ciudad
 * detectada en mensajes donde nadie había preguntado por ninguna ciudad.
 *
 * Ahora EJECUTA la consulta que ya decidió el reducer, y clasifica el resultado. Nada más. La
 * prosa para el prompt se fue a `lib/estado/contexto.ts`, que la genera desde el estado y por eso
 * sobrevive al turno.
 */
import { getAffiliateGateway } from "./index";
import type { AfiliadoSegmento } from "./gateway";
import { detectarNombre } from "./deteccion";
import type { ConsultaIdentidad } from "../estado/tipos";
import type { HallazgoIdentidad } from "../estado/reducir";
import type { SegmentoBase } from "../engine/sanear";

/** Los 5 ejes que consume el motor, desde la fila de la base. */
export function aSegmentoBase(s: AfiliadoSegmento): SegmentoBase {
  return {
    GENERO: s.genero,
    RANGO_EDAD: s.rango_edad,
    CATEGORIA: s.categoria,
    SEGMENTO_GRUPO_FAMILIAR: s.grupo_familiar,
    SEGMENTO_POBLACIONAL: s.poblacional,
  };
}

export async function ejecutarConsulta(consulta: ConsultaIdentidad): Promise<HallazgoIdentidad> {
  let nombre: string;
  let ciudad: string | undefined;

  switch (consulta.modo) {
    case "ninguna":
      return { estado: "sin_intento" };

    case "detectar": {
      // La heurística solo se usa aquí: cuando NADIE preguntó nada y hay que pescar un nombre
      // dentro de una frase cualquiera. Si el sistema sí preguntó, el mensaje entero es la
      // respuesta y eso lo resuelve el reducer, que es quien sabe qué preguntó.
      const detectado = detectarNombre(consulta.texto, consulta.primerMensaje);
      if (!detectado) return { estado: "sin_intento" };
      nombre = detectado;
      break;
    }

    case "nombre":
      nombre = consulta.nombre;
      break;

    case "ciudad":
      nombre = consulta.nombre;
      ciudad = consulta.ciudad;
      break;
  }

  const h = await getAffiliateGateway().buscar(nombre, ciudad);

  if (h.estado === "unico") {
    return {
      estado: "reconocido",
      // El nombre CANÓNICO de la base, no el que se tecleó: es el que se guarda en el estado y
      // con el que se saluda.
      nombre: h.segmento.nombre,
      ciudad: h.segmento.ciudad ?? ciudad,
      segmento: aSegmentoBase(h.segmento),
    };
  }

  if (h.estado === "ambiguo") {
    return {
      estado: "ambiguo",
      nombre,
      n: h.n,
      comun: h.comun ? aSegmentoBase(h.comun) : undefined,
    };
  }

  return { estado: "no_encontrado", nombre };
}
