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

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
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
  let batch: (string | null)[][] = [];
  let total = 0;

  const flush = async () => {
    if (!batch.length) return;
    await db.batch(
      batch.map((a) => ({
        sql: `INSERT INTO afiliados (nombre,nombre_norm,ciudad,ciudad_norm,genero,rango_edad,categoria,grupo_familiar,poblacional)
              VALUES (?,?,?,?,?,?,?,?,?)`,
        args: a,
      })),
      "write"
    );
    total += batch.length;
    batch = [];
    process.stdout.write(`\r  cargados: ${total}`);
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
    batch.push([
      nombre, norm(nombre), ciudad, norm(ciudad),
      get("GENERO"), get("RANGO_EDAD"), get("CATEGORIA"),
      get("SEGMENTO_GRUPO_FAMILIAR"), get("SEGMENTO_POBLACIONAL"),
    ]);
    if (batch.length >= 500) await flush();
  }
  await flush();
  await db.execute("CREATE INDEX IF NOT EXISTS idx_afiliados_nombre ON afiliados (nombre_norm)");
  console.log(`\n✅ ${total} afiliados cargados a Turso + índice por nombre. Pon TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en Vercel.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
