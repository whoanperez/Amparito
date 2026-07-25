/**
 * Siembra en Turso los afiliados SINTÉTICOS del demo (data/afiliados_muestra.json).
 *   set -a; . ./.env.local; set +a;  npx tsx scripts/seed-demo-afiliados.ts
 *
 * POR QUÉ HACE FALTA. Las pastillas del jurado mandan un nombre del sample sintético. Eso funciona
 * con el adaptador local, pero en el deploy hay Turso — y esos nombres NO están en la base real
 * (verificado: 0 coincidencias). Sin esto, el primer toque del jurado responde "no apareces en la
 * base de afiliados", que es exactamente lo contrario del momento que queremos mostrar.
 *
 * La alternativa —poner nombres REALES de afiliados en las pastillas— cruza la línea que este
 * proyecto no cruza: nombres reales no van al repo público. Los del sample son inventados y ya
 * están en el repo, así que sembrarlos es gratis y seguro.
 *
 * Idempotente: borra los sintéticos antes de insertarlos, así se puede correr las veces que sea.
 */
import { createClient } from "@libsql/client";
import muestra from "../data/afiliados_muestra.json";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

interface Registro {
  nombre: string; ciudad: string;
  genero?: string; rango_edad?: string; categoria?: string;
  grupo_familiar?: string; poblacional?: string;
}

/** El sample usa etiquetas canónicas; la base guarda las crudas del CSV. Se invierte el mapa. */
const A_CRUDO: Record<string, string> = {
  "Sin grupo familiar": "AFILLIADO SIN GRUPO_FAMILIAR",
  "Monoparental": "FAMILIA MONOPARENTAL",
  "Monoparental ampliada": "FAMILIA MONOPARENTAL AMPLIADA",
  "Nuclear integral": "FAMILIA NUCLEAR INTEGRAL",
  "Nuclear ampliada": "FAMILIA NUCLEAR AMPLIADA",
  "Pareja conyugal": "PAREJA CONYUGAL",
};

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.log("Sin TURSO_DATABASE_URL: no hay nada que sembrar (el adaptador local ya los tiene).");
    return;
  }
  const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const registros = muestra as Registro[];

  for (const r of registros) {
    const n = norm(r.nombre);
    // Idempotencia: se borra por nombre normalizado antes de insertar.
    await db.execute({ sql: "DELETE FROM afiliados WHERE nombre_norm = ?", args: [n] });
    await db.execute({
      sql: `INSERT INTO afiliados
              (nombre, nombre_norm, ciudad, ciudad_norm, genero, rango_edad, categoria, grupo_familiar, poblacional)
            VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [
        r.nombre, n, r.ciudad, norm(r.ciudad),
        r.genero ?? "", r.rango_edad ?? "", r.categoria ?? "",
        // Se guarda en CRUDO para que `canonSegmento` haga su trabajo igual que con la base real:
        // así el camino del demo ejercita el mismo código que el de un afiliado de verdad.
        A_CRUDO[r.grupo_familiar ?? ""] ?? r.grupo_familiar ?? "",
        r.poblacional ?? "",
      ],
    });
    console.log(`  sembrado: ${r.nombre} · ${r.ciudad}`);
  }

  console.log(`\n✅ ${registros.length} afiliados sintéticos del demo en Turso.`);
  console.log("   (Son inventados: no hay PII. Sirven para que el primer toque del jurado reconozca.)");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
