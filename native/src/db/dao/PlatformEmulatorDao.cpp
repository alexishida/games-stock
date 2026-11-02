/** Porta de src/main/db/dao/platformEmulatorDao.ts. */
#include "PlatformEmulatorDao.h"

#include <QSqlError>
#include <QSqlQuery>
#include <QSqlRecord>

namespace gamestock {
namespace {
/** Converte o JOIN em um mapa com o emulador aninhado. */
QVariantMap readLink(const QSqlQuery& query) {
    return QVariantMap{
        {QStringLiteral("platform_id"), query.value(QStringLiteral("platform_id"))},
        {QStringLiteral("emulator_id"), query.value(QStringLiteral("emulator_id"))},
        {QStringLiteral("is_default"), query.value(QStringLiteral("is_default"))},
        {QStringLiteral("isDefault"), query.value(QStringLiteral("is_default")).toInt() != 0},
        {QStringLiteral("core_path"), query.value(QStringLiteral("core_path"))},
        {QStringLiteral("emulator"), QVariantMap{
            {QStringLiteral("id"), query.value(QStringLiteral("em_id"))},
            {QStringLiteral("name"), query.value(QStringLiteral("em_name"))},
            {QStringLiteral("executable"), query.value(QStringLiteral("em_executable"))},
            {QStringLiteral("args"), query.value(QStringLiteral("em_args"))},
            {QStringLiteral("is_retroarch"), query.value(QStringLiteral("em_is_retroarch"))},
            {QStringLiteral("created_at"), query.value(QStringLiteral("em_created_at"))},
        }},
    };
}

/** SELECT reutilizado pelos três métodos de leitura. */
const QString linkSelect = QStringLiteral(
    "SELECT pe.*, e.id AS em_id, e.name AS em_name, e.executable AS em_executable, "
    "e.args AS em_args, e.is_retroarch AS em_is_retroarch, e.created_at AS em_created_at "
    "FROM platform_emulators pe JOIN emulators e ON e.id = pe.emulator_id ");
} // namespace

PlatformEmulatorDao::PlatformEmulatorDao(QSqlDatabase& database) : database_(database) {}

bool PlatformEmulatorDao::listByPlatform(qint64 platformId, QList<QVariantMap>* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino dos vínculos ausente.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.prepare(linkSelect + QStringLiteral(
            "WHERE pe.platform_id = ? ORDER BY pe.is_default DESC, e.name COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(platformId);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> links;
    while (query.next()) links.append(readLink(query));
    *result = links;
    if (error) error->clear();
    return true;
}

bool PlatformEmulatorDao::listByPlatforms(const QList<qint64>& platformIds, QVariantMap* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino dos vínculos ausente.");
        return false;
    }
    QList<qint64> unique;
    for (const qint64 id : platformIds) {
        if (id > 0 && !unique.contains(id)) unique.append(id);
    }
    QVariantMap grouped;
    for (const qint64 id : unique) grouped.insert(QString::number(id), QVariantList{});
    if (unique.isEmpty()) {
        if (error) error->clear();
        return true;
    }
    QStringList placeholders;
    for (qsizetype index = 0; index < unique.size(); ++index) placeholders.append(QStringLiteral("?"));
    QSqlQuery query(database_);
    if (!query.prepare(linkSelect + QStringLiteral("WHERE pe.platform_id IN (%1) "
            "ORDER BY pe.platform_id, pe.is_default DESC, e.name COLLATE NOCASE")
            .arg(placeholders.join(QStringLiteral(", "))))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    for (const qint64 id : unique) query.addBindValue(id);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    while (query.next()) {
        const QVariantMap link = readLink(query);
        const QString key = QString::number(link.value(QStringLiteral("platform_id")).toLongLong());
        QVariantList list = grouped.value(key).toList();
        list.append(link);
        grouped.insert(key, list);
    }
    *result = grouped;
    if (error) error->clear();
    return true;
}

bool PlatformEmulatorDao::getDefault(qint64 platformId, QVariantMap* result, bool* found, QString* error) const {
    if (!result || !found) {
        if (error) *error = QStringLiteral("Destino do vínculo ausente.");
        return false;
    }
    *found = false;
    QSqlQuery query(database_);
    if (!query.prepare(linkSelect + QStringLiteral("WHERE pe.platform_id = ? AND pe.is_default = 1"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(platformId);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (query.next()) {
        *result = readLink(query);
        *found = true;
    }
    if (error) error->clear();
    return true;
}

bool PlatformEmulatorDao::link(qint64 emulatorId, qint64 platformId, bool isDefault, const QString& corePath,
    QVariantMap* result, QString* error) const {
    if (emulatorId <= 0 || platformId <= 0) {
        if (error) *error = QStringLiteral("Vínculo de emulador inválido");
        return false;
    }
    QSqlQuery upsert(database_);
    if (!upsert.prepare(QStringLiteral(
            "INSERT INTO platform_emulators (platform_id, emulator_id, is_default, core_path) "
            "VALUES (?, ?, ?, ?) ON CONFLICT(platform_id, emulator_id) DO UPDATE SET "
            "is_default = excluded.is_default, core_path = excluded.core_path"))) {
        if (error) *error = upsert.lastError().text();
        return false;
    }
    upsert.addBindValue(platformId);
    upsert.addBindValue(emulatorId);
    upsert.addBindValue(isDefault ? 1 : 0);
    upsert.addBindValue(corePath.trimmed().isEmpty() ? QVariant(QMetaType(QMetaType::QString)) : QVariant(corePath.trimmed()));
    if (!upsert.exec()) {
        if (error) *error = upsert.lastError().text();
        return false;
    }
    QList<QVariantMap> links;
    if (!listByPlatform(platformId, &links, error)) return false;
    for (const QVariantMap& link : links) {
        if (link.value(QStringLiteral("emulator_id")).toLongLong() == emulatorId) {
            if (result) *result = link;
            if (error) error->clear();
            return true;
        }
    }
    if (error) *error = QStringLiteral("Vínculo de emulador não encontrado após gravação.");
    return false;
}

bool PlatformEmulatorDao::unlink(qint64 emulatorId, qint64 platformId, QString* error) const {
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("DELETE FROM platform_emulators WHERE emulator_id = ? AND platform_id = ?"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(emulatorId);
    query.addBindValue(platformId);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (error) error->clear();
    return true;
}

bool PlatformEmulatorDao::linkMany(const QVariantList& changes, QString* error) const {
    if (!database_.transaction()) {
        if (error) *error = database_.lastError().text();
        return false;
    }
    QSqlQuery upsert(database_);
    if (!upsert.prepare(QStringLiteral(
            "INSERT INTO platform_emulators (platform_id, emulator_id, is_default, core_path) "
            "VALUES (?, ?, ?, ?) ON CONFLICT(platform_id, emulator_id) DO UPDATE SET "
            "is_default = excluded.is_default, core_path = excluded.core_path"))) {
        if (error) *error = upsert.lastError().text();
        database_.rollback();
        return false;
    }
    for (const QVariant& change : changes) {
        const QVariantMap entry = change.toMap();
        const qint64 platformId = entry.value(QStringLiteral("platformId")).toLongLong();
        const qint64 emulatorId = entry.value(QStringLiteral("emulatorId")).toLongLong();
        if (platformId <= 0 || emulatorId <= 0) {
            if (error) *error = QStringLiteral("Vínculo de emulador inválido");
            database_.rollback();
            return false;
        }
        const QString corePath = entry.value(QStringLiteral("corePath")).toString().trimmed();
        upsert.bindValue(0, platformId);
        upsert.bindValue(1, emulatorId);
        upsert.bindValue(2, entry.value(QStringLiteral("isDefault")).toBool() ? 1 : 0);
        upsert.bindValue(3, corePath.isEmpty() ? QVariant(QMetaType(QMetaType::QString)) : QVariant(corePath));
        if (!upsert.exec()) {
            if (error) *error = upsert.lastError().text();
            database_.rollback();
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
