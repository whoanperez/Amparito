/**
 * Motor de propensión (scorecard aditivo, determinista y explicable).
 *
 * Regla de oro: el MOTOR calcula, el LLM redacta. Aquí no hay LLM ni aleatoriedad:
 * dado un `Perfil`, sumamos los pesos de las señales que aplican (data/weights.json),
 * aplicamos redundancia (lo que ya tiene → anti-venta) y el gate de asequibilidad por
 * categoría, y devolvemos ranking + reason codes + descartados con razón + ledger + peer.
 */
import weightsData from "../../data/weights.json";
import { getProduct } from "../catalog";
import { lookupPeer, MIN_N as MIN_N_PEER } from "./peer";
import { ejesPeerVerificados } from "./sanear";
import {
  Perfil,
  PropensionResult,
  Matcher,
  ProductoWeights,
  WeightsFile,
  Recomendacion,
  Obligatorio,
  TrazaDecision,
  TrazaProducto,
  Descartado,
  YaCubierto,
} from "./types";

const weights = weightsData as unknown as WeightsFile;

const MAX_RECOMENDACIONES = 2;
// Dos motivos distintos convencen; cuatro plantillas idénticas delatan.
const MAX_DESCARTADOS = 2;
const MAX_REASON_CODES = 4;

/** Marcador interno: las señales `prior.*` (tasas base citadas) siempre aplican. */
const PRIOR = Symbol("prior");

function resolveFeature(perfil: Perfil, feature: string): unknown {
  if (feature.startsWith("enriquecido.")) {
    const k = feature.slice("enriquecido.".length);
    return perfil.enriquecido ? (perfil.enriquecido as Record<string, unknown>)[k] : undefined;
  }
  if (feature.startsWith("marca.")) {
    const k = feature.slice("marca.".length);
    return perfil.marca ? perfil.marca[k] : undefined;
  }
  if (feature.startsWith("prior.")) return PRIOR;
  return (perfil as Record<string, unknown>)[feature];
}

function senalAplica(perfil: Perfil, s: Matcher): boolean {
  const val = resolveFeature(perfil, s.feature);
  if (val === PRIOR) return true;
  if (val === undefined || val === null) return false;

  if (s.en) {
    if (Array.isArray(val)) return val.some((v) => s.en!.includes(String(v)));
    return s.en.includes(String(val));
  }
  if (s.op && s.valor !== undefined) {
    const n = Number(val);
    if (Number.isNaN(n)) return false;
    switch (s.op) {
      case ">=":
        return n >= s.valor;
      case ">":
        return n > s.valor;
      case "<=":
        return n <= s.valor;
      case "<":
        return n < s.valor;
      case "==":
        return n === s.valor;
    }
  }
  if (s.es !== undefined) return val === s.es;
  return false;
}

interface Scored {
  id: string;
  w: ProductoWeights;
  score: number;
  reasons: Array<{ feature: string; razon: string; peso: number }>;
  yaCubierto?: { razon: string };
  hasRealSignal: boolean; // ¿aplicó alguna señal que NO sea un prior (tasa base)?
}

export function calcularPropension(perfil: Perfil): PropensionResult {
  // Sin ingreso hoy no se vende NADA de pago. Ver el corte más abajo: se hace DESPUÉS de puntuar,
  // no antes, porque hay una cosa que sí hay que decirle a esa persona — ver `sinIngresos`.
  const sinIngresos = Boolean(perfil.enriquecido?.sin_ingresos);

  const cat = perfil.CATEGORIA ?? "";
  const gate = weights.gate_affordability[cat] ?? weights.gate_affordability["(vacío)"];
  const primaBajaPrimero = Boolean(gate?.prioriza_prima_baja);

  const scored: Scored[] = Object.entries(weights.productos)
    // Guarda: solo productos con entrada real en el catálogo (evita crashes por id huérfano).
    .filter(([id]) => getProduct(id) !== undefined)
    // Gate de posesión: un producto que exige una posesión (carro, vivienda, moto…) NO se considera
    // si el perfil no declara ninguna. Evita ofrecer "Todo Riesgo Carro" a quien no tiene carro.
    .filter(([, w]) => !w.requiere?.length || w.requiere.some((r) => senalAplica(perfil, r)))
    .map(([id, w]) => {
      let score = 0;
      let hasRealSignal = false;
      // `feature` se guarda además de la razón: la traza tiene que poder decir QUÉ campo del
      // perfil disparó cada señal, no solo qué dice. Es la diferencia entre explicar y afirmar.
      const reasons: Array<{ feature: string; razon: string; peso: number }> = [];
      for (const s of w["señales"]) {
        if (senalAplica(perfil, s)) {
          score += s.peso;
          reasons.push({ feature: s.feature, razon: s.razon, peso: s.peso });
          if (!s.feature.startsWith("prior.")) hasRealSignal = true;
        }
      }
      let yaCubierto: { razon: string } | undefined;
      for (const r of w.redundancia ?? []) {
        if ((perfil.ya_cubierto ?? []).includes(r.si_tiene)) {
          score += r.peso;
          yaCubierto = { razon: r.razon };
          reasons.push({ feature: `ya_cubierto.${r.si_tiene}`, razon: r.razon, peso: r.peso });
        }
      }
      reasons.sort((a, b) => b.peso - a.peso);
      return { id, w, score, reasons, yaCubierto, hasRealSignal };
    });

  // Anti-venta: productos cuya redundancia disparó → salen del ranking, van al ledger.
  const yaCubiertoList: YaCubierto[] = scored
    .filter((x) => x.yaCubierto)
    .map((x) => ({ producto: getProduct(x.id)?.nombre ?? x.id, razon: x.yaCubierto!.razon }));

  const primaBase = (id: string) => getProduct(id)?.prima_regla.base ?? Number.MAX_SAFE_INTEGER;

  // Jerarquía de protección: cuando hay personas que dependen de ese ingreso, reemplazarlo va
  // antes que proteger un bien o un gusto. Sin esta capa, alguien que sostiene sola su hogar y
  // menciona que tiene perro recibía Mascotas (57) por encima de Vida (55).
  const GRUPOS_SOSTEN = ["Monoparental", "Monoparental ampliada"];
  const sostieneAOtros =
    (perfil.enriquecido?.dependientes ?? 0) >= 1 ||
    GRUPOS_SOSTEN.includes(perfil.SEGMENTO_GRUPO_FAMILIAR ?? "");

  const ordenar = (a: Scored, b: Scored) => {
    // Prioridad por encima del score: no recalibra ningún peso, cambia el orden.
    if (sostieneAOtros) {
      const pa = a.w.protege_ingreso ? 1 : 0;
      const pb = b.w.protege_ingreso ? 1 : 0;
      if (pa !== pb) return pb - pa;
    }
    if (b.score !== a.score) return b.score - a.score;
    // Desempate 1: cat A prioriza prima baja (gate de asequibilidad).
    if (primaBajaPrimero) {
      const d = primaBase(a.id) - primaBase(b.id);
      if (d !== 0) return d;
    }
    // Desempate final: estable y determinista (nunca depende del orden del JSON).
    return a.id.localeCompare(b.id);
  };

  // Obligatorios por ley que la persona NO tiene. Salen ANTES del ranking y no compiten por un
  // cupo: el SOAT perdía contra Vida y terminaba en descartados con un "esto lo puedes sumar más
  // adelante" — sobre un seguro sin el cual inmovilizan el vehículo.
  const obligatorios: Obligatorio[] = scored
    .filter((x) => x.w.obligatorio_legal && !x.yaCubierto && x.hasRealSignal)
    .sort(ordenar)
    .map((x) => {
      const p = getProduct(x.id)!;
      return {
        id: x.id,
        nombre: p.nombre,
        aseguradora: p.aseguradora,
        razon: x.reasons[0]?.razon ?? "Obligatorio por ley para tu vehículo.",
        consecuencia: x.w.consecuencia_legal ?? "No tenerlo tiene consecuencias legales.",
      };
    });
  const obligIds = new Set(obligatorios.map((o) => o.id));

  // El segundo NO, y el que más confianza gana: sin ingreso hoy no se recomienda NINGÚN producto de
  // pago —ni el más barato— porque un seguro que no se puede sostener el mes entrante no protege,
  // aprieta. Y Colsubsidio no es una aseguradora: es una caja, y tiene qué ofrecer en ese momento.
  //
  // PERO la banda de obligatorios SÍ sobrevive, y esto es criterio, no inconsistencia: no mencionarle
  // el SOAT a alguien que trabaja en su moto lo deja expuesto a que se la inmovilicen, y eso le
  // cuesta más que la prima — le cuesta el ingreso del día. Advertir de una obligación legal es
  // INFORMACIÓN, no una venta. Un asesor humano lo diría; el sistema también debe.
  if (sinIngresos) {
    /*
     * `no_venta` significa "no te lo vendo", NO "no hay nada para ti".
     *
     * Antes esto devolvía cero y ahí se acababa la conversación. Para quien llega pidiendo algo
     * concreto —"quiero dejar algo para que mis hijos no carguen con el entierro"— eso es
     * despedirla con cortesía: el motor sabía perfectamente que lo suyo era un exequial (lo puntúa
     * 35, con razón real) y el prompt prohibía mencionarlo.
     *
     * `informativo` es el producto mejor puntuado CON señal real —nada de priors— y viaja sin
     * prima y sin quoteId. No puede convertirse en venta por descuido: la cotización está cerrada
     * por compuerta en servidor, no por una frase del prompt.
     */
    const mejor = scored.filter((x) => x.hasRealSignal && !x.yaCubierto && x.score > 0).sort(ordenar)[0];
    const prod = mejor ? getProduct(mejor.id) : undefined;

    return {
      recomendaciones: [],
      obligatorios,
      descartados: [],
      informativo:
        mejor && prod
          ? {
              id: mejor.id,
              nombre: prod.nombre,
              aseguradora: prod.aseguradora,
              razon: mejor.reasons[0]?.razon ?? "Responde a lo que contaste.",
            }
          : undefined,
      no_venta: {
        motivo:
          "Hoy no hay ingreso con qué sostener una póliza. Un seguro que no se pueda pagar el mes " +
          "entrante no protege: aprieta.",
        // Distingue lo que aplica a CUALQUIERA de lo que depende de estar afiliado. La versión
        // anterior afirmaba "como afiliado de Colsubsidio te puede corresponder…" a todo el mundo,
        // incluida gente que no está afiliada — y se lo decía en el momento más delicado de la
        // conversación, justo después de contar que se quedó sin ingreso.
        // TODO(negocio): confirmar que la agencia de empleo atiende también a no afiliados. Si no
        // fuera así, esta frase se cae entera; no se deja "por si acaso".
        alternativa:
          "La agencia de empleo de Colsubsidio te puede ayudar a buscar trabajo, estés afiliado o " +
          "no. Y si estás afiliado, además te puede corresponder el subsidio al desempleo.",
      },
      ledger: { riesgos_hoy: [], ya_cubierto: yaCubiertoList },
      peer: null,
      // Negarse a vender también es una decisión, y es la que más vale poder demostrar. Sin esto,
      // la única ruta del motor sin traza sería justamente la más delicada.
      traza: {
        version_reglas: String((weights as unknown as { _meta?: { version?: unknown } })._meta?.version ?? "?"),
        perfil,
        gate_asequibilidad: { categoria: cat || "(vacío)", prioriza_prima_baja: primaBajaPrimero },
        jerarquia_aplicada: false,
        peer: { afirmada: false, motivo: "no se evalúa: no hay recomendación que sustentar" },
        productos: scored
          .map((x) => ({
            id: x.id,
            nombre: getProduct(x.id)?.nombre ?? x.id,
            score: x.score,
            senales: x.reasons,
            resultado: (obligIds.has(x.id) ? "obligatorio" : "fuera_del_top") as TrazaProducto["resultado"],
          }))
          .sort((a, b) => b.score - a.score),
      },
    };
  }

  // Recomendaciones: con señal REAL (no solo un prior), no ya-cubierto, que cierran solas.
  const recomendaciones: Recomendacion[] = scored
    .filter((x) => !x.yaCubierto && x.score > 0 && x.hasRealSignal && !x.w.requiere_asesoria && !obligIds.has(x.id))
    .sort(ordenar)
    .slice(0, MAX_RECOMENDACIONES)
    .map((x) => {
      const p = getProduct(x.id)!;
      return {
        id: x.id,
        nombre: p.nombre,
        aseguradora: p.aseguradora,
        linea: x.w.linea,
        score: x.score,
        requiere_asesoria: x.w.requiere_asesoria,
        reason_codes: x.reasons.map((r) => r.razon).slice(0, MAX_REASON_CODES),
      };
    });

  const recIds = new Set(recomendaciones.map((r) => r.id));
  const topNombre = recomendaciones[0]?.nombre;

  // Descartados: tuvieron señal REAL pero no entraron al top → con motivo honesto.
  // (Un producto empujado solo por un prior —ej. Mascotas por la tasa DANE— no se lista.)
  // Un obligatorio NUNCA puede aparecer aquí: no es "menor prioridad", es la ley.
  const descartados: Descartado[] = scored
    .filter((x) => !x.yaCubierto && x.score > 0 && x.hasRealSignal && !recIds.has(x.id) && !obligIds.has(x.id))
    .sort(ordenar)
    .slice(0, MAX_DESCARTADOS)
    .map((x) => ({ id: x.id, nombre: getProduct(x.id)!.nombre, motivo: motivoDescarte(x, topNombre) }));

  const riesgos_hoy = recomendaciones[0]?.reason_codes ?? [];

  // Explicabilidad: si la jerarquía movió el orden, hay que poder decir por qué. Un jurado
  // pregunta "¿por qué Vida primero si Mascotas puntúa más alto?" y la respuesta debe estar
  // en pantalla, no en la cabeza de quien presenta.
  const jerarquiaAplicada =
    sostieneAOtros &&
    !!recomendaciones[0] &&
    !!scored.find((x) => x.id === recomendaciones[0].id)?.w.protege_ingreso &&
    recomendaciones.some((r, i) => i > 0 && r.score > recomendaciones[0].score);

  const peerResult = lookupPeer(perfil);

  // RNF-6 · traza auditable. Se arma AQUÍ porque solo ahora se sabe dónde terminó cada producto.
  // El motivo del descarte YA estaba escrito; lo que faltaba era que llegara a la traza. Se indexa
  // por id para no volver a calcularlo: una sola fuente, la misma que ve la persona en el chat.
  const motivoPorId = new Map(descartados.map((d) => [d.id, d.motivo]));
  const descIds = new Set(descartados.map((d) => d.id));
  const cubiertoIds = new Set(scored.filter((x) => x.yaCubierto).map((x) => x.id));
  const traza: TrazaDecision = {
    version_reglas: String((weights as unknown as { _meta?: { version?: unknown } })._meta?.version ?? "?"),
    perfil, // trae `_origen`: la procedencia de cada campo
    gate_asequibilidad: { categoria: cat || "(vacío)", prioriza_prima_baja: primaBajaPrimero },
    jerarquia_aplicada: jerarquiaAplicada,
    peer: peerResult
      ? { afirmada: true, motivo: `celda encontrada con n=${peerResult.n} (umbral mínimo ${MIN_N_PEER})` }
      : {
          afirmada: false,
          motivo: perfil._origen && !ejesPeerVerificados(perfil)
            ? "los 4 ejes del peer-group no están verificados (base o declarados)"
            : "no hay celda para este segmento, o su tamaño está bajo el umbral mínimo",
        },
    productos: scored
      .map((x) => ({
        id: x.id,
        nombre: getProduct(x.id)?.nombre ?? x.id,
        score: x.score,
        senales: x.reasons,
        motivo: motivoPorId.get(x.id) ?? x.yaCubierto?.razon,
        resultado: (obligIds.has(x.id)
          ? "obligatorio"
          : cubiertoIds.has(x.id)
            ? "ya_cubierto"
            : recIds.has(x.id)
              ? "recomendado"
              : descIds.has(x.id)
                ? "descartado"
                : "fuera_del_top") as TrazaProducto["resultado"],
      }))
      .sort((a, b) => b.score - a.score),
  };

  return {
    recomendaciones,
    traza,
    obligatorios,
    jerarquia: jerarquiaAplicada
      ? "Primero lo que reemplaza tu ingreso: hay personas que dependen de él. Lo demás va después, aunque encaje bien."
      : undefined,
    descartados,
    ledger: { riesgos_hoy, ya_cubierto: yaCubiertoList },
    peer: peerResult,
  };
}

function motivoDescarte(x: Scored, topNombre?: string): string {
  // El motivo específico del producto manda: la plantilla genérica producía viñetas idénticas.
  if (x.w.motivo_descarte) return x.w.motivo_descarte;
  if (x.w.requiere_asesoria) {
    return "Requiere asesoría personalizada; te conecto con un asesor si te interesa.";
  }
  if (topNombre) {
    return `Hoy tu prioridad es ${topNombre.toLowerCase()}; esto lo puedes sumar más adelante.`;
  }
  return "Menor prioridad para tu situación de hoy.";
}
