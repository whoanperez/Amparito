/**
 * Carga `.env.local` para los gates que tocan la base.
 *
 * POR QUÉ. Ni `npm run gates` ni una suite suelta cargaban nada: no hay dotenv en el repo, y los
 * comentarios de cabecera le pedían al humano hacerlo a mano con `set -a; . ./.env.local`. Nadie
 * lo hacía, así que las suites de identidad corrían SIEMPRE contra el sample sintético de seis
 * registros — y el camino de producción (canonización de etiquetas, homónimos, filtro tolerante
 * de ciudad) no tenía cobertura, sin que nada lo dijera.
 *
 * Lo importa el runner y también cada suite que necesita la base, para que correrla sola no sea
 * un modo degradado silencioso.
 *
 * Sin dependencia: son quince líneas y evitan una más en el árbol.
 */
import { existsSync, readFileSync } from "node:fs";

export function cargarEnvLocal(archivo = ".env.local"): boolean {
  if (!existsSync(archivo)) return false;
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const l = linea.trim();
    if (!l || l.startsWith("#")) continue;
    const i = l.indexOf("=");
    if (i < 1) continue;
    const clave = l.slice(0, i).trim();
    let valor = l.slice(i + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    // Lo que ya venga del entorno MANDA: así CI puede sobreescribir sin tocar el archivo.
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
  return true;
}

/** Se ejecuta al importar: quien importa este módulo quiere el entorno cargado. */
cargarEnvLocal();
