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

  /*
   * Las OTRAS DOS personas, que son las que traen el anti-venta.
   *
   * Esta suite reproducía solo a Carolina, y eso dejó sin cubrir justo lo que el demo va a mostrar
   * como diferencial: que a Andrés NO se le vende Vida y que a Jaime NO se le vuelve a vender el
   * Exequial. Se vio al añadir la compuerta de `ya_cubierto`: si hubiera roto a Jaime, este gate
   * habría seguido en verde y el paracaídas habría fallado en el salón.
   */
  console.log("\n===== Las otras dos personas, sin red =====");
  for (const quien of ["Andres", "Jaime"] as const) {
    const ev: EventoDemo[] = [];
    const rc: string[] = [];
    await playDemo(DEMO_SCRIPTS[quien], {
      addMsg: () => {},
      addEvent: (e) => ev.push(e),
      addRecommend: (r) => rc.push(...r.map((x) => x.nombre)),
      sleep: async () => {},
      cancelled: () => false,
    });
    const p = ev.find((e) => e.type === "propension")?.data as Record<string, any> | undefined;
    check(`${quien}: el flujo llega a la póliza`, ev.some((e) => e.type === "policy"));

    if (quien === "Andres") {
      // Aserción de PRESENCIA: no basta con que Vida no salga —una lista vacía también lo
      // cumpliría—, tiene que salir OTRA cosa en su lugar.
      const nombres = (p?.recomendaciones ?? []).map((r: any) => r.nombre);
      check("Andrés: se le recomienda algo", nombres.length > 0);
      check("Andrés: y NO es Vida (nadie depende de su ingreso)",
        !nombres.some((n: string) => /Seguro de Vida$/.test(n)));
      console.log(`      → ${nombres.join(", ")}`);
    } else {
      const cubierto = (p?.ledger?.ya_cubierto ?? []).map((x: any) => x.producto);
      check("Jaime: el Exequial aparece como YA CUBIERTO (anti-venta 2)",
        cubierto.some((n: string) => /Exequial/i.test(n)));
      check("Jaime: y aun así se le recomienda lo que sí le falta",
        (p?.recomendaciones ?? []).length > 0);
      console.log(`      → ya cubierto: ${cubierto.join(", ") || "nada"}`);
    }
  }

  console.log(ok ? "\n✅ OFFLINE OK — las 3 personas, con prueba social, anti-venta y cierre rotulado" : "\n❌ OFFLINE FALLÓ");
  process.exit(ok ? 0 : 1);
}

main();
