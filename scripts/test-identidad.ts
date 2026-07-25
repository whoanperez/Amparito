/**
 * Gate de identidad y arranque (B5).
 *   set -a; . ./.env.local; set +a;  npx tsx scripts/test-identidad.ts
 *
 * Corre igual contra Turso y contra el sample local. Verifica la cascada completa y, sobre todo,
 * el caso que motivó el bloque: en la conversación real la persona escribió "soy Mauricio
 * Cajamarca" en su primer mensaje y NO PASÓ NADA, porque no existía ningún camino del chat al
 * gateway — el lookup solo se disparaba desde un formulario.
 */
import { detectarCiudad, detectarNombre } from "../lib/afiliados/deteccion";
import { resolverIdentidad } from "../lib/afiliados/resolver";
import { getAffiliateGateway } from "../lib/afiliados";

let ok = true;
const check = (label: string, cond: boolean) => {
  console.log(`   ${cond ? "✅" : "❌"} ${label}`);
  if (!cond) ok = false;
};
const u = (content: string) => ({ role: "user" as const, content });

async function main() {
  const fuente = process.env.TURSO_DATABASE_URL ? "TURSO (base completa)" : "sample local sintético";
  console.log(`Fuente: ${fuente}\n`);

  /* ── 1 · detección del nombre en código ────────────────────────────────── */
  console.log("===== Detección del nombre =====");
  const casos: Array<[string, string | null]> = [
    ["soy Mauricio Cajamarca", "mauricio cajamarca"],
    ["me llamo Carolina Ramírez López", "carolina ramirez lopez"],
    ["Andrés Gómez Ruiz", "andres gomez ruiz"],
    ["mi nombre es Jaime Ortiz", "jaime ortiz"],
    // Falsos positivos que hay que evitar
    ["soy afiliado de Colsubsidio", null],
    ["hola", null],
    ["compré una moto", null],
    ["no tengo ingresos", null],
    // Regresión real: los guiones del jurado no deben disparar identificación, o el jurado
    // tocaría "Andrés, 28" y Amparito le diría que no aparece en la base.
    ["Hola, tengo 28 años, soltero y sin hijos, y acabo de comprar una moto.", null],
    ["Hola, tengo 39 años y soy mamá cabeza de hogar con un hijo de 8 años, en Soacha.", null],
    ["Hola, tengo 58 años, vivo con mi esposa y ya tengo un seguro exequial con Colsubsidio.", null],
    // Las mayúsculas cortan el nombre donde debe: no arrastra "tengo 28 años, soltero..."
    ["Hola, soy Andrés, tengo 28 años, soltero y sin hijos", "andres"],
    // Y si escribe todo en minúscula, la stoplist hace el trabajo.
    ["soy pedro perez y tengo 40 anos", "pedro perez"],
  ];
  for (const [texto, esperado] of casos) {
    const got = detectarNombre(texto, false);
    check(`"${texto}" → ${esperado ?? "(nada)"}`, got === esperado);
  }
  check('"Bogotá" se lee como ciudad', detectarCiudad("Bogotá") === "bogota");
  check('"vivo en Cali" → cali', detectarCiudad("vivo en Cali") === "cali");

  /* ── 2 · el caso real: decir el nombre AHORA dispara la búsqueda ────────── */
  console.log("\n===== El caso que motivó el bloque =====");
  const nombreReal = process.env.TURSO_DATABASE_URL
    ? await (async () => {
        // Un afiliado real cualquiera, tomado de la propia base.
        const gw = getAffiliateGateway();
        for (const cand of ["maria fernanda amaya mora", "gerardo galvis penaloza"]) {
          const h = await gw.buscar(cand);
          if (h.estado === "unico") return cand;
        }
        return null;
      })()
    : "carolina ramirez lopez";

  if (nombreReal) {
    const r = await resolverIdentidad([u(`soy ${nombreReal}`)]);
    console.log(`   "soy ${nombreReal}" → estado: ${r.estado}`);
    check("se reconoce sin formulario y sin tool", r.estado === "reconocido");
    check("trae el segmento verificado", !!r.segmento?.categoria);
    check("se persiste para los siguientes turnos", !!r.persistir?.nombre);
    check("el contexto dice cómo saludar", (r.contexto ?? "").includes("Bienvenid"));
  } else {
    check("se encontró un afiliado real para la prueba", false);
  }

  /* ── 3 · nombre inventado ──────────────────────────────────────────────── */
  console.log("\n===== Nombre que no está en la base =====");
  const inv = await resolverIdentidad([u("soy Zulema Trastamara Quispe Vergara")]);
  console.log(`   estado: ${inv.estado}`);
  check("no encontrado", inv.estado === "no_encontrado");
  check("usa el copy A y NO dice 'no eres afiliado'",
    (inv.contexto ?? "").includes("No apareces en la base de afiliados") &&
    (inv.contexto ?? "").includes('NUNCA digas "no eres afiliado"'));

  /* ── 4 · nombre corto: se pide el completo antes de descartar ───────────── */
  console.log("\n===== Nombre corto =====");
  const corto = await resolverIdentidad([u("soy Mauricio")]);
  console.log(`   "soy Mauricio" → estado: ${corto.estado}`);
  check("pide el nombre completo antes de descartar",
    corto.estado !== "reconocido" ? (corto.contexto ?? "").includes("nombre completo") : true);

  /* ── 5 · sin nombre: no se intenta nada ────────────────────────────────── */
  console.log("\n===== Sin nombre =====");
  const sin = await resolverIdentidad([u("quiero un seguro para mi moto")]);
  check("sin intento (no hay nombre que buscar)", sin.estado === "sin_intento");
  check("no inventa contexto", sin.contexto === undefined);

  /* ── 6 · tope de enumeración ───────────────────────────────────────────── */
  console.log("\n===== Tope de búsquedas =====");
  const muchos = await resolverIdentidad([
    u("soy Ana Perez"), u("soy Luis Gomez"), u("soy Pedro Diaz"), u("soy Sara Ruiz"), u("soy Juan Mora"),
  ]);
  check("con 5 nombres distintos se corta (tope 3)", muchos.estado === "tope_alcanzado");

  console.log(`\n${ok ? "✅ GATE OK" : "❌ GATE FALLÓ"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
