/** Confere paginação e agrupamento sem depender do perfil do usuário. */
#include "db/dao/GameReadDao.h"
#include "db/ReadOnlyConnection.h"
#include <QSqlQuery>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QtTest>

/** Exercita registros manuais, variantes e chaves legadas vazias. */
class GameReadDaoTest : public QObject {
    Q_OBJECT
private slots:
    /** Bancos antigos sem title_normalized também preservam as variantes Unicode. */
    void legacyVersionsWithoutNormalizedTitle() {
        {
            QSqlDatabase db = QSqlDatabase::addDatabase("QSQLITE", "legacy-versions");
            db.setDatabaseName(":memory:");
            QVERIFY(db.open());
            QSqlQuery query(db);
            QVERIFY(query.exec("CREATE TABLE platforms (id INTEGER PRIMARY KEY, name TEXT)"));
            QVERIFY(query.exec("CREATE TABLE games (id INTEGER PRIMARY KEY, title TEXT, platform_id INTEGER, rom_path TEXT, launch_count INTEGER, box_art_path TEXT, background_path TEXT, screenshot_path TEXT)"));
            QVERIFY(query.exec("INSERT INTO platforms VALUES (1, 'Console')"));
            QVERIFY(query.prepare("INSERT INTO games (id, title, platform_id, rom_path, launch_count) VALUES (?, ?, 1, ?, 0)"));
            query.addBindValue(1); query.addBindValue(QString::fromUtf8("\xc3\x87\xc3\x89U")); query.addBindValue("C:/roms/Jogo (USA).rom");
            QVERIFY(query.exec());
            query.bindValue(0, 2); query.bindValue(1, QString::fromUtf8("\xc3\xa7\xc3\xa9u")); query.bindValue(2, "C:/roms/Jogo (Europe).rom");
            QVERIFY(query.exec());
            gamestock::GameReadDao dao(db);
            QList<QVariantMap> versions;
            QString error;
            QVERIFY2(dao.listVersions(1, &versions, &error), qPrintable(error));
            QCOMPARE(versions.size(), 2);
        }
        QSqlDatabase::removeDatabase("legacy-versions");
    }

    /** A paginação escolhe um representante estável antes de aplicar limite. */
    void groupedPages() {
        {
            QSqlDatabase db = QSqlDatabase::addDatabase("QSQLITE", "game-dao-test");
            db.setDatabaseName(":memory:");
            QVERIFY(db.open());
            QSqlQuery query(db);
            QVERIFY(query.exec("CREATE TABLE platforms (id INTEGER PRIMARY KEY, name TEXT)"));
            QVERIFY(query.exec("CREATE TABLE games (id INTEGER PRIMARY KEY, title TEXT, title_normalized TEXT, platform_id INTEGER, rom_path TEXT, library_group_key TEXT, year INTEGER, created_at TEXT, launch_count INTEGER DEFAULT 0, favorite INTEGER DEFAULT 0, play_status TEXT DEFAULT 'unplayed', box_art_path TEXT, genre TEXT)"));
            QVERIFY(query.exec("INSERT INTO platforms VALUES (1, 'Console'), (2, 'Outro')"));
            QVERIFY(query.exec("INSERT INTO games (id,title,platform_id,rom_path,library_group_key) VALUES (1,'Alpha',1,'a.rom','alpha'), (2,'Alpha',1,'b.rom','alpha'), (3,'Beta',1,NULL,NULL), (4,'Beta',1,NULL,NULL), (5,'Gamma',1,'g.rom',NULL), (6,'Gamma',1,'h.rom',NULL), (7,'Alpha',2,'x.rom','alpha')"));
            // A busca usa a coluna derivada; o teste minimalista a preenche como o DAO de escrita faria.
            QVERIFY(query.exec("UPDATE games SET title_normalized = lower(title)"));
            QVERIFY(query.exec("UPDATE games SET favorite=1, box_art_path='capa', year=2000 WHERE id IN (2,3)"));
            QVERIFY(query.exec("UPDATE games SET genre='Ação; Plataforma / RPG' WHERE id IN (2,3)"));
            gamestock::GameReadDao dao(db);
            gamestock::GamePage first, second;
            QString error;
            QVERIFY2(dao.list(1, 2, &first, &error), qPrintable(error));
            QCOMPARE(first.total, 6);
            QCOMPARE(first.items.size(), 2);
            QCOMPARE(first.items[0].value("id").toInt(), 1);
            QCOMPARE(first.items[1].value("id").toInt(), 7);
            QVERIFY2(dao.list(2, 2, &second, &error), qPrintable(error));
            QCOMPARE(second.total, 6);
            QCOMPARE(second.items[0].value("id").toInt(), 3);
            QCOMPARE(second.items[1].value("id").toInt(), 4);
            gamestock::GameListFilters filters;
            filters.platformId = 1; filters.collection = "favorites"; filters.search = "a"; filters.includeMissingCovers = false; filters.sortBy = "year";
            QVERIFY2(dao.list(1, 10, &second, &error, filters), qPrintable(error));
            QCOMPARE(second.total, 6);
            QCOMPARE(second.filtered, 2);
            QCOMPARE(second.items.size(), 2);
            QCOMPARE(second.items[0].value("id").toInt(), 2);
            QCOMPARE(second.items[1].value("id").toInt(), 3);
            filters.genre = " AÇÃO ";
            QVERIFY2(dao.list(1, 10, &second, &error, filters), qPrintable(error));
            QCOMPARE(second.filtered, 2);
            filters.genre = "aç";
            QVERIFY2(dao.list(1, 10, &second, &error, filters), qPrintable(error));
            QCOMPARE(second.filtered, 0);
            QVERIFY(!dao.list(0, 2, &second, &error));
            QVERIFY(!error.isEmpty());
        }
        QSqlDatabase::removeDatabase("game-dao-test");
    }
    /** Contadores da sidebar contam grupos, não variantes, e usam filtros cruzados. */
    void sidebarCountsVariants() {
        {
            QSqlDatabase db = QSqlDatabase::addDatabase("QSQLITE", "sidebar-counts-test");
            db.setDatabaseName(":memory:");
            QVERIFY(db.open());
            QSqlQuery query(db);
            QVERIFY(query.exec("CREATE TABLE platforms (id INTEGER PRIMARY KEY, name TEXT)"));
            QVERIFY(query.exec("CREATE TABLE games (id INTEGER PRIMARY KEY, title TEXT, title_normalized TEXT, platform_id INTEGER, "
                "rom_path TEXT, library_group_key TEXT, genre TEXT, favorite INTEGER DEFAULT 0, "
                "play_status TEXT DEFAULT 'unplayed', launch_count INTEGER DEFAULT 0, box_art_path TEXT)"));
            QVERIFY(query.exec("INSERT INTO platforms VALUES (1, 'Console'), (2, 'Portátil')"));
            // Duas variantes do mesmo grupo: cada coleção conta o grupo uma vez (MAX).
            QVERIFY(query.exec("INSERT INTO games (id,title,platform_id,rom_path,library_group_key,favorite,play_status,launch_count) VALUES "
                "(1,'Aventura',1,'a.rom','aventura',1,'unplayed',3),"
                "(2,'Aventura',1,'b.rom','aventura',0,'completed',0),"
                "(3,'Manual',1,NULL,NULL,0,'unplayed',0),"
                "(4,'Portátil',2,'c.rom','portatil',1,'playing',0)"));
            gamestock::GameReadDao dao(db);
            gamestock::GameReadDao::SidebarCounts counts;
            QString error;
            QVERIFY2(dao.sidebarCounts({}, &counts, &error), qPrintable(error));
            QCOMPARE(counts.all, static_cast<qint64>(3));
            QCOMPARE(counts.collections.favorites, static_cast<qint64>(2));
            QCOMPARE(counts.collections.completed, static_cast<qint64>(1));
            QCOMPARE(counts.collections.mostPlayed, static_cast<qint64>(1));
            QCOMPARE(counts.collections.playing, static_cast<qint64>(1));
            QCOMPARE(counts.platforms.value(1), static_cast<qint64>(2));
            QCOMPARE(counts.platforms.value(2), static_cast<qint64>(1));

            // A coleção selecionada não reduz o total nem os outros contadores.
            gamestock::GameListFilters filters;
            filters.collection = "favorites";
            QVERIFY2(dao.sidebarCounts(filters, &counts, &error), qPrintable(error));
            QCOMPARE(counts.all, static_cast<qint64>(3));
            QCOMPARE(counts.collections.favorites, static_cast<qint64>(2));
            // O menu de plataformas acompanha a coleção ativa.
            QCOMPARE(counts.platforms.value(1), static_cast<qint64>(1));
            QCOMPARE(counts.platforms.value(2), static_cast<qint64>(1));

            // A plataforma selecionada filtra os contadores, mas não o menu de plataformas.
            filters = {};
            filters.platformId = 1;
            QVERIFY2(dao.sidebarCounts(filters, &counts, &error), qPrintable(error));
            QCOMPARE(counts.all, static_cast<qint64>(2));
            QCOMPARE(counts.collections.favorites, static_cast<qint64>(1));
            QCOMPARE(counts.platforms.value(1), static_cast<qint64>(2));
            QCOMPARE(counts.platforms.value(2), static_cast<qint64>(1));

            // Gênero usa a mesma normalização da listagem, inclusive delimitadores compostos.
            filters = {};
            filters.genre = "ação";
            QVERIFY2(dao.sidebarCounts(filters, &counts, &error), qPrintable(error));
            QCOMPARE(counts.all, static_cast<qint64>(0));
        }
        QSqlDatabase::removeDatabase("sidebar-counts-test");
    }

    /** Seletor de versões agrupa pela chave visual, rotula região/tipo e ordena por partidas. */
    void versionsByGroupKey() {
        {
            QSqlDatabase db = QSqlDatabase::addDatabase("QSQLITE", "versions-test");
            db.setDatabaseName(":memory:");
            QVERIFY(db.open());
            QSqlQuery query(db);
            QVERIFY(query.exec("CREATE TABLE platforms (id INTEGER PRIMARY KEY, name TEXT)"));
            QVERIFY(query.exec("CREATE TABLE games (id INTEGER PRIMARY KEY, title TEXT, title_normalized TEXT, platform_id INTEGER, "
                "rom_path TEXT, library_group_key TEXT, favorite INTEGER DEFAULT 0, play_status TEXT DEFAULT 'unplayed', "
                "launch_count INTEGER DEFAULT 0, box_art_path TEXT, background_path TEXT, screenshot_path TEXT)"));
            QVERIFY(query.exec("INSERT INTO platforms VALUES (1, 'Console')"));
            QVERIFY(query.exec("INSERT INTO games (id,title,platform_id,rom_path,launch_count) VALUES "
                "(10,'Aventura Legada',1,'C:/roms/Aventura (USA).nes',5),"
                "(11,'Aventura Legada',1,'C:/roms/Aventura (Japan).nes',2),"
                "(12,'Aventura Legada',1,'C:/roms/Aventura (Europe).nes',9),"
                "(13,'Outro Jogo',1,'C:/roms/Outro.sfc',0),"
                "(14,'Sem ROM',1,NULL,0)"));
            QVERIFY(query.exec("UPDATE games SET title_normalized = lower(title)"));
            gamestock::GameReadDao dao(db);
            QList<QVariantMap> versions;
            QString error;
            QVERIFY2(dao.listVersions(10, &versions, &error), qPrintable(error));
            QCOMPARE(versions.size(), 3);
            // Ordenação: mais jogado primeiro; romFileName desempata.
            QCOMPARE(versions[0].value("id").toInt(), 12);
            QCOMPARE(versions[0].value("regionLabel").toString(), QString("EUR"));
            QCOMPARE(versions[1].value("id").toInt(), 10);
            QCOMPARE(versions[2].value("id").toInt(), 11);
            QCOMPARE(versions[0].value("baseTitle").toString(), QString("Aventura Legada"));
            QCOMPARE(versions[1].value("variantLabel").toString(), QString("USA"));
            QCOMPARE(versions[1].value("platformName").toString(), QString("Console"));
            // Jogo sem ROM cai no fallback com ele mesmo.
            QVERIFY2(dao.listVersions(14, &versions, &error), qPrintable(error));
            QCOMPARE(versions.size(), 1);
            QCOMPARE(versions[0].value("variantLabel").toString(), QString("Versão padrão"));
            // ID inexistente não é erro, apenas lista vazia.
            QVERIFY2(dao.listVersions(999999, &versions, &error), qPrintable(error));
            QVERIFY(versions.isEmpty());
        }
        QSqlDatabase::removeDatabase("versions-test");
    }

    /** Compara a contagem e páginas com a massa sintética medida pelo Electron. */
    void electronFixture() {        const QString path = qEnvironmentVariable("GAMESTOCK_TEST_DATABASE");
        if (path.isEmpty()) QSKIP("Fixture de benchmark não informada.");
        gamestock::ReadOnlyConnection connection;
        QString error;
        QVERIFY2(connection.open(path, &error), qPrintable(error));
        gamestock::GameReadDao dao(connection.database());
        gamestock::GamePage first, tenth;
        QVERIFY2(dao.list(1, 36, &first, &error), qPrintable(error));
        QVERIFY2(dao.list(10, 36, &tenth, &error), qPrintable(error));
        QCOMPARE(first.total, 2502);
        QCOMPARE(tenth.total, 2502);
        QCOMPARE(first.items.size(), 36);
        QCOMPARE(tenth.items.size(), 36);
        QCOMPARE(first.items[0].value("title").toString(), QString("Aventura Legada"));
        const QString referencePath = qEnvironmentVariable("GAMESTOCK_TEST_REFERENCE");
        if (referencePath.isEmpty()) return;
        QFile reference(referencePath);
        QVERIFY(reference.open(QIODevice::ReadOnly));
        const QJsonObject baseline = QJsonDocument::fromJson(reference.readAll()).object();
        const QJsonArray samples = baseline.value("pagination").toArray();
        QCOMPARE(samples.size(), 8);
        QStringList genres;
        QVERIFY2(dao.listGenres(&genres, &error), qPrintable(error));
        const QJsonArray expectedGenres = baseline.value("genres").toArray();
        QCOMPARE(genres.size(), expectedGenres.size());
        for (qsizetype index = 0; index < expectedGenres.size(); ++index) QCOMPARE(genres[index], expectedGenres[index].toString());
        // Compara IDs e contagens obtidos pela API Electron, não só a implementação da consulta nativa.
        for (const auto& sampleValue : samples) {
            const QJsonObject sample = sampleValue.toObject();
            const QJsonObject input = sample.value("filters").toObject();
            gamestock::GameListFilters filters;
            filters.search = input.value("search").toString();
            filters.genre = input.value("genre").toString();
            filters.collection = input.value("collectionFilter").toString();
            filters.sortBy = input.value("sortBy").toString();
            gamestock::GamePage actual;
            QVERIFY2(dao.list(input.value("page").toInt(), 36, &actual, &error, filters), qPrintable(error));
            QCOMPARE(actual.total, static_cast<qint64>(sample.value("total").toInt()));
            QCOMPARE(actual.filtered, static_cast<qint64>(sample.value("filtered").toInt()));
            const QJsonArray ids = sample.value("ids").toArray();
            QCOMPARE(actual.items.size(), ids.size());
            for (qsizetype index = 0; index < ids.size(); ++index)
                QCOMPARE(actual.items[index].value("id").toInt(), ids[index].toInt());
        }
    }
};
QTEST_GUILESS_MAIN(GameReadDaoTest)
#include "GameReadDaoTest.moc"
