/**
 * Gate del vocabulario compartido (B13 · #43).
 *   npx tsx scripts/test-vocabulario.ts
 *
 * POR QUÉ EXISTE. "moto" vivía escrita en tres archivos con tres propósitos distintos —posesión
 * que hay que verificar, tema de pregunta, palabra que no puede ser un nombre— y ninguna sabía de
 * las otras. Ya habían divergido: "scooter" en una, "camioneta" en otra, "monopatín" en ninguna de
 * las que decidían.
 *
 * Juntarlas no basta. Un archivo compartido que nadie comprueba se vuelve a copiar en tres meses,
 * con el argumento razonable de "es que aquí necesito una variante". Este gate afirma la propiedad
 * que importa: LO QUE EL MOTOR SABE VERIFICAR, LOS OTROS DOS LO CONOCEN.
 *
 * Y prueba la otra mitad, que apareció al juntarlas: las tres comparaban con `includes` a secas.
 */
import {
  MASCOTAS, VEHICULOS, VIVIENDA, aplanar, coincide, menciona, raiz,
} from "../lib/vocabulario";
import { sanearPerfil, resumenEvidencia } from "../lib/engine/sanear";
import { detectarNombre } from "../lib/afiliados/deteccion";
import { esDobleCanon } from "../lib/prompts";

let ok = true;
const check = (label: string, cond: boolean, detalle?: string) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}${detalle ? `  ${detalle}` : ""}`);
  if (!cond) ok = false;
};

/*
 * 1 · Los falsos positivos REALES, comprobados contra el código de producción antes de arreglarlo.
 *
 * El de "autorizo" es el que más importa: `textoUsuario` es el join de TODOS los mensajes de la
 * persona, y "autorizo" es lo que se escribe en la compuerta de consentimiento. O sea, en cualquier
 * conversación que llegue al formulario, el modelo podía afirmar un carro y la compuerta —la pieza
 * que existe para no creerle— lo aprobaba.
 */
console.log("===== Una palabra dentro de otra no es evidencia =====");
const NO_ES_EVIDENCIA: Array<[string, Record<string, unknown>, string]> = [
  ["sí, autorizo", { enriquecido: { tiene_vehiculo: ["carro"] } }, "auto ⊂ autorizo"],
  ["autorizo el tratamiento de mis datos", { enriquecido: { tiene_vehiculo: ["carro"] } }, "auto ⊂ autorizo"],
  ["quiero algo automatico", { enriquecido: { tiene_vehiculo: ["carro"] } }, "auto ⊂ automatico"],
  ["soy casado y tengo dos hijos", { enriquecido: { vivienda: "propia" } }, "casa ⊂ casado"],
  ["mi hermana es casada", { enriquecido: { vivienda: "arriendo" } }, "casa ⊂ casada"],
  ["tengo un motor viejo en el patio", { enriquecido: { tiene_vehiculo: ["moto"] } }, "moto ⊂ motor"],
];
for (const [texto, propuesto, por] of NO_ES_EVIDENCIA) {
  const { perfil } = sanearPerfil(propuesto, { textoUsuario: texto });
  check(`"${texto}" no prueba nada`, Object.keys(perfil.enriquecido ?? {}).length === 0, `(${por})`);
}

// Y lo que SÍ es evidencia sigue entrando: una compuerta que no deja pasar nada tampoco sirve.
console.log("\n===== Y lo que sí se dijo, sigue entrando =====");
const SÍ_ES_EVIDENCIA: Array<[string, Record<string, unknown>, string]> = [
  ["tengo una moto", { enriquecido: { tiene_vehiculo: ["moto"] } }, "moto"],
  ["compré una motocicleta", { enriquecido: { tiene_vehiculo: ["moto"] } }, "motocicleta"],
  ["ando en scooter", { enriquecido: { tiene_vehiculo: ["moto"] } }, "scooter"],
  ["tengo una camioneta", { enriquecido: { tiene_vehiculo: ["carro"] } }, "camioneta"],
  ["vivo en arriendo", { enriquecido: { vivienda: "arriendo" } }, "arriendo"],
  ["la casa es propia", { enriquecido: { vivienda: "propia" } }, "casa"],
  ["tengo dos perritos", { enriquecido: { tiene_mascota: ["perro"] } }, "perritos"],
];
for (const [texto, propuesto, por] of SÍ_ES_EVIDENCIA) {
  const { perfil } = sanearPerfil(propuesto, { textoUsuario: texto });
  check(`"${texto}" sí prueba`, Object.keys(perfil.enriquecido ?? {}).length > 0, `(${por})`);
}

/*
 * 2 · La propiedad que impide la divergencia. No dice "las tres listas son iguales" —no lo son ni
 *     deben serlo—, dice que lo que el MOTOR sabe verificar es conocido por los otros dos.
 */
console.log("\n===== Ninguna lista se queda atrás =====");
const DOMINIO = [...aplanar(VEHICULOS), ...aplanar(MASCOTAS), ...VIVIENDA];
const deUnaPalabra = DOMINIO.filter((t) => !t.includes(" "));

// Se prueba con la RAÍZ, que es la cadena exacta contra la que compara el matcher. Nada de
// inventar formas con una letra pegada: un check que pasa con "motocicletaa" no prueba que
// "motocicleta" esté cubierta.
for (const termino of aplanar(VEHICULOS)) {
  if (termino.includes(" ")) continue;
  const palabra = raiz(termino);
  check(`"${palabra}" es tema de pregunta`, esDobleCanon(`¿tienes ${palabra}, o tu vivienda es propia?`));
}

for (const termino of deUnaPalabra) {
  const palabra = raiz(termino);
  check(`"${palabra}" no se cuela dentro de un nombre`, detectarNombre(`soy ${palabra}`, false) === null);
}

// Y con las palabras que la gente de verdad escribe, que es lo que la mecánica de arriba no cubre.
console.log("\n===== Las formas reales, no solo las raíces =====");
for (const palabra of ["motocicleta", "camioneta", "bicicleta", "apartamento", "arriendo", "perrito", "gatico"]) {
  check(`"${palabra}" la conocen las tres`,
    menciona(palabra, DOMINIO) &&
    detectarNombre(`soy ${palabra}`, false) === null &&
    esDobleCanon(`¿tienes ${palabra}, o cuánto ganas al mes?`));
}

/*
 * 3 · La regla de comparación, en aislamiento. Es la que hay que poder leer para confiar en el
 *     resto: `*` = prefijo de palabra, sin `*` = palabra exacta.
 */
console.log("\n===== La regla de comparación =====");
check("palabra exacta: 'auto' está en 'un auto'", coincide("tengo un auto", "auto"));
check("palabra exacta: 'auto' NO está en 'autorizo'", !coincide("si autorizo", "auto"));
check("palabra exacta: 'casa' NO está en 'casado'", !coincide("soy casado", "casa"));
check("prefijo: 'arriend*' está en 'arriendo'", coincide("vivo en arriendo", "arriend*"));
check("prefijo: 'arriend*' está en 'arriendan'", coincide("me lo arriendan", "arriend*"));
check("prefijo: no empieza a mitad de palabra", !coincide("desarriendo", "arriend*"));
check("una lista completa se consulta de una", menciona("tengo una bicicleta", aplanar(VEHICULOS)));

/*
 * 4 · El resumen de evidencia usa las mismas reglas: si se le escapa un término, Amparito vuelve a
 *     preguntar algo que la persona ya contestó — que es el defecto que ese resumen vino a cerrar.
 */
console.log("\n===== El resumen de evidencia no se queda corto =====");
for (const texto of ["tengo una motocicleta", "ando en camioneta", "tengo dos perritos"]) {
  const r = resumenEvidencia(texto) ?? "";
  check(`"${texto}" cuenta como ya contado`, /Ya te contó/i.test(r) || r.includes("="), `→ ${r.split("\n")[0]}`);
}

console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
process.exit(ok ? 0 : 1);
