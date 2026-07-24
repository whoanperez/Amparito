#!/usr/bin/env python3
"""
profile_base.py — Perfila la base real de afiliados de Colsubsidio SIN PII.

Entrada: CSV `Usos_Productos_Afiliados_SIN_ID.csv` (separador ';', UTF-8 BOM).
Salida:  data/base_stats.json — distribuciones + tabla de "peer groups" para la
         prueba social ("afiliados como tú"). NUNCA persiste `NOMBRE_COMPLETO` (PII, Ley 1581).

Uso:
    python3 data/pipeline/profile_base.py /ruta/al/Usos_Productos_Afiliados_SIN_ID.csv

Nota de diseño: la base NO tiene etiqueta de compra de seguro → aquí solo derivamos
DISTRIBUCIONES reales (para peer-proof y para calibrar/justificar el scorecard). Los PESOS
de propensión viven en data/weights.json (lógica documentada + priors citados), no aquí.
"""
import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

# Columna PII que se descarta y NUNCA se escribe a disco.
PII_DROP = "NOMBRE_COMPLETO"

# Variables categóricas cuyas distribuciones exportamos.
CAT_VARS = [
    "GENERO", "RANGO_EDAD", "CATEGORIA", "SEGMENTO_GRUPO_FAMILIAR",
    "SEGMENTO_POBLACIONAL", "PIRAMIDE_NUEVA", "EMPRESA_FOCO",
]
MARKS = ["HOTELES", "PISCILAGO", "DROGUERIA", "AGENCIAS", "VIVIENDA"]

# Ejes del "peer group" para la prueba social (baja cardinalidad, ~240 celdas).
PEER_KEYS = ["GENERO", "RANGO_EDAD", "SEGMENTO_GRUPO_FAMILIAR", "CATEGORIA"]

# Normalización de etiquetas: el CSV trae typos ("AFILLIADO", "GRUPO_FAMILIAR").
NORM = {
    "AFILLIADO SIN GRUPO_FAMILIAR": "Sin grupo familiar",
    "FAMILIA MONOPARENTAL": "Monoparental",
    "FAMILIA MONOPARENTAL AMPLIADA": "Monoparental ampliada",
    "FAMILIA NUCLEAR INTEGRAL": "Nuclear integral",
    "FAMILIA NUCLEAR AMPLIADA": "Nuclear ampliada",
    "PAREJA CONYUGAL SIN HIJOS": "Pareja conyugal",
    "PAREJA CONYUGAL": "Pareja conyugal",
}


def norm(s: str) -> str:
    s = (s or "").strip()
    return NORM.get(s.upper(), s)


def main(csv_path: str) -> None:
    src = Path(csv_path)
    if not src.exists():
        sys.exit(f"No existe el CSV: {src}")

    total = 0
    dist = {v: Counter() for v in CAT_VARS}
    mark_counts = Counter()          # cuántos "SI" por marca
    n_marks_per_person = Counter()   # 0,1,2... marcas por afiliado
    peer = Counter()                 # peer-group -> conteo
    # Co-ocurrencia marca × segmento familiar (para justificar refuerzos, no como eje).
    mark_by_family = defaultdict(Counter)

    # utf-8-sig descarta el BOM automáticamente.
    with src.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            row.pop(PII_DROP, None)  # PII fuera desde el paso 1
            total += 1

            for v in CAT_VARS:
                dist[v][norm(row.get(v, "")) or "(vacío)"] += 1

            n = 0
            fam = norm(row.get("SEGMENTO_GRUPO_FAMILIAR", ""))
            for m in MARKS:
                if (row.get(m, "") or "").strip().upper() == "SI":
                    mark_counts[m] += 1
                    mark_by_family[m][fam] += 1
                    n += 1
            n_marks_per_person[n] += 1

            key = "|".join(norm(row.get(k, "")) or "(vacío)" for k in PEER_KEYS)
            peer[key] += 1

    # Peer groups como lista ordenada (solo celdas con señal suficiente para citar).
    peer_rows = [
        {"grupo": dict(zip(PEER_KEYS, k.split("|"))), "n": n,
         "pct": round(100 * n / total, 2)}
        for k, n in peer.most_common()
    ]

    out = {
        "_meta": {
            "fuente": src.name,
            "total_afiliados": total,
            "pii_descartada": PII_DROP,
            "nota": ("Distribuciones REALES de la base. Sin etiqueta de compra: los pesos "
                     "de propensión están en weights.json (lógica + priors citados), no aquí."),
        },
        "distribuciones": {v: dict(dist[v].most_common()) for v in CAT_VARS},
        "marcas_consumo": {
            "conteo_si": dict(mark_counts.most_common()),
            "pct_si": {m: round(100 * mark_counts[m] / total, 3) for m in MARKS},
            "n_marcas_por_afiliado": dict(sorted(n_marks_per_person.items())),
            "por_segmento_familiar": {m: dict(mark_by_family[m].most_common())
                                       for m in MARKS},
        },
        "peer_groups": {
            "ejes": PEER_KEYS,
            "n_celdas": len(peer_rows),
            "celdas": peer_rows,
        },
    }

    dst = Path(__file__).resolve().parents[1] / "base_stats.json"
    dst.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK · {total:,} afiliados procesados · {len(peer_rows)} peer-groups → {dst}")
    print(f"   PII '{PII_DROP}' descartada · sin nombres en la salida")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Uso: python3 profile_base.py <ruta_al_csv>")
    main(sys.argv[1])
