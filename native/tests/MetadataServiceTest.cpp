/** Busca e importação LaunchBox com cache local e servidor determinístico. */
#include "db/Database.h"
#include "db/dao/GameWriteDao.h"
#include "db/dao/PlatformDao.h"
#include "jobs/JobManager.h"
#include "jobs/JobRegistry.h"
#include "services/MetadataService.h"
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
  <Game>
    <DatabaseID>11</DatabaseID><Name>Game Two</Name><Platform>Nintendo NES</Platform>
    <ReleaseDate>1989-01-01T00:00:00-05:00</ReleaseDate>
  </Game>
  <GameImage><DatabaseID>10</DatabaseID><FileName>box.png</FileName><Type>Box - Front</Type><Region>Brazil</Region></GameImage>
</LaunchBox>
)";

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

QByteArray tinyPng() {
    return QByteArray::fromBase64(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
}
} // namespace

/** Verifica ensure, busca filtrada por plataforma e importação com mídia. */
class MetadataServiceTest : public QObject {
    Q_OBJECT
private slots:
    void searchAndImportLaunchBoxGame() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString databasePath = dir.filePath(QStringLiteral("db/gamestock.db"));
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(databasePath, dir.filePath(QStringLiteral("db/images")), &error),
                qPrintable(error));
        }
        const QByteArray zip = metadataZip(dir.path());
        QVERIFY(!zip.isEmpty());
        HttpTestServer server;
        QVERIFY(server.listen());
        server.add(QStringLiteral("/Metadata.zip"), zip);
        server.add(QStringLiteral("/box.png"), tinyPng());

        gamestock::MetadataService service;
        QString error;
        QVERIFY2(service.open(databasePath, dir.filePath(QStringLiteral("cache")),
            dir.filePath(QStringLiteral("images")), &error), qPrintable(error));
        service.setMetadataUrl(server.baseUrl() + QStringLiteral("/Metadata.zip"));
        service.setImagesBaseUrl(server.baseUrl() + QStringLiteral("/"));
        gamestock::JobRegistry registry([](const QJsonArray&, QString* persistError) {
            if (persistError) persistError->clear();
            return true;
        });
        gamestock::JobManager manager(&registry);
        service.setJobManager(&manager);

        const QVariantMap ensure = service.ensureMetadata();
        QVERIFY2(!ensure.isEmpty(), qPrintable(service.error()));
        QTRY_VERIFY_WITH_TIMEOUT(service.metadataReady(), 30000);
        QVERIFY(!service.busy());

        // A plataforma restrita aceita o jogo correto e recusa outro sistema.
        const QVariantMap filtered = service.search(QStringLiteral("Game"), QStringLiteral("Sega Mega Drive"));
        QVERIFY2(!filtered.isEmpty(), qPrintable(service.error()));
        QTRY_VERIFY_WITH_TIMEOUT(!service.busy(), 30000);
        QCOMPARE(service.results().size(), 1);
        const QVariantMap selected = service.results().first().toMap();
        QCOMPARE(selected.value(QStringLiteral("id")).toString(), QStringLiteral("10"));

        const QVariantMap wide = service.search(QStringLiteral("Game"), QString());
        QVERIFY(!wide.isEmpty());
        QTRY_VERIFY_WITH_TIMEOUT(!service.busy(), 30000);
        QCOMPARE(service.results().size(), 2);

        const QVariantMap imported = service.importGame(selected, {QStringLiteral("Box - Front")});
        QVERIFY2(!imported.isEmpty(), qPrintable(service.error()));
        QTRY_VERIFY_WITH_TIMEOUT(!service.busy(), 30000);
        QVERIFY2(service.error().isEmpty(), qPrintable(service.error()));

        gamestock::Database inspector;
        QVERIFY2(inspector.open(databasePath, dir.filePath(QStringLiteral("db/images")), &error),
            qPrintable(error));
        QSqlQuery game(inspector.handle());
        QVERIFY(game.exec(QStringLiteral(
            "SELECT title, launchbox_id, box_art_path, platform_id FROM games WHERE launchbox_id = '10'")));
        QVERIFY(game.next());
        QCOMPARE(game.value(0).toString(), QStringLiteral("Game One"));
        QCOMPARE(game.value(1).toString(), QStringLiteral("10"));
        const QString cover = game.value(2).toString();
        QVERIFY(!cover.isEmpty());
        QVERIFY(QFileInfo::exists(cover));
        gamestock::PlatformDao platforms(inspector.handle());
        QVariantMap platform;
        QVERIFY(platforms.get(game.value(3).toLongLong(), &platform, &error));
        QCOMPARE(platform.value(QStringLiteral("name")).toString(), QStringLiteral("Sega Mega Drive"));
        QCOMPARE(server.requests(QStringLiteral("/box.png")), 1);
    }
};

QTEST_MAIN(MetadataServiceTest)
#include "MetadataServiceTest.moc"
