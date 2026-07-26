/**
 * Gate del sello de simulación (B13).
 *   npx tsx scripts/test-sello.ts
 *
 * POR QUÉ EXISTE. El sello —"no se emitió ninguna póliza y no vas a recibir ningún correo"— es la
 * pieza que los tres revisores señalaron como bien hecha. Y era la única a la que el propio
 * producto le llevaba la contraria: el video prometía "certificado digital a tu correo en pocas
 * horas" a dos centímetros de la tarjeta que lo negaba.
 *
 * Eso no se arregla reescribiendo una frase: se arregla haciendo que la contradicción sea
 * IMPOSIBLE DE NO VER. Mientras el sello viva escrito a mano en tres sitios, la próxima superficie
 * que hable de la entrega volverá a contradecirlo y nadie se va a enterar hasta que lo vea un
 * jurado. Por eso el sello es dato (`AVISO_SIMULACION`) y la regla es un predicado
 * (`contradiceElSello`) que este gate corre sobre CADA superficie, incluidas las que no existían
 * cuando se escribió.
 *
 * Aserciones de PRESENCIA: no dice "el video no contiene tal palabra", dice "toda superficie que
 * promete una entrega lleva el sello encima". Un texto nuevo entra al gate por el hecho de estar
 * en la lista, no porque alguien se acuerde de agregarlo.
 */
import { AVISO_SIMULACION, contradiceElSello, inventaTiempos, copyCierre, PASOS_EXPEDICION } from "../lib/expedicion";
import { SCENES, MARCA_PRODUCCION, marcaDeEscena } from "../components/FlowVideo";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

/*
 * 1 · El predicado tiene que poder dar rojo.
 *
 * Un guard que nunca dispara es un comentario caro. Antes de creerle al gate, se le pasa por
 * delante EL TEXTO EXACTO que estaba en producción y que motivó todo esto.
 */
console.log("===== El predicado detecta el defecto real =====");
const ESCENA_12_VIEJA = "Certificado digital a tu correo en pocas horas.";
check("la escena 12 original contradice el sello", contradiceElSello(ESCENA_12_VIEJA));
check("y además inventa un tiempo que ningún SLA respalda", inventaTiempos(ESCENA_12_VIEJA));
check("una frase que no habla de entrega no dispara",
  !contradiceElSello("Matching por gatillos y reglas; nunca de memoria."));
check("y hablar del correo CON el sello encima es legítimo",
  !contradiceElSello("Te envía el certificado al correo. Hoy es una simulación: nada de eso se dispara."));

/*
 * 2 · Toda superficie que promete una entrega carga el sello.
 *
 * El video se IMPORTA, no se copia: si mañana alguien agrega una escena 14 que promete algo, entra
 * a este gate sola. Es la misma lección de B5 —dos listas sincronizadas a mano divergen— aplicada
 * al copy en vez de a los guiones.
 */
console.log("\n===== Ninguna superficie desmiente al sello =====");
const SUPERFICIES: Array<{ donde: string; texto: string }> = [
  { donde: "copyCierre (mensaje de cierre)", texto: copyCierre("MetLife") },
  { donde: "AVISO_SIMULACION (la tarjeta)", texto: AVISO_SIMULACION },
  ...SCENES.map((sc, i) => ({
    donde: `video · escena ${i} "${sc.t.slice(0, 34)}"`,
    texto: [sc.t, sc.s, sc.chip ?? "", marcaDeEscena(sc) ?? ""].join(" "),
  })),
];

for (const s of SUPERFICIES) {
  check(`${s.donde} no promete entrega sin sello`, !contradiceElSello(s.texto));
}

console.log("\n===== Ninguna superficie inventa tiempos =====");
check("los SLA siguen sin acordarse (si esto cambia, el gate de abajo se relaja solo)",
  PASOS_EXPEDICION.every((p) => p.sla === null));
for (const s of SUPERFICIES) {
  check(`${s.donde} no afirma un plazo`, !inventaTiempos(s.texto));
}

/*
 * 3 · Lo que describe el futuro se PINTA como futuro.
 *
 * La tarjeta de póliza dice "Simulada" porque el adaptador lo dice, no porque alguien lo escribió:
 * el estado es dato y la UI lo obedece. Las escenas ahora funcionan igual. Sin esta aserción,
 * `estado: "produccion"` sería decorativo — un campo que nadie pinta.
 */
console.log("\n===== Lo que falta se ve que falta =====");
const futuras = SCENES.filter((sc) => sc.estado === "produccion");
check("hay al menos una escena declarada como pendiente", futuras.length > 0,
  `→ ${futuras.map((s) => s.t.split("·")[0].trim()).join(", ") || "ninguna"}`);
for (const sc of futuras) {
  check(`"${sc.t.slice(0, 40)}" se pinta marcada`, marcaDeEscena(sc) === MARCA_PRODUCCION);
}
const yaCorre = SCENES.find((s) => /api\/issue/.test(s.chip ?? ""));
check("y una escena de lo que YA corre no lleva marca",
  !!yaCorre && marcaDeEscena(yaCorre) === null);

/*
 * 4 · El sello vive en un solo sitio.
 *
 * El cierre citaba el texto y la tarjeta lo tenía escrito a mano: dos copias que no tenían forma
 * de enterarse la una de la otra. Se verifica por CONTENIDO, no por que alguien haya importado la
 * constante — un `import` sin usar también pasaría.
 */
console.log("\n===== Una sola fuente =====");
check("el cierre cita el sello literal",
  copyCierre("MetLife").toLowerCase().includes(AVISO_SIMULACION.toLowerCase()),
  `→ "…${AVISO_SIMULACION.slice(-42)}"`);
check("y el sello niega las dos cosas que la gente asume",
  /ninguna p[óo]liza/i.test(AVISO_SIMULACION) && /ning[úu]n correo/i.test(AVISO_SIMULACION));

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
