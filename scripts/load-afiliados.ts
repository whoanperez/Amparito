/**
 * Carga la base de afiliados a Turso (para el deploy en Vercel).
 *
 * Lee el CSV local (con nombres) y lo inserta en la BD administrada, con acceso solo-backend.
 * NO sube nombres al repo. Se corre UNA vez, en local, con las credenciales de tu Turso.
 *
 * 1) Crea una BD gratis en https://turso.tech  → obtén la URL y el token.
 * 2) Corre:
 *    TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." \
 *      npx tsx scripts/load-afiliados.ts "/ruta/a/Usos_Productos_Afiliados_SIN_ID.csv"
 *
 * Guarda solo nombre + ciudad + segmento (bota el resto). Indexa por nombre normalizado.
 */
import { createClient } from "@libsql/client";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const COLS = 9;
// Medido contra Turso: INSERT multi-fila de 2.000 × 10 statements ≈ 8.500 filas/s
// (~3 min para 1,57M). Un INSERT por fila baja a ~1.000 filas/s (~25 min).
const ROWS_PER_STMT = 2000;
const STMTS_PER_BATCH = 10;

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Un solo INSERT con N tuplas de VALUES — amortiza la latencia de red. */
function multiInsert(rows: (string | null)[][]) {
  const tuple = `(${Array(COLS).fill("?").join(",")})`;
  return {
    sql: `INSERT INTO afiliados (nombre,nombre_norm,ciudad,ciudad_norm,genero,rango_edad,categoria,grupo_familiar,poblacional)
          VALUES ${Array(rows.length).fill(tuple).join(",")}`,
    args: rows.flat(),
  };
}

async function main() {
  const csvPath = process.argv[2] || process.env.CSV_PATH;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!csvPath) throw new Error("Falta la ruta del CSV: npx tsx scripts/load-afiliados.ts <ruta.csv>");
  if (!url) throw new Error("Falta TURSO_DATABASE_URL (crea la BD en turso.tech).");

  const db = createClient({ url, authToken });
  await db.execute("DROP TABLE IF EXISTS afiliados");
  await db.execute(
    `CREATE TABLE afiliados (
      nombre TEXT, nombre_norm TEXT, ciudad TEXT, ciudad_norm TEXT,
      genero TEXT, rango_edad TEXT, categoria TEXT, grupo_familiar TEXT, poblacional TEXT
    )`
  );

  const rl = createInterface({ input: createReadStream(csvPath, { encoding: "utf8" }), crlfDelay: Infinity });
  const idx: Record<string, number> = {};
  let header = false;
  let pending: (string | null)[][] = [];
  let total = 0;
  let duplicados = 0;
  const vistos = new Set<string>(); // dedup por nombre+ciudad (el CSV trae una fila por producto)
  const t0 = Date.now();

  const flush = async (force = false) => {
    const lote = ROWS_PER_STMT * STMTS_PER_BATCH;
    while (pending.length >= (force ? 1 : lote)) {
      const chunk = pending.splice(0, lote);
      const stmts = [];
      for (let i = 0; i < chunk.length; i += ROWS_PER_STMT) {
        stmts.push(multiInsert(chunk.slice(i, i + ROWS_PER_STMT)));
      }
      await db.batch(stmts, "write");
      total += chunk.length;
      const s = (Date.now() - t0) / 1000;
      console.log(`  ${total.toLocaleString("es-CO")} filas · ${Math.round(total / s)} filas/s · ${s.toFixed(0)}s`);
    }
  };

  for await (const raw of rl) {
    const line = raw.replace(/^﻿/, "");
    if (!line.trim()) continue;
    const cols = line.split(";");
    if (!header) {
      cols.forEach((h, i) => (idx[h.trim()] = i));
      header = true;
      continue;
    }
    const get = (k: string): string => (idx[k] != null ? (cols[idx[k]] ?? "").trim() : "");
    const nombre = get("NOMBRE_COMPLETO");
    if (!nombre) continue;
    const ciudad = get("CIUDAD_AFILIADO");
    const nombreNorm = norm(nombre);
    const ciudadNorm = norm(ciudad);

    const clave = `${nombreNorm}|${ciudadNorm}`;
    if (vistos.has(clave)) { duplicados++; continue; }
    vistos.add(clave);

    pending.push([
      nombre, nombreNorm, ciudad, ciudadNorm,
      get("GENERO"), get("RANGO_EDAD"), get("CATEGORIA"),
      get("SEGMENTO_GRUPO_FAMILIAR"), get("SEGMENTO_POBLACIONAL"),
    ]);
    await flush();
  }
  await flush(true);
  console.log("  creando índice por nombre…");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_afiliados_nombre ON afiliados (nombre_norm)");
  console.log(
    `\n✅ ${total.toLocaleString("es-CO")} afiliados cargados a Turso (+${duplicados.toLocaleString("es-CO")} filas duplicadas omitidas) ` +
      `+ índice por nombre, en ${((Date.now() - t0) / 1000).toFixed(0)}s.\n` +
      `   Pon TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en Vercel.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
