import catalogData from "../data/catalog.json";

export interface PrimaRegla {
  base: number;
  por_edad: number;
  edad_pivote: number;
  nota?: string;
}

export interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  aseguradora: string;
  estandarizado: boolean;
  requiere_asesoria: boolean;
  periodicidad: string;
  gatillos_vida: string[];
  coberturas: string[];
  exclusiones: string[];
  prima_regla: PrimaRegla;
  art9: { forma_calculo: string; consecuencias_no_pago: string };
  // Datos de trazabilidad (v2.2): fuente real y tipo de precio
  fuente?: string;            // URL de la fuente pública de las coberturas
  precio_tipo?: "referencia" | "regulado"; // "regulado" = tarifa oficial (ej. SOAT)
  nota_precio?: string;       // aclaración del precio mostrado
}

const productos: Producto[] = (catalogData as { productos: Producto[] }).productos;

export function getCatalog(): Producto[] {
  return productos;
}

export function getProduct(id: string): Producto | undefined {
  return productos.find((p) => p.id === id);
}

/** Normaliza texto para matching de gatillos (sin tildes, minúsculas). */
function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Recomendador: puntúa productos por coincidencia de gatillos de vida
 * contra el texto del perfil/situación. Determinista y explicable.
 */
export function recommendProducts(perfilTexto: string, gatillos: string[]): Producto[] {
  const haystack = norm([perfilTexto, ...gatillos].join(" "));
  const scored = productos
    .map((p) => {
      let score = 0;
      for (const g of p.gatillos_vida) {
        if (haystack.includes(norm(g))) score += 2;
      }
      if (gatillos.some((g) => norm(p.categoria).includes(norm(g)))) score += 1;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 2).map((x) => x.p);
}
