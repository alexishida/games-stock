/** Porta de src/main/db/dao/hardwareItemPhotoDao.ts. */
#include "HardwareItemPhotoDao.h"

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
} // namespace

HardwareItemPhotoDao::HardwareItemPhotoDao(QSqlDatabase& database) : database_(database) {}

bool HardwareItemPhotoDao::listByItem(qint64 itemId, QList<QVariantMap>* result, QString* error) const {
    if (!result || itemId <= 0) {
        if (error) *error = QStringLiteral("Item inválido para listar fotos.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral(
            "SELECT id, item_id, file_path, sort_order, created_at FROM hardware_item_photos "
            "WHERE item_id = ? ORDER BY sort_order ASC, id ASC"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(itemId);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) rows.append(readRow(query));
    *result = rows;
    if (error) error->clear();
    return true;
}

bool HardwareItemPhotoDao::get(qint64 id, QVariantMap* result, QString* error) const {
    if (!result || id <= 0) {
        if (error) *error = QStringLiteral("Foto não encontrada");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral(
            "SELECT id, item_id, file_path, sort_order, created_at FROM hardware_item_photos WHERE id = ?"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(id);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (!query.next()) {
        if (error) *error = QStringLiteral("Foto não encontrada");
        return false;
    }
    *result = readRow(query);
    if (error) error->clear();
    return true;
}

bool HardwareItemPhotoDao::create(qint64 itemId, const QString& filePath, qint64* newId, QString* error) const {
    if (itemId <= 0 || filePath.trimmed().isEmpty()) {
        if (error) *error = QStringLiteral("Foto inválida.");
        return false;
    }
    QSqlQuery maxQuery(database_);
    if (!maxQuery.prepare(QStringLiteral(
            "SELECT COALESCE(MAX(sort_order), -1) FROM hardware_item_photos WHERE item_id = ?"))) {
        if (error) *error = maxQuery.lastError().text();
        return false;
    }
    maxQuery.addBindValue(itemId);
    if (!maxQuery.exec() || !maxQuery.next()) {
        if (error) *error = maxQuery.lastError().text();
        return false;
    }
    const int sortOrder = maxQuery.value(0).toInt() + 1;

    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral(
            "INSERT INTO hardware_item_photos (item_id, file_path, sort_order) VALUES (?, ?, ?)"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(itemId);
    query.addBindValue(filePath);
    query.addBindValue(sortOrder);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (newId) *newId = query.lastInsertId().toLongLong();
    if (error) error->clear();
    return true;
}

bool HardwareItemPhotoDao::remove(qint64 id, QString* error) const {
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("DELETE FROM hardware_item_photos WHERE id = ?"))) {
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

bool HardwareItemPhotoDao::reorder(qint64 idA, qint64 idB, QString* error) const {
    if (idA == idB) {
        if (error) error->clear();
        return true;
    }
    QVariantMap first;
    QVariantMap second;
    if (!get(idA, &first, error) || !get(idB, &second, error)) return false;
    if (first.value(QStringLiteral("item_id")).toLongLong() != second.value(QStringLiteral("item_id")).toLongLong()) {
        if (error) *error = QStringLiteral("As fotos devem pertencer ao mesmo item.");
        return false;
    }

    if (!database_.transaction()) {
        if (error) *error = database_.lastError().text();
        return false;
    }
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("UPDATE hardware_item_photos SET sort_order = ? WHERE id = ?"))) {
        database_.rollback();
        if (error) *error = query.lastError().text();
        return false;
    }
    const bool firstUpdate = [&] {
        query.addBindValue(second.value(QStringLiteral("sort_order")));
        query.addBindValue(idA);
        return query.exec();
    }();
    if (!firstUpdate) {
        database_.rollback();
        if (error) *error = query.lastError().text();
        return false;
    }
    QSqlQuery next(database_);
    if (!next.prepare(QStringLiteral("UPDATE hardware_item_photos SET sort_order = ? WHERE id = ?"))) {
        database_.rollback();
        if (error) *error = next.lastError().text();
        return false;
    }
    next.addBindValue(first.value(QStringLiteral("sort_order")));
    next.addBindValue(idB);
    if (!next.exec()) {
        database_.rollback();
        if (error) *error = next.lastError().text();
        return false;
    }
    if (!database_.commit()) {
        database_.rollback();
        if (error) *error = database_.lastError().text();
        return false;
    }
    if (error) error->clear();
    return true;
}

bool HardwareItemPhotoDao::takeByItem(qint64 itemId, QList<QVariantMap>* removed, QString* error) const {
    QList<QVariantMap> photos;
    if (!listByItem(itemId, &photos, error)) return false;
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("DELETE FROM hardware_item_photos WHERE item_id = ?"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(itemId);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (removed) *removed = photos;
    if (error) error->clear();
    return true;
}
} // namespace gamestock
