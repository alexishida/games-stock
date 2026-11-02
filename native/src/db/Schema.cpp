/** Schema compatível com o banco do Electron; a ordem das colunas não muda IDs. */
#include "Schema.h"

#include <QSqlError>
#include <QSqlQuery>
#include <QStringList>

namespace gamestock {
namespace {
/** O driver QSQLITE executa um comando por vez; triggers mantêm o corpo inteiro. */
bool execStatements(QSqlDatabase& database, const QStringList& statements, QString* error) {
    for (const QString& sql : statements) {
        QSqlQuery query(database);
        if (query.exec(sql)) continue;
        if (error) *error = query.lastError().text() + QStringLiteral(" (") + sql.left(80) + QLatin1Char(')');
        return false;
    }
    return true;
}
} // namespace

bool addColumnIfMissing(QSqlDatabase& database, const QString& table, const QString& column,
    const QString& definition, QString* error) {
    // Nomes vêm de uma lista fechada no código, nunca de dados externos.
    QSqlQuery info(database);
    if (!info.exec(QStringLiteral("PRAGMA table_info(") + table + QLatin1Char(')'))) {
        if (error) *error = info.lastError().text();
        return false;
    }
    while (info.next()) {
        if (info.value(1).toString() == column) return true;
    }
    QSqlQuery alter(database);
    if (alter.exec(QStringLiteral("ALTER TABLE ") + table + QStringLiteral(" ADD COLUMN ") + column + QLatin1Char(' ') + definition)) return true;
    if (error) *error = alter.lastError().text();
    return false;
}

bool ensureGamesLaunchBoxUniqueIndex(QSqlDatabase& database, QString* error) {
    return execStatements(database, {QStringLiteral(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_games_platform_launchbox_unique "
        "ON games(platform_id, launchbox_id) "
        "WHERE launchbox_id IS NOT NULL AND TRIM(launchbox_id) != ''")}, error);
}

bool applySchema(QSqlDatabase& database, QString* error) {
    const QStringList structure = {
        QStringLiteral("CREATE TABLE IF NOT EXISTS platforms ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, category TEXT NOT NULL, "
            "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
        QStringLiteral("CREATE TABLE IF NOT EXISTS games ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, platform_id INTEGER NOT NULL, publisher TEXT, "
            "year INTEGER, genre TEXT, rating TEXT, box_art_path TEXT, background_path TEXT, screenshot_path TEXT, "
            "rom_path TEXT, favorite INTEGER NOT NULL DEFAULT 0, play_status TEXT NOT NULL DEFAULT 'unplayed', "
            "notes TEXT, launchbox_id TEXT, launch_count INTEGER NOT NULL DEFAULT 0, library_group_key TEXT, "
            "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, "
            "FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE RESTRICT)"),
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_games_title ON games(title)"),
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_games_platform ON games(platform_id)"),
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_games_platform_title ON games(platform_id, title COLLATE NOCASE)"),
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_games_launchbox ON games(launchbox_id)"),
        QStringLiteral("CREATE TABLE IF NOT EXISTS platform_launchbox_aliases ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE, "
            "alias TEXT NOT NULL COLLATE NOCASE UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
        QStringLiteral("CREATE TABLE IF NOT EXISTS platform_rom_extensions ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE, "
            "extension TEXT NOT NULL, kind TEXT NOT NULL DEFAULT '', is_primary INTEGER NOT NULL DEFAULT 1, "
            "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(platform_id, extension))"),
        QStringLiteral("CREATE TABLE IF NOT EXISTS emulators ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, executable TEXT NOT NULL DEFAULT '', "
            "args TEXT NOT NULL DEFAULT '', is_retroarch INTEGER NOT NULL DEFAULT 0, "
            "created_at TEXT NOT NULL DEFAULT (datetime('now')))"),
        QStringLiteral("CREATE TABLE IF NOT EXISTS platform_emulators ("
            "platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE, "
            "emulator_id INTEGER NOT NULL REFERENCES emulators(id) ON DELETE CASCADE, "
            "is_default INTEGER NOT NULL DEFAULT 0, core_path TEXT, PRIMARY KEY (platform_id, emulator_id))"),
        QStringLiteral("CREATE TABLE IF NOT EXISTS app_state ("
            "key TEXT PRIMARY KEY, value_json TEXT NOT NULL, "
            "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
        QStringLiteral("CREATE TRIGGER IF NOT EXISTS trg_platform_emulators_single_default_insert "
            "BEFORE INSERT ON platform_emulators WHEN NEW.is_default = 1 BEGIN "
            "UPDATE platform_emulators SET is_default = 0 WHERE platform_id = NEW.platform_id; END"),
        QStringLiteral("CREATE TRIGGER IF NOT EXISTS trg_platform_emulators_single_default_update "
            "BEFORE UPDATE OF is_default ON platform_emulators WHEN NEW.is_default = 1 BEGIN "
            "UPDATE platform_emulators SET is_default = 0 "
            "WHERE platform_id = NEW.platform_id AND emulator_id != NEW.emulator_id; END"),
    };
    if (!execStatements(database, structure, error)) return false;

    // Colunas introduzidas depois da criação inicial da tabela.
    struct Column { const char* table; const char* column; const char* definition; };
    static const Column columns[] = {
        {"games", "favorite", "INTEGER NOT NULL DEFAULT 0"},
        {"games", "play_status", "TEXT NOT NULL DEFAULT 'unplayed'"},
        {"games", "background_path", "TEXT"},
        {"games", "screenshot_path", "TEXT"},
        {"games", "rom_path", "TEXT"},
        {"games", "launchbox_id", "TEXT"},
        {"games", "launch_count", "INTEGER NOT NULL DEFAULT 0"},
        {"games", "library_group_key", "TEXT"},
        {"platforms", "is_default", "INTEGER NOT NULL DEFAULT 0"},
    };
    for (const auto& column : columns) {
        if (!addColumnIfMissing(database, QString::fromLatin1(column.table), QString::fromLatin1(column.column),
                QString::fromLatin1(column.definition), error)) return false;
    }

    const QStringList extraIndexes = {
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_games_favorite ON games(favorite)"),
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_games_play_status ON games(play_status)"),
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_games_rom_path ON games(rom_path)"),
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_games_launch_count ON games(launch_count DESC)"),
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_games_library_group_title ON games(platform_id, library_group_key, title COLLATE NOCASE) "
            "WHERE library_group_key IS NOT NULL AND library_group_key != ''"),
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_games_recent ON games(created_at DESC, id DESC)"),
    };
    if (!execStatements(database, extraIndexes, error)) return false;

    // ── Inventário de hardware físico ──────────────────────────────────────────
    const QStringList inventory = {
        QStringLiteral("CREATE TABLE IF NOT EXISTS item_types ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, is_default INTEGER NOT NULL DEFAULT 0, "
            "created_at TEXT NOT NULL DEFAULT (datetime('now')))"),
        QStringLiteral("CREATE TABLE IF NOT EXISTS conservation_states ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, is_default INTEGER NOT NULL DEFAULT 0, "
            "created_at TEXT NOT NULL DEFAULT (datetime('now')))"),
        QStringLiteral("CREATE TABLE IF NOT EXISTS hardware_items ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, "
            "platform_id INTEGER REFERENCES platforms(id) ON DELETE SET NULL, is_multiplatform INTEGER NOT NULL DEFAULT 0, "
            "item_type_id INTEGER REFERENCES item_types(id) ON DELETE SET NULL, "
            "conservation_state_id INTEGER REFERENCES conservation_states(id) ON DELETE SET NULL, "
            "description TEXT NOT NULL DEFAULT '', acquisition_date TEXT, acquisition_url TEXT, color TEXT, value REAL, "
            "serial_number TEXT, region TEXT, storage_location TEXT, loan_to TEXT, "
            "created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))"),
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_hardware_items_platform ON hardware_items(platform_id)"),
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_hardware_items_type ON hardware_items(item_type_id)"),
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_hardware_items_state ON hardware_items(conservation_state_id)"),
        QStringLiteral("CREATE TABLE IF NOT EXISTS hardware_item_photos ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL REFERENCES hardware_items(id) ON DELETE CASCADE, "
            "file_path TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, "
            "created_at TEXT NOT NULL DEFAULT (datetime('now')))"),
        QStringLiteral("CREATE INDEX IF NOT EXISTS idx_hardware_item_photos_item ON hardware_item_photos(item_id, sort_order)"),
    };
    if (!execStatements(database, inventory, error)) return false;

    if (!addColumnIfMissing(database, QStringLiteral("hardware_items"), QStringLiteral("is_multiplatform"),
            QStringLiteral("INTEGER NOT NULL DEFAULT 0"), error)) return false;
    return execStatements(database, {QStringLiteral(
        "CREATE INDEX IF NOT EXISTS idx_hardware_items_multi ON hardware_items(is_multiplatform)")}, error);
}
} // namespace gamestock
