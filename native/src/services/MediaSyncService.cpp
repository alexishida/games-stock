/** Implementação da sincronização de mídia, sem rede na thread da interface. */
#include "MediaSyncService.h"

#include "db/dao/GameReadDao.h"
#include "db/dao/GameWriteDao.h"
#include "jobs/JobManager.h"
#include "jobs/JobWorker.h"
#include "launchbox/LaunchBoxCache.h"
#include "launchbox/LaunchBoxMedia.h"
#include "launchbox/LibretroMedia.h"

#include <QDateTime>
#include <QDir>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonObject>
#include <QMetaType>
#include <QUuid>

#include <stdexcept>

namespace gamestock {
namespace {
/** Mapa de progresso consumido pelo JobListModel/NotificationCenter. */
QJsonObject mediaProgress(qint64 current, qint64 total, const QString& title,
    const QString& stage, const QString& message, const QString& image = {}, bool indeterminate = false) {
    QJsonObject event{{QStringLiteral("current"), current}, {QStringLiteral("total"), total},
        {QStringLiteral("stage"), stage}, {QStringLiteral("message"), message}};
    if (!title.isEmpty()) event.insert(QStringLiteral("filename"), title);
    if (!image.isEmpty()) event.insert(QStringLiteral("imageFilename"), image);
    if (indeterminate) event.insert(QStringLiteral("indeterminate"), true);
    return event;
}

/** Primeiro arquivo que representa a capa principal do jogo. */
QString coverFrom(const QStringList& files) {
    for (const QString& file : files) if (file.endsWith(QStringLiteral("cover.jpg"))) return file;
    for (const QString& file : files) if (file.contains(QStringLiteral("box-front"))) return file;
    return {};
}

/** Primeiro arquivo de um tipo de mídia, sem confundir capa e screenshot. */
QString findByFragment(const QStringList& files, const QString& fragment) {
    for (const QString& file : files) if (file.contains(fragment)) return file;
    return {};
}
} // namespace

MediaSyncService::MediaSyncService(QObject* parent) : QObject(parent) {}

std::shared_ptr<LaunchBoxCache> MediaSyncService::sharedCache() {
    if (!cache_) cache_ = std::make_shared<LaunchBoxCache>(cacheDir_, metadataUrl_);
    return cache_;
}

bool MediaSyncService::open(const QString& databasePath, const QString& cacheDir,
    const QString& imagesDir, QString* error) {
    QString localError;
    if (!connection_.open(databasePath, &localError)) {
        error_ = localError;
        open_ = false;
        if (error) *error = localError;
        emit changed();
        return false;
    }
    databasePath_ = databasePath;
    cacheDir_ = QFileInfo(cacheDir).absoluteFilePath();
    imagesDir_ = QFileInfo(imagesDir).absoluteFilePath();
    // Um perfil/cache novo invalida o índice em memória da sessão anterior.
    cache_.reset();
    QDir().mkpath(cacheDir_);
    QDir().mkpath(imagesDir_);
    open_ = true;
    error_.clear();
    if (error) error->clear();
    emit changed();
    return true;
}

QVariantMap MediaSyncService::stats() {
    if (!open_) return {};
    GameReadDao dao(connection_.database());
    GameReadDao::CoverStats stats;
    QString error;
    if (!dao.coverStats(&stats, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    error_.clear();
    return QVariantMap{{QStringLiteral("total"), stats.total},
        {QStringLiteral("downloaded"), stats.downloaded},
        {QStringLiteral("missing"), stats.missing},
        {QStringLiteral("syncable"), stats.syncable},
        {QStringLiteral("metadataSyncable"), stats.metadataSyncable}};
}

QVariantMap MediaSyncService::startSync(bool refreshAll) {
    if (!open_) {
        error_ = QStringLiteral("Mídia da biblioteca indisponível.");
        emit changed();
        return {};
    }
    if (!jobManager_) {
        error_ = QStringLiteral("Gerenciador de jobs indisponível.");
        emit changed();
        return {};
    }
    for (const QJsonValue& value : jobManager_->jobs()) {
        const QJsonObject previous = value.toObject();
        if (previous.value(QStringLiteral("kind")).toString() != QLatin1String("media-sync")) continue;
        if (previous.value(QStringLiteral("status")).toString() == QLatin1String("running")) continue;
        jobManager_->dismiss(previous.value(QStringLiteral("jobId")).toString());
    }
    const QJsonObject job{
        {QStringLiteral("jobId"), QUuid::createUuid().toString(QUuid::WithoutBraces)},
        {QStringLiteral("kind"), QStringLiteral("media-sync")},
        {QStringLiteral("status"), QStringLiteral("running")},
        {QStringLiteral("title"), QStringLiteral("Sincronizando mídia")},
        {QStringLiteral("subtitle"), refreshAll ? QStringLiteral("Baixando novamente todas as capas")
                                                : QStringLiteral("Preenchendo capas ausentes")},
        {QStringLiteral("startedAt"), QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs)},
        {QStringLiteral("refreshAll"), refreshAll},
        {QStringLiteral("progress"), QJsonObject{{QStringLiteral("current"), 0},
            {QStringLiteral("total"), 0}, {QStringLiteral("indeterminate"), true},
            {QStringLiteral("message"), QStringLiteral("Preparando catálogo LaunchBox")}}},
    };
    const QString databasePath = databasePath_;
    const QString imagesDir = imagesDir_;
    const QString imagesBaseUrl = imagesBaseUrl_;
    const QString libretroBaseUrl = libretroBaseUrl_;
    // O índice LaunchBox é compartilhado entre sincronizações da mesma sessão.
    const auto cache = sharedCache();
    const JobManager::Work work = [databasePath, cache, imagesDir, imagesBaseUrl,
        libretroBaseUrl, refreshAll](JobWorker* worker) {
        WriteConnection connection;
        QString error;
        if (!connection.open(databasePath, &error)) throw std::runtime_error(error.toStdString());
        GameReadDao reader(connection.database());
        QList<GameReadDao::LinkedGame> games;
        if (!reader.listLinkedGames(&games, &error)) throw std::runtime_error(error.toStdString());

        const auto metadataProgress = [worker](const LaunchBoxProgress& progress) {
            const QString stage = progress.status == QLatin1String("error") ? QStringLiteral("error")
                : progress.status == QLatin1String("indexing") ? QStringLiteral("indexing")
                : progress.status == QLatin1String("loading_index") ? QStringLiteral("loading_index")
                : progress.status == QLatin1String("extracting") ? QStringLiteral("extracting")
                : progress.status == QLatin1String("done") ? QStringLiteral("done")
                : progress.status == QLatin1String("downloading") ? QStringLiteral("downloading")
                : QStringLiteral("preparing_metadata");
            QString message = progress.filename;
            if (message.isEmpty()) {
                if (stage == QLatin1String("indexing"))
                    message = QStringLiteral("Construindo índice (%1 jogos)").arg(progress.current);
                else if (stage == QLatin1String("loading_index"))
                    message = QStringLiteral("Carregando índice LaunchBox");
                else if (stage == QLatin1String("extracting"))
                    message = QStringLiteral("Extraindo Metadata.xml");
                else
                    message = QStringLiteral("Preparando catálogo LaunchBox");
            }
            worker->reportProgress(mediaProgress(progress.current, progress.total, progress.filename,
                stage, message, {}, progress.total <= 0));
        };
        const auto ensured = cache->ensureMetadata(false, metadataProgress);
        if (!ensured.ok()) throw std::runtime_error(ensured.error.toStdString());
        QJsonObject index;
        if (!cache->buildIndex(&index, &error, metadataProgress)) throw std::runtime_error(error.toStdString());

        GameWriteDao writer(connection.database());
        LaunchBoxMedia media(imagesBaseUrl);
        LibretroMedia libretro(libretroBaseUrl);
        qint64 downloadedNow = 0;
        qint64 failed = 0;
        qint64 skipped = 0;
        qint64 metadataUpdated = 0;
        qint64 metadataSkipped = 0;
        QVariantList failures;
        const int total = static_cast<int>(games.size());
        for (int indexPosition = 0; indexPosition < total; ++indexPosition) {
            const auto& record = games.at(indexPosition);
            const int current = indexPosition + 1;
            const QJsonValue entry = index.value(record.launchboxId);
            if (!entry.isObject()) {
                ++metadataSkipped;
                const bool needsCover = record.boxArtPath.isEmpty() || refreshAll;
                const bool needsScreenshot = record.screenshotPath.isEmpty();
                if (!needsCover && !needsScreenshot) {
                    ++skipped;
                    worker->reportProgress(mediaProgress(current, total, record.title,
                        QStringLiteral("skipped"), QStringLiteral("Mídia já existente")));
                    continue;
                }
                // O vínculo pode permanecer no banco após o catálogo remover o ID.
                const QString fallbackDir = QDir(imagesDir)
                    .filePath(QStringLiteral("libretro-unindexed/") + QString::number(record.id));
                const LibretroMediaResult fallback = libretro.downloadMedia(
                    {record.title}, record.platformName, fallbackDir, needsCover, needsScreenshot);
                QVariantMap fallbackChanges;
                if (!fallback.coverPath.isEmpty()) fallbackChanges.insert(QStringLiteral("box_art_path"), fallback.coverPath);
                if (!fallback.screenshotPath.isEmpty())
                    fallbackChanges.insert(QStringLiteral("screenshot_path"), fallback.screenshotPath);
                if (!fallbackChanges.isEmpty() && !writer.update(record.id, fallbackChanges, &error)) {
                    ++failed;
                    failures.append(QVariantMap{{QStringLiteral("gameId"), record.id},
                        {QStringLiteral("title"), record.title},
                        {QStringLiteral("platformName"), record.platformName},
                        {QStringLiteral("reason"), error}});
                    continue;
                }
                if (fallbackChanges.contains(QStringLiteral("box_art_path"))) ++downloadedNow;
                if (fallback.coverPath.isEmpty() && record.boxArtPath.isEmpty()) {
                    ++failed;
                    failures.append(QVariantMap{{QStringLiteral("gameId"), record.id},
                        {QStringLiteral("title"), record.title},
                        {QStringLiteral("platformName"), record.platformName},
                        {QStringLiteral("launchboxId"), record.launchboxId},
                        {QStringLiteral("reason"), QStringLiteral("Jogo ausente no LaunchBox e capa não encontrada na Libretro")}});
                    worker->reportProgress(mediaProgress(current, total, record.title,
                        QStringLiteral("error"), QStringLiteral("Capa não encontrada na Libretro")));
                } else {
                    worker->reportProgress(mediaProgress(current, total, record.title,
                        QStringLiteral("done"), QStringLiteral("Mídia preenchida pela Libretro")));
                }
                continue;
            }
            const QVariantMap launchBoxGame = entry.toObject().toVariantMap();
            const QString nextTitle = launchBoxGame.value(QStringLiteral("name")).toString();
            const QString release = launchBoxGame.value(QStringLiteral("release")).toString();
            QVariantMap changes{
                {QStringLiteral("title"), nextTitle.isEmpty() ? record.title : nextTitle},
                {QStringLiteral("publisher"), launchBoxGame.value(QStringLiteral("publisher")).toString()},
                {QStringLiteral("year"), release.size() >= 4 ? release.left(4).toInt() : QVariant(QMetaType(QMetaType::Int))},
                {QStringLiteral("genre"), launchBoxGame.value(QStringLiteral("genres")).toString()},
                {QStringLiteral("rating"), launchBoxGame.value(QStringLiteral("rating")).toString()},
                {QStringLiteral("notes"), launchBoxGame.value(QStringLiteral("overview")).toString()},
            };
            if (!writer.update(record.id, changes, &error)) {
                ++failed;
                failures.append(QVariantMap{{QStringLiteral("gameId"), record.id},
                    {QStringLiteral("title"), record.title},
                    {QStringLiteral("platformName"), record.platformName},
                    {QStringLiteral("reason"), error}});
                continue;
            }
            ++metadataUpdated;

            QStringList types;
            if (refreshAll || record.boxArtPath.isEmpty()) types.append(QStringLiteral("Box - Front"));
            if (refreshAll || record.screenshotPath.isEmpty()) types.append(QStringLiteral("Screenshot - Gameplay"));
            if (refreshAll) types.append(QStringLiteral("Fanart - Background"));
            if (types.isEmpty()) {
                ++skipped;
                worker->reportProgress(mediaProgress(current, total, record.title,
                    QStringLiteral("done"), QStringLiteral("Mídia já existente")));
                continue;
            }
            worker->reportProgress(mediaProgress(current, total, record.title,
                QStringLiteral("downloading"), QStringLiteral("Baixando mídia")));
            const auto imageProgress = [worker, current, total, record](const LaunchBoxProgress& progress) {
                worker->reportProgress(mediaProgress(current, total, record.title,
                    progress.status == QLatin1String("error") ? QStringLiteral("error")
                                                              : QStringLiteral("downloading"),
                    QStringLiteral("Baixando mídia"), progress.filename));
            };
            const LaunchBoxMediaResult download = media.downloadImages(launchBoxGame, imagesDir, types,
                imageProgress, refreshAll);
            QString cover = coverFrom(download.files);
            QString screenshot = findByFragment(download.files, QStringLiteral("screenshot-gameplay"));
            const QString background = findByFragment(download.files, QStringLiteral("fanart-background"));
            // A Libretro preenche somente o tipo que o LaunchBox não forneceu.
            const bool coverMissing = (record.boxArtPath.isEmpty() || refreshAll) && cover.isEmpty();
            const bool screenshotMissing = (record.screenshotPath.isEmpty() || refreshAll) && screenshot.isEmpty();
            if (coverMissing || screenshotMissing) {
                QStringList titles{record.title};
                const QString launchBoxTitle = launchBoxGame.value(QStringLiteral("name")).toString();
                if (!launchBoxTitle.isEmpty() && launchBoxTitle != record.title) titles.append(launchBoxTitle);
                const QVariant alternatives = launchBoxGame.value(QStringLiteral("alternateNames"));
                if (alternatives.canConvert<QStringList>()) {
                    for (const QString& alternative : alternatives.toStringList())
                        if (!alternative.isEmpty() && !titles.contains(alternative)) titles.append(alternative);
                }
                const QString gameDir = LaunchBoxMedia::gameImageDir(imagesDir, launchBoxGame);
                const LibretroMediaResult fallback = libretro.downloadMedia(
                    titles, record.platformName, gameDir, coverMissing, screenshotMissing);
                if (cover.isEmpty()) cover = fallback.coverPath;
                if (screenshot.isEmpty()) screenshot = fallback.screenshotPath;
            }
            QVariantMap mediaChanges;
            if (!cover.isEmpty()) mediaChanges.insert(QStringLiteral("box_art_path"), cover);
            if (!screenshot.isEmpty()) mediaChanges.insert(QStringLiteral("screenshot_path"), screenshot);
            if (refreshAll && !background.isEmpty()) mediaChanges.insert(QStringLiteral("background_path"), background);
            if (!mediaChanges.isEmpty()) {
                if (!writer.update(record.id, mediaChanges, &error)) {
                    ++failed;
                    failures.append(QVariantMap{{QStringLiteral("gameId"), record.id},
                        {QStringLiteral("title"), record.title},
                        {QStringLiteral("platformName"), record.platformName},
                        {QStringLiteral("reason"), error}});
                    continue;
                }
            }
            if (!cover.isEmpty()) ++downloadedNow;
            if (!cover.isEmpty()) {
                worker->reportProgress(mediaProgress(current, total, record.title,
                    QStringLiteral("done"), QStringLiteral("Mídia sincronizada")));
            } else if (!refreshAll && record.boxArtPath.isEmpty()) {
                ++failed;
                failures.append(QVariantMap{{QStringLiteral("gameId"), record.id},
                    {QStringLiteral("title"), record.title},
                    {QStringLiteral("platformName"), record.platformName},
                    {QStringLiteral("reason"), QStringLiteral("Capa não encontrada no LaunchBox nem na Libretro")}});
                worker->reportProgress(mediaProgress(current, total, record.title,
                    QStringLiteral("error"), QStringLiteral("Capa não encontrada")));
            } else {
                ++skipped;
                worker->reportProgress(mediaProgress(current, total, record.title,
                    QStringLiteral("done"), QStringLiteral("Nada novo para baixar")));
            }
        }

        GameReadDao::CoverStats stats;
        reader.coverStats(&stats, nullptr);
        QVariantMap result{
            {QStringLiteral("attempted"), total},
            {QStringLiteral("downloadedNow"), downloadedNow},
            {QStringLiteral("failed"), failed},
            {QStringLiteral("skipped"), skipped},
            {QStringLiteral("metadataUpdated"), metadataUpdated},
            {QStringLiteral("metadataSkipped"), metadataSkipped},
            {QStringLiteral("failures"), failures},
            {QStringLiteral("stats"), QVariantMap{
                {QStringLiteral("total"), stats.total},
                {QStringLiteral("downloaded"), stats.downloaded},
                {QStringLiteral("missing"), stats.missing},
                {QStringLiteral("syncable"), stats.syncable}}},
        };
        worker->setResult(QJsonObject::fromVariantMap(result));
    };
    QString error;
    if (!jobManager_->start(job, work, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    error_.clear();
    return job.toVariantMap();
}
} // namespace gamestock
