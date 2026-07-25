/**
 * Guiones offline de las 3 personas (red de seguridad del demo, RNF-1).
 *
 * Cada guion es una secuencia de beats. El player (lib/demo/player.ts) los reproduce sin red:
 * las frases de Amparito son fijas, pero las TARJETAS las produce `executeTool` en local (el
 * mismo motor + gateway mock del flujo en vivo). El `quoteId` de la cotización se hilvana hacia
 * la emisión automáticamente. Contactos sintéticos (cero PII).
 */
import { PERSONAS } from "../engine/fixtures";

export interface DemoBeat {
  role: "user" | "assistant";
  say?: string;
  tool?: { name: string; input: Record<string, unknown> };
}

const contacto = (nombre: string, fechaNacimiento: string) => ({
  nombre,
  tipoDocumento: "CC",
  numeroDocumento: "10000000",
  fechaNacimiento,
  celular: "3000000000",
  correo: "demo@ejemplo.com",
});

export const DEMO_SCRIPTS: Record<string, DemoBeat[]> = {
  // A · Andrés — anti-venta 1: NO se le vende Vida.
  Andres: [
    { role: "user", say: "Hola, tengo 28 años, soltero y sin hijos, y acabo de comprar una moto." },
    { role: "assistant", say: "¡Felicitaciones por la moto, Andrés! 🏍️ Déjame mirar qué es lo que de verdad te conviene proteger.", tool: { name: "calcular_propension", input: { perfil: PERSONAS.Andres } } },
    { role: "assistant", say: "Te seré honesto: no te vendo un Seguro de Vida, hoy nadie depende de tu ingreso. Lo tuyo es protegerte a ti con Accidentes Personales. ¿Te cotizo?" },
    { role: "user", say: "Sí, dale." },
    { role: "assistant", say: "Aquí está tu cotización. Abajo puedes ver qué te cubre y qué no.", tool: { name: "quote_product", input: { productId: "accidentes_personales_metlife", perfil: { edad: 28, ciudad: "Bogotá" } } } },
    { role: "assistant", say: "¿Avanzamos y te dejo asegurado?" },
    { role: "user", say: "Sí, quiero." },
    { role: "assistant", say: "Perfecto, con esto queda listo.", tool: { name: "issue_policy", input: { consentimiento: true, contacto: contacto("Andrés Gómez Ruiz", "15/03/1998") } } },
    { role: "assistant", say: "¡Listo, Andrés! Protegido para lo tuyo, sin pagar de más." },
  ],

  // B · Carolina — el corazón: sostén monoparental → Vida.
  Carolina: [
    { role: "user", say: "Hola, tengo 39 años y soy mamá cabeza de hogar con un hijo de 8 años, en Soacha." },
    { role: "assistant", say: "Hola Carolina 💛 Veo que eres el único ingreso de tu hogar y tienes un hijo pequeño. Déjame mirar qué los protege mejor a los dos.", tool: { name: "calcular_propension", input: { perfil: PERSONAS.Carolina } } },
    { role: "assistant", say: "Antes de hablar de plata, quiero que veas algo. ¿Cuánto ganas más o menos al mes?" },
    { role: "user", say: "Como $1.800.000." },
    { role: "assistant", say: "Mira esto con calma.", tool: { name: "calcular_impacto_ingreso", input: { ingreso_mensual: 1800000, dependientes: 1, anos_proteccion: 10 } } },
    { role: "assistant", say: "No es un gasto: es que a tu hijo nunca le falte tu respaldo. Por eso un Seguro de Vida es lo que más te protege. ¿Te muestro cuánto sería?" },
    { role: "user", say: "Sí, muéstrame." },
    { role: "assistant", say: "Aquí está. Abajo ves en detalle qué te cubre y qué no.", tool: { name: "quote_product", input: { productId: "vida_panamerican", perfil: { edad: 39, ciudad: "Soacha" } } } },
    { role: "assistant", say: "¿Te gustaría quedar asegurada?" },
    { role: "user", say: "Sí, quiero." },
    { role: "assistant", say: "Perfecto. Con estos datos queda listo al instante.", tool: { name: "issue_policy", input: { consentimiento: true, contacto: contacto("Carolina Ramírez López", "22/07/1987") } } },
    { role: "assistant", say: "¡Listo, Carolina! Tu solicitud queda completa. Ojo: esto es una simulación del proceso — no se emitió ninguna póliza." },
  ],

  // C · Jaime — anti-venta 2: ya tiene Exequial; se le ofrece Vida (incapacidad).
  Jaime: [
    { role: "user", say: "Hola, tengo 58 años, vivo con mi esposa y ya tengo un seguro exequial con Colsubsidio." },
    { role: "assistant", say: "Gracias por contarme, Jaime. Déjame revisar tu situación con calma.", tool: { name: "calcular_propension", input: { perfil: PERSONAS.Jaime } } },
    { role: "assistant", say: "Veo que el Exequial ya lo tienes con Colsubsidio, así que no te lo ofrezco de nuevo. Lo que sí te falta es respaldo si te incapacitas: un Seguro de Vida. ¿Te muestro?" },
    { role: "user", say: "Sí, por favor." },
    { role: "assistant", say: "Aquí lo tienes, con lo que cubre y lo que no.", tool: { name: "quote_product", input: { productId: "vida_panamerican", perfil: { edad: 58, ciudad: "Bogotá" } } } },
    { role: "assistant", say: "¿Avanzamos?" },
    { role: "user", say: "Sí." },
    { role: "assistant", say: "Perfecto, Jaime.", tool: { name: "issue_policy", input: { consentimiento: true, contacto: contacto("Jaime Ortiz Vega", "10/05/1968") } } },
    { role: "assistant", say: "Listo, Jaime. Quedaste con el respaldo que te faltaba." },
  ],
};
