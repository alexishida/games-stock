/** Porta de src/main/db/dao/platformDao.ts preservando validações e transações. */
#include "PlatformDao.h"

#include <QSqlError>
#include <QSqlQuery>
#include <QSqlRecord>

#include <algorithm>

namespace gamestock {
namespace {
/** Retorna erro de banco com o comando que falhou, sem expor valores do usuário. */
bool fail(QSqlQuery& query, const QString& context, QString* error) {
    if (error) *error = context + QStringLiteral(": ") + query.lastError().text();
    return false;
}

/** Traduz a violação UNIQUE para a mensagem usada pela interface. */
void translateUnique(QSqlQuery& query, QString* error) {
    const QString text = query.lastError().text();
    if (error) *error = text.contains(QStringLiteral("UNIQUE")) ? QStringLiteral("Plataforma já existe") : text;
}

/** Mantém `gameCount` numérico e expõe `isDefault` booleano para o QML. */
QVariantMap mapPlatform(const QVariantMap& row) {
    QVariantMap platform = row;
    platform.insert(QStringLiteral("isDefault"), row.value(QStringLiteral("is_default")).toInt() != 0);
    platform.insert(QStringLiteral("gameCount"), row.value(QStringLiteral("gameCount")).toLongLong());
    return platform;
}

/** Lê todas as colunas de uma query em um mapa, sem depender da ordem do schema. */
QVariantMap readRow(const QSqlQuery& query) {
    QVariantMap row;
    const QSqlRecord record = query.record();
    for (int index = 0; index < record.count(); ++index) row.insert(record.fieldName(index), query.value(index));
    return row;
}

/** Normaliza extensão como o Electron: minúscula e com ponto inicial. */
QString normalizeExtension(const QString& value) {
    const QString trimmed = value.trimmed().toLower();
    if (trimmed.isEmpty()) return {};
    return trimmed.startsWith(QLatin1Char('.')) ? trimmed : QLatin1Char('.') + trimmed;
}
} // namespace

PlatformDao::PlatformDao(QSqlDatabase& database) : database_(database) {}

bool PlatformDao::list(QList<QVariantMap>* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino da listagem ausente.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT platforms.*, COUNT(games.id) AS gameCount FROM platforms "
            "LEFT JOIN games ON games.platform_id = platforms.id "
            "GROUP BY platforms.id ORDER BY platforms.name COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> platforms;
    while (query.next()) platforms.append(mapPlatform(readRow(query)));
    *result = platforms;
    if (error) error->clear();
    return true;
}

bool PlatformDao::get(qint64 id, QVariantMap* result, QString* error) const {
    if (!result || id <= 0) {
        if (error) *error = QStringLiteral("Plataforma não encontrada");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("SELECT *, 0 AS gameCount FROM platforms WHERE id = ?"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(id);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (!query.next()) {
        if (error) *error = QStringLiteral("Plataforma não encontrada");
        return false;
    }
    *result = mapPlatform(readRow(query));
    if (error) error->clear();
    return true;
}

bool PlatformDao::create(const QString& name, const QString& category, qint64* newId, QString* error) const {
    const QString normalizedName = name.trimmed();
    if (normalizedName.isEmpty()) {
        if (error) *error = QStringLiteral("Nome da plataforma é obrigatório");
        return false;
    }
    const QString normalizedCategory = category.trimmed().isEmpty() ? QStringLiteral("Outros") : category.trimmed();
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("INSERT INTO platforms (name, category) VALUES (?, ?)"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(normalizedName);
    query.addBindValue(normalizedCategory);
    if (!query.exec()) {
        translateUnique(query, error);
        return false;
    }
    if (newId) *newId = query.lastInsertId().toLongLong();
    if (error) error->clear();
    return true;
}

bool PlatformDao::update(qint64 id, const QString& name, const QString& category, QString* error) const {
    QVariantMap current;
    if (!get(id, &current, error)) return false;
    // Campos vazios preservam o valor atual, como `data.name?.trim() || current.name`.
    const QString nextName = name.trimmed().isEmpty() ? current.value(QStringLiteral("name")).toString() : name.trimmed();
    const QString nextCategory = category.trimmed().isEmpty() ? current.value(QStringLiteral("category")).toString() : category.trimmed();
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("UPDATE platforms SET name = ?, category = ? WHERE id = ?"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(nextName);
    query.addBindValue(nextCategory);
    query.addBindValue(id);
    if (!query.exec()) {
        translateUnique(query, error);
        return false;
    }
    if (error) error->clear();
    return true;
}

bool PlatformDao::remove(qint64 id, QString* error) const {
    QVariantMap platform;
    if (!get(id, &platform, error)) return false;
    if (platform.value(QStringLiteral("isDefault")).toBool()) {
        if (error) *error = QStringLiteral("Não é possível remover plataformas padrão");
        return false;
    }
    // Conta vínculos antes do DELETE para devolver o motivo específico ao usuário.
    const auto countReferences = [this, id, error](const char* table, const QString& message) -> qint64 {
        QSqlQuery query(database_);
        if (!query.prepare(QStringLiteral("SELECT COUNT(*) FROM ") + QString::fromLatin1(table) + QStringLiteral(" WHERE platform_id = ?"))) {
            if (error) *error = query.lastError().text();
            return -1;
        }
        query.addBindValue(id);
        if (!query.exec() || !query.next()) {
            if (error) *error = query.lastError().text();
            return -1;
        }
        const qint64 count = query.value(0).toLongLong();
        if (count > 0 && error) *error = message;
        return count;
    };
    const qint64 games = countReferences("games", QStringLiteral("Não é possível remover plataforma com jogos associados"));
    if (games < 0) return false;
    if (games > 0) return false;
    const qint64 inventory = countReferences("hardware_items",
        QStringLiteral("Não é possível remover plataforma com itens de inventário associados"));
    if (inventory < 0) return false;
    if (inventory > 0) return false;

    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("DELETE FROM platforms WHERE id = ?"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(id);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (error) error->clear();
    return true;
}

bool PlatformDao::listPrimaryExtensions(QList<ExtensionMapping>* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino das extensões ausente.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT platforms.id, platforms.name, platform_rom_extensions.extension, platform_rom_extensions.is_primary "
            "FROM platform_rom_extensions JOIN platforms ON platforms.id = platform_rom_extensions.platform_id "
            "ORDER BY platforms.name COLLATE NOCASE, platform_rom_extensions.extension COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<ExtensionMapping> mappings;
    while (query.next()) {
        ExtensionMapping mapping;
        mapping.platformId = query.value(0).toLongLong();
        mapping.platformName = query.value(1).toString();
        mapping.extension = query.value(2).toString();
        mapping.primary = query.value(3).toInt() != 0;
        mappings.append(mapping);
    }
    *result = mappings;
    if (error) error->clear();
    return true;
}

bool PlatformDao::mappings(qint64 id, QVariantMap* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino dos mapeamentos ausente.");
        return false;
    }
    QVariantMap platform;
    if (!get(id, &platform, error)) return false;

    QVariantList aliases;
    QSqlQuery aliasQuery(database_);
    if (!aliasQuery.prepare(QStringLiteral(
            "SELECT platform_launchbox_aliases.id, platform_launchbox_aliases.platform_id, "
            "platforms.name AS platform_name, platform_launchbox_aliases.alias "
            "FROM platform_launchbox_aliases JOIN platforms ON platforms.id = platform_launchbox_aliases.platform_id "
            "WHERE platform_launchbox_aliases.platform_id = ? "
            "ORDER BY platforms.name COLLATE NOCASE, platform_launchbox_aliases.alias COLLATE NOCASE"))) {
        if (error) *error = aliasQuery.lastError().text();
        return false;
    }
    aliasQuery.addBindValue(id);
    if (!aliasQuery.exec()) {
        if (error) *error = aliasQuery.lastError().text();
        return false;
    }
    while (aliasQuery.next()) aliases.append(readRow(aliasQuery));

    QVariantList extensions;
    QSqlQuery extensionQuery(database_);
    if (!extensionQuery.prepare(QStringLiteral(
            "SELECT platform_rom_extensions.id, platform_rom_extensions.platform_id, "
            "platforms.name AS platform_name, platform_rom_extensions.extension, "
            "platform_rom_extensions.kind, platform_rom_extensions.is_primary "
            "FROM platform_rom_extensions JOIN platforms ON platforms.id = platform_rom_extensions.platform_id "
            "WHERE platform_rom_extensions.platform_id = ? "
            "ORDER BY platforms.name COLLATE NOCASE, platform_rom_extensions.extension COLLATE NOCASE"))) {
        if (error) *error = extensionQuery.lastError().text();
        return false;
    }
    extensionQuery.addBindValue(id);
    if (!extensionQuery.exec()) {
        if (error) *error = extensionQuery.lastError().text();
        return false;
    }
    while (extensionQuery.next()) {
        QVariantMap entry = readRow(extensionQuery);
        entry.insert(QStringLiteral("isPrimary"), entry.value(QStringLiteral("is_primary")).toInt() != 0);
        extensions.append(entry);
    }

    *result = QVariantMap{{QStringLiteral("aliases"), aliases}, {QStringLiteral("romExtensions"), extensions}};
    if (error) error->clear();
    return true;
}

bool PlatformDao::saveMappings(qint64 id, const QStringList& aliases, const QList<QVariantMap>& extensions, QString* error) const {
    QVariantMap platform;
    if (!get(id, &platform, error)) return false;

    QStringList normalizedAliases;
    for (const QString& alias : aliases) {
        const QString trimmed = alias.trimmed();
        if (!trimmed.isEmpty() && !normalizedAliases.contains(trimmed)) normalizedAliases.append(trimmed);
    }
    if (normalizedAliases.isEmpty()) {
        if (error) *error = QStringLiteral("Informe ao menos um alias do LaunchBox");
        return false;
    }

    // A extensão é a chave de deduplicação, como o Map do DAO Electron.
    QList<QVariantMap> normalizedExtensions;
    QStringList seenExtensions;
    for (const QVariantMap& raw : extensions) {
        const QString extension = normalizeExtension(raw.value(QStringLiteral("extension")).toString());
        if (extension.isEmpty()) continue;
        const QVariant primary = raw.contains(QStringLiteral("is_primary")) ? raw.value(QStringLiteral("is_primary"))
            : raw.value(QStringLiteral("isPrimary"));
        // `kind` é NOT NULL no schema e o Electron sempre envia string; ausência vira vazio.
        QString kind = raw.value(QStringLiteral("kind")).toString().trimmed();
        if (kind.isNull()) kind = QStringLiteral("");
        QVariantMap entry{{QStringLiteral("extension"), extension},
            {QStringLiteral("kind"), kind},
            {QStringLiteral("is_primary"), primary.toBool() ? 1 : 0}};
        const qsizetype index = seenExtensions.indexOf(extension);
        if (index >= 0) normalizedExtensions[static_cast<int>(index)] = entry;
        else { seenExtensions.append(extension); normalizedExtensions.append(entry); }
    }
    if (normalizedExtensions.isEmpty()) {
        if (error) *error = QStringLiteral("Informe ao menos uma extensão principal de ROM");
        return false;
    }
    const bool hasPrimary = std::any_of(normalizedExtensions.cbegin(), normalizedExtensions.cend(),
        [](const QVariantMap& entry) { return entry.value(QStringLiteral("is_primary")).toInt() == 1; });
    if (!hasPrimary) {
        if (error) *error = QStringLiteral("Marque ao menos uma extensão principal");
        return false;
    }

    if (!database_.transaction()) {
        if (error) *error = database_.lastError().text();
        return false;
    }
    QSqlQuery cleanupAliases(database_);
    QSqlQuery cleanupExtensions(database_);
    QSqlQuery insertAlias(database_);
    QSqlQuery insertExtension(database_);
    const bool prepared = cleanupAliases.prepare(QStringLiteral("DELETE FROM platform_launchbox_aliases WHERE platform_id = ?"))
        && cleanupExtensions.prepare(QStringLiteral("DELETE FROM platform_rom_extensions WHERE platform_id = ?"))
        && insertAlias.prepare(QStringLiteral("INSERT INTO platform_launchbox_aliases (platform_id, alias) VALUES (?, ?)"))
        && insertExtension.prepare(QStringLiteral("INSERT INTO platform_rom_extensions (platform_id, extension, kind, is_primary) VALUES (?, ?, ?, ?)"));
    if (!prepared) {
        const QString text = insertExtension.lastError().text().isEmpty()
            ? insertAlias.lastError().text() : insertExtension.lastError().text();
        database_.rollback();
        if (error) *error = text;
        return false;
    }
    cleanupAliases.addBindValue(id);
    cleanupExtensions.addBindValue(id);
    if (!cleanupAliases.exec() || !cleanupExtensions.exec()) {
        const QString text = cleanupAliases.lastError().text().isEmpty()
            ? cleanupExtensions.lastError().text() : cleanupAliases.lastError().text();
        database_.rollback();
        if (error) *error = text;
        return false;
    }
    for (const QString& alias : normalizedAliases) {
        insertAlias.bindValue(0, id);
        insertAlias.bindValue(1, alias);
        if (!insertAlias.exec()) {
            database_.rollback();
            if (error) *error = insertAlias.lastError().text();
            return false;
        }
    }
    for (const QVariantMap& entry : normalizedExtensions) {
        insertExtension.bindValue(0, id);
        insertExtension.bindValue(1, entry.value(QStringLiteral("extension")));
        insertExtension.bindValue(2, entry.value(QStringLiteral("kind")));
        insertExtension.bindValue(3, entry.value(QStringLiteral("is_primary")));
        if (!insertExtension.exec()) {
            database_.rollback();
            if (error) *error = insertExtension.lastError().text();
            return false;
        }
    }
    if (!database_.commit()) {
        if (error) *error = database_.lastError().text();
        database_.rollback();
        return false;
    }
    if (error) error->clear();
    return true;
}
} // namespace gamestock
