import type Anthropic from "@anthropic-ai/sdk";
import { getCatalog, getProduct, recommendProducts } from "./catalog";
import { getInsurerGateway } from "./insurer/mock-adapter";
import { Contacto } from "./insurer/gateway";
import { calcularPropension } from "./engine/scorecard";
import { calcularImpacto } from "./engine/impacto";
import { sanearPerfil, declaroSinIngresos, normalizar, type SanearCtx } from "./engine/sanear";
import { nosHonestos, instruccionDeNos } from "./engine/nos";
import { registrar } from "./auditoria";
import { Perfil } from "./engine/types";

/**
 * Definición de las tools que el orquestador expone a Claude Haiku.
 * Los handlers son la ÚNICA fuente de verdad de datos de producto y de
 * propensión: el modelo nunca inventa precios, coberturas ni razones.
 */
export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "get_catalog",
    description:
      "Devuelve las categorías y productos de seguros y asistencias disponibles en Colsubsidio.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "recommend_products",
    description:
      "Recomienda 1-2 productos según la situación de vida del afiliado. Llamar SIEMPRE antes de recomendar.",
    input_schema: {
      type: "object" as const,
      properties: {
        perfil: {
          type: "string",
          description: "Resumen en texto de la situación de vida contada por el afiliado",
        },
        gatillos: {
          type: "array",
          items: { type: "string" },
          description: "Gatillos de vida detectados (ej: 'moto', 'hijo', 'mascota', 'viaje')",
        },
      },
      required: ["perfil", "gatillos"],
    },
  },
  {
    name: "calcular_propension",
    description:
      "Motor de propensión explicable. Dado el perfil de vida del afiliado (estructurado), devuelve el ranking de seguros con sus reason codes, los productos descartados con su razón, el ledger de brechas (riesgos hoy vs lo que ya tiene = anti-venta) y la prueba social del segmento real. USAR en el Estado 3 ANTES de recomendar, en vez de recommend_products. El motor calcula; tú solo redactas las razones que devuelve (nunca inventes razones nuevas).",
    input_schema: {
      type: "object" as const,
      properties: {
        perfil: {
          type: "object",
          description: "Perfil de vida del afiliado, llenado con lo que se sepa de la conversación.",
          properties: {
            GENERO: { type: "string", enum: ["F", "M"] },
            RANGO_EDAD: {
              type: "string",
              enum: ["Menor de 19 años", "20 a 35 años", "36 a 45 años", "46 a 55 años", "Mayor de 55 años"],
              description: "Rango de edad; mapéalo desde la edad que cuente la persona.",
            },
            CATEGORIA: { type: "string", enum: ["A", "B", "C"], description: "Categoría Colsubsidio (A=menor ingreso)." },
            SEGMENTO_GRUPO_FAMILIAR: {
              type: "string",
              enum: ["Sin grupo familiar", "Monoparental", "Monoparental ampliada", "Nuclear integral", "Nuclear ampliada", "Pareja conyugal"],
              description: "Composición del hogar. Ej: mamá/papá soltero con hijos = Monoparental; pareja sin hijos = Pareja conyugal; solo = Sin grupo familiar.",
            },
            SEGMENTO_POBLACIONAL: { type: "string", enum: ["Básico", "Medio", "Joven", "Alto"] },
            enriquecido: {
              type: "object",
              description: "Señales de vida detectadas en la conversación.",
              properties: {
                dependientes: { type: "number", description: "Cuántas personas dependen de su ingreso." },
                tiene_vehiculo: { type: "array", items: { type: "string", enum: ["moto", "carro", "bici", "patineta"] } },
                tiene_mascota: { type: "array", items: { type: "string", enum: ["perro", "gato"] } },
                vivienda: { type: "string", enum: ["propia", "arriendo"] },
                necesidad_salud: { type: "boolean" },
                viaja: { type: "boolean" },
                tiene_credito: { type: "boolean" },
                mascota_veterinario_frecuente: { type: "boolean" },
                sin_ingresos: {
                  type: "boolean",
                  description:
                    "true si la persona dice que hoy no tiene ingresos (desempleo, informalidad sin " +
                    "entrada). El motor devolverá no_venta y NO se recomienda ningún producto de pago.",
                },
              },
            },
            ya_cubierto: {
              type: "array",
              items: { type: "string", enum: ["exequial", "vida", "soat", "hogar", "accidentes", "mascota"] },
              description: "Coberturas que la persona YA tiene (dispara el anti-venta: no se le vuelve a vender).",
            },
          },
        },
      },
      required: ["perfil"],
    },
  },
  {
    name: "calcular_impacto_ingreso",
    description:
      "Calcula, como referencia, cuánto ingreso dejaría de recibir la familia si la persona faltara (su ingreso mensual proyectado a varios años). Úsala cuando la persona es sostén de un hogar con dependientes y estás recomendando o cotizando un Seguro de Vida: hace tangible el 'por qué' sin vender. Enmárcalo SIEMPRE como cuidado/tranquilidad, nunca como miedo ni como muerte. El motor calcula el número; tú lo comunicas con calidez.",
    input_schema: {
      type: "object" as const,
      properties: {
        ingreso_mensual: { type: "number", description: "Ingreso mensual aproximado de la persona, en pesos." },
        dependientes: { type: "number", description: "Cuántas personas dependen de ese ingreso." },
        anos_proteccion: { type: "number", description: "Años de respaldo a considerar (si no lo sabes, omítelo; por defecto 10)." },
      },
      required: ["ingreso_mensual"],
    },
  },
  {
    name: "get_product_details",
    description:
      "Detalle completo de un producto: coberturas, exclusiones y la información legal mínima (Art. 9 Ley 1328/2009). Llamar SIEMPRE antes del cierre.",
    input_schema: {
      type: "object" as const,
      properties: { productId: { type: "string" } },
      required: ["productId"],
    },
  },
  {
    name: "quote_product",
    description:
      "Cotiza un producto para el perfil dado. Devuelve prima exacta, periodicidad y quoteId. Llamar SIEMPRE antes de dar cualquier precio.",
    input_schema: {
      type: "object" as const,
      properties: {
        productId: { type: "string" },
        perfil: {
          type: "object",
          properties: {
            edad: { type: "number" },
            ciudad: { type: "string" },
            contexto: { type: "string" },
          },
        },
      },
      required: ["productId"],
    },
  },
  {
    name: "collect_customer_data",
    description:
      "Abre el formulario para que la persona llene sus datos personales y autorice el tratamiento de datos (Ley 1581). Úsala en el Estado 6, después de mostrar los detalles del producto y de que la persona quiera continuar. NO pidas los datos por chat.",
    input_schema: {
      type: "object" as const,
      properties: { productId: { type: "string" } },
      required: ["productId"],
    },
  },
  {
    name: "issue_policy",
    description:
      "Emite la póliza. SOLO llamar con: información Art. 9 ya mostrada, consentimiento habeas data explícito, datos de contacto confirmados y confirmación de compra.",
    input_schema: {
      type: "object" as const,
      properties: {
        quoteId: { type: "string" },
        consentimiento: {
          type: "boolean",
          description: "true SOLO si el usuario autorizó explícitamente el tratamiento de datos (Ley 1581)",
        },
        contacto: {
          type: "object",
          properties: {
            nombre: { type: "string" },
            tipoDocumento: { type: "string", enum: ["CC", "CE", "PASAPORTE"] },
            numeroDocumento: { type: "string" },
            fechaNacimiento: { type: "string", description: "DD/MM/AAAA" },
            celular: { type: "string" },
            correo: { type: "string" },
          },
          required: ["nombre", "tipoDocumento", "numeroDocumento", "fechaNacimiento", "celular", "correo"],
        },
      },
      required: ["quoteId", "consentimiento", "contacto"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Deriva el caso a un asesor humano (producto no estandarizado, solicitud del usuario, frustración, caso complejo).",
    input_schema: {
      type: "object" as const,
      properties: { motivo: { type: "string" } },
      required: ["motivo"],
    },
  },
  {
    name: "ofrecer_opciones",
    description:
      "Ofrece de 2 a 4 respuestas rápidas que la persona puede tocar en vez de escribir. " +
      "Úsala junto a una pregunta cuyas respuestas típicas sean pocas, cortas y claras. " +
      "Son RESPUESTAS que la persona daría, nunca preguntas. Al tocarlas se pre-llena la casilla " +
      "de texto, así que cuando la respuesta necesita un dato (un monto, una ciudad, una cantidad) " +
      "deja la opción abierta para completar: \"Vivo en\", \"Tengo un presupuesto de\". " +
      "No la uses cuando esperas un texto largo y libre.",
    input_schema: {
      type: "object" as const,
      properties: {
        opciones: {
          type: "array",
          items: { type: "string" },
          description: "De 2 a 4 respuestas muy cortas, en las palabras de la persona.",
        },
      },
      required: ["opciones"],
    },
  },
];

/**
 * Evento estructurado que la UI renderiza como tarjeta.
 *
 * La definición vive en `lib/estado/tipos.ts` y aquí solo se reexporta: es un contrato de
 * presentación que comparten servidor y navegador, y este módulo importa el SDK de Anthropic,
 * que el cliente no puede arrastrar. Declararlo en los dos sitios es cómo dos tipos que deben
 * ser el mismo empiezan a divergir sin que nadie lo note.
 */
export type { UiEvent } from "./estado/tipos";
import type { UiEvent } from "./estado/tipos";

/** Ejecuta una tool y devuelve {result, event?}. Compuertas de cumplimiento EN SERVIDOR. */
/**
 * Contexto que el servidor le da a las tools. Lo necesita `sanearPerfil` para verificar que un
 * campo del perfil venga de la base o de algo que la persona escribió de verdad.
 */
/**
 * Es exactamente el contexto de la compuerta: `executeTool` se lo pasa tal cual a `sanearPerfil`.
 * Se declaraba aparte con los mismos dos campos, que es cómo dos tipos que deben ser el mismo
 * empiezan a divergir — uno gana `perfilPrevio` y el otro no, y el turno deja de acumular sin
 * que nada se queje.
 */
export interface ToolCtx extends SanearCtx {
  /**
   * Lo que el servidor ya sabe de la persona y puede escribirle en el formulario.
   *
   * El formulario nacía VACÍO por construcción —`useState({ nombre: "", ... })`— incluso para
   * alguien a quien Amparito acababa de reconocer y saludar por su nombre. El pitch del producto
   * dice que "lo acompaña hasta completar el proceso" y ahí le entregaba una hoja en blanco.
   *
   * Con `origen` porque no es lo mismo: si vino verificado de la base se dice así; si lo escribió
   * la persona, también. Etiquetar de "tu afiliación" algo que no lo es sería la misma falsa
   * atribución que ya apareció dos veces en este bloque.
   */
  conocido?: { nombre?: string; origen?: "base" | "declarado" };
}

/**
 * Punto ÚNICO por donde pasan las 9 tools. Aquí se registra la decisión (RNF-6): no en nueve
 * sitios distintos, que es como se pierde la mitad de la traza.
 */
/**
 * Tools que NO son decisiones, sino afordancias de pantalla. El historial de auditoría es la
 * evidencia del RNF-6, tiene cupo (200) y es global al proceso: llenarlo de filas de botones
 * desplaza decisiones reales del registro. Ofrecer un botón no es una decisión que auditar.
 */
const NO_SE_AUDITAN = new Set(["ofrecer_opciones"]);

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolCtx = {}
): Promise<{ result: unknown; event?: UiEvent }> {
  const salida = await ejecutar(name, input, ctx);
  if (!NO_SE_AUDITAN.has(name)) registrar(name, input, salida.result);
  return salida;
}

async function ejecutar(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolCtx = {}
): Promise<{ result: unknown; event?: UiEvent }> {
  const gateway = getInsurerGateway();

  switch (name) {
    case "get_catalog": {
      const cat = getCatalog().map((p) => ({
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria,
        aseguradora: p.aseguradora,
        estandarizado: p.estandarizado,
        requiere_asesoria: p.requiere_asesoria,
      }));
      return { result: { productos: cat } };
    }

    case "recommend_products": {
      const perfil = String(input.perfil ?? "");
      const gatillos = Array.isArray(input.gatillos) ? input.gatillos.map(String) : [];
      const recs = recommendProducts(perfil, gatillos).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        aseguradora: p.aseguradora,
        categoria: p.categoria,
        estandarizado: p.estandarizado,
        requiere_asesoria: p.requiere_asesoria,
        coberturas_principales: p.coberturas.slice(0, 3),
      }));
      return {
        result: recs.length
          ? { recomendaciones: recs }
          : { recomendaciones: [], nota: "Ningún producto coincide con la situación descrita. Sé honesta al respecto." },
      };
    }

    case "calcular_propension": {
      // COMPUERTA DE ENTRADA (RNF-7). Antes esto era `input.perfil as Perfil` — un cast que no
      // verifica nada en runtime, así que el motor creía cualquier cosa que mandara el modelo.
      const { perfil, descartes } = sanearPerfil(input.perfil, ctx);
      const prop = calcularPropension(perfil);
      const nos = nosHonestos(prop);
      // El resultado que ve el modelo (para redactar) y el evento que ve la UI son el mismo objeto.
      // Los descartes van SOLO al modelo (no a la UI): le dicen qué no pudo usar y por qué, para
      // que pueda preguntarlo en vez de improvisarlo.
      return {
        result: {
          ...prop,
          perfil_usado: perfil,
          descartado_por_falta_de_evidencia: descartes.length ? descartes : undefined,
          instruccion_descartes: descartes.length
            ? "Estos campos NO se usaron porque no vinieron de la base ni la persona los dijo. No los " +
              "des por ciertos ni los menciones como si los supieras: si alguno importa, pregúntalo."
            : undefined,
          /*
           * Antes esto decía "NO la menciones ni la aproximes", y un modelo que obedece se CALLA.
           * Ahí se perdía el tercero de los cuatro NO —"no te lo afirmo, no lo sé"—, que es de los
           * momentos que más confianza ganan y el único que este camino puede mostrar.
           *
           * No afirmar y no hablar no son lo mismo. La instrucción ahora pide lo primero.
           */
          // El material del NO honesto, que hasta ahora el modelo tenía que deducir de mirar tres
          // campos distintos. Ver `lib/engine/nos.ts`.
          nos_honestos: nos,
          instruccion_nos: instruccionDeNos(nos),
          instruccion_peer: prop.peer
            ? undefined
            : "No hay prueba social verificada para este perfil: NO afirmes ni aproximes ningún " +
              "número de personas parecidas. Si viene al caso, dilo — que no se lo puedes afirmar y " +
              "por qué —, con tus palabras. Callarlo no es más prudente que decirlo. Si no está " +
              "identificada, puedes invitarla: con su nombre podrías decírselo.",
        },
        event: { type: "propension", data: prop as unknown as Record<string, unknown> },
      };
    }

    case "ofrecer_opciones": {
      // Reemplaza al protocolo `OPCIONES: a | b | c` que el modelo escribía en el texto y el
      // cliente sacaba con una regex — el mismo transporte frágil que `RECOMENDACION:`, que ya se
      // había eliminado por eso mismo. El modelo sigue ELIGIENDO las opciones, que es donde
      // aporta; lo que deja de ser prosa es el transporte.
      const crudas = Array.isArray(input.opciones) ? (input.opciones as unknown[]) : [];
      const opciones = crudas.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 4);
      return {
        result: opciones.length
          ? { ok: true, opciones }
          : { ok: false, nota: "No se ofreció ninguna opción válida: haz la pregunta en texto." },
        // Sin opciones válidas no hay evento: un evento vacío pintaría una fila de botones
        // fantasma.
        event: opciones.length ? { type: "opciones", data: { opciones } } : undefined,
      };
    }

    case "calcular_impacto_ingreso": {
      const impacto = calcularImpacto({
        ingreso_mensual: Number(input.ingreso_mensual ?? 0),
        anos: input.anos_proteccion != null ? Number(input.anos_proteccion) : undefined,
        dependientes: input.dependientes != null ? Number(input.dependientes) : undefined,
      });
      return {
        result: impacto,
        event: { type: "impacto", data: impacto as unknown as Record<string, unknown> },
      };
    }

    case "get_product_details": {
      const p = getProduct(String(input.productId));
      if (!p) return { result: { error: "Producto no encontrado" } };
      return {
        result: {
          id: p.id,
          nombre: p.nombre,
          aseguradora: p.aseguradora,
          estandarizado: p.estandarizado,
          requiere_asesoria: p.requiere_asesoria,
          coberturas: p.coberturas,
          exclusiones: p.exclusiones,
          art9: {
            forma_calculo: p.art9.forma_calculo,
            consecuencias_no_pago: p.art9.consecuencias_no_pago,
          },
          // "¿de cuánto es la póliza?" es la primera pregunta de cualquiera. Si no lo sabemos,
          // se dice; no se inventa ni se sustituye por la calculadora de impacto.
          valor_asegurado: p.valor_asegurado ?? null,
          nota_valor_asegurado: p.nota_valor_asegurado ?? null,
          instruccion_valor_asegurado:
            p.valor_asegurado == null
              ? "El valor asegurado NO está en el catálogo. Si lo preguntan, di la verdad: lo define " +
                "la aseguradora según el plan y lo confirma un asesor. NUNCA inventes una cifra."
              : undefined,
        },
        event: {
          type: "compliance",
          data: { producto: p.nombre, coberturas: p.coberturas, exclusiones: p.exclusiones, art9: p.art9 },
        },
      };
    }

    case "quote_product": {
      const p = getProduct(String(input.productId));
      if (!p) return { result: { error: "Producto no encontrado" } };

      /*
       * COMPUERTA 0 · sin ingreso hoy, no hay precio.
       *
       * Es la garantía más importante del producto —"hoy no te vendo nada"— y hasta ahora lo único
       * que la sostenía era UNA FRASE DEL PROMPT. El motor devolvía `no_venta`, sí, pero nada
       * impedía que el modelo llamara igual a esta tool y pusiera una cifra en pantalla. Una regla
       * de prompt es una petición probabilística; esto es una compuerta.
       *
       * Y al cerrarla aquí, la conversación puede abrirse: el modelo YA PUEDE hablar de lo que
       * existe (`informativo`) sin que eso pueda convertirse en una venta por descuido. Es el mismo
       * intercambio de todo el sistema — el servidor garantiza, el agente conversa.
       *
       * Se lee del TEXTO de la persona, no del perfil acumulado: si dice "me quedé sin trabajo" y
       * pregunta el precio en el mismo turno, el perfil del turno anterior todavía no lo sabe.
       */
      const sinIngresoHoy =
        declaroSinIngresos(normalizar(ctx.textoUsuario ?? "")) ||
        ctx.perfilPrevio?.enriquecido?.sin_ingresos === true;
      if (sinIngresoHoy) {
        return {
          result: {
            error: "SIN_INGRESO_HOY",
            instruccion:
              "La persona dijo que hoy no tiene ingreso, así que NO hay precio: un seguro que no " +
              "se pueda pagar el mes entrante no protege. No des ninguna cifra ni la aproximes. " +
              "Puedes explicar qué es el producto y para qué sirve, y decir que cuando vuelva a " +
              "tener entrada lo tomamos en tres minutos. Si quien pagaría es otra persona, " +
              "ofrécele preparárselo para mostrárselo.",
          },
        };
      }

      // Compuerta: productos que requieren asesoría NO se cotizan por el bot.
      if (p.requiere_asesoria) {
        return {
          result: {
            error: "PRODUCTO_REQUIERE_ASESORIA",
            instruccion: "Este producto requiere asesoría humana. Explícalo y llama escalate_to_human.",
          },
        };
      }
      // Compuerta 2: la tarifa depende de datos que el chat no tiene (cilindraje, tipo de
      // vehículo). Se muestran las coberturas, NUNCA un número — inventarlo o usar el de otra
      // variante (la tarifa de moto para un carro) es peor que no dar precio.
      if (p.precio_tipo === "requiere_datos") {
        return {
          result: {
            sin_precio: true,
            motivo: p.nota_precio ?? "La tarifa depende de datos del vehículo.",
            instruccion:
              "NO des ninguna cifra de prima para este producto. Explica de qué depende la tarifa, " +
              "muestra las coberturas y ofrece confirmarla con los datos del vehículo o con un asesor.",
            coberturas: p.coberturas,
            exclusiones: p.exclusiones,
          },
          event: {
            type: "quote",
            data: {
              producto: p.nombre,
              aseguradora: p.aseguradora,
              prima: null,
              periodicidad: p.periodicidad,
              coberturas: p.coberturas,
              exclusiones: p.exclusiones,
              forma_calculo: p.art9.forma_calculo,
              consecuencias: p.art9.consecuencias_no_pago,
              fuente: p.fuente ?? null,
              precio_tipo: "requiere_datos",
              nota_precio: p.nota_precio ?? null,
              valor_asegurado: p.valor_asegurado ?? null,
              nota_valor_asegurado: p.nota_valor_asegurado ?? null,
            },
          },
        };
      }

      const perfil = (input.perfil ?? {}) as { edad?: number; ciudad?: string; contexto?: string };
      let quote;
      try {
        quote = await gateway.quote(p.id, perfil);
      } catch (e) {
        // Prima no cotizable (catálogo incompleto). Se degrada a asesoría, nunca a un número falso.
        return {
          result: {
            error: "PRIMA_NO_COTIZABLE",
            instruccion:
              "No hay una prima confiable para este producto. NO inventes ninguna cifra: dilo con " +
              "honestidad y llama escalate_to_human.",
            detalle: e instanceof Error ? e.message : String(e),
          },
        };
      }
      return {
        result: {
          ...quote,
          valor_asegurado: p.valor_asegurado ?? null,
          nota_valor_asegurado: p.nota_valor_asegurado ?? null,
          instruccion_valor_asegurado:
            p.valor_asegurado == null
              ? "El valor asegurado NO está definido en el catálogo. Si preguntan de cuánto es la " +
                "póliza, di la verdad: lo define la aseguradora según el plan y lo confirma un asesor. " +
                "NUNCA inventes una cifra ni uses la calculadora de impacto como si fuera la suma asegurada."
              : undefined,
        },
        event: {
          type: "quote",
          data: {
            producto: p.nombre,
            aseguradora: p.aseguradora,
            prima: quote.prima,
            periodicidad: quote.periodicidad,
            coberturas: quote.coberturas,
            quoteId: quote.quoteId,
            // Detalle real desplegable bajo la cotización
            exclusiones: p.exclusiones,
            forma_calculo: p.art9.forma_calculo,
            consecuencias: p.art9.consecuencias_no_pago,
            fuente: p.fuente ?? null,
            precio_tipo: p.precio_tipo ?? "referencia",
            nota_precio: p.nota_precio ?? null,
            valor_asegurado: p.valor_asegurado ?? null,
            nota_valor_asegurado: p.nota_valor_asegurado ?? null,
            edad_usada: quote.edadUsada,
          },
        },
      };
    }

    case "collect_customer_data": {
      const p = getProduct(String(input.productId));
      if (!p) return { result: { error: "Producto no encontrado" } };
      // Última cotización válida: el frontend usa su propio quoteId guardado,
      // aquí solo señalamos que se abra el formulario para este producto.
      // Lo que ya se sabe viaja al formulario. Antes solo iba el producto, así que la pantalla no
      // tenía forma de saber el nombre de alguien a quien acababa de reconocer.
      const conocido = ctx.conocido?.nombre
        ? { nombre: ctx.conocido.nombre, origen: ctx.conocido.origen ?? "declarado" }
        : undefined;
      return {
        result: {
          estado: "FORMULARIO_ABIERTO",
          instruccion:
            "El formulario se abrió en pantalla, con lo que ya sabemos de ella ya escrito. NO le " +
            "pidas esos datos por chat ni se los leas en voz alta: dile en una frase qué falta y " +
            "espera a que lo complete.",
          ya_escrito: conocido ? Object.keys(conocido).filter((k) => k !== "origen") : [],
        },
        event: {
          type: "form",
          data: { productId: p.id, producto: p.nombre, aseguradora: p.aseguradora, conocido },
        },
      };
    }

    case "issue_policy": {
      // COMPUERTA DURA EN SERVIDOR: sin consentimiento no hay emisión,
      // aunque el modelo lo intente. (Ley 1581 + Art. 9 Ley 1328.)
      if (input.consentimiento !== true) {
        return {
          result: {
            error: "CONSENTIMIENTO_REQUERIDO",
            instruccion:
              "No puedes emitir sin autorización explícita de tratamiento de datos. Pide la autorización con la frase exacta del Estado 5.",
          },
        };
      }
      const contacto = input.contacto as unknown as Contacto;
      const camposFaltantes = ["nombre", "tipoDocumento", "numeroDocumento", "fechaNacimiento", "celular", "correo"].filter(
        (c) => !contacto || !(contacto as unknown as Record<string, unknown>)[c]
      );
      if (camposFaltantes.length) {
        return {
          result: { error: "DATOS_INCOMPLETOS", faltan: camposFaltantes, instruccion: "Captura los datos faltantes uno por uno (Estado 6)." },
        };
      }
      const policy = await gateway.issue(String(input.quoteId), contacto);
      const p = getProduct(policy.productId);
      return {
        result: policy,
        event: {
          type: "policy",
          data: {
            policyId: policy.policyId,
            // El estado viaja al evento para que la tarjeta diga la verdad según el adaptador:
            // si algún día uno real devuelve "ACTIVA", la UI no puede seguir diciendo "simulada".
            estado: policy.estado,
            producto: p?.nombre ?? policy.productId,
            aseguradora: p?.aseguradora ?? "",
            asegurado: contacto.nombre,
            prima: policy.prima,
            periodicidad: policy.periodicidad,
            vigenciaMeses: policy.vigenciaMeses,
            certificado: policy.certificado,
          },
        },
      };
    }

    case "escalate_to_human": {
      const motivo = String(input.motivo ?? "sin motivo");
      const ticket = "ESC-" + Date.now().toString(36).toUpperCase();
      return {
        result: { ticket, motivo, mensaje: "Solicitud registrada. Un asesor contactará al afiliado." },
        event: { type: "escalation", data: { ticket, motivo } },
      };
    }

    default:
      return { result: { error: `Tool desconocida: ${name}` } };
  }
}
