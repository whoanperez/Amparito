import Anthropic from "@anthropic-ai/sdk";
import { getCatalog, getProduct, recommendProducts } from "./catalog";
import { getInsurerGateway } from "./insurer/mock-adapter";
import { Contacto } from "./insurer/gateway";
import { calcularPropension } from "./engine/scorecard";
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
];

/** Evento estructurado que la UI renderiza como tarjeta. */
export interface UiEvent {
  type: "quote" | "policy" | "escalation" | "compliance" | "form" | "propension";
  data: Record<string, unknown>;
}

/** Ejecuta una tool y devuelve {result, event?}. Compuertas de cumplimiento EN SERVIDOR. */
export async function executeTool(
  name: string,
  input: Record<string, unknown>
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
      const perfil = (input.perfil ?? {}) as Perfil;
      const prop = calcularPropension(perfil);
      // El resultado que ve el modelo (para redactar) y el evento que ve la UI son el mismo objeto.
      return {
        result: prop,
        event: { type: "propension", data: prop as unknown as Record<string, unknown> },
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
      // Compuerta: productos que requieren asesoría NO se cotizan por el bot.
      if (p.requiere_asesoria) {
        return {
          result: {
            error: "PRODUCTO_REQUIERE_ASESORIA",
            instruccion: "Este producto requiere asesoría humana. Explícalo y llama escalate_to_human.",
          },
        };
      }
      const perfil = (input.perfil ?? {}) as { edad?: number; ciudad?: string; contexto?: string };
      const quote = await gateway.quote(p.id, perfil);
      return {
        result: quote,
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
          },
        },
      };
    }

    case "collect_customer_data": {
      const p = getProduct(String(input.productId));
      if (!p) return { result: { error: "Producto no encontrado" } };
      // Última cotización válida: el frontend usa su propio quoteId guardado,
      // aquí solo señalamos que se abra el formulario para este producto.
      return {
        result: { estado: "FORMULARIO_ABIERTO", instruccion: "El formulario se abrió en pantalla. Espera a que la persona lo complete." },
        event: { type: "form", data: { productId: p.id, producto: p.nombre, aseguradora: p.aseguradora } },
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
