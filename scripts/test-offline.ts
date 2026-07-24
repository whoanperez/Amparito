/** Verifica el demo offline: reproduce una persona end-to-end sin red y confirma las tarjetas. */
import { playDemo } from "../lib/demo/player";
import { DEMO_SCRIPTS } from "../lib/demo/scripts";

async function main() {
  const events: string[] = [];
  const recs: string[] = [];

  await playDemo(DEMO_SCRIPTS.Carolina, {
    addMsg: () => {},
    addEvent: (e) => events.push(e.type),
    addRecommend: (r) => recs.push(...r.map((x) => x.nombre)),
    sleep: async () => {},
    cancelled: () => false,
  });

  console.log("Eventos:", events.join(" · "));
  console.log("Recomendaciones:", recs.join(", "));
  const ok = ["propension", "impacto", "quote", "policy"].every((e) => events.includes(e));
  console.log(ok ? "\n✅ OFFLINE OK — propensión + impacto + cotización + póliza, todo local sin red" : "\n❌ faltan eventos");
  process.exit(ok ? 0 : 1);
}

main();
