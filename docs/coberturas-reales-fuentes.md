# Coberturas reales y fuentes — catálogo Amparito

> Investigación con verificación adversarial (23 afirmaciones confirmadas contra fuentes primarias: clausulados oficiales y páginas de producto de las aseguradoras + Fasecolda). Útil para el pitch: la data de coberturas de estos productos NO es inventada, sale de documentos oficiales citables.

## Productos con data real y fuente citada

| Producto | Aseguradora | Fuente (oficial) |
|---|---|---|
| Accidentes Personales | MetLife | Clausulado oficial Colsubsidio/MetLife (PDF) — colsubsidio.com/hubfs/documentos/colsubsidio/poliza-de-seguro-de-accidentes-personales-colsubsidio.pdf |
| Seguro de Vida | Pan-American Life | Clausulado "Vive Créditos" alojado en Colsubsidio (PDF Pan-American) |
| Seguro de Vida para Créditos | Pan-American Life | Mismo clausulado Pan-American (deudor) |
| SOAT | Seguros Mundial | Topes 2026 — Fasecolda (fasecolda.com/ramos/soat/tarifas-comerciales/cobertura-por-victima) |
| Seguro de Mascotas | Seguros Bolívar | segurosbolivar.com/seguro-para-mascotas |
| Medicina Prepagada Mascotas | VetPlus | vetpluscolombia.com |
| Seguro de Hogar y Contenidos | Chubb | Términos y Condiciones Hogar (PDF oficial Chubb, canal Leal) |

## Datos duros verificados (para el pitch)

- **Accidentes Personales (MetLife):** cubre muerte accidental y presunta (incluye homicidio, terrorismo, atraco, ahogamiento, mordedura de animal); desmembración escalonada 3%–100%; incapacidad total y permanente con pérdida de capacidad laboral > 50%. La muerte debe ocurrir dentro de 365 días del accidente. Exclusiones: preexistencias, riñas (salvo legítima defensa), guerra, alcohol/drogas, deportes de alto riesgo, aeronaves privadas.
- **Vida (Pan-American Life):** fallecimiento por cualquier causa, incluye homicidio y suicidio, SIN periodos de carencia; ITP ≥ 50%. Exclusiones: guerra y riesgo nuclear; reticencia en la declaración (arts. 1058 y 1158 C. de Comercio).
- **SOAT (topes 2026, Fasecolda):** gastos médicos hasta $36.749.788; incapacidad permanente hasta $10.505.430; muerte y gastos funerarios hasta $43.772.625. Tarifa moto 100–200cc: $343.300.
- **Mascotas (Seguros Bolívar):** urgencias veterinarias, daños a terceros (RC) y exequias de la mascota; excluye preexistencias, vacunación, peluquería; ingreso solo entre 4 meses y 9 años.
- **Prepagada mascotas (VetPlus):** es medicina prepagada (no seguro). Plan Diamante: accidentes, enfermedades crónico-degenerativas, hereditarias (carencia de 1 año), cáncer y médico a domicilio.
- **Hogar (Chubb):** incendio de edificio y contenidos, RC extracontractual y hurto de contenidos, con valores escalonados por plan; deducible en hurto 10% (mín. 0,5 SMMLV).

## Productos con data de referencia (aún no verificada con fuente pública)

Salud (BMI), Asistencia médica familiar, Todo Riesgo Carro, Moto, Bici/patineta, Arrendamiento, Exequial, Asistencia de viajes y Asistencias múltiples usan coberturas realistas de referencia. Sus clausulados no son públicos o no se verificaron en esta corrida. En la app aparecen sin enlace "Ver fuente" (así se distinguen de los verificados). Se pueden profundizar uno a uno si se necesita.

## Nota sobre precios

Todos los precios son "valor de referencia (simulado)", salvo el **SOAT**, que es tarifa oficial regulada. El precio real de cada producto lo confirma la aseguradora vía su API en la emisión (punto de integración del InsurerGateway).

## Advertencias de la investigación

- El "Vida Deudor" de MetLife verificado corresponde al convenio con Banco Serfinanza (distinto del Vida Deudor que Colsubsidio ofrece con Pan-American/BMI). En el catálogo usamos el clausulado de Pan-American (Colsubsidio Vive Créditos).
- Se descartaron por refutación dos afirmaciones sobre un producto de mascotas de Seguros Alfa/Banco de Bogotá (no aplica a Colsubsidio/Bolívar) — no usar.
- Los topes del SOAT dependen del salario mínimo (válidos para 2026, Decreto 0159 de 2026).
