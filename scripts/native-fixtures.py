"""Recria perfis sintéticos congelados sem Electron, Node ou pacotes Python externos."""
from pathlib import Path
import base64
import json
import shutil
import sqlite3
import tempfile

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "native/tests/fixtures"


def generate():
    """Materializa uma referência legada independente em diretório novo e exclusivo."""
    artifacts = ROOT / "artifacts/native-migration"
    artifacts.mkdir(parents=True, exist_ok=True)
    run = Path(tempfile.mkdtemp(prefix="fixtures-", dir=artifacts))
    profile = run / "legacy-populated"
    profile.mkdir()
    pixel = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
    for name in ["images/fixture/cover.png", "inventario/images/controle.png"]:
        image = profile / name
        image.parent.mkdir(parents=True, exist_ok=True)
        image.write_bytes(pixel)
    roms = profile / "ROMs com espaço/Ação"
    roms.mkdir(parents=True)
    for name in ["Aventura (Brasil).nes", "Aventura (Europa).nes"]:
        (roms / name).write_text("ROM SINTÉTICA - NÃO EXECUTÁVEL", encoding="utf-8")
    # A substituição ocorre só no SQL congelado, nunca em banco ou perfil do usuário.
    for template, destination in [
        ("legacy-before-migrations.sql", run / "legacy-before-migrations.db"),
        ("legacy-populated.sql", profile / "gamestock.db"),
    ]:
        sql = (FIXTURES / template).read_text(encoding="utf-8")
        sql = sql.replace("__FIXTURE_PROFILE__", profile.as_posix().replace("'", "''"))
        with sqlite3.connect(destination) as db:
            db.executescript(sql)
            assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
            assert not db.execute("PRAGMA foreign_key_check").fetchall()
    with sqlite3.connect(profile / "gamestock.db") as db:
        emulator = ROOT / "native/build/windows-msvc/Release/fake_emulator.exe"
        db.execute("UPDATE emulators SET executable=?, args=? WHERE name=?",
                   (str(emulator), '"' + str(run / "emulator-invocation.txt") + '"', "Emulador sintético"))
        db.row_factory = sqlite3.Row
        games = [dict(row) for row in db.execute(
            "SELECT games.*, platforms.name AS platform_name FROM games JOIN platforms ON platforms.id=games.platform_id ORDER BY games.id")]
    (run / "catalog.json").write_text(json.dumps(games, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.copy2(FIXTURES / "complete.gamestock-backup", run / "complete.gamestock-backup")
    (run / "verification.json").write_text(json.dumps({
        "source": "fixtures SQL congeladas do Electron; gerador stdlib independente",
        "checks": ["integrity", "foreign-keys"], "games": len(games),
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return run


if __name__ == "__main__":
    print(generate())
