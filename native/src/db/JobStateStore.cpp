/** Mantém o formato de listas e o limite de histórico do renderer anterior. */
#include "JobStateStore.h"
#include "dao/AppStateWriteDao.h"

namespace gamestock {
JobStateStore::JobStateStore(QSqlDatabase& database, const QString& key) : database_(database), key_(key) {}
bool JobStateStore::persist(const QJsonArray& jobs, QString* error) const {
    const bool portability = key_ == QLatin1String("gamestock.dataPortability.jobs");
    const bool lastRom = key_ == QLatin1String("gamestock.media.lastRomImportJob");
    if (!portability && !lastRom && key_ != QLatin1String("gamestock.media.lastMediaSyncJobs")) {
        if (error) *error = QStringLiteral("Chave de lista de jobs não suportada."); return false;
    }
    AppStateWriteDao dao(database_);
    if (jobs.isEmpty()) return dao.remove(key_, error);
    // O formato legado guarda apenas um job de ROM, não uma lista.
    if (lastRom) {
        if (jobs.size() != 1) { if (error) *error = QStringLiteral("O estado legado aceita apenas um job de ROM."); return false; }
        return dao.set(key_, jobs.at(0), error);
    }
    QJsonArray stored;
    // O histórico de portabilidade permanece limitado às cinco entradas mais recentes.
    const qsizetype limit = portability ? qMin(jobs.size(), qsizetype(5)) : jobs.size();
    for (qsizetype index = 0; index < limit; ++index) stored.append(jobs.at(index));
    return dao.set(key_, stored, error);
}
}
