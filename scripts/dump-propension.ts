/** Exporta la salida real del motor para las 3 personas (para el review visual). */
import { calcularPropension } from "../lib/engine/scorecard";
import { PERSONAS } from "../lib/engine/fixtures";

const out: Record<string, unknown> = {};
for (const [nombre, perfil] of Object.entries(PERSONAS)) {
  out[nombre] = calcularPropension(perfil);
}
console.log(JSON.stringify(out, null, 2));
