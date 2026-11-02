/** Porta de src/main/db/dao/hardwareItemTypeDao.ts. */
#include "HardwareItemTypeDao.h"

#include <QSqlError>
#include <QSqlQuery>
#include <QSqlRecord>

namespace gamestock {
namespace {
QVariantMap readRow(const QSqlQuery& query) {
    QVariantMap row;
    const QSqlRecord record = query.record();
    for (int index = 0; index < record.count(); ++index) row.insert(record.fieldName(index), query.value(index));
    return row;
}

/** Duplicidade de nome é o único erro esperado pela interface. */
void translateUnique(QSqlQuery& query, QString* error) {
    const QString text = query.lastError().text();
    if (error) *error = text.contains(QStringLiteral("UNIQUE")) ? QStringLiteral("Tipo já existe") : text;
}
} // namespace

HardwareItemTypeDao::HardwareItemTypeDao(QSqlDatabase& database) : database_(database) {}

bool HardwareItemTypeDao::list(QList<QVariantMap>* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino da listagem ausente.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT id, name, is_default, created_at FROM item_types ORDER BY name COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) rows.append(readRow(query));
    *result = rows;
    if (error) error->clear();
    return true;
}

bool HardwareItemTypeDao::listWithCounts(QList<QVariantMap>* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino da listagem ausente.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT it.id, it.name, COUNT(hi.id) AS count FROM item_types it "
            "LEFT JOIN hardware_items hi ON hi.item_type_id = it.id "
            "GROUP BY it.id, it.name ORDER BY it.name COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) rows.append(readRow(query));
    *result = rows;
    if (error) error->clear();
    return true;
}

bool HardwareItemTypeDao::create(const QString& name, qint64* newId, QString* error) const {
    const QString trimmed = name.trimmed();
    if (trimmed.isEmpty()) {
        if (error) *error = QStringLiteral("Nome do tipo é obrigatório");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("INSERT INTO item_types (name, is_default) VALUES (?, 0)"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(trimmed);
    if (!query.exec()) {
        translateUnique(query, error);
        return false;
    }
    if (newId) *newId = query.lastInsertId().toLongLong();
    if (error) error->clear();
    return true;
}

bool HardwareItemTypeDao::remove(qint64 id, QString* error) const {
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("DELETE FROM item_types WHERE id = ?"))) {
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
} // namespace gamestock
