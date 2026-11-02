/** Reconstrói em memória o estado legado de pastas e jobs interrompidos. */
#pragma once
#include <QJsonArray>
#include <QJsonValue>
#include <QSqlDatabase>
#include <QString>

namespace gamestock {
/** Retrato de leitura, sem persistir alterações até o fluxo seguro de escrita existir. */
struct LegacyJobState {
    QJsonArray folders;
    QJsonValue lastRomJob;
    QJsonArray mediaJobs;
    QJsonArray portabilityJobs;
};

/** Retorna os dados tolerantes a campos ausentes e converte running em interrupted. */
bool loadLegacyJobState(QSqlDatabase& database, LegacyJobState* result, QString* error);
}
