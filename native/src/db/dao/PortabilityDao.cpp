/** Porta de src/main/db/dao/dataPortabilityDao.ts. */
#include "PortabilityDao.h"

#include "db/LibraryGrouping.h"

#include <QFileInfo>
#include <QRegularExpression>
#include <QSqlError>
#include <QSqlQuery>
#include <QSqlRecord>
#include <QSet>

namespace gamestock {
namespace {
/** Lê a linha atual em um mapa independente da ordem do schema. */
QVariantMap readRow(const QSqlQuery& query) {
    QVariantMap row;
    const QSqlRecord record = query.record();
    for (int index = 0; index < record.count(); ++index) row.insert(record.fieldName(index), query.value(index));
    return row;
}

/** Texto opcional vazio vira NULL, como no DAO TypeScript. */
QVariant nullableText(const QVariant& value) {
    if (value.isNull()) return {};
    const QString text = value.toString().trimmed();
    return text.isEmpty() ? QVariant() : QVariant(text);
}

/** Número inválido vira NULL; aceita int/double do JSON. */
QVariant nullableNumber(const QVariant& value) {
    if (value.isNull()) return {};
    bool ok = false;
    const double number = value.toDouble(&ok);
    return ok ? QVariant(number) : QVariant();
}

/** Nome de arquivo portátil, aceitando separadores Windows e POSIX. */
QString portableBaseName(const QString& path) {
    QString normalized = path;
    normalized.replace(QLatin1Char('\\'), QLatin1Char('/'));
    const int slash = normalized.lastIndexOf(QLatin1Char('/'));
    return slash >= 0 ? normalized.mid(slash + 1) : normalized;
}

/** play_status desconhecido cai em unplayed, como o renderer. */
QString normalizePlayStatus(const QVariant& value) {
    const QString text = value.toString();
    return text == QLatin1String("playing") || text == QLatin1String("completed")
        ? text : QStringLiteral("unplayed");
}

/** Erro de UNIQUE/CHECK sempre vira diagnóstico curto. */
bool queryOk(QSqlQuery& query, QString* error) {
    if (query.lastError().isValid()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    return true;
}
} // namespace

PortabilityDao::PortabilityDao(QSqlDatabase& database) : database_(database) {}

QString PortabilityDao::normalizeName(const QString& value) {
    QString normalized = value.trimmed().toLower().normalized(QString::NormalizationForm_D);
    QString withoutMarks;
    withoutMarks.reserve(normalized.size());
    for (const QChar character : normalized) {
        const ushort code = character.unicode();
        if (code >= 0x0300 && code <= 0x036F) continue;
        withoutMarks.append(character);
    }
    withoutMarks.replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral(" "));
    return withoutMarks;
}

QString PortabilityDao::normalizeExtension(const QString& value) {
    const QString trimmed = value.trimmed().toLower();
    if (trimmed.isEmpty()) return {};
    return trimmed.startsWith(QLatin1Char('.')) ? trimmed : QLatin1Char('.') + trimmed;
}

QString PortabilityDao::normalizeRomFileName(const QString& value) {
    return value.trimmed().toLower();
}

bool PortabilityDao::isInventoryMultiplatform(const QVariantMap& entry) {
    const QVariant flag = entry.value(QStringLiteral("isMultiplatform"));
    if (flag.toBool() || flag.toInt() == 1) return true;
    return normalizeName(entry.value(QStringLiteral("platformName")).toString())
        == normalizeName(QStringLiteral("Multiplataforma"));
}

QString PortabilityDao::inventoryItemKey(const QString& itemName, const QString& platformName, bool multiplatform) {
    return itemName.trimmed() + QLatin1Char('|')
        + (multiplatform ? QStringLiteral("__multiplatform__") : platformName);
}

bool PortabilityDao::listGameMetadata(QList<QVariantMap>* result, QString* error) const {
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT games.title, platforms.name AS platformName, platforms.category AS platformCategory, "
            "games.publisher, games.year, games.genre, games.rating, games.favorite, games.play_status, "
            "games.notes, games.launchbox_id, games.rom_path "
            "FROM games JOIN platforms ON platforms.id = games.platform_id "
            "ORDER BY platforms.name COLLATE NOCASE, games.title COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) {
        const QVariantMap row = readRow(query);
        QVariantMap entry = row;
        entry.remove(QStringLiteral("rom_path"));
        entry.insert(QStringLiteral("favorite"), row.value(QStringLiteral("favorite")).toInt() == 1);
        entry.insert(QStringLiteral("play_status"), normalizePlayStatus(row.value(QStringLiteral("play_status"))));
        entry.insert(QStringLiteral("romFileName"), portableBaseName(row.value(QStringLiteral("rom_path")).toString()));
        rows.append(entry);
    }
    *result = rows;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::listMediaReferences(QList<QVariantMap>* result, QString* error) const {
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT games.title, platforms.name AS platformName, games.launchbox_id, games.rom_path, "
            "games.box_art_path, games.background_path, games.screenshot_path "
            "FROM games JOIN platforms ON platforms.id = games.platform_id "
            "WHERE (games.box_art_path IS NOT NULL AND games.box_art_path != '') "
            "OR (games.background_path IS NOT NULL AND games.background_path != '') "
            "OR (games.screenshot_path IS NOT NULL AND games.screenshot_path != '') "
            "ORDER BY platforms.name COLLATE NOCASE, games.title COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> refs;
    while (query.next()) {
        const QVariantMap row = readRow(query);
        for (const QString& field : {QStringLiteral("box_art_path"), QStringLiteral("background_path"),
                 QStringLiteral("screenshot_path")}) {
            const QString source = row.value(field).toString().trimmed();
            if (source.isEmpty()) continue;
            refs.append(QVariantMap{{QStringLiteral("title"), row.value(QStringLiteral("title"))},
                {QStringLiteral("platformName"), row.value(QStringLiteral("platformName"))},
                {QStringLiteral("launchbox_id"), row.value(QStringLiteral("launchbox_id"))},
                {QStringLiteral("romFileName"), portableBaseName(row.value(QStringLiteral("rom_path")).toString())},
                {QStringLiteral("field"), field}, {QStringLiteral("sourcePath"), source}});
        }
    }
    *result = refs;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::listPlatforms(QList<QVariantMap>* result, QString* error) const {
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral("SELECT name, category, is_default FROM platforms ORDER BY name COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) rows.append(readRow(query));
    *result = rows;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::listPlatformAliases(QList<QVariantMap>* result, QString* error) const {
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT platforms.name AS platformName, platform_launchbox_aliases.alias "
            "FROM platform_launchbox_aliases JOIN platforms ON platforms.id = platform_launchbox_aliases.platform_id "
            "ORDER BY platforms.name COLLATE NOCASE, platform_launchbox_aliases.alias COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) rows.append(readRow(query));
    *result = rows;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::listRomExtensions(QList<QVariantMap>* result, QString* error) const {
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT platforms.name AS platformName, platform_rom_extensions.extension, "
            "platform_rom_extensions.kind, platform_rom_extensions.is_primary "
            "FROM platform_rom_extensions JOIN platforms ON platforms.id = platform_rom_extensions.platform_id "
            "ORDER BY platforms.name COLLATE NOCASE, platform_rom_extensions.extension COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) rows.append(readRow(query));
    *result = rows;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::listEmulators(QList<QVariantMap>* result, QString* error) const {
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT name, executable, args, is_retroarch FROM emulators ORDER BY name COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) rows.append(readRow(query));
    *result = rows;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::listPlatformEmulators(QList<QVariantMap>* result, QString* error) const {
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT platforms.name AS platformName, emulators.name AS emulatorName, "
            "platform_emulators.is_default, platform_emulators.core_path "
            "FROM platform_emulators JOIN platforms ON platforms.id = platform_emulators.platform_id "
            "JOIN emulators ON emulators.id = platform_emulators.emulator_id "
            "ORDER BY platforms.name COLLATE NOCASE, emulators.name COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) rows.append(readRow(query));
    *result = rows;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::listRomLocations(QList<QVariantMap>* result, QString* error) const {
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT games.title, platforms.name AS platformName, games.launchbox_id, games.rom_path "
            "FROM games JOIN platforms ON platforms.id = games.platform_id "
            "WHERE games.rom_path IS NOT NULL AND games.rom_path != '' "
            "ORDER BY platforms.name COLLATE NOCASE, games.title COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) {
        QVariantMap row = readRow(query);
        row.insert(QStringLiteral("romFileName"),
            portableBaseName(row.value(QStringLiteral("rom_path")).toString()));
        rows.append(row);
    }
    *result = rows;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::listInventoryData(QVariantMap* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino do inventário ausente.");
        return false;
    }
    QList<QVariantMap> itemTypes;
    QSqlQuery types(database_);
    if (!types.exec(QStringLiteral("SELECT id, name, is_default FROM item_types ORDER BY name COLLATE NOCASE"))) {
        if (error) *error = types.lastError().text();
        return false;
    }
    while (types.next()) itemTypes.append(readRow(types));

    QList<QVariantMap> states;
    QSqlQuery stateQuery(database_);
    if (!stateQuery.exec(QStringLiteral(
            "SELECT id, name, is_default FROM conservation_states ORDER BY name COLLATE NOCASE"))) {
        if (error) *error = stateQuery.lastError().text();
        return false;
    }
    while (stateQuery.next()) states.append(readRow(stateQuery));

    QList<QVariantMap> items;
    QSqlQuery itemQuery(database_);
    if (!itemQuery.exec(QStringLiteral(
            "SELECT hi.name, p.name AS platformName, hi.is_multiplatform AS isMultiplatform, "
            "it.name AS itemTypeName, cs.name AS conservationStateName, hi.description, "
            "hi.acquisition_date, hi.acquisition_url, hi.color, hi.value, hi.serial_number, hi.region, "
            "hi.storage_location, hi.loan_to FROM hardware_items hi "
            "LEFT JOIN platforms p ON p.id = hi.platform_id "
            "LEFT JOIN item_types it ON it.id = hi.item_type_id "
            "LEFT JOIN conservation_states cs ON cs.id = hi.conservation_state_id "
            "ORDER BY hi.name COLLATE NOCASE"))) {
        if (error) *error = itemQuery.lastError().text();
        return false;
    }
    while (itemQuery.next()) items.append(readRow(itemQuery));

    QList<QVariantMap> photos;
    QSqlQuery photoQuery(database_);
    if (!photoQuery.exec(QStringLiteral(
            "SELECT hi.name AS itemName, p.name AS platformName, hi.is_multiplatform AS isMultiplatform, "
            "ph.file_path, ph.sort_order FROM hardware_item_photos ph "
            "JOIN hardware_items hi ON hi.id = ph.item_id "
            "LEFT JOIN platforms p ON p.id = hi.platform_id "
            "ORDER BY hi.name COLLATE NOCASE, ph.sort_order ASC, ph.id ASC"))) {
        if (error) *error = photoQuery.lastError().text();
        return false;
    }
    while (photoQuery.next()) photos.append(readRow(photoQuery));

    QVariantMap bundle;
    QVariantList typeList;
    QVariantList stateList;
    QVariantList itemList;
    QVariantList photoList;
    for (const QVariantMap& entry : itemTypes) typeList.append(entry);
    for (const QVariantMap& entry : states) stateList.append(entry);
    for (const QVariantMap& entry : items) itemList.append(entry);
    for (const QVariantMap& entry : photos) photoList.append(entry);
    bundle.insert(QStringLiteral("itemTypes"), typeList);
    bundle.insert(QStringLiteral("conservationStates"), stateList);
    bundle.insert(QStringLiteral("items"), itemList);
    bundle.insert(QStringLiteral("photos"), photoList);
    *result = bundle;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::platformIdByName(const QString& name, qint64* id) const {
    if (!id) return false;
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("SELECT id FROM platforms WHERE LOWER(name) = LOWER(?)"))) return false;
    query.addBindValue(name.trimmed());
    if (!query.exec() || !query.next()) {
        // Fallback sem acentos, igual ao DAO legado.
        QSqlQuery all(database_);
        if (!all.exec(QStringLiteral("SELECT id, name FROM platforms"))) return false;
        const QString normalized = normalizeName(name);
        while (all.next()) {
            if (normalizeName(all.value(1).toString()) == normalized) {
                *id = all.value(0).toLongLong();
                return true;
            }
        }
        return false;
    }
    *id = query.value(0).toLongLong();
    return true;
}

bool PortabilityDao::emulatorIdByName(const QString& name, qint64* id) const {
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("SELECT id FROM emulators WHERE LOWER(name) = LOWER(?)"))) return false;
    query.addBindValue(name.trimmed());
    if (!query.exec() || !query.next()) return false;
    *id = query.value(0).toLongLong();
    return true;
}

bool PortabilityDao::ensurePlatform(const QString& name, const QString& category, qint64* id, bool* created,
    bool* updated, QString* error) {
    const QString trimmed = name.trimmed();
    if (trimmed.isEmpty()) {
        if (error) *error = QStringLiteral("Plataforma sem nome.");
        return false;
    }
    const QString normalizedCategory = category.trimmed().isEmpty() ? QStringLiteral("Importadas") : category.trimmed();
    qint64 existingId = 0;
    if (platformIdByName(trimmed, &existingId)) {
        QSqlQuery current(database_);
        current.prepare(QStringLiteral("SELECT category FROM platforms WHERE id = ?"));
        current.addBindValue(existingId);
        QString currentCategory;
        if (current.exec() && current.next()) currentCategory = current.value(0).toString();
        const bool categoryChanged = currentCategory != normalizedCategory;
        if (categoryChanged) {
            QSqlQuery update(database_);
            update.prepare(QStringLiteral("UPDATE platforms SET category = ? WHERE id = ?"));
            update.addBindValue(normalizedCategory);
            update.addBindValue(existingId);
            if (!update.exec()) {
                if (error) *error = update.lastError().text();
                return false;
            }
        }
        if (id) *id = existingId;
        if (created) *created = false;
        if (updated) *updated = categoryChanged;
        if (error) error->clear();
        return true;
    }
    QSqlQuery insert(database_);
    insert.prepare(QStringLiteral("INSERT INTO platforms (name, category) VALUES (?, ?)"));
    insert.addBindValue(trimmed);
    insert.addBindValue(normalizedCategory);
    if (!insert.exec()) {
        if (error) *error = insert.lastError().text();
        return false;
    }
    if (id) *id = insert.lastInsertId().toLongLong();
    if (created) *created = true;
    if (updated) *updated = false;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::upsertEmulator(const QVariantMap& emulator, QString* error) {
    const QString name = emulator.value(QStringLiteral("name")).toString().trimmed();
    if (name.isEmpty()) {
        if (error) *error = QStringLiteral("Emulador sem nome.");
        return false;
    }
    qint64 existingId = 0;
    if (emulatorIdByName(name, &existingId)) {
        QSqlQuery current(database_);
        current.prepare(QStringLiteral("SELECT executable, args FROM emulators WHERE id = ?"));
        current.addBindValue(existingId);
        QString currentExecutable;
        QString currentArgs;
        if (current.exec() && current.next()) {
            currentExecutable = current.value(0).toString();
            currentArgs = current.value(1).toString();
        }
        const QString incoming = emulator.value(QStringLiteral("executable")).toString().trimmed();
        // O executável do backup pertence à máquina de origem; não sobrescreve um caminho local já configurado.
        const QString executable = !currentExecutable.trimmed().isEmpty() && !incoming.isEmpty()
            ? currentExecutable : (!incoming.isEmpty() ? incoming : currentExecutable);
        const QString args = emulator.contains(QStringLiteral("args"))
            ? emulator.value(QStringLiteral("args")).toString().trimmed() : currentArgs;
        QSqlQuery update(database_);
        update.prepare(QStringLiteral("UPDATE emulators SET executable = ?, args = ?, is_retroarch = ? WHERE id = ?"));
        update.addBindValue(executable);
        update.addBindValue(args);
        update.addBindValue(emulator.value(QStringLiteral("is_retroarch")).toBool() ? 1 : 0);
        update.addBindValue(existingId);
        if (!update.exec()) {
            if (error) *error = update.lastError().text();
            return false;
        }
        if (error) error->clear();
        return true;
    }
    QSqlQuery insert(database_);
    insert.prepare(QStringLiteral("INSERT INTO emulators (name, executable, args, is_retroarch) VALUES (?, ?, ?, ?)"));
    insert.addBindValue(name);
    insert.addBindValue(emulator.value(QStringLiteral("executable")).toString().trimmed());
    insert.addBindValue(emulator.value(QStringLiteral("args")).toString().trimmed());
    insert.addBindValue(emulator.value(QStringLiteral("is_retroarch")).toBool() ? 1 : 0);
    if (!insert.exec()) {
        if (error) *error = insert.lastError().text();
        return false;
    }
    if (error) error->clear();
    return true;
}

bool PortabilityDao::importPlatformBundle(const QVariantMap& bundle, QVariantMap* summary, QString* error) {
    QVariantMap result{{QStringLiteral("created"), 0}, {QStringLiteral("updated"), 0},
        {QStringLiteral("mappings"), 0}, {QStringLiteral("emulators"), 0}, {QStringLiteral("links"), 0}};
    const QVariantList platforms = bundle.value(QStringLiteral("platforms")).toList();
    const QVariantList aliases = bundle.value(QStringLiteral("aliases")).toList();
    const QVariantList extensions = bundle.value(QStringLiteral("romExtensions")).toList();
    const QVariantList emulators = bundle.value(QStringLiteral("emulators")).toList();
    const QVariantList links = bundle.value(QStringLiteral("platformEmulators")).toList();

    QSet<QString> mappingPlatforms;
    for (const QVariant& value : platforms) {
        const QVariantMap platform = value.toMap();
        const QString name = platform.value(QStringLiteral("name")).toString().trimmed();
        if (name.isEmpty()) continue;
        qint64 id = 0;
        bool created = false;
        bool updated = false;
        if (!ensurePlatform(name, platform.value(QStringLiteral("category")).toString(), &id, &created, &updated, error)) {
            return false;
        }
        if (created) result[QStringLiteral("created")] = result.value(QStringLiteral("created")).toInt() + 1;
        else if (updated) result[QStringLiteral("updated")] = result.value(QStringLiteral("updated")).toInt() + 1;
    }
    for (const QVariantList* list : {&aliases, &extensions}) {
        for (const QVariant& value : *list) {
            const QString name = value.toMap().value(QStringLiteral("platformName")).toString().trimmed();
            if (name.isEmpty()) continue;
            mappingPlatforms.insert(normalizeName(name));
            qint64 ignored = 0;
            bool created = false;
            bool updated = false;
            if (!ensurePlatform(name, QStringLiteral("Importadas"), &ignored, &created, &updated, error)) return false;
        }
    }
    for (const QString& normalized : mappingPlatforms) {
        qint64 platformId = 0;
        if (!platformIdByName(normalized, &platformId)) continue;
        QSqlQuery removeAliases(database_);
        removeAliases.prepare(QStringLiteral("DELETE FROM platform_launchbox_aliases WHERE platform_id = ?"));
        removeAliases.addBindValue(platformId);
        if (!removeAliases.exec()) {
            if (error) *error = removeAliases.lastError().text();
            return false;
        }
        QSqlQuery removeExtensions(database_);
        removeExtensions.prepare(QStringLiteral("DELETE FROM platform_rom_extensions WHERE platform_id = ?"));
        removeExtensions.addBindValue(platformId);
        if (!removeExtensions.exec()) {
            if (error) *error = removeExtensions.lastError().text();
            return false;
        }
    }
    for (const QVariant& value : aliases) {
        const QVariantMap alias = value.toMap();
        qint64 platformId = 0;
        const QString text = alias.value(QStringLiteral("alias")).toString().trimmed();
        if (!platformIdByName(alias.value(QStringLiteral("platformName")).toString(), &platformId) || text.isEmpty()) continue;
        QSqlQuery insert(database_);
        insert.prepare(QStringLiteral("INSERT OR IGNORE INTO platform_launchbox_aliases (platform_id, alias) VALUES (?, ?)"));
        insert.addBindValue(platformId);
        insert.addBindValue(text);
        if (!insert.exec()) {
            if (error) *error = insert.lastError().text();
            return false;
        }
        result[QStringLiteral("mappings")] = result.value(QStringLiteral("mappings")).toInt() + 1;
    }
    for (const QVariant& value : extensions) {
        const QVariantMap extension = value.toMap();
        qint64 platformId = 0;
        const QString text = normalizeExtension(extension.value(QStringLiteral("extension")).toString());
        if (!platformIdByName(extension.value(QStringLiteral("platformName")).toString(), &platformId) || text.isEmpty()) continue;
        QSqlQuery insert(database_);
        insert.prepare(QStringLiteral(
            "INSERT OR IGNORE INTO platform_rom_extensions (platform_id, extension, kind, is_primary) VALUES (?, ?, ?, ?)"));
        insert.addBindValue(platformId);
        insert.addBindValue(text);
        insert.addBindValue(extension.value(QStringLiteral("kind")).toString().trimmed());
        insert.addBindValue(extension.value(QStringLiteral("is_primary")).toBool() ? 1 : 0);
        if (!insert.exec()) {
            if (error) *error = insert.lastError().text();
            return false;
        }
        result[QStringLiteral("mappings")] = result.value(QStringLiteral("mappings")).toInt() + 1;
    }
    for (const QVariant& value : emulators) {
        const QVariantMap emulator = value.toMap();
        if (emulator.value(QStringLiteral("name")).toString().trimmed().isEmpty()) continue;
        if (!upsertEmulator(emulator, error)) return false;
        result[QStringLiteral("emulators")] = result.value(QStringLiteral("emulators")).toInt() + 1;
    }
    for (const QVariant& value : links) {
        const QVariantMap link = value.toMap();
        qint64 platformId = 0;
        qint64 emulatorId = 0;
        if (!platformIdByName(link.value(QStringLiteral("platformName")).toString(), &platformId)
            || !emulatorIdByName(link.value(QStringLiteral("emulatorName")).toString(), &emulatorId)) continue;
        QSqlQuery insert(database_);
        insert.prepare(QStringLiteral(
            "INSERT INTO platform_emulators (platform_id, emulator_id, is_default, core_path) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(platform_id, emulator_id) DO UPDATE SET is_default = excluded.is_default, "
            "core_path = excluded.core_path"));
        insert.addBindValue(platformId);
        insert.addBindValue(emulatorId);
        insert.addBindValue(link.value(QStringLiteral("is_default")).toBool() ? 1 : 0);
        insert.addBindValue(nullableText(link.value(QStringLiteral("core_path"))));
        if (!insert.exec()) {
            if (error) *error = insert.lastError().text();
            return false;
        }
        result[QStringLiteral("links")] = result.value(QStringLiteral("links")).toInt() + 1;
    }
    if (summary) *summary = result;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::findGameIdByIdentity(const QVariantMap& entry, qint64 platformId, qint64* id) const {
    if (!id) return false;
    const QString launchboxId = entry.value(QStringLiteral("launchbox_id")).toString().trimmed();
    if (!launchboxId.isEmpty()) {
        QSqlQuery query(database_);
        query.prepare(QStringLiteral(
            "SELECT id FROM games WHERE launchbox_id = ? AND platform_id = ? ORDER BY id LIMIT 1"));
        query.addBindValue(launchboxId);
        query.addBindValue(platformId);
        if (query.exec() && query.next()) {
            *id = query.value(0).toLongLong();
            return true;
        }
    }
    const QString romFileName = normalizeRomFileName(entry.value(QStringLiteral("romFileName")).toString());
    const QString title = entry.value(QStringLiteral("title")).toString();
    if (!romFileName.isEmpty()) {
        if (findGameIdByRomFileName(platformId, title, romFileName, id)) return true;
        if (findUnresolvedTitleMatch(platformId, title, id)) return true;
        return false;
    }
    return findSafeTitleMatch(platformId, title, id);
}

bool PortabilityDao::findGameIdByRomFileName(qint64 platformId, const QString& title, const QString& romFileName,
    qint64* id) const {
    QSqlQuery query(database_);
    query.prepare(QStringLiteral(
        "SELECT id, title, rom_path FROM games WHERE platform_id = ? AND rom_path IS NOT NULL "
        "AND TRIM(rom_path) != '' ORDER BY id"));
    query.addBindValue(platformId);
    if (!query.exec()) return false;
    QList<qint64> byFile;
    QList<qint64> exact;
    while (query.next()) {
        if (normalizeRomFileName(portableBaseName(query.value(2).toString())) != romFileName) continue;
        byFile.append(query.value(0).toLongLong());
        if (query.value(1).toString().trimmed().toLower() == title.trimmed().toLower()) {
            exact.append(query.value(0).toLongLong());
        }
    }
    if (exact.size() == 1) {
        *id = exact.first();
        return true;
    }
    if (byFile.size() == 1) {
        *id = byFile.first();
        return true;
    }
    return false;
}

bool PortabilityDao::findUnresolvedTitleMatch(qint64 platformId, const QString& title, qint64* id) const {
    QSqlQuery query(database_);
    query.prepare(QStringLiteral(
        "SELECT id FROM games WHERE platform_id = ? AND LOWER(title) = LOWER(?) "
        "AND (rom_path IS NULL OR TRIM(rom_path) = '') ORDER BY id"));
    query.addBindValue(platformId);
    query.addBindValue(title.trimmed());
    if (!query.exec() || !query.next()) return false;
    *id = query.value(0).toLongLong();
    return true;
}

bool PortabilityDao::findSafeTitleMatch(qint64 platformId, const QString& title, qint64* id) const {
    QSqlQuery query(database_);
    query.prepare(QStringLiteral("SELECT id FROM games WHERE platform_id = ? AND LOWER(title) = LOWER(?) ORDER BY id"));
    query.addBindValue(platformId);
    query.addBindValue(title.trimmed());
    if (!query.exec()) return false;
    QList<qint64> matches;
    while (query.next()) matches.append(query.value(0).toLongLong());
    if (matches.size() != 1) return false;
    *id = matches.first();
    return true;
}

bool PortabilityDao::findGameId(const QVariantMap& entry, qint64* id, QString* error) const {
    qint64 platformId = 0;
    if (!platformIdByName(entry.value(QStringLiteral("platformName")).toString(), &platformId)) {
        if (error) error->clear();
        return false;
    }
    const bool found = findGameIdByIdentity(entry, platformId, id);
    if (error) error->clear();
    return found;
}

bool PortabilityDao::importGameMetadata(const QList<QVariantMap>& records, QVariantMap* summary, QString* error) {
    QVariantMap result{{QStringLiteral("created"), 0}, {QStringLiteral("updated"), 0},
        {QStringLiteral("skipped"), 0}};
    for (const QVariantMap& record : records) {
        const QString title = record.value(QStringLiteral("title")).toString().trimmed();
        const QString platformName = record.value(QStringLiteral("platformName")).toString().trimmed();
        if (title.isEmpty() || platformName.isEmpty()) {
            result[QStringLiteral("skipped")] = result.value(QStringLiteral("skipped")).toInt() + 1;
            continue;
        }
        qint64 platformId = 0;
        bool created = false;
        bool updated = false;
        if (!ensurePlatform(platformName, record.value(QStringLiteral("platformCategory")).toString(), &platformId,
                &created, &updated, error)) return false;
        qint64 existingId = 0;
        const bool exists = findGameIdByIdentity(record, platformId, &existingId);
        const QVariant year = nullableNumber(record.value(QStringLiteral("year")));
        const QVariant publisher = nullableText(record.value(QStringLiteral("publisher")));
        const QVariant genre = nullableText(record.value(QStringLiteral("genre")));
        const QVariant rating = nullableText(record.value(QStringLiteral("rating")));
        const QVariant notes = nullableText(record.value(QStringLiteral("notes")));
        const QVariant launchbox = nullableText(record.value(QStringLiteral("launchbox_id")));
        const int favorite = record.value(QStringLiteral("favorite")).toBool() ? 1 : 0;
        const QString playStatus = normalizePlayStatus(record.value(QStringLiteral("play_status")));
        if (exists) {
            QSqlQuery current(database_);
            current.prepare(QStringLiteral("SELECT rom_path FROM games WHERE id = ?"));
            current.addBindValue(existingId);
            QString romPath;
            if (current.exec() && current.next()) romPath = current.value(0).toString();
            const QString groupKey = buildStoredLibraryGroupKey(title, romPath);
            QSqlQuery update(database_);
            update.prepare(QStringLiteral(
                "UPDATE games SET title = ?, platform_id = ?, publisher = ?, year = ?, genre = ?, rating = ?, "
                "favorite = ?, play_status = ?, notes = ?, launchbox_id = ?, library_group_key = ?, "
                "updated_at = CURRENT_TIMESTAMP WHERE id = ?"));
            update.addBindValue(title);
            update.addBindValue(platformId);
            update.addBindValue(publisher);
            update.addBindValue(year);
            update.addBindValue(genre);
            update.addBindValue(rating);
            update.addBindValue(favorite);
            update.addBindValue(playStatus);
            update.addBindValue(notes);
            update.addBindValue(launchbox);
            update.addBindValue(groupKey.isEmpty() ? QVariant() : QVariant(groupKey));
            update.addBindValue(existingId);
            if (!update.exec()) {
                if (error) *error = update.lastError().text();
                return false;
            }
            result[QStringLiteral("updated")] = result.value(QStringLiteral("updated")).toInt() + 1;
        } else {
            QSqlQuery insert(database_);
            insert.prepare(QStringLiteral(
                "INSERT INTO games (title, platform_id, publisher, year, genre, rating, favorite, play_status, "
                "notes, launchbox_id, library_group_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)"));
            insert.addBindValue(title);
            insert.addBindValue(platformId);
            insert.addBindValue(publisher);
            insert.addBindValue(year);
            insert.addBindValue(genre);
            insert.addBindValue(rating);
            insert.addBindValue(favorite);
            insert.addBindValue(playStatus);
            insert.addBindValue(notes);
            insert.addBindValue(launchbox);
            if (!insert.exec()) {
                if (error) *error = insert.lastError().text();
                return false;
            }
            result[QStringLiteral("created")] = result.value(QStringLiteral("created")).toInt() + 1;
        }
    }
    if (summary) *summary = result;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::importRomLocations(const QList<QVariantMap>& records, QVariantMap* summary, QString* error) {
    QVariantMap result{{QStringLiteral("updated"), 0}, {QStringLiteral("skipped"), 0},
        {QStringLiteral("romFolderEntries"), 0}};
    for (const QVariantMap& record : records) {
        qint64 platformId = 0;
        qint64 gameId = 0;
        const QString romPath = record.value(QStringLiteral("rom_path")).toString().trimmed();
        if (!platformIdByName(record.value(QStringLiteral("platformName")).toString(), &platformId)
            || !findGameIdByIdentity(record, platformId, &gameId) || romPath.isEmpty()) {
            result[QStringLiteral("skipped")] = result.value(QStringLiteral("skipped")).toInt() + 1;
            continue;
        }
        QSqlQuery current(database_);
        current.prepare(QStringLiteral("SELECT title FROM games WHERE id = ?"));
        current.addBindValue(gameId);
        if (!current.exec() || !current.next()) {
            result[QStringLiteral("skipped")] = result.value(QStringLiteral("skipped")).toInt() + 1;
            continue;
        }
        const QString groupKey = buildStoredLibraryGroupKey(current.value(0).toString(), romPath);
        QSqlQuery update(database_);
        update.prepare(QStringLiteral(
            "UPDATE games SET rom_path = ?, library_group_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"));
        update.addBindValue(romPath);
        update.addBindValue(groupKey.isEmpty() ? QVariant() : QVariant(groupKey));
        update.addBindValue(gameId);
        if (!update.exec()) {
            if (error) *error = update.lastError().text();
            return false;
        }
        result[QStringLiteral("updated")] = result.value(QStringLiteral("updated")).toInt() + 1;
    }
    if (summary) *summary = result;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::importInventoryData(const QVariantMap& bundle, const QMap<QString, QStringList>& photoPaths,
    QVariantMap* summary, QString* error) {
    QVariantMap result{{QStringLiteral("itemsCreated"), 0}, {QStringLiteral("itemsUpdated"), 0},
        {QStringLiteral("photosImported"), 0}};
    for (const QVariant& value : bundle.value(QStringLiteral("itemTypes")).toList()) {
        const QString name = value.toMap().value(QStringLiteral("name")).toString().trimmed();
        if (name.isEmpty()) continue;
        QSqlQuery insert(database_);
        insert.prepare(QStringLiteral("INSERT OR IGNORE INTO item_types (name, is_default) VALUES (?, 0)"));
        insert.addBindValue(name);
        if (!insert.exec()) {
            if (error) *error = insert.lastError().text();
            return false;
        }
    }
    for (const QVariant& value : bundle.value(QStringLiteral("conservationStates")).toList()) {
        const QString name = value.toMap().value(QStringLiteral("name")).toString().trimmed();
        if (name.isEmpty()) continue;
        QSqlQuery insert(database_);
        insert.prepare(QStringLiteral("INSERT OR IGNORE INTO conservation_states (name, is_default) VALUES (?, 0)"));
        insert.addBindValue(name);
        if (!insert.exec()) {
            if (error) *error = insert.lastError().text();
            return false;
        }
    }
    const auto typeIdFor = [&](const QString& name) -> QVariant {
        if (name.trimmed().isEmpty()) return {};
        QSqlQuery query(database_);
        query.prepare(QStringLiteral("SELECT id FROM item_types WHERE LOWER(name) = LOWER(?)"));
        query.addBindValue(name.trimmed());
        if (query.exec() && query.next()) return query.value(0);
        return {};
    };
    const auto stateIdFor = [&](const QString& name) -> QVariant {
        if (name.trimmed().isEmpty()) return {};
        QSqlQuery query(database_);
        query.prepare(QStringLiteral("SELECT id FROM conservation_states WHERE LOWER(name) = LOWER(?)"));
        query.addBindValue(name.trimmed());
        if (query.exec() && query.next()) return query.value(0);
        return {};
    };
    for (const QVariant& value : bundle.value(QStringLiteral("items")).toList()) {
        const QVariantMap item = value.toMap();
        const QString name = item.value(QStringLiteral("name")).toString().trimmed();
        if (name.isEmpty()) continue;
        const bool multiplatform = isInventoryMultiplatform(item);
        const QString platformName = item.value(QStringLiteral("platformName")).toString();
        qint64 platformIdValue = 0;
        const QVariant platformId = multiplatform ? QVariant()
            : (platformIdByName(platformName, &platformIdValue) ? QVariant(platformIdValue) : QVariant());
        const QVariant typeId = typeIdFor(item.value(QStringLiteral("itemTypeName")).toString());
        const QVariant stateId = stateIdFor(item.value(QStringLiteral("conservationStateName")).toString());
        const int flag = multiplatform ? 1 : 0;
        QSqlQuery existing(database_);
        existing.prepare(QStringLiteral(
            "SELECT hi.id FROM hardware_items hi WHERE LOWER(hi.name) = LOWER(?) AND hi.is_multiplatform = ? "
            "AND (hi.platform_id = ? OR (hi.platform_id IS NULL AND ? IS NULL)) LIMIT 1"));
        existing.addBindValue(name);
        existing.addBindValue(flag);
        existing.addBindValue(platformId);
        existing.addBindValue(platformId);
        qint64 itemId = 0;
        const bool hasExisting = existing.exec() && existing.next();
        if (hasExisting) itemId = existing.value(0).toLongLong();
        if (hasExisting) {
            QSqlQuery update(database_);
            update.prepare(QStringLiteral(
                "UPDATE hardware_items SET platform_id = ?, is_multiplatform = ?, item_type_id = ?, "
                "conservation_state_id = ?, description = ?, acquisition_date = ?, acquisition_url = ?, "
                "color = ?, value = ?, serial_number = ?, region = ?, storage_location = ?, loan_to = ?, "
                "updated_at = datetime('now') WHERE id = ?"));
            update.addBindValue(platformId);
            update.addBindValue(flag);
            update.addBindValue(typeId);
            update.addBindValue(stateId);
            update.addBindValue(item.value(QStringLiteral("description")).toString());
            update.addBindValue(nullableText(item.value(QStringLiteral("acquisition_date"))));
            update.addBindValue(nullableText(item.value(QStringLiteral("acquisition_url"))));
            update.addBindValue(nullableText(item.value(QStringLiteral("color"))));
            update.addBindValue(nullableNumber(item.value(QStringLiteral("value"))));
            update.addBindValue(nullableText(item.value(QStringLiteral("serial_number"))));
            update.addBindValue(nullableText(item.value(QStringLiteral("region"))));
            update.addBindValue(nullableText(item.value(QStringLiteral("storage_location"))));
            update.addBindValue(nullableText(item.value(QStringLiteral("loan_to"))));
            update.addBindValue(itemId);
            if (!update.exec()) {
                if (error) *error = update.lastError().text();
                return false;
            }
            result[QStringLiteral("itemsUpdated")] = result.value(QStringLiteral("itemsUpdated")).toInt() + 1;
            const QStringList files = photoPaths.value(inventoryItemKey(name, platformName, multiplatform));
            QSqlQuery duplicate(database_);
            duplicate.prepare(QStringLiteral("SELECT 1 FROM hardware_item_photos WHERE item_id = ? AND file_path = ?"));
            QSqlQuery maxOrder(database_);
            maxOrder.prepare(QStringLiteral("SELECT COALESCE(MAX(sort_order), -1) FROM hardware_item_photos WHERE item_id = ?"));
            for (const QString& file : files) {
                duplicate.bindValue(0, itemId);
                duplicate.bindValue(1, file);
                if (duplicate.exec() && duplicate.next()) continue;
                maxOrder.bindValue(0, itemId);
                int nextOrder = 0;
                if (maxOrder.exec() && maxOrder.next()) nextOrder = maxOrder.value(0).toInt() + 1;
                QSqlQuery insert(database_);
                insert.prepare(QStringLiteral(
                    "INSERT INTO hardware_item_photos (item_id, file_path, sort_order) VALUES (?, ?, ?)"));
                insert.addBindValue(itemId);
                insert.addBindValue(file);
                insert.addBindValue(nextOrder);
                if (!insert.exec()) {
                    if (error) *error = insert.lastError().text();
                    return false;
                }
                result[QStringLiteral("photosImported")] = result.value(QStringLiteral("photosImported")).toInt() + 1;
            }
        } else {
            QSqlQuery insert(database_);
            insert.prepare(QStringLiteral(
                "INSERT INTO hardware_items (name, platform_id, is_multiplatform, item_type_id, "
                "conservation_state_id, description, acquisition_date, acquisition_url, color, value, "
                "serial_number, region, storage_location, loan_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"));
            insert.addBindValue(name);
            insert.addBindValue(platformId);
            insert.addBindValue(flag);
            insert.addBindValue(typeId);
            insert.addBindValue(stateId);
            insert.addBindValue(item.value(QStringLiteral("description")).toString());
            insert.addBindValue(nullableText(item.value(QStringLiteral("acquisition_date"))));
            insert.addBindValue(nullableText(item.value(QStringLiteral("acquisition_url"))));
            insert.addBindValue(nullableText(item.value(QStringLiteral("color"))));
            insert.addBindValue(nullableNumber(item.value(QStringLiteral("value"))));
            insert.addBindValue(nullableText(item.value(QStringLiteral("serial_number"))));
            insert.addBindValue(nullableText(item.value(QStringLiteral("region"))));
            insert.addBindValue(nullableText(item.value(QStringLiteral("storage_location"))));
            insert.addBindValue(nullableText(item.value(QStringLiteral("loan_to"))));
            if (!insert.exec()) {
                if (error) *error = insert.lastError().text();
                return false;
            }
            itemId = insert.lastInsertId().toLongLong();
            result[QStringLiteral("itemsCreated")] = result.value(QStringLiteral("itemsCreated")).toInt() + 1;
            const QStringList files = photoPaths.value(inventoryItemKey(name, platformName, multiplatform));
            int order = 0;
            for (const QString& file : files) {
                QSqlQuery photo(database_);
                photo.prepare(QStringLiteral(
                    "INSERT INTO hardware_item_photos (item_id, file_path, sort_order) VALUES (?, ?, ?)"));
                photo.addBindValue(itemId);
                photo.addBindValue(file);
                photo.addBindValue(order++);
                if (!photo.exec()) {
                    if (error) *error = photo.lastError().text();
                    return false;
                }
                result[QStringLiteral("photosImported")] = result.value(QStringLiteral("photosImported")).toInt() + 1;
            }
        }
    }
    if (summary) *summary = result;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::updateGameMedia(qint64 gameId, const QString& field, const QString& filePath, QString* error) {
    static const QStringList allowed{QStringLiteral("box_art_path"), QStringLiteral("background_path"),
        QStringLiteral("screenshot_path")};
    if (!allowed.contains(field)) {
        if (error) *error = QStringLiteral("Campo de mídia inválido.");
        return false;
    }
    QSqlQuery query(database_);
    query.prepare(QStringLiteral("UPDATE games SET %1 = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").arg(field));
    query.addBindValue(filePath);
    query.addBindValue(gameId);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (error) error->clear();
    return true;
}

bool PortabilityDao::resolveRomFolderEntries(const QList<QVariantMap>& entries, QList<QVariantMap>* result,
    QString* error) const {
    QList<QVariantMap> resolved;
    for (const QVariantMap& entry : entries) {
        const QString platformName = entry.value(QStringLiteral("platformName")).toString().trimmed();
        if (platformName.isEmpty()) continue;
        qint64 platformId = 0;
        if (!platformIdByName(platformName, &platformId)) continue;
        QVariantMap copy = entry;
        copy.insert(QStringLiteral("platformId"), platformId);
        copy.insert(QStringLiteral("includeSubfolders"), entry.value(QStringLiteral("includeSubfolders")).toBool());
        resolved.append(copy);
    }
    if (result) *result = resolved;
    if (error) error->clear();
    return true;
}

bool PortabilityDao::countGameConflicts(const QList<QVariantMap>& records, QVariantMap* result, QString* error) const {
    int creates = 0;
    int updates = 0;
    for (const QVariantMap& record : records) {
        const QString title = record.value(QStringLiteral("title")).toString().trimmed();
        const QString platformName = record.value(QStringLiteral("platformName")).toString().trimmed();
        qint64 platformId = 0;
        qint64 gameId = 0;
        if (title.isEmpty() || platformName.isEmpty() || !platformIdByName(platformName, &platformId)
            || !findGameIdByIdentity(record, platformId, &gameId)) {
            creates += 1;
        } else {
            updates += 1;
        }
    }
    if (result) *result = QVariantMap{{QStringLiteral("create"), creates}, {QStringLiteral("update"), updates}};
    if (error) error->clear();
    return true;
}

bool PortabilityDao::countPlatformConflicts(const QList<QVariantMap>& records, QVariantMap* result, QString* error) const {
    int creates = 0;
    int updates = 0;
    for (const QVariantMap& record : records) {
        qint64 id = 0;
        if (record.value(QStringLiteral("name")).toString().trimmed().isEmpty()) continue;
        if (platformIdByName(record.value(QStringLiteral("name")).toString(), &id)) updates += 1;
        else creates += 1;
    }
    if (result) *result = QVariantMap{{QStringLiteral("create"), creates}, {QStringLiteral("update"), updates}};
    if (error) error->clear();
    return true;
}

bool PortabilityDao::countEmulatorConflicts(const QList<QVariantMap>& records, QVariantMap* result, QString* error) const {
    int creates = 0;
    int updates = 0;
    for (const QVariantMap& record : records) {
        qint64 id = 0;
        const QString name = record.value(QStringLiteral("name")).toString().trimmed();
        if (name.isEmpty()) continue;
        if (emulatorIdByName(name, &id)) updates += 1;
        else creates += 1;
    }
    if (result) *result = QVariantMap{{QStringLiteral("create"), creates}, {QStringLiteral("update"), updates}};
    if (error) error->clear();
    return true;
}
} // namespace gamestock
