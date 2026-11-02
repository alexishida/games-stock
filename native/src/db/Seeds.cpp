/** Seeds do banco nativo; cada rotina é idempotente como a do Electron. */
#include "Seeds.h"

#include "PlatformCatalogData.h"

#include <QSqlError>
#include <QSqlQuery>

namespace gamestock {
namespace {
/** Executa um comando preparado e propaga a mensagem do SQLite. */
bool run(QSqlQuery& query, QString* error) {
    if (query.exec()) return true;
    if (error) *error = query.lastError().text();
    return false;
}
} // namespace

bool seedPlatforms(QSqlDatabase& database, QString* error) {
    QSqlQuery insert(database);
    if (!insert.prepare(QStringLiteral("INSERT OR IGNORE INTO platforms (name, category, is_default) VALUES (?, ?, 1)"))) {
        if (error) *error = insert.lastError().text();
        return false;
    }
    QSqlQuery update(database);
    if (!update.prepare(QStringLiteral("UPDATE platforms SET is_default = 1 WHERE name = ? AND is_default = 0"))) {
        if (error) *error = update.lastError().text();
        return false;
    }
    if (!database.transaction()) {
        if (error) *error = database.lastError().text();
        return false;
    }
    for (const auto& platform : catalog::platforms()) {
        insert.bindValue(0, platform.name);
        insert.bindValue(1, platform.category);
        if (!run(insert, error)) { database.rollback(); return false; }
        update.bindValue(0, platform.name);
        if (!run(update, error)) { database.rollback(); return false; }
    }
    if (!database.commit()) {
        if (error) *error = database.lastError().text();
        return false;
    }
    return true;
}

bool seedPlatformMappings(QSqlDatabase& database, QString* error) {
    QSqlQuery findId(database);
    QSqlQuery insertAlias(database);
    QSqlQuery insertExtension(database);
    if (!findId.prepare(QStringLiteral("SELECT id FROM platforms WHERE name = ?"))
        || !insertAlias.prepare(QStringLiteral("INSERT OR IGNORE INTO platform_launchbox_aliases (platform_id, alias) VALUES (?, ?)"))
        || !insertExtension.prepare(QStringLiteral("INSERT OR IGNORE INTO platform_rom_extensions (platform_id, extension, kind, is_primary) VALUES (?, ?, ?, ?)"))) {
        if (error) *error = findId.lastError().text().isEmpty() ? insertAlias.lastError().text() : findId.lastError().text();
        return false;
    }
    // O próprio nome da plataforma também é um alias LaunchBox, como no Electron.
    if (!database.transaction()) {
        if (error) *error = database.lastError().text();
        return false;
    }
    for (const auto& platform : catalog::platforms()) {
        findId.bindValue(0, platform.name);
        if (!findId.exec()) { if (error) *error = findId.lastError().text(); database.rollback(); return false; }
        if (!findId.next()) continue;
        const int platformId = findId.value(0).toInt();
        const auto addAlias = [&](const QString& alias) {
            insertAlias.bindValue(0, platformId);
            insertAlias.bindValue(1, alias);
            return run(insertAlias, error);
        };
        if (!addAlias(platform.name)) { database.rollback(); return false; }
        for (const QString& alias : platform.launchboxAliases) {
            if (!addAlias(alias)) { database.rollback(); return false; }
        }
        for (const auto& extension : platform.romExtensions) {
            insertExtension.bindValue(0, platformId);
            insertExtension.bindValue(1, extension.extension.toLower());
            insertExtension.bindValue(2, extension.kind);
            insertExtension.bindValue(3, extension.primary ? 1 : 0);
            if (!run(insertExtension, error)) { database.rollback(); return false; }
        }
    }
    if (!database.commit()) {
        if (error) *error = database.lastError().text();
        return false;
    }
    return true;
}

bool seedEmulators(QSqlDatabase& database, QString* error) {
    QSqlQuery query(database);
    if (!query.prepare(QStringLiteral("INSERT OR IGNORE INTO emulators (name, executable, is_retroarch) VALUES ('RetroArch', '', 1)"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (!run(query, error)) return false;
    // TeknoParrot procura o perfil pelo nome dentro de UserProfiles.
    if (!query.prepare(QStringLiteral("INSERT OR IGNORE INTO emulators (name, executable, args, is_retroarch) VALUES ('TeknoParrot', '', '--profile={romFileName} --startMinimized', 0)"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    return run(query, error);
}

bool seedArcadeEmulatorAssociations(QSqlDatabase& database, QString* error) {
    QSqlQuery emulator(database);
    if (!emulator.exec(QStringLiteral("SELECT id FROM emulators WHERE name = 'TeknoParrot' COLLATE NOCASE"))) {
        if (error) *error = emulator.lastError().text();
        return false;
    }
    if (!emulator.next()) return true;
    const int emulatorId = emulator.value(0).toInt();
    QSqlQuery platform(database);
    if (!platform.exec(QStringLiteral("SELECT id FROM platforms WHERE name = 'TeknoParrot' COLLATE NOCASE"))) {
        if (error) *error = platform.lastError().text();
        return false;
    }
    if (!platform.next()) return true;
    const int platformId = platform.value(0).toInt();
    QSqlQuery existing(database);
    existing.prepare(QStringLiteral("SELECT 1 FROM platform_emulators WHERE platform_id = ? AND is_default = 1"));
    existing.bindValue(0, platformId);
    if (!existing.exec()) { if (error) *error = existing.lastError().text(); return false; }
    const bool hasDefault = existing.next();
    QSqlQuery link(database);
    if (!link.prepare(QStringLiteral("INSERT OR IGNORE INTO platform_emulators (platform_id, emulator_id, is_default) VALUES (?, ?, ?)"))) {
        if (error) *error = link.lastError().text();
        return false;
    }
    link.bindValue(0, platformId);
    link.bindValue(1, emulatorId);
    link.bindValue(2, hasDefault ? 0 : 1);
    return run(link, error);
}

bool seedHardwareInventoryDefaults(QSqlDatabase& database, QString* error) {
    static const char* types[] = {"Console", "Controle", "Cabo de Energia", "Cabo de Vídeo",
        "Cartucho/Mídia", "Memória/Memory Card", "Acessório", "Outros"};
    static const char* states[] = {"Novo", "Ótimo", "Bom", "Ruim", "Com Defeito"};
    QSqlQuery insertType(database);
    QSqlQuery insertState(database);
    if (!insertType.prepare(QStringLiteral("INSERT OR IGNORE INTO item_types (name, is_default) VALUES (?, 1)"))
        || !insertState.prepare(QStringLiteral("INSERT OR IGNORE INTO conservation_states (name, is_default) VALUES (?, 1)"))) {
        if (error) *error = insertType.lastError().text();
        return false;
    }
    if (!database.transaction()) {
        if (error) *error = database.lastError().text();
        return false;
    }
    for (const char* name : types) {
        insertType.bindValue(0, QString::fromUtf8(name));
        if (!run(insertType, error)) { database.rollback(); return false; }
    }
    for (const char* name : states) {
        insertState.bindValue(0, QString::fromUtf8(name));
        if (!run(insertState, error)) { database.rollback(); return false; }
    }
    if (!database.commit()) {
        if (error) *error = database.lastError().text();
        return false;
    }
    return true;
}
} // namespace gamestock
