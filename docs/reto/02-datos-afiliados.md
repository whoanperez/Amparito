# Insumo de datos — Base de afiliados

> El **insumo principal** del reto: base con la **totalidad de afiliados** a Colsubsidio (anonimizada
> por número de serie). Objetivo: **perfilar afiliados para identificar qué seguros ofrecerles**.
> Archivo: `Usos_Productos_Afiliados_SIN_ID.csv` (~197 MB, **PII — vive solo en la máquina local, nunca
> en este repo**; el `.gitignore` lo bloquea). Salidas derivadas sin PII: [`../../data/`](../../data/).
> Oferta de seguros de referencia: https://www.colsubsidio.com/seguros

## Ficha del archivo

- **Registros:** 1.566.028 afiliados (todos, a la fecha).
- **Tamaño:** ~197 MB. **No abrir completo en Excel** (supera el límite de filas). Procesar por código
  o abrir muestra en editor de texto. Separador **`;`** (punto y coma), encoding UTF-8 con BOM.
- **Recomendación oficial:** trabajar por **número de serie** (`SERIE`), no por cédula (no hay cédulas
  reales).

## ⚠️ Alerta de PII (importante)

El brief dice "anonimizada, sin nombres ni cédulas", pero **el archivo SÍ incluye la columna
`NOMBRE_COMPLETO` con nombres reales**. Tratar el archivo como **dato personal sensible**:
- **No** subirlo a repos públicos, servicios externos, ni pasarlo a LLMs en la nube fila por fila.
- Para el MVP, **ignorar/descartar `NOMBRE_COMPLETO`** (trabajar solo con `SERIE` + variables de
  perfil). Idealmente generar una copia sin esa columna para el desarrollo.

## Esquema (16 columnas)

| # | Columna | Tipo | Valores observados |
|---|---|---|---|
| 1 | `SERIE` | id | 1..1.566.028 |
| 2 | `NOMBRE_COMPLETO` | texto | ⚠️ PII — descartar |
| 3 | `GENERO` | cat | F, M |
| 4 | `RANGO_EDAD` | cat | Menor de 19 · 20 a 35 · 36 a 45 · 46 a 55 · Mayor de 55 |
| 5 | `CATEGORIA` | cat | A, B, C, D(2), vacío — categoría de afiliación (A = menor ingreso) |
| 6 | `SEGMENTO_GRUPO_FAMILIAR` | cat | Afiliado sin grupo familiar · Monoparental · Monoparental ampliada · Pareja conyugal · Nuclear integral · Nuclear ampliada |
| 7 | `SEGMENTO_POBLACIONAL` | cat | Básico · Joven · Medio · Alto |
| 8 | `PIRAMIDE_NUEVA` | cat | 1 Grandes · 2 Medianas · 3 Empresarial Top · 4 Empresarial Estándar · 5 Micro Transaccional · 6.1 Facultativo · 6.2 Independiente · 6.3 Pensionado |
| 9 | `EMPRESA_FOCO` | flag | `X` o vacío (17% marcado) |
| 10 | `ESTADOAFILIADO` | cat | **"Al dia" (100%)** → sin poder discriminante |
| 11 | `CIUDAD_AFILIADO` | texto | 42% con dato; resto vacío |
| 12 | `HOTELES` | SI/NO | marca de consumo 2026 |
| 13 | `PISCILAGO` | SI/NO | marca de consumo (recreación/piscinas) |
| 14 | `DROGUERIA` | SI/NO | marca de consumo |
| 15 | `AGENCIAS` | SI/NO | marca de consumo (agencias de viajes) |
| 16 | `VIVIENDA` | SI/NO | 5ª marca de servicios |

## Distribuciones (perfilado completo sobre 1.566.028)

**Género:** M 870.562 (55.6%) · F 695.466 (44.4%)

**Rango de edad:** 20–35 → 47.0% · 36–45 → 24.9% · 46–55 → 15.3% · Mayor de 55 → 11.3% ·
Menor de 19 → 1.5%. → **base joven-adulta.**

**Categoría:** A 1.187.788 (75.9%) · B 226.688 (14.5%) · C 137.640 (8.8%) · vacío 0.9% · D 2.
→ **fuertemente sesgada a A** (menor ingreso).

**Segmento grupo familiar:** Afiliado sin grupo familiar 908.102 (58.0%) · Monoparental 367.713
(23.5%) · Nuclear integral 147.289 (9.4%) · Pareja conyugal 85.695 (5.5%) · Monoparental ampliada
34.0k (2.2%) · Nuclear ampliada 69. → **mayoría sin grupo familiar registrado.**

**Segmento poblacional:** Básico 764.794 (48.8%) · Medio 419.563 (26.8%) · Joven 361.381 (23.1%) ·
Alto 5.732 (0.4%).

**Pirámide:** 5 Micro Transaccional 508.345 (+13.8k variante) · 2 Medianas 314.199 · 1 Grandes
313.408 (+67 variante) · 3 Empresarial Top 182.114 · 6.1 Facultativo 81.279 · 4 Empresarial Estándar
62.998 · 6.3 Pensionado 43.729 · 6.2 Independiente 25.421.

**Empresa foco:** 17% marcado `X`, 83% vacío.

**Ciudad:** 42% con dato. Top: Bogotá 531.275 · Soacha 27.058 · Fusagasugá · Mosquera · Zipaquirá ·
Funza · Facatativá · Madrid · Girardot · Chía… → **Bogotá + Sabana de Cundinamarca.**

### Marcas de consumo — señal MUY escasa (clave para el diseño)

| Marca | Afiliados "SI" | % |
|---|---:|---:|
| Droguería | 86.985 | 5.6% |
| Piscilago | 76.344 | 4.9% |
| Vivienda | 1.048 | 0.07% |
| Hoteles | 426 | 0.03% |
| Agencias | 248 | 0.016% |

**Nº de marcas por afiliado:** 0 marcas → **1.408.173 (89.9%)** · 1 marca → 151.714 (9.7%) ·
2 marcas → 6.134 · 3 marcas → 7 · 4–5 → 0.

## Implicaciones para la lógica de propensión

1. **El consumo NO puede ser el eje principal:** ~90% no tiene ninguna marca. Úsalo como **boost/
   enriquecimiento** cuando esté presente (ej. Agencias→viaje, Piscilago→familia/recreación,
   Droguería→salud), no como base.
2. **El eje real de propensión son las variables demográfico-familiares:** `RANGO_EDAD`,
   `SEGMENTO_GRUPO_FAMILIAR`, `CATEGORIA`, `SEGMENTO_POBLACIONAL`, `PIRAMIDE_NUEVA`, `GENERO`,
   `EMPRESA_FOCO`, `CIUDAD`. Con eso se construye el "por qué este seguro".
3. **Descartar columnas sin señal:** `ESTADOAFILIADO` (100% "Al dia") y `NOMBRE_COMPLETO` (PII).
4. **Faltan variables que el brief menciona como ideales** (nº de beneficiarios exacto, eventos de
   vida, hábitos, tipo de empleo detallado). Parte se **infiere** del segmento familiar/pirámide; el
   resto se **enriquece en la conversación** (deseado por el equipo → ver ejemplo "Carolina").
5. **Mapa perfil → producto (hipótesis inicial, a validar contra el catálogo real):**
   - Monoparental / Nuclear integral / Pareja conyugal → **Personal y Familiar (vida)**.
   - Con hijos / dependientes → **vida + educación**.
   - Ciudad + categoría media/alta → **Hogar / Movilidad (carro)**.
   - Joven urbano sin grupo familiar → **Movilidad (bici/patineta)**, mascotas.
   - Consumo Droguería/edad mayor → **salud / exequial**.
   *(Formalizar como matriz determinística y explicable — cumple "lógica documentada, no caja negra".)*

## Pendientes de datos

- [ ] **Catálogo real de productos con coberturas y tarifas** (de colsubsidio.com/seguros) para cerrar
      el mapa perfil→producto y el cotizador.
- [ ] Confirmar significado de negocio de `PIRAMIDE_NUEVA` y `SEGMENTO_POBLACIONAL` (¿tamaño de empresa
      empleadora? ¿nivel socioeconómico?).
- [ ] Generar **copia de trabajo sin `NOMBRE_COMPLETO`** para desarrollo.
