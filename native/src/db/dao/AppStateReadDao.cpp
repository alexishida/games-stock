/** Consulta e desserializa valores persistidos, tolerando JSON legado inválido. */
#include "AppStateReadDao.h"
#include <QJsonArray>
#include <QJsonDocument>
#include <QSqlError>
#include <QSqlQuery>

namespace gamestock {
AppStateReadDao::AppStateReadDao(QSqlDatabase& database) : database_(database) {}

bool AppStateReadDao::get(const QString& key, QJsonValue* value, QString* error) const {
    if (!value) { if (error) *error = QStringLiteral("Destino do estado ausente."); return false; }
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("SELECT value_json FROM app_state WHERE key = ?"))) {
        if (error) *error = query.lastError().text(); return false;
    }
    query.addBindValue(key);
    if (!query.exec()) { if (error) *error = query.lastError().text(); return false; }
    *value = QJsonValue(QJsonValue::Undefined);
    if (query.next()) {
        // O wrapper permite ler valores escalares, que QJsonDocument não aceita isoladamente.
        const QByteArray json = QByteArray("[") + query.value(0).toString().toUtf8() + QByteArray("]");
        QJsonParseError parseError;
        const QJsonDocument document = QJsonDocument::fromJson(json, &parseError);
        if (parseError.error == QJsonParseError::NoError && document.isArray() && document.array().size() == 1)
            *value = document.array().at(0);
    }
    if (error) error->clear();
    return true;
}
}
