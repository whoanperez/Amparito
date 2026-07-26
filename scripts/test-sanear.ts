/**
 * Gate de la compuerta de entrada del motor (B3 · RNF-7).
 *   npx tsx scripts/test-sanear.ts
 *
 * Reproduce la conversación REAL que expuso el problema: la persona nunca dijo dónde vive, el
 * modelo mandó `vivienda:"propia"` (había contestado "propio" hablando de su carro, tras una
 * pregunta de doble cañón) y eso decidió la venta. Y mandó `CATEGORIA:"B"` para alguien que
 * acababa de decir que no tiene ingresos, apagando `prioriza_prima_baja`.
 */
import { sanearPerfil, resumenEvidencia, edadDicha } from "../lib/engine/sanear";
import { calcularPropension } from "../lib/engine/scorecard";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

/* ── 1 · la conversación real de Mauricio ────────────────────────────────── */
console.log("===== Conversación real (no identificado) =====");

// Textual: solo lo que ÉL escribió. La palabra "vivienda" solo apareció en el mensaje de Amparito.
const textoUsuario = [
  "soy Mauricio Cajamarca",
  "si busco un seguro para mi, no se que me puedes ofrecer",
  "tengo familia, y no tengo trabajo",
  "no tengo ingresos",
  "mi esposa",
  "si ella trabaja en una empresa",
  "si carro",
  "propio",
  "uso personal",
].join("\n");

// Exactamente lo que el modelo mandó al motor (reconstruido de la tarjeta que se mostró).
const loQueMandoElModelo = {
  GENERO: "M",
  RANGO_EDAD: "36 a 45 años",
  CATEGORIA: "B",
  SEGMENTO_GRUPO_FAMILIAR: "Pareja conyugal",
  enriquecido: { tiene_vehiculo: ["carro"], vivienda: "propia" },
};

const { perfil, descartes } = sanearPerfil(loQueMandoElModelo, { textoUsuario });
console.log("   perfil que llega al motor:", JSON.stringify(perfil));
console.log("   descartes:");
descartes.forEach((d) => console.log(`     · ${d}`));

check("CATEGORIA descartada (no vino de la base)", perfil.CATEGORIA === undefined);
check("RANGO_EDAD descartada (nunca dijo su edad)", perfil.RANGO_EDAD === undefined);
check("GENERO descartado (no lo declaró)", perfil.GENERO === undefined);
check("vivienda DESCARTADA (nunca habló de su vivienda)", perfil.enriquecido?.vivienda === undefined);
check("carro SÍ aceptado (dijo 'si carro')", perfil.enriquecido?.tiene_vehiculo?.includes("carro") === true);
check("grupo familiar aceptado como inferido ('mi esposa')", perfil.SEGMENTO_GRUPO_FAMILIAR === "Pareja conyugal");
check("origen del grupo familiar = inferido", perfil._origen?.SEGMENTO_GRUPO_FAMILIAR === "inferido");

const r = calcularPropension(perfil);
console.log("   recomendaciones:", r.recomendaciones.map((x) => `${x.nombre} (${x.score})`).join("  ·  ") || "—");
/*
 * Aquí había `r.recomendaciones[0]?.nombre !== "Seguro de Hogar y Contenidos"`. Con este perfil
 * el texto contiene "no tengo ingresos", así que el motor devuelve `no_venta` y la lista viene
 * VACÍA: `undefined !== "Hogar"` es siempre cierto. Pasaba igual si el motor se hubiera roto
 * entero, y afirmar la AUSENCIA de algo sobre una lista vacía no prueba nada.
 */
check("el motor se pronuncia: hoy no se vende", !!r.no_venta);
check("y por tanto no hay recomendaciones de pago", r.recomendaciones.length === 0);
check("prueba social AUSENTE (los 4 ejes no están verificados)", r.peer === null);

/*
 * Lo que de verdad prueba que la compuerta CAMBIA el resultado es un diferencial: el mismo perfil
 * del modelo, con y sin saneamiento, sobre un texto donde la persona sí tiene ingresos (para que
 * el `no_venta` no tape el efecto). Sin compuerta, el `vivienda:"propia"` inventado mete Hogar en
 * el ranking — que es la venta que se decidió en la conversación real por un dato falso.
 */
const textoConIngresos = textoUsuario
  .replace("tengo familia, y no tengo trabajo\n", "tengo familia\n")
  .replace("no tengo ingresos\n", "");
const conCompuerta = calcularPropension(sanearPerfil(loQueMandoElModelo, { textoUsuario: textoConIngresos }).perfil);
const sinCompuerta = calcularPropension(loQueMandoElModelo as Parameters<typeof calcularPropension>[0]);
const hayHogar = (x: { recomendaciones: { nombre: string }[] }) =>
  x.recomendaciones.some((p) => /Hogar/i.test(p.nombre));
check("SIN compuerta, el dato falso mete Hogar en el ranking", hayHogar(sinCompuerta),
  `→ ${sinCompuerta.recomendaciones.map((x) => x.nombre).join(", ") || "—"}`);
check("CON compuerta, Hogar desaparece", !hayHogar(conCompuerta),
  `→ ${conCompuerta.recomendaciones.map((x) => x.nombre).join(", ") || "—"}`);

/* ── 2 · afiliado reconocido: el segmento de la base SÍ manda ────────────── */
console.log("\n===== Afiliado reconocido (segmento de la base) =====");
const conBase = sanearPerfil(
  { CATEGORIA: "C", RANGO_EDAD: "Menor de 19 años" }, // el modelo propone basura
  {
    textoUsuario: "hola",
    segmentoBase: {
      GENERO: "F", RANGO_EDAD: "36 a 45 años", CATEGORIA: "A",
      SEGMENTO_GRUPO_FAMILIAR: "Monoparental", SEGMENTO_POBLACIONAL: "Medio",
    },
  }
);
console.log("   perfil:", JSON.stringify(conBase.perfil));
check("la base manda sobre lo que propone el modelo (CATEGORIA=A, no C)", conBase.perfil.CATEGORIA === "A");
check("origen marcado como base", conBase.perfil._origen?.CATEGORIA === "base");
const rBase = calcularPropension(conBase.perfil);
check("prueba social PRESENTE (4 ejes verificados)", rBase.peer !== null);
console.log(`   peer: ${rBase.peer ? `${rBase.peer.n.toLocaleString("es-CO")} — ${rBase.peer.descripcion}` : "—"}`);

/* ── 3 · casos sueltos ───────────────────────────────────────────────────── */
console.log("\n===== Casos sueltos =====");
check(
  "valor fuera del enum se cae",
  sanearPerfil({ CATEGORIA: "Z", SEGMENTO_GRUPO_FAMILIAR: "Inventado" }, { textoUsuario: "" }).perfil.SEGMENTO_GRUPO_FAMILIAR === undefined
);
check(
  "moto no se acepta si solo habló de carro",
  sanearPerfil({ enriquecido: { tiene_vehiculo: ["carro", "moto"] } }, { textoUsuario: "tengo carro" })
    .perfil.enriquecido?.tiene_vehiculo?.join() === "carro"
);
check(
  "vivienda SÍ se acepta cuando de verdad la mencionó",
  sanearPerfil({ enriquecido: { vivienda: "propia" } }, { textoUsuario: "mi casa es propia" })
    .perfil.enriquecido?.vivienda === "propia"
);
check(
  "edad declarada se acepta",
  sanearPerfil({ RANGO_EDAD: "36 a 45 años" }, { textoUsuario: "tengo 39 años" }).perfil.RANGO_EDAD === "36 a 45 años"
);
check(
  "marca.* no se acepta desde la conversación",
  sanearPerfil({ marca: { VIVIENDA: "SI" } }, { textoUsuario: "hola" }).perfil.marca === undefined
);

/* ── 4 · el perfil acumulado es un PISO, no un reemplazo ─────────────────────
   El hallazgo más profundo del sistema: el perfil lo re-inferí­a el LLM en cada turno y `_origen`
   —del que depende la prueba social— nacía y moría dentro del mismo request. El motor, la pieza
   determinista y auditable, recibía cada turno un input retecleado por el componente menos
   determinista.

   El piso es de fiar porque el perfil previo llega dentro del estado SELLADO: ya pasó por esta
   misma compuerta en su turno, y el HMAC impide que el navegador lo edite por el camino. */
console.log("\n===== El perfil acumulado (piso, no reemplazo) =====");

const turno1 = sanearPerfil(
  { enriquecido: { tiene_vehiculo: ["moto"] } },
  { textoUsuario: "tengo una moto y la uso para trabajar" }
);
check("turno 1 · la compuerta acepta la moto", turno1.perfil.enriquecido?.tiene_vehiculo?.join() === "moto");
check("turno 1 · con su procedencia", turno1.perfil._origen?.["enriquecido.tiene_vehiculo"] === "declarado");

// Turno 2: el modelo NO retranscribe nada. Antes, aquí se perdía todo.
const turno2 = sanearPerfil(
  {},
  { textoUsuario: "tengo una moto y la uso para trabajar\n¿y eso qué cubre?", perfilPrevio: turno1.perfil }
);
check("turno 2 · la moto sigue ahí aunque el modelo no la mande",
  turno2.perfil.enriquecido?.tiene_vehiculo?.join() === "moto");
check("turno 2 · y su procedencia también", turno2.perfil._origen?.["enriquecido.tiene_vehiculo"] === "declarado");

// Y el caso que de verdad importa: el modelo manda algo DISTINTO, no nada. Con una asignación
// en vez de una unión, la moto desaparecía — justo lo contrario de lo que el piso promete. El
// test anterior no lo distinguía porque solo probaba el caso fácil (el modelo no manda nada).
const turno2b = sanearPerfil(
  { enriquecido: { tiene_vehiculo: ["carro"] } },
  { textoUsuario: "tengo una moto y también un carro", perfilPrevio: turno1.perfil }
);
check("un vehículo nuevo se SUMA al ya conocido",
  (turno2b.perfil.enriquecido?.tiene_vehiculo ?? []).slice().sort().join() === "carro,moto");

const yaCubierto1 = sanearPerfil({ ya_cubierto: ["exequial"] }, { textoUsuario: "tengo exequial" });
const yaCubierto2 = sanearPerfil(
  { ya_cubierto: ["vida"] },
  { textoUsuario: "tengo exequial y vida", perfilPrevio: yaCubierto1.perfil }
);
check("una cobertura nueva se SUMA a la ya conocida",
  (yaCubierto2.perfil.ya_cubierto ?? []).slice().sort().join() === "exequial,vida");

// El piso no relaja la compuerta: lo que el modelo propone AHORA sigue verificándose.
const turno3 = sanearPerfil(
  { enriquecido: { vivienda: "propia" } },
  { textoUsuario: "tengo una moto y la uso para trabajar", perfilPrevio: turno2.perfil }
);
check("el piso NO relaja la compuerta: vivienda sin evidencia se sigue cayendo",
  turno3.perfil.enriquecido?.vivienda === undefined);
check("y se explica por qué", turno3.descartes.some((d) => d.includes("vivienda")));
check("mientras lo ya ganado se conserva", turno3.perfil.enriquecido?.tiene_vehiculo?.join() === "moto");

// El segmento de la base sigue mandando por encima del piso.
const conBaseNueva = sanearPerfil(
  {},
  { textoUsuario: "hola", perfilPrevio: { CATEGORIA: "C", _origen: { CATEGORIA: "base" } }, segmentoBase: { CATEGORIA: "A" } }
);
check("la base manda sobre el piso", conBaseNueva.perfil.CATEGORIA === "A");

/* ── 5 · el resumen de evidencia usa texto Y perfil ────────────────────────── */
console.log("\n===== Lo que ya te contó =====");
const soloTexto = resumenEvidencia("tengo una moto") ?? "";
check("el texto solo ya reconoce la moto", soloTexto.includes("moto"));
// Un campo confirmado en un turno anterior cuenta como sabido aunque el texto de ESTE turno no
// lo mencione: es lo que impide repreguntar lo mismo tres turnos después.
const conPerfil = resumenEvidencia("¿y eso qué cubre?", turno2.perfil) ?? "";
check("un campo ya confirmado cuenta como sabido", conPerfil.includes("moto"));
check("y por tanto no aparece como pendiente", !/Falta por saber:[^\n]*vehículo/.test(conPerfil));

/* ── 6 · `ya_cubierto`: el campo que se aceptaba sin evidencia ─────────────── */
/*
 * POR QUÉ. Era el único campo del perfil que entraba sin verificarse contra el texto y sin
 * registrar procedencia — y es el que más pesa: el scorecard le resta 100 puntos al producto
 * marcado. Un modelo que escriba `ya_cubierto: ["vida"]` por su cuenta SUPRIME una recomendación
 * sin que la persona vea nunca lo que se le quitó. Espejo exacto del defecto de `sin_ingresos`.
 *
 * El caso peligroso es el tercero: "quiero un seguro de vida" contiene la palabra "vida", así que
 * una compuerta que solo busque el término apagaría justo el producto que la persona acaba de
 * pedir. Se exige posesión y se descarta intención, en la misma oración.
 */
console.log("\n===== ya_cubierto exige que lo hayas dicho =====");

const ACEPTA: Array<[string, string]> = [
  ["vida", "ya tengo un seguro de vida con Colsubsidio"],
  ["soat", "tengo el SOAT al día"],
  ["exequial", "ya tengo exequial, mi mamá lo pagó"],
  ["hogar", "tengo asegurada la casa"],
  ["accidentes", "mi empresa me cubre con accidentes personales"],
  ["mascota", "cuento con un seguro de mascota para mi perro"],
];
for (const [cob, texto] of ACEPTA) {
  const s = sanearPerfil({ ya_cubierto: [cob] }, { textoUsuario: texto });
  check(`"${texto}" → ${cob} entra`, (s.perfil.ya_cubierto ?? []).includes(cob));
  check(`  …y queda registrado como declarado`, s.perfil._origen?.ya_cubierto === "declarado");
}

const RECHAZA: Array<[string, string]> = [
  ["vida", "quiero un seguro de vida"],
  ["vida", "no tengo seguro de vida"],
  ["vida", "estoy buscando algo de vida para mi familia"],
  ["exequial", "estoy pensando en un plan funerario"],
  ["accidentes", "me interesa cotizar accidentes personales"],
  ["soat", "necesito sacar el SOAT"],
  ["hogar", "quiero proteger mi hogar"],
];
for (const [cob, texto] of RECHAZA) {
  const s = sanearPerfil({ ya_cubierto: [cob] }, { textoUsuario: texto });
  check(`"${texto}" → ${cob} NO entra`, !(s.perfil.ya_cubierto ?? []).includes(cob));
  check(`  …y queda el descarte`, s.descartes.some((d) => d.includes(`ya_cubierto.${cob}`)));
}

// La consecuencia real, de punta a punta: sin la compuerta, el producto pedido desaparece.
const inventado = sanearPerfil({ ya_cubierto: ["vida"] }, { textoUsuario: "quiero un seguro de vida para mi familia" });
const rInventado = calcularPropension({ ...inventado.perfil, SEGMENTO_GRUPO_FAMILIAR: "Nuclear integral" });
check("el modelo no puede apagar el producto que la persona acaba de pedir",
  rInventado.recomendaciones.some((r) => /Vida/i.test(r.nombre)),
  `→ ${rInventado.recomendaciones.map((r) => r.nombre).join(", ") || "ninguna"}`);

// Lo ganado no se vuelve a pedir: la evidencia se dio en el turno en que se dio.
const t1 = sanearPerfil({ ya_cubierto: ["exequial"] }, { textoUsuario: "ya tengo exequial" });
const t2 = sanearPerfil(
  { ya_cubierto: ["exequial"] },
  { textoUsuario: "¿y eso qué cubre?", perfilPrevio: t1.perfil }
);
check("una cobertura ya aceptada sobrevive aunque este turno no la mencione",
  (t2.perfil.ya_cubierto ?? []).includes("exequial"));
check("y conserva su procedencia", t2.perfil._origen?.ya_cubierto === "declarado");

/* ── 7 · la dependencia tiene DIRECCIÓN (B14 · 5a) ────────────────────────── */
/*
 * POR QUÉ. "Tengo dos hijos que dependen de mí" y "yo dependo de mi hija" comparten casi todas las
 * palabras y significan lo contrario. `dependientes` entraba sin mirar ninguna de las dos.
 *
 * Y no es un matiz: vale +25 hacia el Seguro de Vida y enciende la jerarquía de protección del
 * ingreso. Invertido, el motor le ofrece proteger un ingreso que no tiene a alguien a quien su
 * familia mantiene — que es exactamente el caso de Rosa.
 */
console.log("\n===== La dependencia tiene dirección =====");

const INVIERTE = [
  "yo dependo de mi hija, ella me mantiene",
  "vivo con mi hija y ella responde por mí",
  "mi hijo me mantiene",
  "dependo de mis papás",
  "ellos me sostienen",
  "mi esposa me cubre los gastos",
  "vivo de lo que me dan mis hijos",
];
for (const t of INVIERTE) {
  const s = sanearPerfil({ enriquecido: { dependientes: 1 } }, { textoUsuario: t });
  check(`"${t}" → se cae`, s.perfil.enriquecido?.dependientes === undefined);
  check("  …y el descarte le dice al modelo qué pasó",
    s.descartes.some((d) => d.startsWith("dependientes") && /ELLA depende de otros/.test(d)));
}

/*
 * El otro lado, que es donde una compuerta mal hecha haría más daño que el bug: si esto se pasa de
 * estricto, deja de reconocer a quien SÍ sostiene a alguien — y ese es el caso de Carolina, el
 * corazón del producto. Los dos últimos son los que casi lo rompen: hablan de depender, pero de
 * algo, no de alguien.
 */
const NO_INVIERTE = [
  "tengo dos hijos que dependen de mí",
  "soy el único ingreso de mi casa",
  "mis hijos dependen de mí",
  "vivo con mi esposa y dos hijos",
  "tengo familia y respondo por ellos",
  "dependo de mi trabajo",
  "dependo de mi pensión",
];
for (const t of NO_INVIERTE) {
  const s = sanearPerfil({ enriquecido: { dependientes: 2 } }, { textoUsuario: t });
  check(`"${t}" → sigue entrando`, s.perfil.enriquecido?.dependientes === 2);
}

/*
 * El otro camino hacia Vida, encontrado al revisar el veto: `SEGMENTO_GRUPO_FAMILIAR` no es una
 * etiqueta neutra. "Monoparental" hace que el scorecard diga "eres el sostén de un hogar
 * monoparental" y vale +35. Con solo vetar `dependientes`, Vida volvía con score 45 — recomendado.
 */
const conGrupo = sanearPerfil(
  { SEGMENTO_GRUPO_FAMILIAR: "Monoparental", enriquecido: { dependientes: 1 } },
  { textoUsuario: "yo dependo de mi hija, ella me mantiene" }
);
check("el grupo familiar PROPUESTO también se cae si contradice lo declarado",
  conGrupo.perfil.SEGMENTO_GRUPO_FAMILIAR === undefined);

// Pero lo VERIFICADO manda: el servidor no sobrescribe la base, solo impide que el modelo la
// contradiga. Si Colsubsidio dice que es cabeza de hogar, eso se respeta y se conversa.
const deLaBase = sanearPerfil({}, {
  textoUsuario: "yo dependo de mi hija, ella me mantiene",
  segmentoBase: { SEGMENTO_GRUPO_FAMILIAR: "Monoparental" },
});
check("y lo que vino de la base NO se toca",
  deLaBase.perfil.SEGMENTO_GRUPO_FAMILIAR === "Monoparental" &&
  deLaBase.perfil._origen?.SEGMENTO_GRUPO_FAMILIAR === "base");

/*
 * EL CAMINO REAL, y el que casi se me escapa. Nadie abre diciendo "yo dependo de mi hija": dice
 * "vivo con mi hija" y lo aclara un turno después. Con el veto puesto solo a la ENTRADA, lo que ya
 * estaba en el perfil acumulado sobrevivía y el motor seguía recomendando Vida. La inversión no es
 * un filtro de entrada: es una corrección del expediente.
 */
const antes = sanearPerfil(
  { SEGMENTO_GRUPO_FAMILIAR: "Monoparental", enriquecido: { dependientes: 2 } },
  { textoUsuario: "vivo con mi hija y mi nieto" }
);
check("turno 1 · el modelo infiere algo razonable y entra",
  antes.perfil.SEGMENTO_GRUPO_FAMILIAR === "Monoparental" && antes.perfil.enriquecido?.dependientes === 2);

const despues = sanearPerfil(
  { SEGMENTO_GRUPO_FAMILIAR: "Monoparental", enriquecido: { dependientes: 2 } },
  {
    textoUsuario: "vivo con mi hija y mi nieto\nen realidad yo dependo de mi hija, ella me mantiene",
    perfilPrevio: antes.perfil,
  }
);
check("turno 2 · la aclaración BORRA lo que el piso traía (dependientes)",
  despues.perfil.enriquecido?.dependientes === undefined);
check("turno 2 · y también el grupo familiar que ya estaba",
  despues.perfil.SEGMENTO_GRUPO_FAMILIAR === undefined);
check("turno 2 · con sus dos descartes, para que el modelo sepa por qué",
  despues.descartes.some((d) => d.startsWith("dependientes")) &&
  despues.descartes.some((d) => d.startsWith("SEGMENTO_GRUPO_FAMILIAR")));

// La consecuencia, de punta a punta: al motor, no al campo.
const rosa = sanearPerfil(
  { RANGO_EDAD: "Mayor de 55 años", SEGMENTO_GRUPO_FAMILIAR: "Monoparental", enriquecido: { dependientes: 1 } },
  { textoUsuario: "tengo 62 años, yo dependo de mi hija, ella me mantiene" }
);
const rReal = calcularPropension(rosa.perfil);
check("a quien su familia mantiene NO se le recomienda proteger su ingreso",
  !rReal.recomendaciones.some((r) => /Seguro de Vida$/.test(r.nombre)),
  `→ ${rReal.recomendaciones.map((r) => r.nombre).join(", ") || "ninguna"}`);
// De presencia, no de ausencia: tiene que recomendar OTRA cosa, no quedarse en blanco.
check("y sí se le recomienda lo que de verdad le sirve", rReal.recomendaciones.length > 0);

/* ── 8 · lo verificado viaja a todas las fases (B14 · 5b) ─────────────────── */
/*
 * POR QUÉ. En producción Amparito le preguntaba la edad, los dependientes y el ingreso a Carolina
 * —cuyo segmento vino verificado de la base—. La causa no era el prompt: era que este bloque no
 * mencionaba NI UNO de los ejes de la base, y que `turno.ts` lo apagaba justo en ASESORANDO, que
 * es la fase donde cotiza. La regla vivía en una fase y el conocimiento en el estado.
 */
console.log("\n===== Lo verificado viaja a todas las fases =====");

const CAROLINA: Parameters<typeof resumenEvidencia>[1] = {
  GENERO: "F", RANGO_EDAD: "36 a 45 años", CATEGORIA: "A", SEGMENTO_GRUPO_FAMILIAR: "Monoparental",
  _origen: { GENERO: "base", RANGO_EDAD: "base", CATEGORIA: "base", SEGMENTO_GRUPO_FAMILIAR: "base" },
};

const rPuede = resumenEvidencia("Soy Carolina Ramírez López", CAROLINA, { puedePreguntar: true }) ?? "";
check("los ejes de la base aparecen, con su procedencia", /Verificado por Colsubsidio/.test(rPuede));
check("  …con la edad", /36 a 45/.test(rPuede));
check("  …y el grupo familiar", /Monoparental/.test(rPuede));
// La contradicción que tenía: listaba el segmento como verificado y en la línea siguiente pedía
// preguntar lo mismo — peleando además con el prompt de RECONOCIDO, que lo prohíbe con todas las
// letras. Un prompt que se contradice a sí mismo es cómo el modelo acaba preguntando de más.
check("y NO pide preguntar lo que el segmento ya responde",
  !/Falta por saber[^\n]*depende de su ingreso/.test(rPuede));
// Y no se le atribuye a ella lo que vino de la base.
check("lo de la base NO se presenta como algo que ella contó",
  !/Te lo contó ella[^\n]*depende de su ingreso/.test(rPuede));

const rAsesora = resumenEvidencia(
  "Soy Carolina Ramírez López\nQuiero el Seguro de Vida", CAROLINA, { puedePreguntar: false }
) ?? "";
check("en ASESORANDO el bloque SIGUE llegando", rAsesora.includes("Verificado por Colsubsidio"));
check("y ahí frena, en vez de invitar a preguntar",
  /NO abras preguntas de perfilamiento/.test(rAsesora) && !/Pregunta solo lo de mayor valor/.test(rAsesora));

/*
 * La edad exacta es OTRO dato que el rango: la base da el rango, la prima necesita el número. Se
 * pide una sola vez y solo al cotizar (decisión tomada); si ya la dijo, no se vuelve a pedir.
 */
check("con rango verificado, se pide la edad exacta SOLO al cotizar",
  /únicamente cuando vayas a cotizar/.test(rPuede));
const rConEdad = resumenEvidencia("Soy Carolina\ntengo 39 años", CAROLINA, { puedePreguntar: false }) ?? "";
check("si ya dijo su edad, se le dice al modelo que ya la tiene",
  /Edad exacta: 39/.test(rConEdad) && !/únicamente cuando vayas a cotizar/.test(rConEdad));
/*
 * En una conversación de seguros se habla de plata todo el rato, así que un número detrás de
 * "tengo" es tan probablemente dinero como edad. El primero devolvía 40 años antes de revisarlo.
 */
for (const t of ["tengo 40 mil pesos ahorrados", "tengo 27 mil de prima", "gano 39 mil pesos al mes", "tengo 15 anos de casado"]) {
  check(`"${t}" no se lee como una edad`, edadDicha(t) === null);
}
check("y las formas normales de decirla sí se leen",
  edadDicha("tengo 28") === 28 && edadDicha("voy a cumplir 45 anos") === 45);

// Andrés no tiene nada verificado: el bloque no debe inventarle una sección vacía.
const rAndres = resumenEvidencia("Soy Andrés Gómez Ruiz\ntengo una moto", undefined, { puedePreguntar: true }) ?? "";
check("sin nada de la base, no aparece la sección de verificado",
  !rAndres.includes("Verificado por Colsubsidio"));
check("y sí lo que él contó", /Te lo contó ella: vehículo = moto/.test(rAndres));
check("y sigue faltando lo que de verdad falta",
  /Falta por saber[^\n]*depende de su ingreso/.test(rAndres));

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
