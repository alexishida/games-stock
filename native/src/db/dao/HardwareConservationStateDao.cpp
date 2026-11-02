/** Porta de src/main/db/dao/hardwareConservationStateDao.ts. */
#include "HardwareConservationStateDao.h"

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

void translateUnique(QSqlQuery& query, QString* error) {
    const QString text = query.lastError().text();
    if (error) *error = text.contains(QStringLiteral("UNIQUE")) ? QStringLiteral("Estado já existe") : text;
}
} // namespace

HardwareConservationStateDao::HardwareConservationStateDao(QSqlDatabase& database) : database_(database) {}

bool HardwareConservationStateDao::list(QList<QVariantMap>* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino da listagem ausente.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT id, name, is_default, created_at FROM conservation_states ORDER BY name COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) rows.append(readRow(query));
    *result = rows;
    if (error) error->clear();
    return true;
}

bool HardwareConservationStateDao::listWithCounts(QList<QVariantMap>* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino da listagem ausente.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT cs.id, cs.name, COUNT(hi.id) AS count FROM conservation_states cs "
            "LEFT JOIN hardware_items hi ON hi.conservation_state_id = cs.id "
            "GROUP BY cs.id, cs.name ORDER BY cs.name COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) rows.append(readRow(query));
    *result = rows;
    if (error) error->clear();
    return true;
}

bool HardwareConservationStateDao::create(const QString& name, qint64* newId, QString* error) const {
    const QString trimmed = name.trimmed();
    if (trimmed.isEmpty()) {
        if (error) *error = QStringLiteral("Nome do estado é obrigatório");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("INSERT INTO conservation_states (name, is_default) VALUES (?, 0)"))) {
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

bool HardwareConservationStateDao::remove(qint64 id, QString* error) const {
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("DELETE FROM conservation_states WHERE id = ?"))) {
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
