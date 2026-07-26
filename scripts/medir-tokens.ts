/**
 * ¿Vale la pena el prompt caching? (#39) — MEDIR, no asumir.
 *   npx tsx scripts/medir-tokens.ts
 *
 * El caching de Anthropic tiene un PREFIJO MÍNIMO por modelo. Por debajo de ese mínimo,
 * `cache_control` no falla: no hace nada, en silencio (`cache_creation_input_tokens: 0`). Es la
 * peor forma de gastar una tarde: el código queda "optimizado", la factura igual, y nadie se
 * entera porque no hay error.
 *
 * Esto mide el prefijo REAL —el mismo `system` y las mismas `tools` que manda `lib/turno.ts`— con
 * `count_tokens`, que es gratis, y lo compara contra el mínimo del modelo configurado.
 *
 * NO es un gate: necesita red y una API key, así que no entra a `npm run gates`. Es una
 * herramienta de decisión, y su salida es la que justifica hacer o no hacer el #39.
 */
import Anthropic from "@anthropic-ai/sdk";
import { cargarEnvLocal } from "./_env";
import { buildSystemPrompt } from "../lib/prompts";
import { toolDefinitions } from "../lib/tools";
import { MODELO_POR_DEFECTO } from "../lib/turno";
import type { Fase } from "../lib/estado/tipos";

cargarEnvLocal();

/**
 * Mínimo cacheable por familia de modelo. Si el prefijo no llega, `cache_control` es decorativo.
 * Fuente: documentación de prompt caching de Anthropic.
 */
const MINIMO: Array<[RegExp, number]> = [
  [/haiku/, 4096],
  [/sonnet/, 1024],
  [/opus|fable/, 512],
];

const minimoDe = (modelo: string) => MINIMO.find(([re]) => re.test(modelo))?.[1] ?? 4096;

const FASES: Fase[] = ["SALUDO", "DESCUBRIENDO", "RECONOCIDO", "ASESORANDO"];

async function main() {
  const modelo = MODELO_POR_DEFECTO;
  const minimo = minimoDe(modelo);

  if (!process.env.ANTHROPIC_API_KEY) {
    // Sin key no se MIDE, y decirlo es parte del punto: lo que sigue es una ESTIMACIÓN, con su
    // margen a la vista. No sustituye a `count_tokens`, sirve para saber si vale la pena mirarlo.
    console.log(`Modelo ....... ${modelo}`);
    console.log(`Mínimo ....... ${minimo} tokens\n`);
    console.log("No hay ANTHROPIC_API_KEY: no se puede medir. Estimación por tamaño:\n");
    const chars = (x: unknown) => (typeof x === "string" ? x : JSON.stringify(x)).length;
    const cTools = chars(toolDefinitions);
    for (const fase of FASES) {
      const total = cTools + chars(buildSystemPrompt(fase as never));
      // Español técnico con JSON: entre 3 y 4 caracteres por token. Se dan los dos extremos en vez
      // de un número que aparente una precisión que no hay.
      console.log(
        `tools + system(${fase.padEnd(12)}) ... ${String(total).padStart(6)} chars  ` +
          `≈ ${Math.round(total / 4)}–${Math.round(total / 3)} tokens`
      );
    }
    console.log(
      "\nCorre esto de nuevo con la key puesta: la estimación decide si vale la pena mirarlo,\n" +
      "la medición decide si se implementa."
    );
    return;
  }

  const client = new Anthropic();

  console.log(`Modelo ....... ${modelo}`);
  console.log(`Mínimo ....... ${minimo} tokens de prefijo para que el caching haga algo\n`);

  // El prefijo cacheable es lo que NO cambia turno a turno: `tools` + `system`. El contexto del
  // servidor (identidad, veredicto) sí cambia, así que se mide aparte para ver cuánto pesa.
  const soloTools = await client.beta.messages.countTokens({
    model: modelo,
    tools: toolDefinitions as never,
    messages: [{ role: "user", content: "." }],
  });

  console.log(`tools ........................ ${soloTools.input_tokens} tokens`);

  let algunaLlega = false;
  for (const fase of FASES) {
    const system = buildSystemPrompt(fase as never);
    const r = await client.beta.messages.countTokens({
      model: modelo,
      system,
      tools: toolDefinitions as never,
      messages: [{ role: "user", content: "." }],
    });
    const llega = r.input_tokens >= minimo;
    algunaLlega ||= llega;
    console.log(
      `tools + system(${fase.padEnd(12)}) ... ${String(r.input_tokens).padStart(5)} tokens  ` +
        `${llega ? "✅ supera el mínimo" : `❌ le faltan ${minimo - r.input_tokens}`}`
    );
  }

  console.log(
    `\n${algunaLlega
      ? "VEREDICTO: el prefijo da para cachear. Vale la pena marcar `tools` + `system` con\n" +
        "cache_control y medir `cache_read_input_tokens` en la respuesta siguiente."
      : "VEREDICTO: NO alcanza. Poner `cache_control` hoy no ahorraría nada y lo haría en\n" +
        "silencio. Las salidas son: cambiar de modelo (sonnet baja el mínimo a 1024) o no\n" +
        "hacer el #39. No hay una tercera que sea 'ponerlo por si acaso'."}`
  );
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
