/** Persiste valores de app_state sem criar ou alterar o schema legado. */
#pragma once
#include <QJsonValue>
#include <QSqlDatabase>
#include <QString>

namespace gamestock {
/** Escrita só deve ser usada após os controles de lock e migração do perfil. */
class AppStateWriteDao final {
public:
    /** Associa a conexão já aberta e pertencente à thread do chamador. */
    explicit AppStateWriteDao(QSqlDatabase& database);
    /** Insere ou atualiza JSON em uma única instrução SQLite. */
    bool set(const QString& key, const QJsonValue& value, QString* error) const;
    /** Remove uma chave, mantendo ausência como operação idempotente. */
    bool remove(const QString& key, QString* error) const;
private:
    QSqlDatabase& database_;
};
}
