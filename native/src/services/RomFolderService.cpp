/** Implementação da fachada de importação de pastas; SQL permanece nos DAOs. */
#include "RomFolderService.h"

#include "db/FolderStateStore.h"
#include "db/dao/GameWriteDao.h"
#include "db/dao/PlatformDao.h"
#include "db/dao/RomFolderDao.h"
#include "jobs/JobManager.h"
#include "jobs/JobWorker.h"

#include <QDateTime>
#include <QDir>
#include <QFileInfo>
#include <QHash>
#include <QJsonArray>
#include <QJsonObject>
#include <QMetaType>
#include <QUuid>

#include <stdexcept>

namespace gamestock {
namespace {
/** Aceita array do QML, QStringList ou um único caminho. */
QStringList pathList(const QVariant& value) {
    QStringList paths;
    if (value.metaType() == QMetaType::fromType<QStringList>()) return value.toStringList();
    for (const QVariant& entry : value.toList()) {
        const QString path = entry.toString();
        if (!path.trimmed().isEmpty()) paths.append(path);
    }
    return paths;
}

/** Plataforma automática não tem ID único; o mapa expõe null como no Electron. */
QVariant platformVariant(qint64 platformId) {
    return platformId > 0 ? QVariant(platformId) : QVariant(QMetaType(QMetaType::LongLong));
}

/** Evento de progresso com apenas as chaves preenchidas. */
QVariantMap progressEvent(int current, int total, const QString& stage, const QVariantMap& candidate,
    const QString& message) {
    QVariantMap event{{QStringLiteral("current"), current}, {QStringLiteral("total"), total},
        {QStringLiteral("stage"), stage}, {QStringLiteral("message"), message}};
    if (!candidate.isEmpty()) {
        event.insert(QStringLiteral("folderPath"), candidate.value(QStringLiteral("folderPath")));
        event.insert(QStringLiteral("filename"), candidate.value(QStringLiteral("filename")));
    }
    return event;
}

/** Cópia JSON de uma lista de caminhos do pedido. */
QJsonArray jsonPaths(const QVariant& value) {
    QJsonArray array;
    for (const QString& path : pathList(value)) array.append(path);
    return array;
}
} // namespace

RomFolderService::RomFolderService(QObject* parent) : QObject(parent) {}

bool RomFolderService::open(const QString& databasePath, QString* error) {
    QString localError;
    if (!connection_.open(databasePath, &localError)) {
        error_ = localError;
        open_ = false;
        if (error) *error = localError;
        emit changed();
        return false;
    }
    open_ = true;
    databasePath_ = databasePath;
    error_.clear();
    refreshFolders();
    if (error) error->clear();
    return true;
}

bool RomFolderService::isOpen() const { return open_; }

RomFolderScanRequest RomFolderService::parseRequest(const QVariantMap& request) {
    RomFolderScanRequest parsed;
    parsed.folderPaths = pathList(request.value(QStringLiteral("folderPaths")));
    parsed.romFilePaths = pathList(request.value(QStringLiteral("romFilePaths")));
    parsed.platformId = request.value(QStringLiteral("platformId")).toLongLong();
    parsed.detectionMode = request.value(QStringLiteral("detectionMode")).toString().trimmed().toLower();
    parsed.includeSubfolders = request.value(QStringLiteral("includeSubfolders")).toBool();
    return parsed;
}

QVariantMap RomFolderService::describeScan(const RomFolderScanResult& scan) {
    QVariantMap result;
    result.insert(QStringLiteral("ok"), scan.ok);
    if (!scan.error.isEmpty()) result.insert(QStringLiteral("error"), scan.error);
    result.insert(QStringLiteral("folderPaths"), QVariant::fromValue(scan.folderPaths));
    result.insert(QStringLiteral("romFilePaths"), QVariant::fromValue(scan.romFilePaths));
    result.insert(QStringLiteral("platformId"), platformVariant(scan.platformId));
    result.insert(QStringLiteral("platformName"), scan.platformName);
    result.insert(QStringLiteral("detectionMode"), scan.detectionMode);
    result.insert(QStringLiteral("includeSubfolders"), scan.includeSubfolders);
    result.insert(QStringLiteral("candidates"), scan.candidates);
    result.insert(QStringLiteral("detectedPlatforms"), scan.detectedPlatforms);
    result.insert(QStringLiteral("ignored"), scan.ignoredItems.size());
    result.insert(QStringLiteral("ignoredItems"), scan.ignoredItems);
    return result;
}

QVariantMap RomFolderService::fail(const QString& message) {
    error_ = message;
    emit changed();
    return QVariantMap{{QStringLiteral("ok"), false}, {QStringLiteral("error"), message}};
}

bool RomFolderService::loadFolders(QVariantList* result, QString* error) {
    FolderStateStore store(connection_.database());
    QJsonArray entries;
    if (!store.load(&entries, error)) return false;
    PlatformDao platforms(connection_.database());
    QList<QVariantMap> platformList;
    if (!platforms.list(&platformList, error)) return false;
    QHash<qint64, QString> names;
    for (const QVariantMap& platform : platformList) {
        names.insert(platform.value(QStringLiteral("id")).toLongLong(),
            platform.value(QStringLiteral("name")).toString());
    }
    RomFolderDao roms(connection_.database());
    QVariantList folders;
    for (const QJsonValue& value : entries) {
        QVariantMap entry = value.toObject().toVariantMap();
        const QString folderPath = entry.value(QStringLiteral("folderPath")).toString();
        const qint64 platformId = entry.value(QStringLiteral("platformId")).toLongLong();
        qint64 indexed = 0;
        if (!roms.countInFolder(folderPath, platformId, &indexed, error)) return false;
        entry.insert(QStringLiteral("platformName"), names.value(platformId));
        entry.insert(QStringLiteral("indexedCount"), indexed);
        folders.append(entry);
    }
    *result = folders;
    if (error) error->clear();
    return true;
}

void RomFolderService::refreshFolders() {
    if (!open_) return;
    QVariantList folders;
    QString error;
    if (!loadFolders(&folders, &error)) {
        error_ = error;
        emit changed();
        return;
    }
    folders_ = folders;
    error_.clear();
    emit changed();
}

QVariantMap RomFolderService::scan(const QVariantMap& request) {
    if (!open_) return fail(QStringLiteral("Banco do importador indisponível."));
    RomFolderScanner scanner(connection_.database());
    const RomFolderScanResult result = scanner.scan(parseRequest(request));
    if (!result.ok) return fail(result.error);
    error_.clear();
    return describeScan(result);
}

QVariantMap RomFolderService::import(const QVariantMap& request) {
    if (!open_) return fail(QStringLiteral("Banco do importador indisponível."));
    RomFolderScanner scanner(connection_.database());
    const RomFolderScanResult scan = scanner.scan(parseRequest(request));
    if (!scan.ok) return fail(scan.error);

    GameWriteDao games(connection_.database());
    const int total = static_cast<int>(scan.candidates.size());
    emit progress(progressEvent(0, total, QStringLiteral("preparing_metadata"), {},
        QStringLiteral("Preparando importação")));

    qint64 created = 0;
    qint64 updated = 0;
    qint64 unmatched = 0;
    qint64 processed = 0;
    QVariantList items;
    for (int index = 0; index < total; ++index) {
        const QVariantMap candidate = scan.candidates.at(index).toMap();
        const int current = index + 1;
        emit progress(progressEvent(current, total, QStringLiteral("matching"), candidate,
            QStringLiteral("Buscando ") + candidate.value(QStringLiteral("titleCandidate")).toString()));

        const qint64 platformId = candidate.value(QStringLiteral("platformId")).toLongLong();
        const QString romPath = candidate.value(QStringLiteral("romPath")).toString();
        QString title = candidate.value(QStringLiteral("titleCandidate")).toString().trimmed();
        if (title.isEmpty()) title = candidate.value(QStringLiteral("filename")).toString();

        qint64 existingId = 0;
        bool found = false;
        QString error;
        if (!games.findIdByRomPath(romPath, platformId, &existingId, &found, &error)) {
            // Falha por candidato não aborta o lote, como no importador legado.
            ++processed;
            items.append(QVariantMap{{QStringLiteral("candidate"), candidate},
                {QStringLiteral("status"), QStringLiteral("failed")},
                {QStringLiteral("error"), error}});
            emit progress(progressEvent(current, total, QStringLiteral("error"), candidate, error));
            continue;
        }

        if (!found) {
            emit progress(progressEvent(current, total, QStringLiteral("saving"), candidate, title));
            const QVariantMap input{
                {QStringLiteral("title"), title},
                {QStringLiteral("platform_id"), platformId},
                {QStringLiteral("rom_path"), romPath},
                {QStringLiteral("favorite"), false},
                {QStringLiteral("play_status"), QStringLiteral("unplayed")},
            };
            if (!games.create(input, &existingId, &error)) {
                ++processed;
                items.append(QVariantMap{{QStringLiteral("candidate"), candidate},
                    {QStringLiteral("status"), QStringLiteral("failed")},
                    {QStringLiteral("error"), error}});
                emit progress(progressEvent(current, total, QStringLiteral("error"), candidate, error));
                continue;
            }
            ++created;
        } else {
            // Reimportação preserva o registro existente; nada é sobrescrito aqui.
            ++updated;
        }

        ++unmatched;
        ++processed;
        items.append(QVariantMap{{QStringLiteral("candidate"), candidate},
            {QStringLiteral("status"), QStringLiteral("unmatched")},
            {QStringLiteral("gameId"), existingId}});
        emit progress(progressEvent(current, total, QStringLiteral("done"), candidate, title));
    }
    emit progress(progressEvent(total, total, QStringLiteral("done"), {},
        QStringLiteral("Importação concluída")));

    const QVariantMap summary{
        {QStringLiteral("created"), created},
        {QStringLiteral("updated"), updated},
        {QStringLiteral("skipped"), static_cast<qint64>(scan.ignoredItems.size())},
        {QStringLiteral("unmatched"), unmatched},
        {QStringLiteral("failedDownloads"), 0},
        {QStringLiteral("processed"), processed},
    };
    QVariantMap result = describeScan(scan);
    result.insert(QStringLiteral("items"), items);
    result.insert(QStringLiteral("summary"), summary);
    error_.clear();
    emit changed();
    return result;
}

QVariantMap RomFolderService::startImport(const QVariantMap& request) {
    if (!open_) return fail(QStringLiteral("Banco do importador indisponível."));
    if (!jobManager_) return fail(QStringLiteral("Gerenciador de jobs indisponível."));
    const RomFolderScanRequest parsed = parseRequest(request);
    // O estado legado aceita um único job de ROM; remove terminais antes de iniciar outro.
    const QJsonArray existing = jobManager_->jobs();
    for (const QJsonValue& value : existing) {
        const QJsonObject previous = value.toObject();
        if (previous.value(QStringLiteral("kind")).toString() != QLatin1String("rom-folder-import")) continue;
        if (previous.value(QStringLiteral("status")).toString() == QLatin1String("running")) {
            return fail(QStringLiteral("Já existe uma importação de ROMs em andamento."));
        }
        jobManager_->dismiss(previous.value(QStringLiteral("jobId")).toString());
    }
    QJsonObject job{
        {QStringLiteral("jobId"), QUuid::createUuid().toString(QUuid::WithoutBraces)},
        {QStringLiteral("kind"), QStringLiteral("rom-folder-import")},
        {QStringLiteral("status"), QStringLiteral("running")},
        {QStringLiteral("title"), QStringLiteral("Importando ROMs")},
        {QStringLiteral("subtitle"), QStringLiteral("%1 pasta(s)").arg(parsed.folderPaths.size())},
        {QStringLiteral("startedAt"), QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs)},
        {QStringLiteral("folderPaths"), jsonPaths(request.value(QStringLiteral("folderPaths")))},
        {QStringLiteral("romFilePaths"), jsonPaths(request.value(QStringLiteral("romFilePaths")))},
        {QStringLiteral("platformId"), parsed.platformId},
        {QStringLiteral("detectionMode"), parsed.detectionMode},
        {QStringLiteral("includeSubfolders"), parsed.includeSubfolders},
        {QStringLiteral("progress"), QJsonObject{
            {QStringLiteral("current"), 0}, {QStringLiteral("total"), 0},
            {QStringLiteral("stage"), QStringLiteral("preparing_metadata")},
            {QStringLiteral("message"), QStringLiteral("Preparando importação")}}},
    };

    const QString databasePath = databasePath_;
    const JobManager::Work work = [databasePath, request](JobWorker* worker) {
        RomFolderService local;
        QString openError;
        if (!local.open(databasePath, &openError)) throw std::runtime_error(openError.toStdString());
        QObject::connect(&local, &RomFolderService::progress, worker, [worker](const QVariantMap& event) {
            worker->reportProgress(QJsonObject::fromVariantMap(event));
        }, Qt::DirectConnection);
        const QVariantMap result = local.import(request);
        if (!result.value(QStringLiteral("ok")).toBool()) {
            throw std::runtime_error(result.value(QStringLiteral("error")).toString().toStdString());
        }
        worker->setResult(QJsonObject::fromVariantMap(result));
    };

    QString error;
    if (!jobManager_->start(job, work, &error)) return fail(error);
    error_.clear();
    return job.toVariantMap();
}

bool RomFolderService::saveFolder(const QString& folderPath, qint64 platformId, bool includeSubfolders) {
    if (!open_) {
        error_ = QStringLiteral("Banco do importador indisponível.");
        emit changed();
        return false;
    }
    const QString absolute = QFileInfo(folderPath).absoluteFilePath();
    if (absolute.isEmpty() || platformId <= 0) {
        error_ = QStringLiteral("Informe a pasta e a plataforma.");
        emit changed();
        return false;
    }
    PlatformDao platforms(connection_.database());
    QVariantMap platform;
    QString error;
    if (!platforms.get(platformId, &platform, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    const QJsonObject entry{
        {QStringLiteral("folderPath"), QDir::fromNativeSeparators(absolute)},
        {QStringLiteral("platformId"), platformId},
        {QStringLiteral("platformName"), platform.value(QStringLiteral("name")).toString()},
        {QStringLiteral("includeSubfolders"), includeSubfolders},
    };
    FolderStateStore store(connection_.database());
    if (!store.merge(QJsonArray{entry}, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    refreshFolders();
    return true;
}

qint64 RomFolderService::removeFolder(const QString& folderPath, qint64 platformId) {
    if (!open_) {
        error_ = QStringLiteral("Banco do importador indisponível.");
        emit changed();
        return -1;
    }
    RomFolderDao roms(connection_.database());
    qint64 deleted = 0;
    QString error;
    if (!roms.deleteInFolder(folderPath, platformId, &deleted, &error)) {
        error_ = error;
        emit changed();
        return -1;
    }
    FolderStateStore store(connection_.database());
    if (!store.remove(folderPath, platformId, &error)) {
        error_ = error;
        emit changed();
        return -1;
    }
    refreshFolders();
    return deleted;
}

qint64 RomFolderService::countFolderRecords(const QString& folderPath, qint64 platformId) {
    if (!open_) {
        error_ = QStringLiteral("Banco do importador indisponível.");
        emit changed();
        return -1;
    }
    RomFolderDao dao(connection_.database());
    qint64 count = 0;
    QString error;
    if (!dao.countInFolder(folderPath, platformId, &count, &error)) {
        error_ = error;
        emit changed();
        return -1;
    }
    error_.clear();
    return count;
}

qint64 RomFolderService::removeFolderRecords(const QString& folderPath, qint64 platformId) {
    if (!open_) {
        error_ = QStringLiteral("Banco do importador indisponível.");
        emit changed();
        return -1;
    }
    RomFolderDao dao(connection_.database());
    qint64 deleted = 0;
    QString error;
    if (!dao.deleteInFolder(folderPath, platformId, &deleted, &error)) {
        error_ = error;
        emit changed();
        return -1;
    }
    error_.clear();
    emit changed();
    return deleted;
}
} // namespace gamestock
