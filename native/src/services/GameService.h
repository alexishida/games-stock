/** Fachada tipada da biblioteca: filtros, página, CRUD, contadores e gêneros. */
#pragma once

#include "db/WriteConnection.h"
#include "db/dao/GameReadDao.h"
#include "models/GameListModel.h"
#include "services/LibraryQueryWorker.h"

#include <QObject>
#include <QThread>
#include <QUrl>
#include <QStringList>
#include <QVariantList>
#include <QVariantMap>

namespace gamestock {
/** Uma conexão por instância; a UI conversa apenas com propriedades e slots. */
class GameService final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QAbstractItemModel* model READ model CONSTANT)
    Q_PROPERTY(QVariantList items READ items NOTIFY changed)
    Q_PROPERTY(bool available READ available NOTIFY changed)
    Q_PROPERTY(QString search READ search WRITE setSearch NOTIFY changed)
    Q_PROPERTY(QString genre READ genre WRITE setGenre NOTIFY changed)
    Q_PROPERTY(QString collection READ collection WRITE setCollection NOTIFY changed)
    Q_PROPERTY(QString sortBy READ sortBy WRITE setSortBy NOTIFY changed)
    Q_PROPERTY(QString viewMode READ viewMode WRITE setViewMode NOTIFY changed)
    Q_PROPERTY(qint64 platformId READ platformId WRITE setPlatformId NOTIFY changed)
    Q_PROPERTY(bool includeMissingCovers READ includeMissingCovers WRITE setIncludeMissingCovers NOTIFY changed)
    Q_PROPERTY(int page READ page NOTIFY changed)
    Q_PROPERTY(int pageSize READ pageSize WRITE setPageSize NOTIFY changed)
    Q_PROPERTY(QStringList genres READ genres NOTIFY changed)
    Q_PROPERTY(qint64 total READ total NOTIFY changed)
    Q_PROPERTY(qint64 filtered READ filtered NOTIFY changed)
    Q_PROPERTY(qint64 favoritesCount READ favoritesCount NOTIFY changed)
    Q_PROPERTY(qint64 playingCount READ playingCount NOTIFY changed)
    Q_PROPERTY(qint64 completedCount READ completedCount NOTIFY changed)
    Q_PROPERTY(qint64 mostPlayedCount READ mostPlayedCount NOTIFY changed)
    Q_PROPERTY(qint64 totalLaunches READ totalLaunches NOTIFY changed)
    Q_PROPERTY(qint64 playedGames READ playedGames NOTIFY changed)
    Q_PROPERTY(qint64 coverTotal READ coverTotal NOTIFY changed)
    Q_PROPERTY(qint64 coverDownloaded READ coverDownloaded NOTIFY changed)
    Q_PROPERTY(qint64 coverMissing READ coverMissing NOTIFY changed)
    Q_PROPERTY(qint64 coverSyncable READ coverSyncable NOTIFY changed)
    Q_PROPERTY(qint64 coverMetadataSyncable READ coverMetadataSyncable NOTIFY changed)
    Q_PROPERTY(QVariantMap platformCounts READ platformCounts NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
public:
    explicit GameService(QObject* parent = nullptr);
    ~GameService() override;
    /** Liga a leitura em thread própria; deve ser chamado antes de `open` no app interativo. */
    void setAsyncQueries(bool enabled);
    /** Abre o banco já inicializado para leitura/escrita e carrega a primeira página.
     *  `deferAggregates` deixa gêneros/contadores/estatísticas para depois do primeiro quadro. */
    bool open(const QString& databasePath, QString* error = nullptr, bool deferAggregates = false);
    bool isOpen() const;
    /** Raiz autorizada para listar mídias; padrão é o diretório do banco. */
    void setMediaRoot(const QString& path);
    QString mediaRoot() const { return mediaRoot_; }

    QAbstractItemModel* model();
    QVariantList items() const { return items_; }
    bool available() const { return open_; }
    QString search() const { return search_; }
    QString genre() const { return genre_; }
    QString collection() const { return collection_; }
    QString sortBy() const { return sortBy_; }
    QString viewMode() const { return viewMode_; }
    qint64 platformId() const { return platformId_; }
    bool includeMissingCovers() const { return includeMissingCovers_; }
    int page() const { return page_; }
    int pageSize() const { return pageSize_; }
    qint64 total() const { return total_; }
    qint64 filtered() const { return filtered_; }
    qint64 favoritesCount() const { return counts_.collections.favorites; }
    qint64 playingCount() const { return counts_.collections.playing; }
    qint64 completedCount() const { return counts_.collections.completed; }
    qint64 mostPlayedCount() const { return counts_.collections.mostPlayed; }
    qint64 totalLaunches() const { return launchStats_.totalLaunches; }
    qint64 playedGames() const { return launchStats_.playedGames; }
    qint64 coverTotal() const { return coverStats_.total; }
    qint64 coverDownloaded() const { return coverStats_.downloaded; }
    qint64 coverMissing() const { return coverStats_.missing; }
    qint64 coverSyncable() const { return coverStats_.syncable; }
    qint64 coverMetadataSyncable() const { return coverStats_.metadataSyncable; }
    QVariantMap platformCounts() const;
    QString error() const { return error_; }
    QStringList genres() const { return genres_; }

public slots:
    void setSearch(const QString& value);
    void setGenre(const QString& value);
    void setCollection(const QString& value);
    void setSortBy(const QString& value);
    void setViewMode(const QString& value);
    void setPlatformId(qint64 value);
    void setIncludeMissingCovers(bool value);
    void setPageSize(int value);
    void goToPage(int value);
    /** Recarrega página, contadores, gêneros, estatísticas e plataformas. */
    void refresh();
    /** Carrega somente agregados adiados na abertura, sem repetir a consulta da página. */
    void loadAggregates();

    /** Retorna o jogo completo com `coverUrl`, ou mapa vazio em erro. */
    QVariantMap get(qint64 id);
    /** Cria e retorna o jogo persistido; mapa vazio indica validação/erro. */
    QVariantMap create(const QVariantMap& input);
    /** Atualiza apenas as chaves presentes; retorna falso em validação/erro. */
    bool update(qint64 id, const QVariantMap& changes);
    /** Exclui o jogo e recarrega a página atual. */
    bool remove(qint64 id);
    /** Lista arquivos de mídia do diretório autorizado, excluindo a capa principal. */
    QVariantList listMedia(qint64 id);
    /** Converte caminho local no identificador do provider de mídia. */
    QString mediaUrl(const QString& path) const;
    /** Exporta somente imagem válida do perfil para o destino escolhido no diálogo nativo. */
    QVariantMap saveImage(const QString& sourcePath, const QUrl& destination);
    /** Copia a capa escolhida pelo usuário para o perfil, sem expor arquivos externos ao provider. */
    QVariantMap importImage(const QUrl& source);
    /** Decodifica URLs locais sem perder espaços, acentos ou caminhos UNC. */
    QString localFilePath(const QUrl& file) const { return file.toLocalFile(); }
    /** Variantes do mesmo grupo visual, já ordenadas para o seletor. */
    QVariantList listVersions(qint64 id);
    /** Contadores agregados por coleção, iguais aos da sidebar. */
    QVariantMap collectionCounts();
    /** Estatísticas de partidas usadas em Configurações. */
    QVariantMap launchStats();
    /** Estatísticas de capas baixadas, ausentes e sincronizáveis. */
    QVariantMap coverStats();
    /** Zera o histórico de partidas e informa quantos jogos mudaram. */
    QVariantMap resetLaunchStats();

signals:
    void changed();

private:
    /** Recarrega a página e, quando necessário, os agregados da biblioteca. */
    void refreshPage(bool refreshAggregates);
    /** Caminho síncrono usado na abertura, nas mutações e nos testes. */
    void refreshPageSync(bool refreshAggregates);
    /** Enfileira uma consulta para a thread de leitura. */
    void scheduleQuery(bool refreshAggregates);
    /** Aplica a resposta mais recente e descarta gerações obsoletas. */
    void applyQueryResponse(const LibraryQueryWorker::Response& response);
    /** Executa as consultas agregadas, pulando as que não mudaram desde a última leitura. */
    bool loadAggregateQueries(QString* error);
    /** Mesmos filtros aplicados à página, à sidebar e aos contadores. */
    GameListFilters filters() const;
    /** Persiste as preferências de biblioteca no formato do renderer legado. */
    void savePreferences();
    /** Acrescenta a URL do provider de mídia aos mapas expostos ao QML. */
    static void decorate(QVariantMap* game);
    WriteConnection connection_;
    GameReadDao::SidebarCounts counts_;
    GameReadDao::LaunchStats launchStats_;
    GameReadDao::CoverStats coverStats_;
    GameListModel model_;
    QVariantList items_;
    QStringList genres_;
    QString mediaRoot_;
    QString search_;
    QString genre_;
    QString collection_ = QStringLiteral("all");
    QString sortBy_ = QStringLiteral("title");
    QString viewMode_ = QStringLiteral("grid");
    bool loading_ = false;
    qint64 platformId_ = 0;
    bool includeMissingCovers_ = true;
    int page_ = 1;
    int pageSize_ = 36;
    qint64 total_ = 0;
    qint64 filtered_ = 0;
    QString error_;
    bool open_ = false;
    // Agregados que não dependem dos filtros só são recalculados após mutações.
    bool genresDirty_ = true;
    bool launchStatsDirty_ = true;
    bool coverStatsDirty_ = true;
    // Consulta assíncrona: worker com conexão própria, geração e flag do último pedido.
    QThread queryThread_;
    LibraryQueryWorker* queryWorker_ = nullptr;
    QString databasePath_;
    bool asyncQueries_ = false;
    quint64 queryGeneration_ = 0;
    bool pendingAggregates_ = true;
};
} // namespace gamestock
