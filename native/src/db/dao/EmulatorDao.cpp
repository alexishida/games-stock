/** Porta de src/main/db/dao/emulatorDao.ts. */
#include "EmulatorDao.h"

#include <QSqlError>
#include <QSqlQuery>
#include <QSqlRecord>

namespace gamestock {
namespace {
/** Lê a linha atual em um mapa independente da ordem do schema. */
QVariantMap readRow(const QSqlQuery& query) {
    QVariantMap row;
    const QSqlRecord record = query.record();
    for (int index = 0; index < record.count(); ++index) row.insert(record.fieldName(index), query.value(index));
    return row;
}

/** Campos TEXT do schema são NOT NULL; ausência vira string vazia, não NULL. */
QString textOrEmpty(const QVariant& value) {
    const QString text = value.toString().trimmed();
    return text.isNull() ? QStringLiteral("") : text;
}

/** Traduz duplicidade de nome para a mensagem esperada pela interface. */
void translateUnique(QSqlQuery& query, QString* error) {
    const QString text = query.lastError().text();
    if (error) *error = text.contains(QStringLiteral("UNIQUE")) ? QStringLiteral("Emulador já existe") : text;
}
} // namespace

EmulatorDao::EmulatorDao(QSqlDatabase& database) : database_(database) {}

bool EmulatorDao::list(QList<QVariantMap>* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino da listagem ausente.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral("SELECT * FROM emulators ORDER BY name COLLATE NOCASE"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<QVariantMap> emulators;
    while (query.next()) emulators.append(readRow(query));
    *result = emulators;
    if (error) error->clear();
    return true;
}

bool EmulatorDao::get(qint64 id, QVariantMap* result, QString* error) const {
    if (!result || id <= 0) {
        if (error) *error = QStringLiteral("Emulador não encontrado");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("SELECT * FROM emulators WHERE id = ?"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(id);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (!query.next()) {
        if (error) *error = QStringLiteral("Emulador não encontrado");
        return false;
    }
    *result = readRow(query);
    if (error) error->clear();
    return true;
}

bool EmulatorDao::create(const QVariantMap& input, qint64* newId, QString* error) const {
    const QString name = input.value(QStringLiteral("name")).toString().trimmed();
    if (name.isEmpty()) {
        if (error) *error = QStringLiteral("Nome do emulador é obrigatório");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("INSERT INTO emulators (name, executable, args, is_retroarch) VALUES (?, ?, ?, ?)"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(name);
    query.addBindValue(textOrEmpty(input.value(QStringLiteral("executable"))));
    query.addBindValue(textOrEmpty(input.value(QStringLiteral("args"))));
    query.addBindValue(input.value(QStringLiteral("is_retroarch")).toBool() ? 1 : 0);
    if (!query.exec()) {
        translateUnique(query, error);
        return false;
    }
    if (newId) *newId = query.lastInsertId().toLongLong();
    if (error) error->clear();
    return true;
}

bool EmulatorDao::update(qint64 id, const QVariantMap& changes, QString* error) const {
    QVariantMap current;
    if (!get(id, &current, error)) return false;
    QStringList columns;
    QVariantList values;
    // Somente colunas editáveis entram no UPDATE; vazias preservam o valor atual.
    if (changes.contains(QStringLiteral("name"))) {
        const QString name = changes.value(QStringLiteral("name")).toString().trimmed();
        if (name.isEmpty()) {
            if (error) *error = QStringLiteral("Nome do emulador é obrigatório");
            return false;
        }
        columns.append(QStringLiteral("name"));
        values.append(name);
    }
    if (changes.contains(QStringLiteral("executable"))) {
        columns.append(QStringLiteral("executable"));
        values.append(textOrEmpty(changes.value(QStringLiteral("executable"))));
    }
    if (changes.contains(QStringLiteral("args"))) {
        columns.append(QStringLiteral("args"));
        values.append(textOrEmpty(changes.value(QStringLiteral("args"))));
    }
    if (changes.contains(QStringLiteral("is_retroarch"))) {
        columns.append(QStringLiteral("is_retroarch"));
        values.append(changes.value(QStringLiteral("is_retroarch")).toBool() ? 1 : 0);
    }
    if (columns.isEmpty()) {
        if (error) error->clear();
        return true;
    }
    QStringList assignments;
    for (const QString& column : columns) assignments.append(column + QStringLiteral(" = ?"));
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("UPDATE emulators SET %1 WHERE id = ?").arg(assignments.join(QStringLiteral(", "))))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    for (const QVariant& value : values) query.addBindValue(value);
    query.addBindValue(id);
    if (!query.exec()) {
        translateUnique(query, error);
        return false;
    }
    if (error) error->clear();
    return true;
}

bool EmulatorDao::remove(qint64 id, QString* error) const {
    QVariantMap emulator;
    if (!get(id, &emulator, error)) return false;
    if (emulator.value(QStringLiteral("is_retroarch")).toInt() != 0) {
        if (error) *error = QStringLiteral("RetroArch não pode ser removido");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("DELETE FROM emulators WHERE id = ?"))) {
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
