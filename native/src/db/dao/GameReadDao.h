/** Consulta paginada inicial da biblioteca, sem modificar o banco legado. */
#pragma once
#include <QHash>
#include <QSqlDatabase>
#include <QString>
#include <QStringList>
#include <QVariantMap>
#include <QList>

namespace gamestock {
class GameCountCache;

/** Página de representantes visuais e contagem de grupos. */
struct GamePage {
    QList<QVariantMap> items;
    qint64 total = 0;
    qint64 filtered = 0;
};

/** Filtros da listagem de biblioteca. */
struct GameListFilters {
    qint64 platformId = 0;
    QString search;
    QString genre;
    QString collection;
    QString sortBy;
    bool includeMissingCovers = true;
};

/** Encapsula SQL de leitura de jogos; a conexão continua pertencendo ao chamador. */
class GameReadDao final {
public:
    /** Usa uma conexão viva da mesma thread e não assume posse dela. */
    explicit GameReadDao(QSqlDatabase& database);
    /** Lista por título com variantes agrupadas, retornando falso e erro em falhas SQL.
     *  O cache opcional evita repetir as contagens quando os filtros e a geração não mudaram. */
    bool list(int page, int pageSize, GamePage* result, QString* error, const GameListFilters& filters = {},
        GameCountCache* cache = nullptr) const;
    /** Divide os gêneros compostos em opções únicas para o filtro da biblioteca. */
    bool listGenres(QStringList* result, QString* error) const;
    /** Retorna o jogo completo (com nome da plataforma) ou falso quando não existe. */
    bool get(qint64 id, QVariantMap* result, QString* error) const;
    /** Contadores por coleção, iguais aos da sidebar do Electron. */
    struct CollectionCounts {
        qint64 favorites = 0;
        qint64 playing = 0;
        qint64 completed = 0;
        qint64 mostPlayed = 0;
    };
    bool collectionCounts(CollectionCounts* result, QString* error) const;
    /** Contadores da sidebar: coleções e plataformas, com filtros cruzados. */
    struct SidebarCounts {
        qint64 all = 0;
        CollectionCounts collections;
        QMap<qint64, qint64> platforms;
    };
    /** `cache` opcional reutiliza os contadores enquanto os filtros e a geração forem os mesmos. */
    bool sidebarCounts(const GameListFilters& filters, SidebarCounts* result, QString* error,
        GameCountCache* cache = nullptr) const;
    /** Variantes do mesmo grupo visual, prontas para o seletor de versões. */
    bool listVersions(qint64 id, QList<QVariantMap>* result, QString* error) const;
    /** Estatísticas de partidas exibidas em Configurações. */
    struct LaunchStats {
        qint64 totalLaunches = 0;
        qint64 playedGames = 0;
    };
    bool launchStats(LaunchStats* result, QString* error) const;
    /** Estatísticas de capas usadas pela tela de mídia. */
    struct CoverStats {
        qint64 total = 0;
        qint64 downloaded = 0;
        qint64 missing = 0;
        qint64 syncable = 0;
        qint64 metadataSyncable = 0;
    };
    bool coverStats(CoverStats* result, QString* error) const;
    /** Jogos vinculados ao LaunchBox usados pela sincronização de mídia. */
    struct LinkedGame {
        qint64 id = 0;
        QString title;
        QString platformName;
        QString launchboxId;
        QString boxArtPath;
        QString screenshotPath;
        QString backgroundPath;
    };
    bool listLinkedGames(QList<LinkedGame>* result, QString* error) const;
private:
    QSqlDatabase& database_;
};

/**
 * Contagens reutilizáveis da biblioteca para uma geração de dados.
 * Fica fora do DAO porque a UI alterna entre páginas/filtros usando a mesma instância;
 * a geração é incrementada pelo serviço sempre que escritas podem alterar os totais.
 * Não é segura entre threads: cada worker/conexão mantém a própria instância.
 */
class GameCountCache final {
public:
    using SidebarCounts = GameReadDao::SidebarCounts;

    /** Descarta tudo quando a geração de dados muda; a mesma geração mantém o cache. */
    void setGeneration(quint64 generation);
    quint64 generation() const { return generation_; }
    /** Esvazia as entradas sem alterar a geração atual. */
    void clear();

    bool total(qint64* value) const;
    void storeTotal(qint64 value);
    bool filtered(const QString& key, qint64* value) const;
    void storeFiltered(const QString& key, qint64 value);
    bool sidebar(const QString& key, SidebarCounts* value) const;
    void storeSidebar(const QString& key, const SidebarCounts& value);

    /** Chave estável dos filtros que alteram contagens; página e ordenação não entram. */
    static QString filterKey(const GameListFilters& filters);

private:
    quint64 generation_ = 0;
    bool hasTotal_ = false;
    qint64 total_ = 0;
    QHash<QString, qint64> filtered_;
    QHash<QString, SidebarCounts> sidebar_;
};
} // namespace gamestock
