/** Verifica CRUD de jogos, validação e contadores contra o contrato do Electron. */
#include "db/Database.h"
#include "db/dao/GameReadDao.h"
#include "db/dao/GameWriteDao.h"

#include <QSqlQuery>
#include <QTemporaryDir>
#include <QtTest>

namespace {
/** O catálogo de seeds é a fonte estável de plataformas para os testes. */
qint64 platformId(QSqlDatabase& database, const QString& name) {
    QSqlQuery query(database);
    query.prepare(QStringLiteral("SELECT id FROM platforms WHERE name = ?"));
    query.bindValue(0, name);
    if (!query.exec() || !query.next()) return 0;
    return query.value(0).toLongLong();
}
} // namespace

/** CRUD e consultas de jogos sobre um banco temporário criado pelo próprio runtime. */
class GameWriteDaoTest : public QObject {
    Q_OBJECT
private slots:
    /** Criação aplica defaults, valida campos e deriva a chave de agrupamento. */
    void createAndValidate() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        gamestock::Database database;
        QString error;
        QVERIFY2(database.open(dir.filePath("db/gamestock.db"), dir.filePath("db/images"), &error), qPrintable(error));
        const qint64 platform = platformId(database.handle(), QStringLiteral("Super Nintendo"));
        QVERIFY(platform > 0);
        gamestock::GameWriteDao dao(database.handle());
        gamestock::GameReadDao read(database.handle());

        qint64 id = 0;
        QVERIFY2(dao.create({{"title", "  Jogo Teste  "}, {"platform_id", platform}}, &id, &error), qPrintable(error));
        QVERIFY(id > 0);
        QVariantMap game;
        QVERIFY2(read.get(id, &game, &error), qPrintable(error));
        QCOMPARE(game.value("title").toString(), QString("Jogo Teste"));
        QCOMPARE(game.value("platform_name").toString(), QString("Super Nintendo"));
        QCOMPARE(game.value("play_status").toString(), QString("unplayed"));
        QCOMPARE(game.value("favorite").toBool(), false);
        QCOMPARE(game.value("launch_count").toInt(), 0);
        QCOMPARE(game.value("library_group_key").isNull(), true);

        // Sem título ou sem plataforma o serviço recusa antes do SQLite.
        QVERIFY(!dao.create({{"title", "   "}, {"platform_id", platform}}, &id, &error));
        QVERIFY(error.contains(QStringLiteral("Título")));
        QVERIFY(!dao.create({{"title", "Sem plataforma"}}, &id, &error));
        QVERIFY(error.contains(QStringLiteral("Plataforma")));
        // A foreign key continua ativa para IDs inexistentes.
        QVERIFY(!dao.create({{"title", "Plataforma fantasma"}, {"platform_id", 999999}}, &id, &error));
        QVERIFY(!error.isEmpty());

        // Com ROM, a chave de agrupamento é derivada do título-base.
        qint64 variant = 0;
        QVERIFY2(dao.create({{"title", "Jogo Teste"}, {"platform_id", platform},
            {"rom_path", "C:/roms/Jogo Teste (USA).nes"}}, &variant, &error), qPrintable(error));
        QVERIFY(read.get(variant, &game, &error));
        QCOMPARE(game.value("library_group_key").toString(), QString("jogo teste"));
    }

    /** Atualização parcial recalcula agrupamento e rejeita campos desconhecidos. */
    void updateRules() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        gamestock::Database database;
        QString error;
        QVERIFY2(database.open(dir.filePath("db/gamestock.db"), dir.filePath("db/images"), &error), qPrintable(error));
        const qint64 platform = platformId(database.handle(), QStringLiteral("Sega Mega Drive"));
        QVERIFY(platform > 0);
        gamestock::GameWriteDao dao(database.handle());
        gamestock::GameReadDao read(database.handle());

        qint64 id = 0;
        QVERIFY(dao.create({{"title", "Antigo"}, {"platform_id", platform}, {"rom_path", "C:/roms/Antigo.smd"}}, &id, &error));
        QVERIFY2(dao.update(id, {{"title", "Novo"}, {"favorite", true}}, &error), qPrintable(error));
        QVariantMap game;
        QVERIFY(read.get(id, &game, &error));
        QCOMPARE(game.value("title").toString(), QString("Novo"));
        QCOMPARE(game.value("favorite").toBool(), true);
        // A chave acompanha o título; a ROM não mudou.
        QCOMPARE(game.value("library_group_key").toString(), QString("novo"));

        QVERIFY(!dao.update(id, {{"sql", "DROP TABLE games"}}, &error));
        QVERIFY(error.contains(QStringLiteral("Campo não editável")));
        QVERIFY(!dao.update(999999, {{"title", "Nada"}}, &error));
        QVERIFY(error.contains(QStringLiteral("não encontrado")));
        // Sem alterações, o registro existente continua válido.
        QVERIFY2(dao.update(id, {}, &error), qPrintable(error));
    }

    /** Contadores por coleção e contagem de partidas acompanham as transições. */
    void countsAndLaunch() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        gamestock::Database database;
        QString error;
        QVERIFY2(database.open(dir.filePath("db/gamestock.db"), dir.filePath("db/images"), &error), qPrintable(error));
        const qint64 platform = platformId(database.handle(), QStringLiteral("Nintendo NES"));
        QVERIFY(platform > 0);
        gamestock::GameWriteDao dao(database.handle());
        gamestock::GameReadDao read(database.handle());

        qint64 first = 0;
        qint64 second = 0;
        QVERIFY(dao.create({{"title", "Favorito"}, {"platform_id", platform}, {"favorite", true},
            {"play_status", "playing"}}, &first, &error));
        QVERIFY(dao.create({{"title", "Concluído"}, {"platform_id", platform},
            {"play_status", "completed"}}, &second, &error));
        gamestock::GameReadDao::CollectionCounts counts;
        QVERIFY2(read.collectionCounts(&counts, &error), qPrintable(error));
        QCOMPARE(counts.favorites, static_cast<qint64>(1));
        QCOMPARE(counts.playing, static_cast<qint64>(1));
        QCOMPARE(counts.completed, static_cast<qint64>(1));
        QCOMPARE(counts.mostPlayed, static_cast<qint64>(0));

        QVERIFY2(dao.incrementLaunchCount(second, &error), qPrintable(error));
        QVERIFY2(read.collectionCounts(&counts, &error), qPrintable(error));
        QCOMPARE(counts.mostPlayed, static_cast<qint64>(1));
        QVariantMap game;
        QVERIFY(read.get(second, &game, &error));
        QCOMPARE(game.value("launch_count").toInt(), 1);
        QVERIFY(!dao.incrementLaunchCount(999999, &error));

        gamestock::GameReadDao::LaunchStats launches;
        QVERIFY2(read.launchStats(&launches, &error), qPrintable(error));
        QCOMPARE(launches.totalLaunches, static_cast<qint64>(1));
        QCOMPARE(launches.playedGames, static_cast<qint64>(1));
        qint64 updated = 0;
        QVERIFY2(dao.resetLaunchCounts(&updated, &error), qPrintable(error));
        QCOMPARE(updated, static_cast<qint64>(1));
        QVERIFY2(read.launchStats(&launches, &error), qPrintable(error));
        QCOMPARE(launches.totalLaunches, static_cast<qint64>(0));

        // Estatísticas de capa separam total, baixadas, sincronizáveis e metadados.
        qint64 third = 0;
        QVERIFY(dao.create({{"title", "Com capa"}, {"platform_id", platform},
            {"box_art_path", "C:/capas/capa.jpg"}, {"launchbox_id", "lb-1"}}, &third, &error));
        qint64 fourth = 0;
        QVERIFY(dao.create({{"title", "Sem capa"}, {"platform_id", platform}, {"launchbox_id", "lb-2"}}, &fourth, &error));
        gamestock::GameReadDao::CoverStats covers;
        QVERIFY2(read.coverStats(&covers, &error), qPrintable(error));
        QCOMPARE(covers.total, static_cast<qint64>(4));
        QCOMPARE(covers.downloaded, static_cast<qint64>(1));
        QCOMPARE(covers.missing, static_cast<qint64>(3));
        QCOMPARE(covers.syncable, static_cast<qint64>(1));
        QCOMPARE(covers.metadataSyncable, static_cast<qint64>(2));

        // Exclusão é definitiva e não falha para ID ausente, como no DAO legado.
        QVERIFY2(dao.remove(first, &error), qPrintable(error));
        QVERIFY(!read.get(first, &game, &error));
        QVERIFY2(dao.remove(first, &error), qPrintable(error));
    }
};

QTEST_GUILESS_MAIN(GameWriteDaoTest)
#include "GameWriteDaoTest.moc"
