/** Porta de src/main/db/dao/hardwareItemDao.ts. */
#include "HardwareItemDao.h"

#include <QSqlError>
#include <QSqlQuery>
#include <QSqlRecord>
#include <QStringList>

namespace gamestock {
namespace {
/** Rótulo exibido quando o item serve várias plataformas, sem criar plataforma. */
constexpr auto kMultiplatformLabel = "Multiplataforma";

/** Lê a linha atual em um mapa independente da ordem do schema. */
QVariantMap readRow(const QSqlQuery& query) {
    QVariantMap row;
    const QSqlRecord record = query.record();
    for (int index = 0; index < record.count(); ++index) row.insert(record.fieldName(index), query.value(index));
    return row;
}

/** Campos TEXT não nulos do schema guardam string vazia, nunca NULL. */
QString textOrEmpty(const QVariant& value) {
    return value.isNull() ? QStringLiteral("") : value.toString();
}

/** Converte texto opcional vazio em NULL para preservar o formato legado. */
QVariant nullableText(const QVariant& value) {
    if (value.isNull()) return {};
    const QString text = value.toString().trimmed();
    return text.isEmpty() ? QVariant() : QVariant(text);
}

/** Normaliza plataforma e marcador Multiplataforma como o renderer atual. */
struct PlatformAssignment {
    QVariant platformId;
    int isMultiplatform = 0;
};

PlatformAssignment normalizePlatform(const QVariantMap& data) {
    const QVariant rawMulti = data.value(QStringLiteral("is_multiplatform"));
    const bool isMultiplatform = rawMulti.toBool() || rawMulti.toInt() == 1;
    PlatformAssignment assignment;
    if (isMultiplatform) {
        assignment.platformId = QVariant();
        assignment.isMultiplatform = 1;
        return assignment;
    }
    const qint64 platformId = data.value(QStringLiteral("platform_id")).toLongLong();
    assignment.platformId = platformId > 0 ? QVariant(platformId) : QVariant();
    return assignment;
}

/** Query base com os JOINs e a capa (menor sort_order) usados pela listagem e pelo detalhe. */
QString baseSelect() {
    return QStringLiteral(
        "SELECT hi.id, hi.name, hi.platform_id, hi.is_multiplatform, "
        "CASE WHEN hi.is_multiplatform = 1 THEN 'Multiplataforma' ELSE p.name END AS platform_name, "
        "hi.item_type_id, it.name AS item_type_name, hi.conservation_state_id, "
        "cs.name AS conservation_state_name, hi.description, hi.acquisition_date, hi.acquisition_url, "
        "hi.color, hi.value, hi.serial_number, hi.region, hi.storage_location, hi.loan_to, "
        "hi.created_at, hi.updated_at, "
        "(SELECT file_path FROM hardware_item_photos WHERE item_id = hi.id "
        "ORDER BY sort_order ASC, id ASC LIMIT 1) AS cover_photo_path "
        "FROM hardware_items hi "
        "LEFT JOIN platforms p ON p.id = hi.platform_id "
        "LEFT JOIN item_types it ON it.id = hi.item_type_id "
        "LEFT JOIN conservation_states cs ON cs.id = hi.conservation_state_id ");
}

/** Ordenação estável, idêntica à consulta paginada do Electron. */
QString buildOrder(const QString& sortBy) {
    if (sortBy == QLatin1String("type")) {
        return QStringLiteral("ORDER BY it.name IS NULL, it.name COLLATE NOCASE, hi.name COLLATE NOCASE");
    }
    if (sortBy == QLatin1String("recent")) return QStringLiteral("ORDER BY hi.created_at DESC, hi.id DESC");
    return QStringLiteral("ORDER BY hi.name COLLATE NOCASE");
}
} // namespace

HardwareItemDao::HardwareItemDao(QSqlDatabase& database) : database_(database) {}

bool HardwareItemDao::list(const HardwareItemFilters& filters, QList<QVariantMap>* items, qint64* total,
    qint64* filtered, QString* error) const {
    if (!items) {
        if (error) *error = QStringLiteral("Destino da listagem ausente.");
        return false;
    }

    QStringList clauses;
    QVariantList params;
    if (filters.platformId > 0) {
        clauses.append(QStringLiteral("hi.is_multiplatform = 0 AND hi.platform_id = ?"));
        params.append(filters.platformId);
    }
    if (filters.itemTypeId > 0) {
        clauses.append(QStringLiteral("hi.item_type_id = ?"));
        params.append(filters.itemTypeId);
    }
    if (filters.conservationStateId > 0) {
        clauses.append(QStringLiteral("hi.conservation_state_id = ?"));
        params.append(filters.conservationStateId);
    }
    const QString search = filters.search.trimmed();
    if (!search.isEmpty()) {
        clauses.append(QStringLiteral("hi.name LIKE ? COLLATE NOCASE"));
        params.append(QStringLiteral("%") + search + QStringLiteral("%"));
    }
    const QString where = clauses.isEmpty() ? QString() : QStringLiteral("WHERE ") + clauses.join(QStringLiteral(" AND "));

    QSqlQuery totalQuery(database_);
    if (!totalQuery.exec(QStringLiteral("SELECT COUNT(*) FROM hardware_items")) || !totalQuery.next()) {
        if (error) *error = totalQuery.lastError().text();
        return false;
    }
    const qint64 totalCount = totalQuery.value(0).toLongLong();

    QSqlQuery filteredQuery(database_);
    if (!filteredQuery.prepare(QStringLiteral("SELECT COUNT(*) FROM hardware_items hi ") + where)) {
        if (error) *error = filteredQuery.lastError().text();
        return false;
    }
    for (const QVariant& value : params) filteredQuery.addBindValue(value);
    if (!filteredQuery.exec() || !filteredQuery.next()) {
        if (error) *error = filteredQuery.lastError().text();
        return false;
    }
    const qint64 filteredCount = filteredQuery.value(0).toLongLong();

    const int page = qMax(1, filters.page);
    const int pageSize = qMax(1, filters.pageSize);
    const int offset = (page - 1) * pageSize;

    QSqlQuery query(database_);
    const QString sql = baseSelect() + where + QLatin1Char(' ') + buildOrder(filters.sortBy)
        + QStringLiteral(" LIMIT ? OFFSET ?");
    if (!query.prepare(sql)) {
        if (error) *error = query.lastError().text();
        return false;
    }
    for (const QVariant& value : params) query.addBindValue(value);
    query.addBindValue(pageSize);
    query.addBindValue(offset);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) rows.append(readRow(query));
    *items = rows;
    if (total) *total = totalCount;
    if (filtered) *filtered = filteredCount;
    if (error) error->clear();
    return true;
}

bool HardwareItemDao::get(qint64 id, QVariantMap* result, QString* error) const {
    if (!result || id <= 0) {
        if (error) *error = QStringLiteral("Item não encontrado");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.prepare(baseSelect() + QStringLiteral("WHERE hi.id = ?"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(id);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (!query.next()) {
        if (error) *error = QStringLiteral("Item não encontrado");
        return false;
    }
    *result = readRow(query);
    if (error) error->clear();
    return true;
}

bool HardwareItemDao::create(const QVariantMap& input, qint64* newId, QString* error) const {
    const QString name = input.value(QStringLiteral("name")).toString().trimmed();
    if (name.isEmpty()) {
        if (error) *error = QStringLiteral("Nome do item é obrigatório");
        return false;
    }
    const PlatformAssignment platform = normalizePlatform(input);
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral(
            "INSERT INTO hardware_items (name, platform_id, is_multiplatform, item_type_id, conservation_state_id, "
            "description, acquisition_date, acquisition_url, color, value, serial_number, region, storage_location, loan_to) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(name);
    query.addBindValue(platform.platformId);
    query.addBindValue(platform.isMultiplatform);
    query.addBindValue(input.value(QStringLiteral("item_type_id")).toLongLong() > 0
        ? input.value(QStringLiteral("item_type_id")) : QVariant());
    query.addBindValue(input.value(QStringLiteral("conservation_state_id")).toLongLong() > 0
        ? input.value(QStringLiteral("conservation_state_id")) : QVariant());
    query.addBindValue(textOrEmpty(input.value(QStringLiteral("description"))));
    query.addBindValue(nullableText(input.value(QStringLiteral("acquisition_date"))));
    query.addBindValue(nullableText(input.value(QStringLiteral("acquisition_url"))));
    query.addBindValue(nullableText(input.value(QStringLiteral("color"))));
    query.addBindValue(input.value(QStringLiteral("value")).isNull() || input.value(QStringLiteral("value")).toString().isEmpty()
        ? QVariant() : input.value(QStringLiteral("value")));
    query.addBindValue(nullableText(input.value(QStringLiteral("serial_number"))));
    query.addBindValue(nullableText(input.value(QStringLiteral("region"))));
    query.addBindValue(nullableText(input.value(QStringLiteral("storage_location"))));
    query.addBindValue(nullableText(input.value(QStringLiteral("loan_to"))));
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (newId) *newId = query.lastInsertId().toLongLong();
    if (error) error->clear();
    return true;
}

bool HardwareItemDao::update(qint64 id, const QVariantMap& changes, QString* error) const {
    QVariantMap current;
    if (!get(id, &current, error)) return false;
    if (changes.isEmpty()) {
        if (error) error->clear();
        return true;
    }

    QStringList columns;
    QVariantList values;
    if (changes.contains(QStringLiteral("name"))) {
        const QString name = changes.value(QStringLiteral("name")).toString().trimmed();
        if (name.isEmpty()) {
            if (error) *error = QStringLiteral("Nome do item é obrigatório");
            return false;
        }
        columns.append(QStringLiteral("name"));
        values.append(name);
    }
    if (changes.contains(QStringLiteral("platform_id")) || changes.contains(QStringLiteral("is_multiplatform"))) {
        // Campo ausente conserva o valor atual, como no DAO legado.
        QVariantMap effective{
            {QStringLiteral("platform_id"), changes.contains(QStringLiteral("platform_id"))
                ? changes.value(QStringLiteral("platform_id")) : current.value(QStringLiteral("platform_id"))},
            {QStringLiteral("is_multiplatform"), changes.contains(QStringLiteral("is_multiplatform"))
                ? changes.value(QStringLiteral("is_multiplatform")) : current.value(QStringLiteral("is_multiplatform"))}
        };
        const PlatformAssignment platform = normalizePlatform(effective);
        columns.append(QStringLiteral("platform_id"));
        values.append(platform.platformId);
        columns.append(QStringLiteral("is_multiplatform"));
        values.append(platform.isMultiplatform);
    }
    auto addNullable = [&](const char* key) {
        if (!changes.contains(QString::fromLatin1(key))) return;
        columns.append(QString::fromLatin1(key));
        values.append(nullableText(changes.value(QString::fromLatin1(key))));
    };
    if (changes.contains(QStringLiteral("item_type_id"))) {
        const qint64 typeId = changes.value(QStringLiteral("item_type_id")).toLongLong();
        columns.append(QStringLiteral("item_type_id"));
        values.append(typeId > 0 ? QVariant(typeId) : QVariant());
    }
    if (changes.contains(QStringLiteral("conservation_state_id"))) {
        const qint64 stateId = changes.value(QStringLiteral("conservation_state_id")).toLongLong();
        columns.append(QStringLiteral("conservation_state_id"));
        values.append(stateId > 0 ? QVariant(stateId) : QVariant());
    }
    if (changes.contains(QStringLiteral("description"))) {
        columns.append(QStringLiteral("description"));
        values.append(textOrEmpty(changes.value(QStringLiteral("description"))));
    }
    addNullable("acquisition_date");
    addNullable("acquisition_url");
    addNullable("color");
    if (changes.contains(QStringLiteral("value"))) {
        columns.append(QStringLiteral("value"));
        const QVariant value = changes.value(QStringLiteral("value"));
        values.append(value.isNull() || value.toString().isEmpty() ? QVariant() : value);
    }
    addNullable("serial_number");
    addNullable("region");
    addNullable("storage_location");
    addNullable("loan_to");

    if (columns.isEmpty()) {
        if (error) error->clear();
        return true;
    }
    QStringList assignments;
    for (const QString& column : columns) assignments.append(column + QStringLiteral(" = ?"));
    assignments.append(QStringLiteral("updated_at = datetime('now')"));
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("UPDATE hardware_items SET %1 WHERE id = ?")
            .arg(assignments.join(QStringLiteral(", "))))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    for (const QVariant& value : values) query.addBindValue(value);
    query.addBindValue(id);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (error) error->clear();
    return true;
}

bool HardwareItemDao::remove(qint64 id, QString* error) const {
    QVariantMap existing;
    if (!get(id, &existing, error)) return false;
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("DELETE FROM hardware_items WHERE id = ?"))) {
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

bool HardwareItemDao::listPlatformsWithItems(QList<QVariantMap>* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino da listagem ausente.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT p.id, p.name, COUNT(*) AS count FROM hardware_items hi "
            "JOIN platforms p ON p.id = hi.platform_id "
            "GROUP BY p.id, p.name ORDER BY p.name COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> rows;
    while (query.next()) rows.append(readRow(query));
    *result = rows;
    if (error) error->clear();
    return true;
}
} // namespace gamestock
