/** Consulta paginada inicial da biblioteca, sem modificar o banco legado. */
#pragma once
#include <QSqlDatabase>
#include <QString>
#include <QStringList>
#include <QVariantMap>
#include <QList>

namespace gamestock {
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
    /** Lista por título com variantes agrupadas, retornando falso e erro em falhas SQL. */
    bool list(int page, int pageSize, GamePage* result, QString* error, const GameListFilters& filters = {}) const;
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
    bool sidebarCounts(const GameListFilters& filters, SidebarCounts* result, QString* error) const;
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
}
