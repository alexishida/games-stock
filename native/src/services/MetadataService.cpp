/** Implementação do importador LaunchBox; rede e SQL nunca rodam na UI. */
#include "MetadataService.h"

#include "db/dao/GameWriteDao.h"
#include "db/dao/PlatformDao.h"
#include "jobs/JobWorker.h"
#include "launchbox/LaunchBoxCache.h"
#include "launchbox/LaunchBoxMedia.h"
#include "launchbox/LaunchBoxSearch.h"

#include <QDateTime>
#include <QDir>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonObject>
#include <QMetaType>
#include <QRegularExpression>
#include <QUuid>

#include <stdexcept>

namespace gamestock {
namespace {
/** Normalização de plataforma equivalente à do renderer. */
QString normalizePlatform(const QString& value) {
    const QString decomposed = value.normalized(QString::NormalizationForm_D);
    QString withoutMarks;
    for (const QChar character : decomposed) {
        const auto category = character.category();
        if (category == QChar::Mark_NonSpacing || category == QChar::Mark_SpacingCombining
            || category == QChar::Mark_Enclosing) continue;
        withoutMarks += character;
    }
    QString normalized = withoutMarks.toLower();
    normalized.replace(QRegularExpression(QStringLiteral("[^a-z0-9]+")), QStringLiteral(" "));
    return normalized.trimmed().replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral(" "));
}

/** Resolve por nome/alias e cria plataforma quando o LaunchBox traz uma nova. */
qint64 resolvePlatform(QSqlDatabase& database, const QString& launchBoxName, QString* error) {
    PlatformDao platforms(database);
    QList<QVariantMap> list;
    if (!platforms.list(&list, error)) return 0;
    const QString target = normalizePlatform(launchBoxName);
    for (const QVariantMap& platform : list) {
        if (normalizePlatform(platform.value(QStringLiteral("name")).toString()) == target) {
            return platform.value(QStringLiteral("id")).toLongLong();
        }
    }
    for (const QVariantMap& platform : list) {
        QVariantMap mappings;
        if (!platforms.mappings(platform.value(QStringLiteral("id")).toLongLong(), &mappings, error)) return 0;
        for (const QVariant& alias : mappings.value(QStringLiteral("aliases")).toList()) {
            if (normalizePlatform(alias.toMap().value(QStringLiteral("alias")).toString()) == target) {
                return platform.value(QStringLiteral("id")).toLongLong();
            }
        }
    }
    qint64 id = 0;
    if (!platforms.create(launchBoxName, QStringLiteral("Outros"), &id, error)) return 0;
    return id;
}

/** Primeiro arquivo de mídia de um tipo/fragmento. */
QString mediaFile(const QStringList& files, const QString& fragment) {
    for (const QString& file : files) if (file.contains(fragment)) return file;
    return {};
}

QString coverFile(const QStringList& files) {
    for (const QString& file : files) if (file.endsWith(QStringLiteral("cover.jpg"))) return file;
    return mediaFile(files, QStringLiteral("box-front"));
}

/** Garante cache/índice e devolve o mapa do jogo selecionado. */
QVariantMap indexGame(LaunchBoxCache& cache, const QString& launchBoxId, JobWorker* worker,
    const std::function<void(const LaunchBoxProgress&)>& progress) {
    const auto ensured = cache.ensureMetadata(false, progress);
    if (!ensured.ok()) throw std::runtime_error(ensured.error.toStdString());
    QJsonObject index;
    QString error;
    if (!cache.buildIndex(&index, &error, progress)) throw std::runtime_error(error.toStdString());
    const QJsonObject game = index.value(launchBoxId).toObject();
    if (game.isEmpty()) throw std::runtime_error(QStringLiteral("Jogo não encontrado no LaunchBox.").toStdString());
    Q_UNUSED(worker);
    return game.toVariantMap();
}

/** Converte o progresso do cache em payload do JobManager, preservando a etapa real. */
QJsonObject metadataProgressPayload(const LaunchBoxProgress& update) {
    const QString stage = update.status == QLatin1String("error") ? QStringLiteral("error")
        : update.status == QLatin1String("indexing") ? QStringLiteral("indexing")
        : update.status == QLatin1String("loading_index") ? QStringLiteral("loading_index")
        : update.status == QLatin1String("extracting") ? QStringLiteral("extracting")
        : update.status == QLatin1String("done") ? QStringLiteral("done")
        : update.status == QLatin1String("downloading") ? QStringLiteral("downloading")
        : QStringLiteral("preparing_metadata");
    QString message = update.filename;
    if (message.isEmpty()) {
        if (stage == QLatin1String("indexing"))
            message = QStringLiteral("Construindo índice (%1 jogos)").arg(update.current);
        else if (stage == QLatin1String("loading_index"))
            message = QStringLiteral("Carregando índice LaunchBox");
        else if (stage == QLatin1String("extracting"))
            message = QStringLiteral("Extraindo Metadata.xml");
        else
            message = QStringLiteral("Preparando catálogo LaunchBox");
    }
    return QJsonObject{
        {QStringLiteral("current"), update.current},
        {QStringLiteral("total"), update.total},
        {QStringLiteral("indeterminate"), update.total <= 0},
        {QStringLiteral("stage"), stage},
        {QStringLiteral("message"), message}};
}
} // namespace

MetadataService::MetadataService(QObject* parent) : QObject(parent) {}

bool MetadataService::open(const QString& databasePath, const QString& cacheDir,
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

void MetadataService::setJobManager(JobManager* manager) {
    if (jobManager_ == manager) return;
    if (jobManager_) QObject::disconnect(jobManager_, nullptr, this, nullptr);
    jobManager_ = manager;
    if (jobManager_) {
        connect(jobManager_, &JobManager::jobFinished, this,
            [this](const QString& id, const QJsonObject& job) { onJobFinished(id, job); });
    }
}

void MetadataService::setMetadataUrl(const QString& url) {
    if (metadataUrl_ == url) return;
    metadataUrl_ = url;
    // O cache em memória foi criado com a URL anterior.
    cache_.reset();
}

std::shared_ptr<LaunchBoxCache> MetadataService::sharedCache() {
    if (!cache_) cache_ = std::make_shared<LaunchBoxCache>(cacheDir_, metadataUrl_);
    return cache_;
}

QVariantMap MetadataService::startJob(const QString& kind, const QString& title,
    const QString& subtitle, const QVariantMap& payload, JobManager::Work work) {
    if (!open_) {
        error_ = QStringLiteral("Importador de metadados indisponível.");
        emit changed();
        return {};
    }
    if (!jobManager_) {
        error_ = QStringLiteral("Gerenciador de jobs indisponível.");
        emit changed();
        return {};
    }
    if (busy_) {
        error_ = QStringLiteral("Já existe uma operação de metadados em andamento.");
        emit changed();
        return {};
    }
    QJsonObject job{
        {QStringLiteral("jobId"), QUuid::createUuid().toString(QUuid::WithoutBraces)},
        {QStringLiteral("kind"), kind},
        {QStringLiteral("status"), QStringLiteral("running")},
        {QStringLiteral("title"), title},
        {QStringLiteral("subtitle"), subtitle},
        {QStringLiteral("startedAt"), QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs)},
        {QStringLiteral("progress"), QJsonObject{{QStringLiteral("current"), 0},
            {QStringLiteral("total"), 0}, {QStringLiteral("indeterminate"), true},
            {QStringLiteral("message"), title}}},
    };
    for (auto iterator = payload.cbegin(); iterator != payload.cend(); ++iterator) {
        job.insert(iterator.key(), QJsonValue::fromVariant(iterator.value()));
    }
    QString error;
    if (!jobManager_->start(job, std::move(work), &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    activeJobId_ = job.value(QStringLiteral("jobId")).toString();
    busy_ = true;
    error_.clear();
    emit changed();
    return job.toVariantMap();
}

QVariantMap MetadataService::ensureMetadata() {
    return startMetadataJob(QStringLiteral("Preparando metadados"));
}

QVariantMap MetadataService::ensureMetadataAtStartup() {
    return startMetadataJob(QStringLiteral("Baixando base de dados"));
}

bool MetadataService::metadataExists() const {
    return !cacheDir_.isEmpty()
        && QFileInfo::exists(QDir(cacheDir_).filePath(QStringLiteral("Metadata.xml")));
}

QVariantMap MetadataService::startMetadataJob(const QString& title) {
    // O cache é compartilhado: o índice de ~300 MB é carregado uma vez por sessão.
    const auto cache = sharedCache();
    return startJob(QStringLiteral("metadata-cache"), title,
        QStringLiteral("LaunchBox"), {},
        [cache](JobWorker* worker) {
            const auto progress = [worker](const LaunchBoxProgress& update) {
                worker->reportProgress(metadataProgressPayload(update));
            };
            const auto ensured = cache->ensureMetadata(false, progress);
            if (!ensured.ok()) throw std::runtime_error(ensured.error.toStdString());
            QJsonObject index;
            QString error;
            if (!cache->buildIndex(&index, &error, progress)) throw std::runtime_error(error.toStdString());
        });
}

QVariantMap MetadataService::search(const QString& query, const QString& platformName) {
    const auto cache = sharedCache();
    const QString trimmedQuery = query.trimmed();
    const QString filterPlatform = platformName.trimmed();
    const QString databasePath = databasePath_;
    return startJob(QStringLiteral("metadata-search"),
        QStringLiteral("Buscando \"%1\"").arg(trimmedQuery),
        filterPlatform.isEmpty() ? QStringLiteral("Todas as plataformas") : filterPlatform,
        {{QStringLiteral("query"), trimmedQuery}, {QStringLiteral("platformName"), filterPlatform}},
        [cache, trimmedQuery, filterPlatform, databasePath](JobWorker* worker) {
            const auto progress = [worker](const LaunchBoxProgress& update) {
                worker->reportProgress(metadataProgressPayload(update));
            };
            // buildIndex garante a base quando necessário e reaproveita o índice da sessão sem rede.
            QJsonObject index;
            QString error;
            if (!cache->buildIndex(&index, &error, progress)) throw std::runtime_error(error.toStdString());
            LaunchBoxSearchOptions options;
            options.query = trimmedQuery;
            options.limit = 100;
            if (!filterPlatform.isEmpty()) {
                options.allowedPlatforms = {filterPlatform};
                // Inclui aliases locais: o nome exibido pode diferir do nome no LaunchBox.
                WriteConnection connection;
                if (!connection.open(databasePath, &error)) throw std::runtime_error(error.toStdString());
                PlatformDao platforms(connection.database());
                QList<QVariantMap> list;
                if (!platforms.list(&list, &error)) throw std::runtime_error(error.toStdString());
                for (const auto& platform : list) {
                    if (normalizePlatform(platform.value(QStringLiteral("name")).toString()) != normalizePlatform(filterPlatform)) continue;
                    QVariantMap mappings;
                    if (!platforms.mappings(platform.value(QStringLiteral("id")).toLongLong(), &mappings, &error))
                        throw std::runtime_error(error.toStdString());
                    for (const auto& alias : mappings.value(QStringLiteral("aliases")).toList())
                        options.allowedPlatforms.append(alias.toMap().value(QStringLiteral("alias")).toString());
                }
                options.restrictPlatforms = true;
            }
            const QList<QVariantMap> found = searchLaunchBoxIndex(index, options);
            QVariantList results;
            for (const QVariantMap& game : found) results.append(game);
            worker->setResult(QJsonObject{{QStringLiteral("results"), QJsonValue::fromVariant(results)}});
        });
}

QVariantMap MetadataService::importGame(const QVariantMap& game, const QStringList& imageTypes, bool draftOnly) {
    const auto cache = sharedCache();
    const QString imagesDir = imagesDir_;
    const QString imagesBaseUrl = imagesBaseUrl_;
    const QString launchBoxId = game.value(QStringLiteral("id")).toString();
    const QString databasePath = databasePath_;
    QStringList types = imageTypes;
    if (types.isEmpty()) {
        types = {QStringLiteral("Box - Front"), QStringLiteral("Screenshot - Gameplay")};
    }
    return startJob(QStringLiteral("metadata-import"),
        QStringLiteral("Importando %1").arg(game.value(QStringLiteral("name")).toString()),
        game.value(QStringLiteral("platform")).toString(),
        {{QStringLiteral("launchboxId"), launchBoxId}},
        [databasePath, cache, imagesDir, imagesBaseUrl, launchBoxId, types, draftOnly](JobWorker* worker) {
            WriteConnection connection;
            QString error;
            if (!connection.open(databasePath, &error)) throw std::runtime_error(error.toStdString());
            const auto progress = [worker](const LaunchBoxProgress& update) {
                worker->reportProgress(metadataProgressPayload(update));
            };
            const QVariantMap launchBoxGame = indexGame(*cache, launchBoxId, worker, progress);
            // O rascunho conserva a plataforma local e não cria relacionamentos antes de Salvar.
            const qint64 platformId = draftOnly ? 0 : resolvePlatform(connection.database(),
                launchBoxGame.value(QStringLiteral("platform")).toString(), &error);
            if (!draftOnly && platformId <= 0) throw std::runtime_error(error.toStdString());

            LaunchBoxMedia media(imagesBaseUrl);
            const auto imageProgress = [worker](const LaunchBoxProgress& update) {
                worker->reportProgress(QJsonObject{
                    {QStringLiteral("current"), update.current}, {QStringLiteral("total"), update.total},
                    {QStringLiteral("stage"), update.status == QLatin1String("error")
                        ? QStringLiteral("error") : QStringLiteral("downloading")},
                    {QStringLiteral("message"), QStringLiteral("Baixando mídia")},
                    {QStringLiteral("imageFilename"), update.filename}});
            };
            const LaunchBoxMediaResult download = media.downloadImages(launchBoxGame, imagesDir, types,
                imageProgress);
            const QString release = launchBoxGame.value(QStringLiteral("release")).toString();
            const QVariantMap input{
                {QStringLiteral("title"), launchBoxGame.value(QStringLiteral("name")).toString()},
                {QStringLiteral("platform_id"), platformId},
                {QStringLiteral("publisher"), launchBoxGame.value(QStringLiteral("publisher")).toString()},
                {QStringLiteral("year"), release.size() >= 4 ? release.left(4).toInt()
                                                             : QVariant(QMetaType(QMetaType::Int))},
                {QStringLiteral("genre"), launchBoxGame.value(QStringLiteral("genres")).toString()},
                {QStringLiteral("rating"), launchBoxGame.value(QStringLiteral("rating")).toString()},
                {QStringLiteral("notes"), launchBoxGame.value(QStringLiteral("overview")).toString()},
                {QStringLiteral("box_art_path"), coverFile(download.files)},
                {QStringLiteral("screenshot_path"), mediaFile(download.files, QStringLiteral("screenshot-gameplay"))},
                {QStringLiteral("background_path"), mediaFile(download.files, QStringLiteral("fanart-background"))},
                {QStringLiteral("launchbox_id"), launchBoxId},
            };
            if (draftOnly) {
                QVariantMap values = input;
                values.remove(QStringLiteral("platform_id"));
                worker->setResult(QJsonObject{{QStringLiteral("draft"), QJsonObject::fromVariantMap(values)}});
                return;
            }
            GameWriteDao games(connection.database());
            qint64 gameId = 0;
            bool found = false;
            if (!games.findIdByLaunchBoxId(launchBoxId, platformId, &gameId, &found, &error)) {
                throw std::runtime_error(error.toStdString());
            }
            bool created = false;
            if (found) {
                QVariantMap changes = input;
                changes.remove(QStringLiteral("platform_id"));
                changes.remove(QStringLiteral("launchbox_id"));
                if (!games.update(gameId, changes, &error)) throw std::runtime_error(error.toStdString());
            } else {
                if (!games.create(input, &gameId, &error)) throw std::runtime_error(error.toStdString());
                created = true;
            }
            worker->setResult(QJsonObject{{QStringLiteral("gameId"), gameId},
                {QStringLiteral("created"), created},
                {QStringLiteral("title"), input.value(QStringLiteral("title")).toString()}});
        });
}

void MetadataService::onJobFinished(const QString& id, const QJsonObject& job) {
    if (id != activeJobId_) return;
    const QString kind = job.value(QStringLiteral("kind")).toString();
    const QString status = job.value(QStringLiteral("status")).toString();
    const QVariantMap result = job.value(QStringLiteral("result")).toObject().toVariantMap();
    busy_ = false;
    activeJobId_.clear();
    if (status == QLatin1String("failed")) {
        error_ = job.value(QStringLiteral("error")).toString();
        if (error_.isEmpty()) error_ = QStringLiteral("Operação de metadados falhou.");
    } else {
        error_.clear();
        if (kind == QLatin1String("metadata-search")) {
            results_ = result.value(QStringLiteral("results")).toList();
        } else if (kind == QLatin1String("metadata-cache")) {
            metadataReady_ = true;
        } else if (kind == QLatin1String("metadata-import")) {
            metadataReady_ = true;
            const qint64 gameId = result.value(QStringLiteral("gameId")).toLongLong();
            if (result.contains(QStringLiteral("draft"))) emit prepared(result.value(QStringLiteral("draft")).toMap());
            else if (gameId > 0) emit imported(gameId);
        }
    }
    emit changed();
}
} // namespace gamestock
