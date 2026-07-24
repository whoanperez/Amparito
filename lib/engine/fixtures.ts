/**
 * Las 3 personas del guion de demo como `Perfil` estructurado.
 * Sirven de fixtures para validar el motor (scripts/test-propension.ts) y de
 * respuestas pre-cacheadas del camino crítico. Nombres sintéticos (cero PII).
 * Ver docs/reto/07-guion-demo.md.
 */
import { Perfil } from "./types";

export const PERSONAS: Record<string, Perfil> = {
  // A · Andrés, 28 — soltero, sin dependientes, moto nueva → Accidentes + Movilidad.
  //     Anti-venta 1: NO se le recomienda Vida (nadie depende de su ingreso).
  Andres: {
    GENERO: "M",
    RANGO_EDAD: "20 a 35 años",
    CATEGORIA: "A",
    SEGMENTO_GRUPO_FAMILIAR: "Sin grupo familiar",
    SEGMENTO_POBLACIONAL: "Medio",
    enriquecido: { dependientes: 0, tiene_vehiculo: ["moto"] },
  },

  // B · Carolina, 39 — cabeza de hogar monoparental, 1 hijo, cat A → Seguro de Vida.
  //     Es el corazón del demo: sostén único + prueba social peer-group real.
  Carolina: {
    GENERO: "F",
    RANGO_EDAD: "36 a 45 años",
    CATEGORIA: "A",
    SEGMENTO_GRUPO_FAMILIAR: "Monoparental",
    SEGMENTO_POBLACIONAL: "Medio",
    enriquecido: { dependientes: 1 },
  },

  // C · Jaime, 58 — pareja conyugal, ya tiene Exequial con Colsubsidio.
  //     Anti-venta 2: no se le vende Exequial otra vez; se le ofrece Vida (incapacidad).
  Jaime: {
    GENERO: "M",
    RANGO_EDAD: "Mayor de 55 años",
    CATEGORIA: "B",
    SEGMENTO_GRUPO_FAMILIAR: "Pareja conyugal",
    SEGMENTO_POBLACIONAL: "Medio",
    enriquecido: {},
    ya_cubierto: ["exequial"],
  },
};
