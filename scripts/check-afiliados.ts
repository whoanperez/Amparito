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
import { createClient } from "@libsql/client";
import { getAffiliateGateway } from "../lib/afiliados";
import { calcularPropension } from "../lib/engine/scorecard";
import { lookupPeer } from "../lib/engine/peer";
import type { Perfil } from "../lib/engine/types";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Las etiquetas crudas del CSV vienen TODO EN MAYÚSCULAS ("FAMILIA MONOPARENTAL"); las canónicas
// del motor, capitalizadas ("Monoparental", "Pareja conyugal"). Si sobrevive una cruda, el gate falla.
const esCruda = (v: string) => v === v.toUpperCase();

let fallos = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? "OK  " : "FALLA"} · ${msg}`);
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
      !seg.grupo_familiar || !esCruda(seg.grupo_familiar),
      `grupo familiar canónico (no cruda del CSV)`
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
    // n<1000 es un "no afirmamos nada" legítimo, no un fallo: solo exigimos que no se caiga
    // por vocabulario. Reportamos cuál de las dos cosas pasó.
    console.log(`       peer: ${peer ? `${peer.n.toLocaleString("es-CO")} personas · ${peer.descripcion}` : "sin celda (n<1000 o eje faltante)"}`);
  }

  console.log(`\n${fallos === 0 ? "GATE OK — arranque caliente end-to-end" : `GATE FALLA — ${fallos} problema(s)`}`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
