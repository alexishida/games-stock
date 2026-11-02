/** Lê valores JSON legados da tabela app_state sem alterar o banco. */
#pragma once
#include <QJsonValue>
#include <QSqlDatabase>
#include <QString>

namespace gamestock {
/** A conexão é emprestada e deve permanecer válida na mesma thread. */
class AppStateReadDao final {
public:
    /** Associa o DAO à conexão de leitura fornecida pelo chamador. */
    explicit AppStateReadDao(QSqlDatabase& database);
    /** Ausência ou JSON inválido resulta em Undefined; erro SQL é retornado separadamente. */
    bool get(const QString& key, QJsonValue* value, QString* error) const;
private:
    QSqlDatabase& database_;
};
}
