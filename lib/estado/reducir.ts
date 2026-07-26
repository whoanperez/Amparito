/**
 * El reducer del estado. Funciones PURAS: sin red, sin base, sin reloj.
 *
 * Reemplaza a `detectarEstado` (lib/prompts.ts), que derivaba la fase de `messages.length` y de
 * dos booleanos que mandaba el NAVEGADOR — entrada no autenticada que se perdía con un F5.
 *
 * Un turno tiene tres momentos porque en la mitad hay I/O (la consulta a la base). Cada momento
 * es una función pura, y el orquestador solo pone el I/O entre ellas:
 *
 *     const { estado, consulta } = iniciarTurno(previo, mensaje);   // puro
 *     const hallazgo = await buscarEnLaBase(consulta);              // I/O
 *     estado = aplicarIdentidad(estado, hallazgo);                  // puro
 *     ...  llamada al modelo, tools  ...                            // I/O
 *     estado = cerrarTurno(estado, { eventos, perfilUsado });       // puro
 */
import type {
  EstadoConversacion, ConsultaIdentidad, Fase, UiEvent, Veredicto,
} from "./tipos";
import { MAX_BUSQUEDAS } from "./tipos";
import type { Perfil, Recomendacion, Obligatorio, Peer, NoVenta } from "../engine/types";
import type { SegmentoBase } from "../engine/sanear";

/**
 * Lo que devolvió la base, normalizado. Se declara aquí en vez de importar `Identidad` de
 * `lib/afiliados/resolver` para que este módulo —y su gate— no arrastren el cliente de Turso.
 * La conversión vive en el orquestador, en un solo sitio.
 */
export type HallazgoIdentidad =
  | { estado: "sin_intento" }
  | { estado: "reconocido"; nombre: string; ciudad?: string; segmento: SegmentoBase }
  | { estado: "ambiguo"; nombre: string; n: number; comun?: SegmentoBase }
  | { estado: "no_encontrado"; nombre: string }
  | { estado: "tope_alcanzado" };

export interface ResultadoDelTurno {
  eventos: UiEvent[];
  /** El perfil que la compuerta aceptó. Ya viene con el acumulado como piso. */
  perfilUsado?: Perfil;
  descartes?: string[];
}

/* ─────────────────────────────────────────────────────────────────────────────
   Limpieza de respuestas a una pregunta concreta

   No es detección heurística: aquí YA sabemos qué preguntamos, así que el mensaje entero es la
   respuesta. Esa es justamente la diferencia que faltaba — `detectarNombre` está afinado para
   pescar un nombre dentro de una frase cualquiera, y por eso fallaba con quien obedecía
   "dame tu nombre completo" y escribía los cuatro apellidos.
   ────────────────────────────────────────────────────────────────────────── */

const PREFIJOS_NOMBRE = [
  "mi nombre completo es", "mi nombre es", "me llamo", "yo soy", "soy",
  "nombre completo:", "nombre:",
];
const PREFIJOS_CIUDAD = ["vivo en", "estoy en", "soy de", "en la ciudad de", "ciudad:", "de", "en"];

function sinPrefijo(texto: string, prefijos: string[]): string {
  let t = texto.trim().replace(/^[¡!¿?.,;:\s]+/, "");
  const bajo = t.toLowerCase();
  for (const p of prefijos) {
    if (bajo.startsWith(p + " ") || bajo === p) {
      t = t.slice(p.length).trim();
      break;
    }
  }
  return t.replace(/[.,;:!¡?¿]+$/, "").replace(/\s+/g, " ").trim();
}

/** El mensaje entero es un nombre. Se topa en 6 tokens: más que eso no es un nombre, es una frase. */
export function soloNombre(texto: string): string {
  return sinPrefijo(texto, PREFIJOS_NOMBRE).split(" ").slice(0, 6).join(" ");
}

/** El mensaje entero es una ciudad. */
export function soloCiudad(texto: string): string {
  return sinPrefijo(texto, PREFIJOS_CIUDAD).split(" ").slice(0, 4).join(" ");
}

/* ─────────────────────────────────────────────────────────────────────────────
   La máquina de fases
   ────────────────────────────────────────────────────────────────────────── */

/**
 * ASESORANDO es ABSORBENTE, y lo es por construcción: `veredicto` nunca se limpia, así que una
 * vez entregado no hay camino de vuelta. No es un caso especial, es una consecuencia — que es
 * como deben cumplirse los invariantes.
 */
export function siguienteFase(e: EstadoConversacion): Fase {
  if (e.veredicto?.entregado) return "ASESORANDO";
  if (e.identidad.resultado === "reconocido") return "RECONOCIDO";
  return e.turno <= 1 ? "SALUDO" : "DESCUBRIENDO";
}

/* ─────────────────────────────────────────────────────────────────────────────
   1 · Abrir el turno
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Avanza el turno y decide QUÉ consultar a la base. Aquí se consume `esperando`: si preguntamos
 * el nombre completo, este mensaje es el nombre completo — y no se le pasa al detector de ciudad,
 * que es lo que dejaba sin salida a quien obedecía la pregunta.
 */
export function iniciarTurno(
  previo: EstadoConversacion,
  mensaje: string
): { estado: EstadoConversacion; consulta: ConsultaIdentidad } {
  const texto = mensaje.trim();
  const estado: EstadoConversacion = {
    ...previo,
    turno: previo.turno + 1,
    identidad: { ...previo.identidad },
    dichoUnaVez: { ...previo.dichoUnaVez },
  };

  const esperaba = previo.identidad.esperando;
  estado.identidad.esperando = null; // se consume siempre: una pregunta, una respuesta

  if (esperaba === "nombre_completo" && texto) {
    const nombre = soloNombre(texto);
    if (nombre) {
      // El nuevo nombre REEMPLAZA al persistido. Antes el persistido ganaba, así que corregirse
      // era imposible: la corrección no se podía buscar y encima se leía como ciudad.
      estado.identidad.nombre = nombre;
      estado.identidad.ciudad = undefined;
      return { estado, consulta: { modo: "nombre", nombre } };
    }
  }

  if (esperaba === "ciudad" && texto && previo.identidad.nombre) {
    const ciudad = soloCiudad(texto);
    if (ciudad) {
      estado.identidad.ciudad = ciudad;
      return { estado, consulta: { modo: "ciudad", nombre: previo.identidad.nombre, ciudad } };
    }
  }

  // Identidad congelada: reconocido no se vuelve a consultar. Se acabó el round-trip por turno.
  if (previo.identidad.resultado === "reconocido") {
    return { estado, consulta: { modo: "ninguna" } };
  }

  // Tope de enumeración. Es lo ÚNICO que apaga la escucha.
  //
  // Haber dicho ya "no apareces en la base" NO la apaga: eso nos prohíbe volver a PREGUNTAR
  // (y de eso se encarga `dichoUnaVez`), no dejar de escuchar. Si la persona corrige su nombre
  // por su cuenta —una tilde, un apellido que faltaba— buscarlo es gratis y es lo que quiere.
  if (previo.identidad.resultado === "tope" || previo.identidad.intentos >= MAX_BUSQUEDAS) {
    return { estado, consulta: { modo: "ninguna" } };
  }

  if (!texto) return { estado, consulta: { modo: "ninguna" } };
  return { estado, consulta: { modo: "detectar", texto, primerMensaje: estado.turno <= 1 } };
}

/* ─────────────────────────────────────────────────────────────────────────────
   2 · Aplicar lo que dijo la base
   ────────────────────────────────────────────────────────────────────────── */

export function aplicarIdentidad(
  previo: EstadoConversacion,
  hallazgo: HallazgoIdentidad
): EstadoConversacion {
  const estado: EstadoConversacion = {
    ...previo,
    identidad: { ...previo.identidad },
    dichoUnaVez: { ...previo.dichoUnaVez },
  };
  const id = estado.identidad;

  // Se cuenta cada búsqueda que llegó a la base, sin importar cómo salió. Es el contador del
  // tope de enumeración, y por eso se lleva aquí y no en `iniciarTurno`: allí todavía no se sabe
  // si el mensaje traía un nombre.
  if (hallazgo.estado !== "sin_intento" && hallazgo.estado !== "tope_alcanzado") {
    id.intentos = previo.identidad.intentos + 1;
  }

  switch (hallazgo.estado) {
    case "reconocido":
      id.resultado = "reconocido";
      id.nombre = hallazgo.nombre;
      if (hallazgo.ciudad) id.ciudad = hallazgo.ciudad;
      id.segmento = hallazgo.segmento; // congelado
      id.esperando = null;
      break;

    case "ambiguo":
      id.resultado = "ambiguo";
      id.nombre = hallazgo.nombre;
      // El número y los ejes comunes son HECHOS sobre la base: viven en el estado, y el copy se
      // genera desde aquí en vez de pasárselos al modelo como prosa para que los parafrasee.
      id.ambiguo = { n: hallazgo.n, comun: hallazgo.comun };
      // La ciudad se pide UNA vez, y quien lo garantiza es este flag, no una frase del prompt.
      if (!estado.dichoUnaVez.pidioCiudad) {
        id.esperando = "ciudad";
        estado.dichoUnaVez.pidioCiudad = true;
      } else {
        // Se deja de insistir y se atiende igual. Y NO se marca el aviso de "no apareces en la
        // base": "ambiguo" significa que hay VARIAS personas con ese nombre, lo contrario. Decirlo
        // aquí sería afirmar algo falso sobre la base — la clase de error que este bloque existe
        // para cerrar, no para reintroducir.
        id.esperando = null;
      }
      break;

    case "no_encontrado": {
      id.resultado = "no_encontrado";
      id.nombre = hallazgo.nombre;
      const corto = hallazgo.nombre.trim().split(/\s+/).length <= 2;
      if (corto && !estado.dichoUnaVez.pidioNombreCompleto) {
        id.esperando = "nombre_completo";
        estado.dichoUnaVez.pidioNombreCompleto = true;
      } else {
        // SOBREVIVE al turno, y con el turno EN QUE se dijo. Antes `no_encontrado` no persistía
        // nada, así que el sistema no podía recordar "ya intentamos identificarte y falló" ni
        // respetar el "no vuelvas a insistir". Guardar el turno es lo que permite distinguir el
        // momento de decirlo de los siguientes, en los que solo hay que callarlo.
        id.esperando = null;
        if (id.avisadoEnTurno === undefined) id.avisadoEnTurno = estado.turno;
      }
      break;
    }

    case "tope_alcanzado":
      id.resultado = "tope";
      id.esperando = null;
      break;

    case "sin_intento":
      break;
  }

  estado.fase = siguienteFase(estado);
  return estado;
}

/* ─────────────────────────────────────────────────────────────────────────────
   3 · Cerrar el turno
   ────────────────────────────────────────────────────────────────────────── */

interface PropensionCruda {
  recomendaciones?: Recomendacion[];
  obligatorios?: Obligatorio[];
  peer?: Peer | null;
  no_venta?: NoVenta;
}

export function cerrarTurno(
  previo: EstadoConversacion,
  resultado: ResultadoDelTurno
): EstadoConversacion {
  const estado: EstadoConversacion = {
    ...previo,
    identidad: { ...previo.identidad },
    dichoUnaVez: { ...previo.dichoUnaVez, saludo: previo.dichoUnaVez.saludo || previo.turno >= 1 },
  };

  if (resultado.perfilUsado) estado.perfil = resultado.perfilUsado;
  if (resultado.descartes) estado.descartes = resultado.descartes;

  // GANA EL ÚLTIMO. Si el modelo llamó la tool dos veces en un turno —cosa que el prompt le pide
  // hacer si lo corrigen— antes se pintaban dos tarjetas de propensión.
  let ultimaPropension: PropensionCruda | null = null;
  for (const ev of resultado.eventos) {
    if (ev.type === "propension") ultimaPropension = ev.data as PropensionCruda;
    if (ev.type === "quote" && ev.data.quoteId) estado.quoteId = String(ev.data.quoteId);
  }

  if (ultimaPropension) {
    const recomendaciones = ultimaPropension.recomendaciones ?? [];
    const veredicto: Veredicto = {
      // El motor se pronunció. Decir que NO también es pronunciarse: aquí muere el bucle de
      // re-saludo, que se colaba porque `no_venta` devuelve `recomendaciones: []` y el sistema
      // leía la lista vacía como "todavía no he recomendado".
      entregado: true,
      tipo: ultimaPropension.no_venta ? "no_venta" : "recomendacion",
      recomendaciones,
      obligatorios: ultimaPropension.obligatorios ?? [],
      peer: ultimaPropension.peer ?? null,
      no_venta: ultimaPropension.no_venta,
    };
    estado.veredicto = veredicto;
    if (recomendaciones[0]) estado.foco = recomendaciones[0].id;
  }

  estado.fase = siguienteFase(estado);
  return estado;
}
