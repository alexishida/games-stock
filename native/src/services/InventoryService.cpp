/** Implementação do inventário; toda a SQL fica nos DAOs. */
#include "InventoryService.h"

#include "db/dao/HardwareConservationStateDao.h"
#include "db/dao/HardwareItemDao.h"
#include "db/dao/HardwareItemPhotoDao.h"
#include "db/dao/HardwareItemTypeDao.h"
#include "db/ReadOnlyConnection.h"
#include "jobs/JobManager.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QSaveFile>
#include <QElapsedTimer>
#include <QImageReader>
#include <QSqlDatabase>
#include <QStringList>
#include <QUuid>
#include <QtConcurrentRun>
#include <QDateTime>
#include <QJsonObject>
#include <stdexcept>

namespace gamestock {
namespace {
/** Extensões aceitas para fotos de inventário, iguais às do renderer. */
const QStringList& photoExtensions() {
    static const QStringList extensions{QStringLiteral("jpg"), QStringLiteral("jpeg"),
        QStringLiteral("png"), QStringLiteral("webp")};
    return extensions;
}

/** Diretório legado das fotos: `<perfil>/inventario/images`. */
QString inventoryImagesDir(const QString& profileRoot) {
    if (profileRoot.isEmpty()) return {};
    return QDir(profileRoot).filePath(QStringLiteral("inventario/images"));
}

/** Compara caminhos com a sensibilidade do sistema de arquivos. */
bool pathStartsWith(const QString& path, const QString& prefix) {
#ifdef Q_OS_WIN
    return path.startsWith(prefix, Qt::CaseInsensitive);
#else
    return path.startsWith(prefix, Qt::CaseSensitive);
#endif
}

/** Cópia em streaming com destino aberto somente após validar a origem. */
bool copyFile(const QString& source, const QString& destination, JobWorker* worker = nullptr) {
    QFile input(source);
    if (!input.open(QIODevice::ReadOnly)) return false;
    // A foto só aparece no destino após a cópia completa e validada pelo QSaveFile.
    QSaveFile output(destination);
    if (!output.open(QIODevice::WriteOnly)) return false;
    QElapsedTimer progressTimer;
    progressTimer.start();
    constexpr qint64 chunk = 1024 * 1024;
    while (!input.atEnd()) {
        if (worker && worker->isCancelled()) return false;
        const QByteArray bytes = input.read(chunk);
        if (bytes.isEmpty() && input.error() != QFileDevice::NoError) return false;
        if (output.write(bytes) != bytes.size()) return false;
        if (worker && (progressTimer.elapsed() >= 100 || input.atEnd())) {
            worker->reportProgress(QJsonObject{{"current", input.pos()}, {"total", input.size()},
                {"stage", "copying"}, {"message", QStringLiteral("Copiando foto")}});
            progressTimer.restart();
        }
    }
    if (worker && worker->isCancelled()) return false;
    return output.commit();
}
} // namespace

InventoryService::InventoryService(QObject* parent) : QObject(parent) {
    connect(&queryWatcher_, &QFutureWatcher<QueryResult>::finished, this, &InventoryService::finishAsyncQuery);
}

void InventoryService::setJobManager(JobManager* manager) {
    if (jobManager_) disconnect(jobManager_, nullptr, this, nullptr);
    jobManager_ = manager;
    if (!manager) return;
    connect(manager, &JobManager::jobFinished, this, [this](const QString& id, const QJsonObject& job) {
        if (job.value(QStringLiteral("kind")).toString() != QLatin1String("inventory-photo")) return;
        if (id == activePhotoJob_) activePhotoJob_.clear();
        const qint64 itemId = job.value(QStringLiteral("itemId")).toVariant().toLongLong();
        const bool success = job.value(QStringLiteral("status")).toString() == QLatin1String("completed");
        if (success) reload();
        else emit changed();
        emit photoImportFinished(itemId, success, job.value(QStringLiteral("error")).toString());
    });
}

bool InventoryService::open(const QString& databasePath, const QString& profileRoot, QString* error, bool lazyLoad) {
    QString localError;
    if (!connection_.open(databasePath, &localError)) {
        error_ = localError;
        if (error) *error = localError;
        emit changed();
        return false;
    }
    profileRoot_ = profileRoot;
    databasePath_ = databasePath;
    // O modo interativo usa leitura assíncrona; chamadas diretas preservam o contrato síncrono.
    asyncQueries_ = lazyLoad;
    if (mediaRoot_.isEmpty()) mediaRoot_ = profileRoot;
    open_ = true;
    // O modo interativo adia a carga; testes e chamadas diretas continuam recebendo tudo pronto.
    if (!lazyLoad) ensureLoaded();
    if (error_.isEmpty()) {
        if (error) error->clear();
        return true;
    }
    if (error) *error = error_;
    return false;
}

void InventoryService::ensureLoaded() {
    if (!open_ || loaded_) return;
    // Marca antes das consultas para que sinais intermediários não repitam a carga.
    loaded_ = true;
    if (asyncQueries_) {
        auxiliaryDirty_ = true;
        reload();
        return;
    }
    reloadTypes();
    reloadStates();
    reloadPlatforms();
    reload();
}

bool InventoryService::isOpen() const { return open_; }
QAbstractItemModel* InventoryService::model() { return &model_; }

void InventoryService::setSearch(const QString& value) {
    if (search_ == value) return;
    search_ = value;
    page_ = 1;
    if (loaded_) reload(); else ensureLoaded();
}

void InventoryService::setSortBy(const QString& value) {
    if (!QStringList{QStringLiteral("name"), QStringLiteral("type"), QStringLiteral("recent")}.contains(value)) return;
    if (sortBy_ == value) return;
    sortBy_ = value;
    page_ = 1;
    if (loaded_) reload(); else ensureLoaded();
}

void InventoryService::setItemTypeId(qint64 value) {
    const qint64 normalized = value > 0 ? value : 0;
    if (itemTypeId_ == normalized) return;
    itemTypeId_ = normalized;
    page_ = 1;
    if (loaded_) reload(); else ensureLoaded();
}

void InventoryService::setConservationStateId(qint64 value) {
    const qint64 normalized = value > 0 ? value : 0;
    if (conservationStateId_ == normalized) return;
    conservationStateId_ = normalized;
    page_ = 1;
    if (loaded_) reload(); else ensureLoaded();
}

void InventoryService::setPlatformId(qint64 value) {
    const qint64 normalized = value > 0 ? value : 0;
    if (platformId_ == normalized) return;
    platformId_ = normalized;
    page_ = 1;
    if (loaded_) reload(); else ensureLoaded();
}

void InventoryService::setPageSize(int value) {
    const int normalized = value > 0 ? value : 36;
    if (pageSize_ == normalized) return;
    pageSize_ = normalized;
    page_ = 1;
    if (loaded_) reload(); else ensureLoaded();
}

void InventoryService::goToPage(int value) {
    const int normalized = qMax(1, value);
    if (page_ == normalized) return;
    page_ = normalized;
    if (loaded_) reload(); else ensureLoaded();
}

void InventoryService::refresh() {
    if (!open_) return;
    // Qualquer mutação exige a carga completa, inclusive quando veio de uma aba ainda não aberta.
    loaded_ = true;
    if (asyncQueries_) {
        auxiliaryDirty_ = true;
        reload();
        return;
    }
    reloadTypes();
    reloadStates();
    reloadPlatforms();
    reload();
}

void InventoryService::reload() {
    if (!open_) return;
    if (asyncQueries_) {
        ++queryGeneration_;
        queryPending_ = true;
        // Uma nova consulta substitui o erro da tentativa anterior imediatamente.
        error_.clear();
        emit changed();
        if (!queryRunning_) startAsyncQuery();
        return;
    }
    HardwareItemDao dao(connection_.database());
    HardwareItemFilters filters;
    filters.platformId = platformId_;
    filters.itemTypeId = itemTypeId_;
    filters.conservationStateId = conservationStateId_;
    filters.search = search_;
    filters.sortBy = sortBy_;
    filters.page = page_;
    filters.pageSize = pageSize_;

    QList<QVariantMap> rows;
    QString error;
    qint64 total = 0;
    qint64 filtered = 0;
    if (!dao.list(filters, &rows, &total, &filtered, &error)) {
        error_ = error;
        emit changed();
        return;
    }
    applyRows(std::move(rows), total, filtered);
}

void InventoryService::startAsyncQuery() {
    queryRunning_ = true;
    HardwareItemFilters filters;
    filters.platformId = platformId_;
    filters.itemTypeId = itemTypeId_;
    filters.conservationStateId = conservationStateId_;
    filters.search = search_;
    filters.sortBy = sortBy_;
    filters.page = page_;
    filters.pageSize = pageSize_;
    const QString path = databasePath_;
    const quint64 generation = queryGeneration_;
    const bool includeAuxiliary = auxiliaryDirty_;
    // Capturas por valor evitam acesso ao serviço depois de sua destruição.
    queryWatcher_.setFuture(QtConcurrent::run([path, filters, generation, includeAuxiliary] {
        QueryResult result;
        result.generation = generation;
        ReadOnlyConnection connection;
        if (!connection.open(path, &result.error)) return result;
        HardwareItemDao dao(connection.database());
        if (!dao.list(filters, &result.rows, &result.total, &result.filtered, &result.error)) return result;
        if (includeAuxiliary) {
            HardwareItemTypeDao types(connection.database());
            HardwareConservationStateDao states(connection.database());
            if (!types.list(&result.types, &result.error) || !types.listWithCounts(&result.typeCounts, &result.error)
                || !states.list(&result.states, &result.error) || !states.listWithCounts(&result.stateCounts, &result.error)
                || !dao.listPlatformsWithItems(&result.platforms, &result.error)) return result;
            result.hasAuxiliary = true;
        }
        result.ok = true;
        return result;
    }));
}

void InventoryService::finishAsyncQuery() {
    QueryResult result = queryWatcher_.result();
    queryRunning_ = false;
    if (result.generation != queryGeneration_) {
        // Condensar alterações rápidas impede uma fila longa de consultas obsoletas.
        startAsyncQuery();
        return;
    }
    queryPending_ = false;
    if (!result.ok) {
        // Uma falha no filtro atual não deve exibir itens pertencentes à consulta anterior.
        items_.clear();
        model_.setItems({});
        filtered_ = 0;
        error_ = result.error;
        emit changed();
        return;
    }
    if (result.hasAuxiliary) {
        const auto toVariants = [](const QList<QVariantMap>& source) {
            QVariantList values;
            values.reserve(source.size());
            for (const QVariantMap& value : source) values.append(value);
            return values;
        };
        types_ = toVariants(result.types);
        typeCounts_ = toVariants(result.typeCounts);
        states_ = toVariants(result.states);
        stateCounts_ = toVariants(result.stateCounts);
        platforms_ = toVariants(result.platforms);
        auxiliaryDirty_ = false;
    }
    applyRows(std::move(result.rows), result.total, result.filtered);
}

void InventoryService::applyRows(QList<QVariantMap> rows, qint64 total, qint64 filtered) {
    // A decoração fica na fronteira do serviço: o QML nunca monta URLs de arquivo.
    for (QVariantMap& row : rows) decorate(&row);
    items_.clear();
    for (const QVariantMap& row : rows) items_.append(row);
    model_.setItems(rows);
    total_ = total;
    filtered_ = filtered;
    error_.clear();
    emit changed();
}

void InventoryService::reloadTypes() {
    if (!open_) return;
    HardwareItemTypeDao dao(connection_.database());
    QList<QVariantMap> types;
    QList<QVariantMap> counts;
    QString error;
    if (!dao.list(&types, &error) || !dao.listWithCounts(&counts, &error)) {
        error_ = error;
        emit changed();
        return;
    }
    types_.clear();
    for (const QVariantMap& type : types) types_.append(type);
    typeCounts_.clear();
    for (const QVariantMap& count : counts) typeCounts_.append(count);
    emit changed();
}

void InventoryService::reloadStates() {
    if (!open_) return;
    HardwareConservationStateDao dao(connection_.database());
    QList<QVariantMap> states;
    QList<QVariantMap> counts;
    QString error;
    if (!dao.list(&states, &error) || !dao.listWithCounts(&counts, &error)) {
        error_ = error;
        emit changed();
        return;
    }
    states_.clear();
    for (const QVariantMap& state : states) states_.append(state);
    stateCounts_.clear();
    for (const QVariantMap& count : counts) stateCounts_.append(count);
    emit changed();
}

void InventoryService::reloadPlatforms() {
    if (!open_) return;
    HardwareItemDao dao(connection_.database());
    QList<QVariantMap> platforms;
    QString error;
    if (!dao.listPlatformsWithItems(&platforms, &error)) {
        error_ = error;
        emit changed();
        return;
    }
    platforms_.clear();
    for (const QVariantMap& platform : platforms) platforms_.append(platform);
    emit changed();
}

QVariantMap InventoryService::get(qint64 id) {
    if (!open_) {
        error_ = QStringLiteral("Banco do inventário indisponível.");
        emit changed();
        return {};
    }
    HardwareItemDao dao(connection_.database());
    QVariantMap item;
    QString error;
    if (!dao.get(id, &item, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    decorate(&item);
    error_.clear();
    return item;
}

QVariantMap InventoryService::create(const QVariantMap& input) {
    if (!open_) {
        error_ = QStringLiteral("Banco do inventário indisponível.");
        emit changed();
        return {};
    }
    HardwareItemDao dao(connection_.database());
    qint64 id = 0;
    QString error;
    if (!dao.create(input, &id, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    refresh();
    return get(id);
}

bool InventoryService::update(qint64 id, const QVariantMap& changes) {
    if (!open_) {
        error_ = QStringLiteral("Banco do inventário indisponível.");
        emit changed();
        return false;
    }
    HardwareItemDao dao(connection_.database());
    QString error;
    if (!dao.update(id, changes, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    refresh();
    return error_.isEmpty();
}

bool InventoryService::remove(qint64 id) {
    if (!open_) {
        error_ = QStringLiteral("Banco do inventário indisponível.");
        emit changed();
        return false;
    }
    HardwareItemPhotoDao photoDao(connection_.database());
    QList<QVariantMap> photos;
    QString error;
    if (!photoDao.listByItem(id, &photos, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    HardwareItemDao dao(connection_.database());
    if (!dao.remove(id, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    for (const QVariantMap& photo : photos) {
        const QString path = authorizedPhotoPath(photo.value(QStringLiteral("file_path")).toString());
        if (!path.isEmpty()) QFile::remove(path);
    }
    // O diretório do item é gerenciado pelo app; remove junto com o registro.
    const QString itemDir = QDir(inventoryImagesDir(profileRoot_)).filePath(QString::number(id));
    QDir(itemDir).removeRecursively();
    refresh();
    return error_.isEmpty();
}

QVariantList InventoryService::listPhotos(qint64 itemId) {
    QVariantList result;
    if (!open_) {
        error_ = QStringLiteral("Banco do inventário indisponível.");
        emit changed();
        return result;
    }
    HardwareItemPhotoDao dao(connection_.database());
    QList<QVariantMap> photos;
    QString error;
    if (!dao.listByItem(itemId, &photos, &error)) {
        error_ = error;
        emit changed();
        return result;
    }
    for (const QVariantMap& photo : photos) {
        QVariantMap decorated = photo;
        decorate(&decorated);
        decorated.insert(QStringLiteral("fileUrl"),
            mediaUrl(photo.value(QStringLiteral("file_path")).toString()));
        result.append(decorated);
    }
    error_.clear();
    return result;
}

QVariantMap InventoryService::addPhoto(qint64 itemId, const QString& sourcePath) {
    return addPhotoInternal(itemId, sourcePath, nullptr);
}

QString InventoryService::startPhotoImport(qint64 itemId, const QString& sourcePath) {
    if (!open_ || !jobManager_) {
        error_ = QStringLiteral("Importação de fotos indisponível.");
        emit changed();
        return {};
    }
    if (!activePhotoJob_.isEmpty()) {
        error_ = QStringLiteral("Aguarde a importação da foto anterior.");
        emit changed();
        return {};
    }
    const QString id = QStringLiteral("inventory-photo-") + QUuid::createUuid().toString(QUuid::WithoutBraces);
    const QJsonObject job{{"jobId", id}, {"kind", "inventory-photo"}, {"status", "running"},
        {"title", QStringLiteral("Adicionando foto ao inventário")},
        {"subtitle", QFileInfo(sourcePath).fileName()}, {"itemId", QJsonValue::fromVariant(itemId)},
        {"startedAt", QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs)},
        {"progress", QJsonObject{{"current", 0}, {"total", 0}, {"stage", "preparing"}, {"message", QStringLiteral("Preparando foto")}}}};
    const QString path = databasePath_;
    const QString profile = profileRoot_;
    const auto work = [path, profile, itemId, sourcePath](JobWorker* worker) {
        if (worker->isCancelled()) return;
        InventoryService service;
        QString error;
        if (!service.open(path, profile, &error, true)) throw std::runtime_error(error.toStdString());
        // O serviço temporário vive inteiramente no worker e não inicia um segundo worker de leitura.
        service.asyncQueries_ = false;
        const QVariantMap photo = service.addPhotoInternal(itemId, sourcePath, worker);
        if (photo.isEmpty()) {
            if (worker->isCancelled()) return;
            throw std::runtime_error(service.error().toStdString());
        }
        // Após a gravação, um cancelamento tardio não pode relatar falha para uma foto persistida.
        worker->setCommittedResult(QJsonObject{{"itemId", QJsonValue::fromVariant(itemId)},
            {"photoId", QJsonValue::fromVariant(photo.value(QStringLiteral("id")))}});
    };
    QString error;
    if (!jobManager_->start(job, work, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    activePhotoJob_ = id;
    error_.clear();
    emit changed();
    return id;
}

QVariantMap InventoryService::addPhotoInternal(qint64 itemId, const QString& sourcePath, JobWorker* worker) {
    if (!open_) {
        error_ = QStringLiteral("Banco do inventário indisponível.");
        emit changed();
        return {};
    }
    QVariantMap item;
    QString error;
    if (!HardwareItemDao(connection_.database()).get(itemId, &item, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    const QFileInfo source(sourcePath);
    if (!source.isFile() || !photoExtensions().contains(source.suffix().toLower())) {
        error_ = QStringLiteral("Arquivo de origem não é uma imagem suportada.");
        emit changed();
        return {};
    }
    if (!isSupportedImage(source.absoluteFilePath())) {
        error_ = QStringLiteral("Arquivo de origem não é uma imagem válida.");
        emit changed();
        return {};
    }
    const QString destDir = QDir(inventoryImagesDir(profileRoot_)).filePath(QString::number(itemId));
    if (!QDir().mkpath(destDir)) {
        error_ = QStringLiteral("Não foi possível preparar o diretório de fotos.");
        emit changed();
        return {};
    }
    const QString destPath = QDir(destDir).filePath(
        QUuid::createUuid().toString(QUuid::WithoutBraces) + QLatin1Char('.') + source.suffix().toLower());
    if (!copyFile(source.absoluteFilePath(), destPath, worker)) {
        QFile::remove(destPath);
        error_ = worker && worker->isCancelled() ? QStringLiteral("Importação cancelada.") : QStringLiteral("Não foi possível copiar a foto.");
        emit changed();
        return {};
    }
    if (worker && worker->isCancelled()) {
        QFile::remove(destPath);
        error_ = QStringLiteral("Importação cancelada.");
        return {};
    }
    HardwareItemPhotoDao dao(connection_.database());
    qint64 photoId = 0;
    if (!dao.create(itemId, destPath, &photoId, &error)) {
        QFile::remove(destPath);
        error_ = error;
        emit changed();
        return {};
    }
    QVariantMap photo;
    if (!dao.get(photoId, &photo, &error)) {
        // A inserção já foi confirmada: não informar falha após persistir a foto.
        photo = {{QStringLiteral("id"), photoId}, {QStringLiteral("item_id"), itemId},
            {QStringLiteral("file_path"), destPath}};
    }
    decorate(&photo);
    photo.insert(QStringLiteral("fileUrl"), mediaUrl(destPath));
    // A capa pode mudar quando o item não tinha fotos; recarrega a página.
    reload();
    return photo;
}

bool InventoryService::removePhoto(qint64 photoId) {
    if (!open_) {
        error_ = QStringLiteral("Banco do inventário indisponível.");
        emit changed();
        return false;
    }
    HardwareItemPhotoDao dao(connection_.database());
    QVariantMap photo;
    QString error;
    if (!dao.get(photoId, &photo, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    if (!dao.remove(photoId, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    const QString path = authorizedPhotoPath(photo.value(QStringLiteral("file_path")).toString());
    if (!path.isEmpty()) QFile::remove(path);
    reload();
    return error_.isEmpty();
}

bool InventoryService::reorderPhotos(qint64 idA, qint64 idB) {
    if (!open_) {
        error_ = QStringLiteral("Banco do inventário indisponível.");
        emit changed();
        return false;
    }
    HardwareItemPhotoDao dao(connection_.database());
    QString error;
    if (!dao.reorder(idA, idB, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    reload();
    return error_.isEmpty();
}

QVariantMap InventoryService::createType(const QString& name) {
    if (!open_) {
        error_ = QStringLiteral("Banco do inventário indisponível.");
        emit changed();
        return {};
    }
    HardwareItemTypeDao dao(connection_.database());
    qint64 id = 0;
    QString error;
    if (!dao.create(name, &id, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    if (asyncQueries_) { auxiliaryDirty_ = true; reload(); }
    else reloadTypes();
    QVariantMap type;
    if (!dao.get(id, &type, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    return type;
}

QVariantMap InventoryService::createState(const QString& name) {
    if (!open_) {
        error_ = QStringLiteral("Banco do inventário indisponível.");
        emit changed();
        return {};
    }
    HardwareConservationStateDao dao(connection_.database());
    qint64 id = 0;
    QString error;
    if (!dao.create(name, &id, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    if (asyncQueries_) { auxiliaryDirty_ = true; reload(); }
    else reloadStates();
    QVariantMap state;
    if (!dao.get(id, &state, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    return state;
}

bool InventoryService::removeType(qint64 id) {
    if (!open_) {
        error_ = QStringLiteral("Banco do inventário indisponível.");
        emit changed();
        return false;
    }
    HardwareItemTypeDao dao(connection_.database());
    QString error;
    if (!dao.remove(id, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    refresh();
    return error_.isEmpty();
}

bool InventoryService::removeState(qint64 id) {
    if (!open_) {
        error_ = QStringLiteral("Banco do inventário indisponível.");
        emit changed();
        return false;
    }
    HardwareConservationStateDao dao(connection_.database());
    QString error;
    if (!dao.remove(id, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    refresh();
    return error_.isEmpty();
}

QVariantList InventoryService::platformsWithItems() {
    if (!open_) return platforms_;
    if (asyncQueries_) { if (!loaded_) ensureLoaded(); return platforms_; }
    reloadPlatforms();
    return platforms_;
}

QString InventoryService::mediaUrl(const QString& path) const {
    return HardwareItemListModel::mediaUrl(path);
}

void InventoryService::decorate(QVariantMap* item) {
    if (!item) return;
    item->insert(QStringLiteral("coverUrl"),
        HardwareItemListModel::mediaUrl(item->value(QStringLiteral("cover_photo_path")).toString()));
}

bool InventoryService::isSupportedImage(const QString& path) {
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) return false;
    const QByteArray header = file.read(16);
    if (header.size() < 4) return false;
    // JPEG, PNG e WebP: mesmas assinaturas verificadas pelo processo principal legado.
    if (header.startsWith("\xFF\xD8\xFF")) return true;
    if (header.startsWith("\x89PNG")) return true;
    if (header.startsWith("RIFF") && header.size() >= 12 && header.mid(8, 4) == "WEBP") return true;
    return false;
}

QString InventoryService::authorizedPhotoPath(const QString& path) const {
    if (profileRoot_.isEmpty() || path.isEmpty() || !QDir::isAbsolutePath(path)) return {};
    const QString base = QDir::cleanPath(inventoryImagesDir(profileRoot_));
    const QString clean = QDir::cleanPath(path);
    if (base.isEmpty() || clean.compare(base, Qt::CaseInsensitive) == 0) return {};
    const QString prefix = base.endsWith(QLatin1Char('/')) ? base : base + QLatin1Char('/');
    if (!pathStartsWith(clean, prefix)) return {};
    // Arquivos inexistentes não precisam de remoção; o retorno vazio é intencional.
    return QFileInfo::exists(clean) ? clean : QString();
}
} // namespace gamestock
