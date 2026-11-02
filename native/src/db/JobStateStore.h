/** Adapta registros de jobs ao formato legado de app_state. */
#pragma once
#include <QJsonArray>
#include <QSqlDatabase>
#include <QString>

namespace gamestock {
/** Armazena listas ou o último job de ROM nas chaves já usadas pelo Electron. */
class JobStateStore final {
public:
    /** Seleciona uma das listas permitidas e empresta a conexão. */
    JobStateStore(QSqlDatabase& database, const QString& key);
    /** Grava transição ou remove a chave quando não restarem jobs. */
    bool persist(const QJsonArray& jobs, QString* error) const;
private:
    QSqlDatabase& database_;
    QString key_;
};
}
