/**
 * Gate del arranque caliente por afiliado — END TO END contra la base configurada.
 *
 *   afiliado real en la BD → getAffiliateGateway().lookup() → Perfil → motor (propensión + peer)
 *
 * Sirve igual para el sample local (sin TURSO_DATABASE_URL) que para Turso (con las dos vars).
 * Uso:  set -a; . ./.env.local; set +a;  npx tsx scripts/check-afiliados.ts
 *
 * Comprueba lo que de verdad importa:
 *  1) el lookup encuentra a la persona escribiendo el nombre SIN tildes;
 *  2) el segmento llega CANÓNICO ("Monoparental", no "FAMILIA MONOPARENTAL") — si no, el motor
 *     pierde la señal de grupo familiar y el PeerProof desaparece en silencio;
 *  3) el motor produce recomendaciones y encuentra la celda de peer-group.
 */
import "./_env";
import { createClient } from "@libsql/client";
import { getAffiliateGateway } from "../lib/afiliados";
import { ENUM } from "../lib/engine/sanear";
import { calcularPropension } from "../lib/engine/scorecard";
import { lookupPeer } from "../lib/engine/peer";
import type { Perfil } from "../lib/engine/types";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Aquí vivía `esCruda = (v) => v === v.toUpperCase()`, y el check era
 * `!seg.grupo_familiar || !esCruda(seg.grupo_familiar)`. Tres agujeros a la vez:
 *
 *   · `"" === "".toUpperCase()` es true, y el `||` de escape lo dejaba pasar igual: el valor
 *     VACÍO —el fallo silencioso que la cabecera de este archivo dice proteger— salía verde;
 *   · solo detectaba MAYÚSCULAS. `canonGrupoFamiliar` deja pasar tal cual cualquier etiqueta
 *     desconocida, así que un "Familia Monoparental" del CSV pasaba el check y el motor perdía
 *     la señal;
 *   · afirmaba la AUSENCIA de algo malo, que es lo que nunca falla cuando desaparece todo.
 *
 * Ahora se afirma la PRESENCIA: el valor tiene que ser uno de los que el motor acepta de verdad,
 * leídos de su propia definición y no de una copia.
 */
const CANONICOS = ENUM.SEGMENTO_GRUPO_FAMILIAR;

let fallos = 0;
let checks = 0;
const check = (ok: boolean, msg: string) => {
  checks++;
  console.log(`   ${ok ? "✅" : "❌"} ${msg}`);
  if (!ok) fallos++;
};

/** Candidatos a probar: nombres reales de la BD (con tilde/ñ y con grupo familiar). */
async function candidatos(): Promise<{ nombre: string; ciudad?: string }[]> {
  if (!process.env.TURSO_DATABASE_URL) {
    // Sample local sintético.
    return [
      { nombre: "Carolina Ramirez Lopez", ciudad: "Soacha" },
      { nombre: "Jaime Ortiz Vega", ciudad: "Bogota" },
    ];
  }
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const r = await db.execute(
    `SELECT nombre, ciudad FROM afiliados
     WHERE grupo_familiar IN ('FAMILIA MONOPARENTAL','FAMILIA NUCLEAR INTEGRAL','PAREJA CONYUGAL')
       AND ciudad <> '' AND genero <> '' AND categoria <> ''
     LIMIT 3`
  );
  return r.rows.map((x) => ({ nombre: String(x.nombre), ciudad: String(x.ciudad ?? "") }));
}

async function main() {
  const fuente = process.env.TURSO_DATABASE_URL ? "TURSO (base completa)" : "sample local sintético";
  console.log(`Fuente de afiliados: ${fuente}\n`);

  const gw = getAffiliateGateway();
  const casos = await candidatos();
  let conPeer = 0;
  if (!casos.length) throw new Error("No se encontraron afiliados de prueba en la base.");

  for (const caso of casos) {
    // El usuario teclea el nombre como sea: sin tildes, en minúscula.
    const tecleado = norm(caso.nombre);
    console.log(`\n· "${tecleado}"${caso.ciudad ? ` · ${caso.ciudad}` : ""}`);

    const t = Date.now();
    const seg = await gw.lookup(tecleado, caso.ciudad);
    check(!!seg, `lookup encuentra a la persona (${Date.now() - t}ms)`);
    if (!seg) continue;

    console.log(
      `       segmento: ${seg.genero} · ${seg.rango_edad} · cat ${seg.categoria} · ` +
        `${seg.grupo_familiar ?? "(sin grupo)"} · ${seg.poblacional ?? "-"}`
    );
    check(
      !!seg.grupo_familiar && CANONICOS.includes(seg.grupo_familiar),
      `grupo familiar canónico: "${seg.grupo_familiar ?? "(vacío)"}" ∈ los que acepta el motor`
    );

    const perfil: Perfil = {
      GENERO: seg.genero as Perfil["GENERO"],
      RANGO_EDAD: seg.rango_edad,
      CATEGORIA: seg.categoria as Perfil["CATEGORIA"],
      SEGMENTO_GRUPO_FAMILIAR: seg.grupo_familiar,
      SEGMENTO_POBLACIONAL: seg.poblacional as Perfil["SEGMENTO_POBLACIONAL"],
    };

    const res = calcularPropension(perfil);
    check(res.recomendaciones.length > 0, `el motor recomienda algo (${res.recomendaciones.length})`);
    if (res.recomendaciones[0]) {
      console.log(`       top: ${res.recomendaciones[0].nombre} — ${res.recomendaciones[0].reason_codes[0] ?? ""}`);
    }

    const peer = lookupPeer(perfil);
    console.log(`       peer: ${peer ? `${peer.n.toLocaleString("es-CO")} personas · ${peer.descripcion}` : "sin celda (n<1000 o eje faltante)"}`);
    if (peer) conPeer++;
  }

  // #17 · La prueba social se CALCULABA, se imprimía y no se verificaba nunca. La cabecera de
  // este archivo promete que "el motor encuentra la celda de peer-group", y esa mitad de la
  // promesa no estaba cubierta: `lookupPeer` podía devolver null para los tres candidatos y el
  // gate salía verde. La regresión que ya perdió la prueba social una vez volvería a pasar.
  //
  // Un n<1000 suelto es un "no afirmamos nada" legítimo, así que no se exige celda en CADA caso;
  // pero que NINGUNO de los candidatos —elegidos con los cuatro ejes completos— encuentre celda
  // sí es el síntoma de que el vocabulario se rompió.
  check(
    conPeer > 0,
    `al menos un candidato con los 4 ejes encuentra su celda de peer-group (${conPeer}/${casos.length})`
  );

  console.log(`\n${fallos === 0 ? `GATE OK — ${checks} checks, arranque caliente end-to-end` : `GATE FALLA — ${fallos} de ${checks}`}`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
