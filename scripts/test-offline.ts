/**
 * Verifica el demo offline: reproduce una persona end-to-end sin red y confirma las tarjetas.
 *
 * Verifica también el CONTENIDO, no solo que los eventos existan. Motivo: al construir la
 * compuerta de entrada (B3) el offline perdió la prueba social en silencio — los cuatro eventos
 * seguían llegando y el gate seguía en verde, pero el momento central del demo de Carolina
 * (los 62.459 afiliados de su segmento) había desaparecido de la tarjeta.
 */
import { playDemo } from "../lib/demo/player";
import { DEMO_SCRIPTS } from "../lib/demo/scripts";

/** El player entrega el evento con `type` como string; aquí solo se inspecciona. */
type EventoDemo = { type: string; data: Record<string, unknown> };

async function main() {
  const eventos: EventoDemo[] = [];
  const recs: string[] = [];
  let ok = true;
  const check = (label: string, cond: boolean) => {
    console.log(`   ${cond ? "✅" : "❌"} ${label}`);
    if (!cond) ok = false;
  };

  await playDemo(DEMO_SCRIPTS.Carolina, {
    addMsg: () => {},
    addEvent: (e) => eventos.push(e),
    addRecommend: (r) => recs.push(...r.map((x) => x.nombre)),
    sleep: async () => {},
    cancelled: () => false,
  });

  const tipos = eventos.map((e) => e.type);
  console.log("Eventos:", tipos.join(" · "));
  console.log("Recomendaciones:", recs.join(", "));

  check("los 4 eventos del flujo llegan", ["propension", "impacto", "quote", "policy"].every((e) => tipos.includes(e)));

  const prop = eventos.find((e) => e.type === "propension")?.data as Record<string, any> | undefined;
  check("hay recomendaciones", (prop?.recomendaciones?.length ?? 0) > 0);
  check("Vida es el #1 de Carolina", prop?.recomendaciones?.[0]?.nombre === "Seguro de Vida");
  // El momento central del demo: el dato real del segmento. Si esto se cae, el demo pierde su punta.
  check("la prueba social está presente", !!prop?.peer);
  if (prop?.peer) {
    console.log(`      peer: ${Number(prop.peer.n).toLocaleString("es-CO")} — ${prop.peer.descripcion}`);
  }

  const policy = eventos.find((e) => e.type === "policy")?.data as Record<string, any> | undefined;
  check("la póliza se rotula como simulada", String(policy?.certificado ?? "").includes("SIMULACIÓN"));

  console.log(ok ? "\n✅ OFFLINE OK — flujo completo local, con prueba social y cierre rotulado" : "\n❌ OFFLINE FALLÓ");
  process.exit(ok ? 0 : 1);
}

main();
