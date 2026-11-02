/** Escrita parametrizada de app_state, compatível com o schema existente. */
#include "AppStateWriteDao.h"
#include <QJsonArray>
#include <QJsonDocument>
#include <QSqlError>
#include <QSqlQuery>

namespace gamestock {
AppStateWriteDao::AppStateWriteDao(QSqlDatabase& database) : database_(database) {}
bool AppStateWriteDao::set(const QString& key, const QJsonValue& value, QString* error) const {
    if (key.trimmed().isEmpty() || value.isUndefined()) { if (error) *error = QStringLiteral("Chave ou valor inválido."); return false; }
    // O wrapper permite serializar escalares JSON sem alterar seu tipo.
    QByteArray json = QJsonDocument(QJsonArray{value}).toJson(QJsonDocument::Compact);
    json = json.mid(1, json.size() - 2);
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("INSERT INTO app_state (key, value_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) "
                                     "ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=CURRENT_TIMESTAMP"))) {
        if (error) *error = query.lastError().text(); return false;
    }
    query.addBindValue(key);
    query.addBindValue(QString::fromUtf8(json));
    if (!query.exec()) { if (error) *error = query.lastError().text(); return false; }
    if (error) error->clear();
    return true;
}
bool AppStateWriteDao::remove(const QString& key, QString* error) const {
    if (key.trimmed().isEmpty()) { if (error) *error = QStringLiteral("Chave inválida."); return false; }
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("DELETE FROM app_state WHERE key = ?"))) { if (error) *error = query.lastError().text(); return false; }
    query.addBindValue(key);
    if (!query.exec()) { if (error) *error = query.lastError().text(); return false; }
    if (error) error->clear();
    return true;
}
}
