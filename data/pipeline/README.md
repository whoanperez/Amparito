# data/pipeline — enriquecimiento de datos (sin PII)

Deriva la lógica de propensión a partir de la base real de afiliados de Colsubsidio, **sin persistir
datos personales**. Enfoque: *derivado + priors con fuente* (nada fabricado).

## ⚠️ Política de PII (Ley 1581 — habeas data)
El CSV real (`Usos_Productos_Afiliados_SIN_ID.csv`, ~197 MB) trae la columna `NOMBRE_COMPLETO` con
nombres reales pese a decirse anónimo. **Reglas duras:**
- El CSV **nunca** se sube al repo (bloqueado en `.gitignore`).
- El pipeline **descarta `NOMBRE_COMPLETO` en el paso 1** y jamás lo escribe a disco.
- Solo se versionan las salidas **derivadas y sin PII**.

## Cómo regenerar
```bash
python3 data/pipeline/profile_base.py /ruta/al/Usos_Productos_Afiliados_SIN_ID.csv
# → genera data/base_stats.json  (sin dependencias; ~8 s para 1,56M filas)
```

## Salidas (en `data/`, consumidas por el motor de propensión)
| Archivo | Qué es | Origen |
|---|---|---|
| `base_stats.json` | Distribuciones reales + **peer-groups** (para la prueba social "afiliados como tú") | **Computado** de la base 1,56M |
| `weights.json` | **Scorecard** documentado: señales → peso → reason code, con priors citados | Lógica + priors (DANE/Fasecolda/Superfinanciera) |
| `eventos_vida.json` | Matriz edad × grupo familiar → evento vital → productos + slots conversacionales | Derivado de la base |

## Por qué no es ML
La base **no tiene etiqueta de compra** de seguro → es imposible (y deshonesto) entrenar un modelo
supervisado de propensión. Un scorecard aditivo interpretable es el estándar en seguros regulados y
responde literal la pregunta del jurado: *"¿por qué a ESTA persona ESTE seguro?"*. Cada peso es
rastreable a una variable real o a una fuente citada — **no caja negra**.
