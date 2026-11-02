/** Sincronização de mídia LaunchBox: índice, download, atualização e job persistido. */
#include "db/Database.h"
#include "db/JobStateStore.h"
#include "db/WriteConnection.h"
#include "db/dao/AppStateReadDao.h"
#include "db/dao/GameWriteDao.h"
#include "db/dao/PlatformDao.h"
#include "jobs/JobManager.h"
#include "jobs/JobRegistry.h"
#include "services/MediaSyncService.h"
#include "HttpTestServer.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonObject>
#include <QProcess>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QtTest>

namespace {
const char* sampleXml = R"(<?xml version="1.0" encoding="utf-8"?>
<LaunchBox>
  <Game>
    <DatabaseID>10</DatabaseID><Name>Game One</Name><Platform>Sega Mega Drive</Platform>
    <ReleaseDate>1994-08-01T00:00:00-05:00</ReleaseDate>
    <Publisher>Pub</Publisher><Genres>Action</Genres><Overview>Overview</Overview>
  </Game>
  <GameImage><DatabaseID>10</DatabaseID><FileName>box.png</FileName><Type>Box - Front</Type><Region>Brazil</Region></GameImage>
</LaunchBox>
)";

/** Cria o Metadata.zip real usando o 7-Zip do ambiente de teste. */
QByteArray metadataZip(const QString& directory) {
    QFile source(QDir(directory).filePath(QStringLiteral("Metadata.xml")));
    if (!source.open(QIODevice::WriteOnly | QIODevice::Truncate)) return {};
    source.write(sampleXml);
    source.close();
    const QString archive = QDir(directory).filePath(QStringLiteral("Metadata.zip"));
    QProcess process;
    process.setWorkingDirectory(directory);
    process.setProgram(qEnvironmentVariable("GAMESTOCK_7Z_PATH"));
    process.setArguments({QStringLiteral("a"), archive, QStringLiteral("Metadata.xml")});
    process.start();
    if (!process.waitForFinished(30000)) return {};
    QFile zip(archive);
    if (!zip.open(QIODevice::ReadOnly)) return {};
    return zip.readAll();
}

/** PNG 1x1 válido para o preview não ser descartado. */
QByteArray tinyPng() {
    return QByteArray::fromBase64(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
}

qint64 platformId(QSqlDatabase& database, const QString& name) {
    QSqlQuery query(database);
    query.prepare(QStringLiteral("SELECT id FROM platforms WHERE name = ?"));
    query.bindValue(0, name);
    if (!query.exec() || !query.next()) return 0;
    return query.value(0).toLongLong();
}
} // namespace

/** Cobre o job de mídia com servidor local determinístico. */
class MediaSyncTest : public QObject {
    Q_OBJECT
private slots:
    /** Baixa capa ausente, atualiza metadados e persiste o resumo do job. */
    void syncDownloadsMissingCoverAndUpdatesMetadata() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString databasePath = dir.filePath(QStringLiteral("db/gamestock.db"));
        const QString cacheDir = dir.filePath(QStringLiteral("cache"));
        const QString imagesDir = dir.filePath(QStringLiteral("images"));
        qint64 megaDrive = 0;
        qint64 gameId = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(databasePath, dir.filePath(QStringLiteral("db/images")), &error),
                qPrintable(error));
            megaDrive = platformId(database.handle(), QStringLiteral("Sega Mega Drive"));
            QVERIFY(megaDrive > 0);
            gamestock::GameWriteDao games(database.handle());
            QVERIFY2(games.create({{QStringLiteral("title"), QStringLiteral("Old Title")},
                {QStringLiteral("platform_id"), megaDrive},
                {QStringLiteral("launchbox_id"), QStringLiteral("10")}}, &gameId, &error),
                qPrintable(error));
        }

        const QByteArray zip = metadataZip(dir.path());
        QVERIFY(!zip.isEmpty());
        HttpTestServer server;
        QVERIFY(server.listen());
        server.add(QStringLiteral("/Metadata.zip"), zip);
        server.add(QStringLiteral("/box.png"), tinyPng());

        gamestock::MediaSyncService service;
        QString error;
        QVERIFY2(service.open(databasePath, cacheDir, imagesDir, &error), qPrintable(error));
        service.setMetadataUrl(server.baseUrl() + QStringLiteral("/Metadata.zip"));
        service.setImagesBaseUrl(server.baseUrl() + QStringLiteral("/"));

        gamestock::WriteConnection jobDatabase;
        QVERIFY2(jobDatabase.open(databasePath, &error), qPrintable(error));
        gamestock::JobStateStore store(jobDatabase.database(),
            QStringLiteral("gamestock.media.lastMediaSyncJobs"));
        gamestock::JobRegistry registry([&store](const QJsonArray& jobs, QString* persistError) {
            return store.persist(jobs, persistError);
        });
        gamestock::JobManager manager(&registry);
        service.setJobManager(&manager);

        const QVariantMap job = service.startSync(false);
        QVERIFY2(!job.isEmpty(), qPrintable(service.error()));
        const QString jobId = job.value(QStringLiteral("jobId")).toString();
        QTRY_VERIFY_WITH_TIMEOUT(manager.job(jobId).value(QStringLiteral("status")).toString()
            == QStringLiteral("completed"), 30000);
        const QVariantMap result = manager.job(jobId).value(QStringLiteral("result")).toMap();
        QCOMPARE(result.value(QStringLiteral("attempted")).toLongLong(), qint64(1));
        QCOMPARE(result.value(QStringLiteral("downloadedNow")).toLongLong(), qint64(1));
        QCOMPARE(result.value(QStringLiteral("metadataUpdated")).toLongLong(), qint64(1));
        QCOMPARE(server.requests(QStringLiteral("/box.png")), 1);

        QSqlQuery query(jobDatabase.database());
        QVERIFY(query.exec(QStringLiteral("SELECT title, box_art_path, publisher FROM games WHERE id = %1")
            .arg(gameId)));
        QVERIFY(query.next());
        QCOMPARE(query.value(0).toString(), QStringLiteral("Game One"));
        QCOMPARE(query.value(2).toString(), QStringLiteral("Pub"));
        const QString cover = query.value(1).toString();
        QVERIFY(!cover.isEmpty());
        QVERIFY(QFileInfo::exists(cover));
        QVERIFY(cover.contains(QStringLiteral("images")));

        const QVariantMap stats = service.stats();
        QCOMPARE(stats.value(QStringLiteral("downloaded")).toLongLong(), qint64(1));

        gamestock::AppStateReadDao reader(jobDatabase.database());
        QJsonValue persisted;
        QVERIFY2(reader.get(QStringLiteral("gamestock.media.lastMediaSyncJobs"), &persisted, &error),
            qPrintable(error));
        QVERIFY(persisted.isArray());
        QCOMPARE(persisted.toArray().size(), 1);
        QCOMPARE(persisted.toArray().first().toObject().value(QStringLiteral("status")).toString(),
            QStringLiteral("completed"));
        QVERIFY(manager.dismiss(jobId));
        QVERIFY2(reader.get(QStringLiteral("gamestock.media.lastMediaSyncJobs"), &persisted, &error),
            qPrintable(error));
        QVERIFY(persisted.isUndefined());
    }

    /** Jogo sem vínculo LaunchBox não é tentado nem apagado. */
    void syncSkipsUnlinkedGames() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString databasePath = dir.filePath(QStringLiteral("db/gamestock.db"));
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(databasePath, dir.filePath(QStringLiteral("db/images")), &error),
                qPrintable(error));
            const qint64 platform = platformId(database.handle(), QStringLiteral("Super Nintendo"));
            gamestock::GameWriteDao games(database.handle());
            qint64 id = 0;
            QVERIFY2(games.create({{QStringLiteral("title"), QStringLiteral("Manual")},
                {QStringLiteral("platform_id"), platform}}, &id, &error), qPrintable(error));
        }
        gamestock::MediaSyncService service;
        QString error;
        QVERIFY2(service.open(databasePath, dir.filePath(QStringLiteral("cache")),
            dir.filePath(QStringLiteral("images")), &error), qPrintable(error));
        QCOMPARE(service.stats().value(QStringLiteral("syncable")).toLongLong(), qint64(0));
    }
};

QTEST_MAIN(MediaSyncTest)
#include "MediaSyncTest.moc"
