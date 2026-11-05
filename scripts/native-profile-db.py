"""Prepara cópia consistente de fixture para capturas; não modifica a origem."""
from pathlib import Path
import sqlite3
import sys


def prepare(source, target, mode="clean"):
    """Copia também transações do WAL e remove somente estados visuais de teste."""
    source, target = Path(source).resolve(), Path(target).resolve()
    if source == target or mode not in ("clean", "jobs"):
        raise ValueError("Origem/destino distintos e modo clean ou jobs são obrigatórios.")
    target.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as original:
        with sqlite3.connect(target) as copied:
            original.backup(copied)
            if mode == "clean":
                copied.execute("DELETE FROM app_state WHERE key LIKE '%job%' OR key LIKE '%ui.libraryFilters%'")


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        raise SystemExit("Uso: python scripts/native-profile-db.py <origem> <destino> [clean|jobs]")
    prepare(*sys.argv[1:])
