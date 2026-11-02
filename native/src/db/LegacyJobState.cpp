/** Preserva formatos persistidos pelo Electron durante a transição nativa. */
#include "LegacyJobState.h"
#include "dao/AppStateReadDao.h"
#include <QJsonObject>

namespace gamestock {
namespace {
/** Ajusta somente jobs em execução; demais campos desconhecidos permanecem intactos. */
QJsonObject interrupted(QJsonObject job, bool nestedProgress) {
    if (job.value("status").toString() != QLatin1String("running")) return job;
    job.insert("status", "interrupted");
    if (nestedProgress) {
        QJsonObject progress = job.value("progress").toObject();
        progress.insert("message", "Interrompido");
        job.insert("progress", progress);
    } else job.insert("progressLabel", "Interrompido");
    return job;
}
/** Verifica as chaves mínimas usadas pela leitura legada. */
bool hasFields(const QJsonValue& value, const QStringList& fields) {
    if (!value.isObject()) return false;
    const QJsonObject object = value.toObject();
    for (const auto& field : fields) if (!object.contains(field)) return false;
    return true;
}
}

bool loadLegacyJobState(QSqlDatabase& database, LegacyJobState* result, QString* error) {
    if (!result) { if (error) *error = QStringLiteral("Destino do estado ausente."); return false; }
    AppStateReadDao dao(database);
    QJsonValue folders, rom, media, portability;
    if (!dao.get("gamestock.romImport.folderEntries", &folders, error)
        || !dao.get("gamestock.media.lastRomImportJob", &rom, error)
        || !dao.get("gamestock.media.lastMediaSyncJobs", &media, error)
        || !dao.get("gamestock.dataPortability.jobs", &portability, error)) return false;
    LegacyJobState output;
    output.lastRomJob = QJsonValue(QJsonValue::Null);
    for (const auto& value : folders.toArray()) {
        if (!hasFields(value, {"folderPath", "platformId"}) || !value.toObject().value("folderPath").isString()) continue;
        QJsonObject folder = value.toObject();
        // Registros anteriores não tinham esta flag; o comportamento antigo não percorria subpastas.
        if (!folder.contains("includeSubfolders")) folder.insert("includeSubfolders", false);
        output.folders.append(folder);
    }
    if (hasFields(rom, {"jobId", "progress"})) output.lastRomJob = interrupted(rom.toObject(), true);
    if (!media.isArray()) {
        if (!dao.get("gamestock.media.lastMediaSyncJob", &media, error)) return false;
        if (hasFields(media, {"jobId", "title", "status"})) output.mediaJobs.append(interrupted(media.toObject(), false));
    } else {
        for (const auto& value : media.toArray())
            if (hasFields(value, {"jobId", "title", "status"})) output.mediaJobs.append(interrupted(value.toObject(), false));
    }
    for (const auto& value : portability.toArray())
        if (hasFields(value, {"jobId", "kind", "progress"})) output.portabilityJobs.append(interrupted(value.toObject(), true));
    *result = output;
    if (error) error->clear();
    return true;
}
}
