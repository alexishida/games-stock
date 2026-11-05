/** Implementação da fachada da biblioteca; toda a SQL fica nos DAOs. */
#include "GameService.h"
#include <QImageReader>
#include <QSaveFile>
#include <QUuid>

#include "app/DataPaths.h"
#include "db/LibraryFilterState.h"
#include "db/dao/GameWriteDao.h"

#include <QDir>
#include <QFileInfo>
#include <QRegularExpression>
#include <QSqlError>

#include <algorithm>

namespace gamestock {
namespace {
/** Extensões reconhecidas como mídia de jogo, iguais às do Electron. */
const QStringList& mediaExtensions() {
    static const QStringList extensions = {QStringLiteral("jpg"), QStringLiteral("jpeg"),
        QStringLiteral("png"), QStringLiteral("webp")};
    return extensions;
}

/** Classificação semântica pelo prefixo do arquivo, como `mediaKind` do Electron. */
QString mediaKind(const QString& filePath) {
    const QString name = QFileInfo(filePath).fileName().toLower();
    if (name == QLatin1String("cover.jpg")) return QStringLiteral("cover");
    if (name.startsWith(QLatin1String("box-"))) return QStringLiteral("box-art");
    if (name.startsWith(QLatin1String("cart-"))) return QStringLiteral("cart");
    if (name.startsWith(QLatin1String("fanart-background"))) return QStringLiteral("background");
    if (name.startsWith(QLatin1String("screenshot-"))) return QStringLiteral("screenshot");
    return QStringLiteral("other");
}

/** Rótulo legível derivado do nome do arquivo, sem sufixo numérico. */
QString mediaLabel(const QString& filePath) {
    QString name = QFileInfo(filePath).completeBaseName().toLower();
    if (name == QLatin1String("cover")) return QStringLiteral("Cover");
    name.remove(QRegularExpression(QStringLiteral("-\\d+$")));
    QStringList parts;
    for (const QString& part : name.split(QLatin1Char('-'), Qt::SkipEmptyParts)) {
        QString capitalized = part;
        if (!capitalized.isEmpty()) capitalized[0] = capitalized.at(0).toUpper();
        parts.append(capitalized);
    }
    return parts.join(QLatin1Char(' '));
}

/** Peso de exibição: capas, carts, fundos, screenshots e demais arquivos. */
int mediaSortWeight(const QString& kind) {
    if (kind == QLatin1String("cover")) return 0;
    if (kind == QLatin1String("box-art")) return 1;
    if (kind == QLatin1String("cart")) return 2;
    if (kind == QLatin1String("background")) return 3;
    if (kind == QLatin1String("screenshot")) return 4;
    return 5;
}

/** Confirma que o diretório existe dentro da raiz autorizada do perfil. */
QString allowedDirectory(const QString& root, const QString& directory) {
    if (root.isEmpty() || directory.isEmpty()) return {};
    const QFileInfo rootInfo(root);
    const QFileInfo directoryInfo(directory);
    if (!rootInfo.isDir() || !directoryInfo.isDir()) return {};
    const QString canonicalRoot = rootInfo.canonicalFilePath();
    const QString canonicalDirectory = directoryInfo.canonicalFilePath();
    if (canonicalRoot.isEmpty() || canonicalDirectory.isEmpty()) return {};
    const QString prefix = canonicalRoot.endsWith(QLatin1Char('/')) ? canonicalRoot : canonicalRoot + QLatin1Char('/');
    return canonicalDirectory.startsWith(prefix, Qt::CaseSensitive) ? canonicalDirectory : QString();
}
/** Copia imagens locais selecionadas por caminho, preservando referências legadas ausentes. */
bool importExternalGameImages(GameService* service, const QString& root, QVariantMap* values, QString* error) {
    for (const QString& key : {QStringLiteral("box_art_path"), QStringLiteral("background_path"), QStringLiteral("screenshot_path")}) {
        const QString path = values->value(key).toString();
        // Campos ausentes ou caminhos antigos indisponíveis não devem bloquear outras edições.
        if (path.isEmpty() || !QFileInfo(path).isFile() || !validatedMediaPath(root, path).isEmpty()) continue;
        const QVariantMap imported = service->importImage(QUrl::fromLocalFile(QFileInfo(path).absoluteFilePath()));
        if (!imported.value("success").toBool()) {
            if (error) *error = imported.value("error").toString();
            return false;
        }
        values->insert(key, imported.value("path"));
    }
    return true;
}
} // namespace

GameService::GameService(QObject* parent) : QObject(parent) {
    // As estruturas do worker atravessam conexões enfileiradas entre threads.
    qRegisterMetaType<LibraryQueryWorker::Request>("LibraryQueryWorker::Request");
    qRegisterMetaType<LibraryQueryWorker::Response>("LibraryQueryWorker::Response");
}

GameService::~GameService() {
    if (queryWorker_ && queryThread_.isRunning()) {
        // A conexão somente leitura precisa morrer na thread que a criou.
        QMetaObject::invokeMethod(queryWorker_, "closeConnection", Qt::BlockingQueuedConnection);
    }
    if (queryThread_.isRunning()) {
        queryThread_.quit();
        queryThread_.wait();
    }
    delete queryWorker_;
    queryWorker_ = nullptr;
}

void GameService::setAsyncQueries(bool enabled) {
    asyncQueries_ = enabled;
}

bool GameService::open(const QString& databasePath, QString* error, bool deferAggregates) {
    QString localError;
    if (!connection_.open(databasePath, &localError)) {
        error_ = localError;
        if (error) *error = localError;
        emit changed();
        return false;
    }
    open_ = true;
    if (mediaRoot_.isEmpty()) mediaRoot_ = QFileInfo(databasePath).absolutePath();
    // Preferências legadas precedem defaults, sem gravar nada durante a hidratação.
    loading_ = true;
    LibraryFilterStore preferences(connection_.database());
    LibraryFilterState state;
    bool present = false;
    QString preferenceError;
    if (preferences.load(&state, &present, &preferenceError) && present) {
        genre_ = state.selectedCategory;
        collection_ = state.collectionFilter;
        includeMissingCovers_ = state.showGamesWithoutCover;
        sortBy_ = state.sortBy;
        viewMode_ = state.viewMode;
    } else if (!preferenceError.isEmpty()) {
        qWarning("Preferências da biblioteca indisponíveis: %s", qPrintable(preferenceError));
    }
    loading_ = false;
    databasePath_ = databasePath;
    // A primeira carga sempre invalida os agregados do perfil anterior.
    genresDirty_ = true;
    launchStatsDirty_ = true;
    coverStatsDirty_ = true;
    // A conexão de leitura nasce na thread do worker, nunca na GUI.
    if (asyncQueries_ && !queryWorker_) {
        queryWorker_ = new LibraryQueryWorker(databasePath);
        queryWorker_->moveToThread(&queryThread_);
        connect(queryWorker_, &LibraryQueryWorker::finished, this, &GameService::applyQueryResponse);
        queryThread_.start();
        bool opened = false;
        QMetaObject::invokeMethod(queryWorker_, "openConnection", Qt::BlockingQueuedConnection,
            Q_RETURN_ARG(bool, opened));
        if (!opened) {
            // Sem conexão de leitura o serviço volta ao modo síncrono em vez de falhar.
            queryThread_.quit();
            queryThread_.wait();
            delete queryWorker_;
            queryWorker_ = nullptr;
            asyncQueries_ = false;
        }
    }
    // A primeira página é síncrona para o primeiro quadro; agregados seguem conforme o modo.
    refreshPageSync(!deferAggregates);
    if (!error_.isEmpty()) {
        if (error) *error = error_;
        return false;
    }
    if (error) error->clear();
    return true;
}

bool GameService::isOpen() const { return open_; }
void GameService::setMediaRoot(const QString& path) { mediaRoot_ = path; }
QAbstractItemModel* GameService::model() { return &model_; }

QVariantMap GameService::platformCounts() const {
    QVariantMap result;
    for (auto it = counts_.platforms.cbegin(); it != counts_.platforms.cend(); ++it) {
        result.insert(QString::number(it.key()), it.value());
    }
    return result;
}

GameListFilters GameService::filters() const {
    GameListFilters value;
    value.platformId = platformId_;
    value.search = search_;
    value.genre = genre_;
    value.collection = collection_;
    value.sortBy = sortBy_;
    value.includeMissingCovers = includeMissingCovers_;
    return value;
}

void GameService::savePreferences() {
    if (!open_ || loading_) return;
    LibraryFilterState state;
    state.selectedCategory = genre_;
    state.collectionFilter = collection_;
    state.showGamesWithoutCover = includeMissingCovers_;
    state.sortBy = sortBy_;
    state.viewMode = viewMode_;
    LibraryFilterStore store(connection_.database());
    QString error;
    if (!store.save(state, &error)) {
        error_ = error;
        emit changed();
    }
}

void GameService::decorate(QVariantMap* game) {
    if (!game) return;
    game->insert(QStringLiteral("coverUrl"),
        GameListModel::coverUrl(game->value(QStringLiteral("box_art_path")).toString()));
}

void GameService::refresh() {
    // Chamadas externas (importadores, sincronização) podem ter alterado qualquer agregado.
    genresDirty_ = true;
    launchStatsDirty_ = true;
    coverStatsDirty_ = true;
    refreshPage(true);
}

void GameService::refreshPage(bool refreshAggregates) {
    if (!open_) return;
    // No app interativo a consulta sai da GUI; testes e abertura usam o caminho síncrono.
    if (asyncQueries_ && queryWorker_) {
        scheduleQuery(refreshAggregates);
        return;
    }
    refreshPageSync(refreshAggregates);
}

void GameService::refreshPageSync(bool refreshAggregates) {
    if (!open_) return;
    GameReadDao dao(connection_.database());
    GamePage result;
    QString error;
    // A página selecionada é revalidada contra o conjunto filtrado atual.
    if (!dao.list(page_, pageSize_, &result, &error, filters())) {
        error_ = error;
        emit changed();
        return;
    }
    if (result.items.isEmpty() && page_ > 1) {
        page_ = 1;
        if (!dao.list(page_, pageSize_, &result, &error, filters())) {
            error_ = error;
            emit changed();
            return;
        }
    }
    total_ = result.total;
    filtered_ = result.filtered;
    // A página vira lista de mapas com a URL de mídia já resolvida para o QML.
    items_.clear();
    for (QVariantMap game : result.items) {
        decorate(&game);
        items_.append(game);
    }
    model_.setGames(result.items);
    // Paginação e ordenação não alteram os filtros nem as estatísticas já carregadas.
    if (!refreshAggregates) {
        error_.clear();
        emit changed();
        return;
    }
    if (!loadAggregateQueries(&error)) {
        error_ = error;
        emit changed();
        return;
    }
    error_.clear();
    emit changed();
}

bool GameService::loadAggregateQueries(QString* error) {
    GameReadDao dao(connection_.database());
    // Os contadores da sidebar dependem dos filtros ativos e acompanham cada busca.
    if (!dao.sidebarCounts(filters(), &counts_, error)) return false;
    // Gêneros, partidas e capas são globais; só mudam após CRUD/importação/sincronização.
    if (genresDirty_) {
        if (!dao.listGenres(&genres_, error)) return false;
        genresDirty_ = false;
    }
    if (launchStatsDirty_) {
        if (!dao.launchStats(&launchStats_, error)) return false;
        launchStatsDirty_ = false;
    }
    if (coverStatsDirty_) {
        if (!dao.coverStats(&coverStats_, error)) return false;
        coverStatsDirty_ = false;
    }
    return true;
}

void GameService::loadAggregates() {
    if (!open_) return;
    // Após o primeiro quadro, a mesma consulta pode seguir na thread de leitura.
    if (asyncQueries_ && queryWorker_) {
        scheduleQuery(true);
        return;
    }
    QString error;
    if (!loadAggregateQueries(&error)) {
        error_ = error;
        emit changed();
        return;
    }
    error_.clear();
    emit changed();
}

void GameService::scheduleQuery(bool refreshAggregates) {
    LibraryQueryWorker::Request request;
    request.generation = ++queryGeneration_;
    request.page = page_;
    request.pageSize = pageSize_;
    request.filters = filters();
    request.wantSidebar = refreshAggregates;
    // Só pede os agregados globais marcados como desatualizados.
    request.wantGenres = refreshAggregates && genresDirty_;
    request.wantLaunchStats = refreshAggregates && launchStatsDirty_;
    request.wantCoverStats = refreshAggregates && coverStatsDirty_;
    pendingAggregates_ = refreshAggregates;
    QMetaObject::invokeMethod(queryWorker_, "run", Qt::QueuedConnection,
        Q_ARG(LibraryQueryWorker::Request, request));
}

void GameService::applyQueryResponse(const LibraryQueryWorker::Response& response) {
    // Gerações antigas (digitação rápida ou paginação) não sobrescrevem o estado atual.
    if (response.generation != queryGeneration_) return;
    if (!response.ok) {
        error_ = response.error;
        emit changed();
        return;
    }
    // A página pode ficar vazia depois de um filtro; volta para a primeira e repete.
    if (response.page.items.isEmpty() && page_ > 1) {
        page_ = 1;
        scheduleQuery(pendingAggregates_);
        return;
    }
    total_ = response.page.total;
    filtered_ = response.page.filtered;
    items_.clear();
    for (QVariantMap game : response.page.items) {
        decorate(&game);
        items_.append(game);
    }
    model_.setGames(response.page.items);
    if (response.hasSidebar) counts_ = response.sidebar;
    if (response.hasGenres) {
        genres_ = response.genres;
        genresDirty_ = false;
    }
    if (response.hasLaunchStats) {
        launchStats_ = response.launchStats;
        launchStatsDirty_ = false;
    }
    if (response.hasCoverStats) {
        coverStats_ = response.coverStats;
        coverStatsDirty_ = false;
    }
    error_.clear();
    emit changed();
}

void GameService::setSearch(const QString& value) {
    if (search_ == value) return;
    search_ = value;
    page_ = 1;
    // A busca só afeta página e contadores filtrados; gêneros e estatísticas globais ficam em cache.
    refreshPage(true);
}

void GameService::setGenre(const QString& value) {
    if (genre_ == value) return;
    genre_ = value;
    page_ = 1;
    refreshPage(true);
    savePreferences();
}

void GameService::setCollection(const QString& value) {
    if (collection_ == value) return;
    collection_ = value;
    page_ = 1;
    refreshPage(true);
    savePreferences();
}

void GameService::setSortBy(const QString& value) {
    if (sortBy_ == value) return;
    sortBy_ = value;
    page_ = 1;
    refreshPage(false);
    savePreferences();
}

void GameService::setViewMode(const QString& value) {
    if (value != QLatin1String("grid") && value != QLatin1String("list")) return;
    if (viewMode_ == value) return;
    viewMode_ = value;
    savePreferences();
    emit changed();
}

void GameService::setPlatformId(qint64 value) {
    if (platformId_ == value) return;
    platformId_ = value;
    page_ = 1;
    refreshPage(true);
}

void GameService::setIncludeMissingCovers(bool value) {
    if (includeMissingCovers_ == value) return;
    includeMissingCovers_ = value;
    page_ = 1;
    refreshPage(true);
    savePreferences();
}

void GameService::setPageSize(int value) {
    if (value <= 0 || value > 1000 || pageSize_ == value) return;
    pageSize_ = value;
    page_ = 1;
    refreshPage(false);
}

void GameService::goToPage(int value) {
    if (value < 1 || value == page_) return;
    page_ = value;
    refreshPage(false);
}

QVariantMap GameService::get(qint64 id) {
    if (!open_) {
        error_ = QStringLiteral("Banco da biblioteca indisponível.");
        emit changed();
        return {};
    }
    GameReadDao dao(connection_.database());
    QVariantMap game;
    QString error;
    if (!dao.get(id, &game, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    decorate(&game);
    error_.clear();
    return game;
}

QVariantMap GameService::create(const QVariantMap& input) {
    if (!open_) {
        error_ = QStringLiteral("Banco da biblioteca indisponível.");
        emit changed();
        return {};
    }
    GameWriteDao dao(connection_.database());
    qint64 id = 0;
    QString error;
    QVariantMap values = input;
    if (!importExternalGameImages(this, mediaRoot_, &values, &error) || !dao.create(values, &id, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    // Limpa o erro anterior: no modo assíncrono o refresh ainda não terminou ao retornar.
    error_.clear();
    refresh();
    if (!error_.isEmpty()) return {};
    return get(id);
}

bool GameService::update(qint64 id, const QVariantMap& changes) {
    if (!open_) {
        error_ = QStringLiteral("Banco da biblioteca indisponível.");
        emit changed();
        return false;
    }
    GameWriteDao dao(connection_.database());
    QString error;
    QVariantMap values = changes;
    if (!importExternalGameImages(this, mediaRoot_, &values, &error) || !dao.update(id, values, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    error_.clear();
    refresh();
    return error_.isEmpty();
}

bool GameService::remove(qint64 id) {
    if (!open_) {
        error_ = QStringLiteral("Banco da biblioteca indisponível.");
        emit changed();
        return false;
    }
    GameWriteDao dao(connection_.database());
    QString error;
    if (!dao.remove(id, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    error_.clear();
    refresh();
    return error_.isEmpty();
}

QVariantList GameService::listMedia(qint64 id) {
    QVariantList result;
    if (!open_) return result;
    GameReadDao dao(connection_.database());
    QVariantMap game;
    QString error;
    if (!dao.get(id, &game, &error)) {
        error_ = error;
        emit changed();
        return result;
    }

    // O diretório vem dos caminhos conhecidos do jogo, sempre validado pela raiz autorizada.
    QString mediaDirectory;
    for (const QString& key : {QStringLiteral("box_art_path"), QStringLiteral("background_path"),
             QStringLiteral("screenshot_path")}) {
        const QString mediaPath = game.value(key).toString();
        if (mediaPath.isEmpty()) continue;
        if (!validatedMediaPath(mediaRoot_, mediaPath).isEmpty()) {
            mediaDirectory = QFileInfo(mediaPath).absolutePath();
            break;
        }
        if (mediaDirectory.isEmpty()) mediaDirectory = allowedDirectory(mediaRoot_, QFileInfo(mediaPath).absolutePath());
    }
    if (mediaDirectory.isEmpty()) return result;

    const QFileInfoList entries = QDir(mediaDirectory).entryInfoList(QDir::Files | QDir::NoDotAndDotDot);
    QList<QVariantMap> files;
    for (const QFileInfo& entry : entries) {
        if (!mediaExtensions().contains(entry.suffix().toLower())) continue;
        if (mediaKind(entry.absoluteFilePath()) == QLatin1String("cover")) continue;
        const QString authorized = validatedMediaPath(mediaRoot_, entry.absoluteFilePath());
        if (authorized.isEmpty()) continue;
        files.append(QVariantMap{{QStringLiteral("path"), authorized},
            {QStringLiteral("label"), mediaLabel(authorized)},
            {QStringLiteral("kind"), mediaKind(authorized)}});
    }
    std::stable_sort(files.begin(), files.end(), [](const QVariantMap& left, const QVariantMap& right) {
        const int leftWeight = mediaSortWeight(left.value(QStringLiteral("kind")).toString());
        const int rightWeight = mediaSortWeight(right.value(QStringLiteral("kind")).toString());
        if (leftWeight != rightWeight) return leftWeight < rightWeight;
        return QString::compare(QFileInfo(left.value(QStringLiteral("path")).toString()).fileName(),
            QFileInfo(right.value(QStringLiteral("path")).toString()).fileName(), Qt::CaseInsensitive) < 0;
    });
    for (const QVariantMap& file : files) result.append(file);
    error_.clear();
    return result;
}

QString GameService::mediaUrl(const QString& path) const {
    return GameListModel::coverUrl(path);
}

QVariantMap GameService::importImage(const QUrl& source) {
    // Seleção explícita permite ler a origem externa; somente a cópia interna é exposta ao QML.
    const QString path = source.toLocalFile();
    QImageReader reader(path);
    reader.setDecideFormatFromContent(true);
    const QByteArray format = reader.format().toLower();
    if (!source.isLocalFile() || mediaRoot_.isEmpty() || !reader.canRead()
        || !QList<QByteArray>{"png", "jpg", "jpeg", "webp"}.contains(format))
        return {{"success", false}, {"error", QStringLiteral("Selecione uma imagem PNG, JPEG ou WebP válida.")}};
    const QString existing = validatedMediaPath(mediaRoot_, path);
    if (!existing.isEmpty()) return {{"success", true}, {"path", path}};
    const QString directory = QDir(mediaRoot_).filePath(QStringLiteral("images/manual"));
    const QString target = QDir(directory).filePath(QUuid::createUuid().toString(QUuid::WithoutBraces)
        + QLatin1Char('.') + QString::fromLatin1(format));
    if (!QDir().mkpath(directory) || !QFile::copy(path, target))
        return {{"success", false}, {"error", QStringLiteral("Não foi possível copiar a capa para o perfil.")}};
    return {{"success", true}, {"path", target}};
}

QVariantMap GameService::saveImage(const QString& sourcePath, const QUrl& destination) {
    // A origem é canônica e restrita ao perfil; o destino vem da escolha explícita do usuário.
    const auto failure = [](const QString& message) {
        return QVariantMap{{"success", false}, {"error", message}};
    };
    const QString source = validatedMediaPath(mediaRoot_, sourcePath);
    if (source.isEmpty() || !QImageReader(source).canRead())
        return failure(QStringLiteral("Imagem de origem inválida ou fora do perfil."));
    const QString target = destination.toLocalFile();
    if (!destination.isLocalFile() || !QDir::isAbsolutePath(target))
        return failure(QStringLiteral("Escolha um arquivo local para salvar a imagem."));
    if (QFileInfo(source).canonicalFilePath() == QFileInfo(target).canonicalFilePath())
        return {{"success", true}, {"path", target}};
    QFile input(source);
    QSaveFile output(target);
    if (!input.open(QIODevice::ReadOnly) || !output.open(QIODevice::WriteOnly))
        return failure(QStringLiteral("Não foi possível abrir o arquivo para salvar a imagem."));
    // A substituição atômica preserva um destino existente se ocorrer falha durante a cópia.
    while (!input.atEnd()) {
        const QByteArray block = input.read(64 * 1024);
        if (input.error() != QFileDevice::NoError || output.write(block) != block.size()) {
            output.cancelWriting();
            return failure(QStringLiteral("Falha ao copiar a imagem; o destino anterior foi preservado."));
        }
    }
    if (!output.commit()) return failure(QStringLiteral("Não foi possível concluir o salvamento da imagem."));
    return {{"success", true}, {"path", target}};
}

QVariantList GameService::listVersions(qint64 id) {
    QVariantList result;
    if (!open_) {
        error_ = QStringLiteral("Banco da biblioteca indisponível.");
        emit changed();
        return result;
    }
    GameReadDao dao(connection_.database());
    QList<QVariantMap> versions;
    QString error;
    if (!dao.listVersions(id, &versions, &error)) {
        error_ = error;
        emit changed();
        return result;
    }
    for (QVariantMap version : versions) {
        version.insert(QStringLiteral("coverUrl"),
            GameListModel::coverUrl(version.value(QStringLiteral("boxArtPath")).toString()));
        result.append(version);
    }
    error_.clear();
    return result;
}

QVariantMap GameService::collectionCounts() {
    if (!open_) {
        error_ = QStringLiteral("Banco da biblioteca indisponível.");
        emit changed();
        return {};
    }
    GameReadDao dao(connection_.database());
    GameReadDao::CollectionCounts counts;
    QString error;
    if (!dao.collectionCounts(&counts, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    error_.clear();
    return QVariantMap{{QStringLiteral("favorites"), counts.favorites},
        {QStringLiteral("playing"), counts.playing},
        {QStringLiteral("completed"), counts.completed},
        {QStringLiteral("mostPlayed"), counts.mostPlayed}};
}

QVariantMap GameService::launchStats() {
    if (!open_) {
        error_ = QStringLiteral("Banco da biblioteca indisponível.");
        emit changed();
        return {};
    }
    GameReadDao dao(connection_.database());
    GameReadDao::LaunchStats stats;
    QString error;
    if (!dao.launchStats(&stats, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    launchStats_ = stats;
    launchStatsDirty_ = false;
    error_.clear();
    emit changed();
    return QVariantMap{{QStringLiteral("totalLaunches"), stats.totalLaunches},
        {QStringLiteral("playedGames"), stats.playedGames}};
}

QVariantMap GameService::coverStats() {
    if (!open_) {
        error_ = QStringLiteral("Banco da biblioteca indisponível.");
        emit changed();
        return {};
    }
    GameReadDao dao(connection_.database());
    GameReadDao::CoverStats stats;
    QString error;
    if (!dao.coverStats(&stats, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    coverStats_ = stats;
    coverStatsDirty_ = false;
    error_.clear();
    emit changed();
    return QVariantMap{{QStringLiteral("total"), stats.total},
        {QStringLiteral("downloaded"), stats.downloaded}, {QStringLiteral("missing"), stats.missing},
        {QStringLiteral("syncable"), stats.syncable}, {QStringLiteral("metadataSyncable"), stats.metadataSyncable}};
}

QVariantMap GameService::resetLaunchStats() {
    if (!open_) {
        error_ = QStringLiteral("Banco da biblioteca indisponível.");
        emit changed();
        return {};
    }
    GameWriteDao dao(connection_.database());
    qint64 updated = 0;
    QString error;
    if (!dao.resetLaunchCounts(&updated, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    error_.clear();
    refresh();
    if (!error_.isEmpty()) return {};
    return QVariantMap{{QStringLiteral("success"), true}, {QStringLiteral("updated"), updated}};
}
} // namespace gamestock
