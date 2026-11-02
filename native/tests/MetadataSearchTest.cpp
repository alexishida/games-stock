/** Verifica busca LaunchBox, aliases, Libretro e OpenVGDB com fixtures. */
#include "HttpTestServer.h"
#include "db/Database.h"
#include "launchbox/LaunchBoxSearch.h"
#include "launchbox/LibretroClient.h"
#include "launchbox/MetadataSearch.h"
#include "launchbox/OpenVgdb.h"
#include "services/PlatformService.h"

#include <QDir>
#include <QDateTime>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QProcess>
#include <QSqlDatabase>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QVariantList>
#include <QtTest>

namespace {
QJsonObject game(const QString& id, const QString& name, const QString& platform,
    const QJsonArray& aliases = {})
{
    return QJsonObject{{QStringLiteral("id"), id}, {QStringLiteral("name"), name},
        {QStringLiteral("platform"), platform}, {QStringLiteral("alternateNames"), aliases},
        {QStringLiteral("source"), QStringLiteral("launchbox")},
        {QStringLiteral("release"), QStringLiteral("1994-01-01")},
        {QStringLiteral("images"), QJsonArray{}}};
}

/** Cria um ZIP real com um único arquivo usando o 7-Zip de teste. */
QByteArray zipFile(const QString& sourceDirectory, const QString& sourceName, const QString& zipName)
{
    const QString archive = QDir(sourceDirectory).filePath(zipName);
    QProcess process;
    process.setWorkingDirectory(sourceDirectory);
    process.setProgram(qEnvironmentVariable("GAMESTOCK_7Z_PATH"));
    process.setArguments({QStringLiteral("a"), archive, sourceName});
    process.start();
    if (!process.waitForFinished(30000)) return {};
    QFile zip(archive);
    if (!zip.open(QIODevice::ReadOnly)) return {};
    return zip.readAll();
}

/** Cria o SQLite mínimo do OpenVGDB e devolve o caminho. */
bool createOpenVgdb(const QString& path)
{
    const QString connection = QStringLiteral("openvgdb-fixture-") + QString::number(QDateTime::currentMSecsSinceEpoch());
    bool ok = false;
    {
        QSqlDatabase database = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), connection);
        database.setDatabaseName(path);
        if (!database.open()) return false;
        QSqlQuery query(database);
        ok = query.exec(QStringLiteral(
            "CREATE TABLE RELEASES (releaseID INTEGER PRIMARY KEY, releaseTitleName TEXT, TEMPsystemName TEXT, "
            "releaseDescription TEXT, releaseDeveloper TEXT, releasePublisher TEXT, releaseGenre TEXT, releaseDate TEXT)"));
        const QList<QVariantList> rows{
            {1, "Super Mario World", "Nintendo Super Nintendo Entertainment System", "desc", "dev", "pub", "Platform", "1991-08-13"},
            {2, "Super Mario World", "Nintendo Super Nintendo Entertainment System", QVariant(), QVariant(), QVariant(), QVariant(), QVariant()},
            {3, "Mario Kart", "Nintendo Super Nintendo Entertainment System", "desc", QVariant(), QVariant(), QVariant(), "1992-01-01"},
            {4, "Super Mario World", "Sega Genesis/Mega Drive", "desc", QVariant(), QVariant(), QVariant(), QVariant()},
            {5, "Mario Bros", "Nintendo Entertainment System", "desc", QVariant(), QVariant(), QVariant(), QVariant()}
        };
        if (ok) {
            ok = query.prepare(QStringLiteral("INSERT INTO RELEASES VALUES (?, ?, ?, ?, ?, ?, ?, ?)"));
            for (const QVariantList& row : rows) {
                if (!ok) break;
                for (int index = 0; index < row.size(); ++index) query.bindValue(index, row[index]);
                ok = query.exec();
            }
        }
        database.close();
    }
    QSqlDatabase::removeDatabase(connection);
    return ok;
}
} // namespace

/** Cobre busca/matching e integrações alternativas sem dados reais. */
class MetadataSearchTest : public QObject {
    Q_OBJECT
private slots:
    /** Nomes exatos (incluindo alias) vêm antes dos parciais e respeitam filtros. */
    void launchBoxSearch() {
        QJsonObject index;
        index.insert(QStringLiteral("1"), game(QStringLiteral("1"), QStringLiteral("Mario World"),
            QStringLiteral("Super Nintendo"), QJsonArray{QStringLiteral("Super Mario World")}));
        index.insert(QStringLiteral("2"), game(QStringLiteral("2"), QStringLiteral("Super Mario Bros"),
            QStringLiteral("Nintendo NES")));
        index.insert(QStringLiteral("3"), game(QStringLiteral("3"), QStringLiteral("Mário 64"),
            QStringLiteral("Nintendo 64")));
        index.insert(QStringLiteral("4"), game(QStringLiteral("4"), QStringLiteral("Mario Kart"),
            QStringLiteral("Super Nintendo")));

        gamestock::LaunchBoxSearchOptions options;
        options.query = QStringLiteral("super mario world");
        QList<QVariantMap> result = gamestock::searchLaunchBoxIndex(index, options);
        QCOMPARE(result.size(), 1);
        QCOMPARE(result.first().value("id").toString(), QString("1"));

        options.query = QStringLiteral("mario");
        options.restrictPlatforms = true;
        options.allowedPlatforms = {QStringLiteral("Super Nintendo")};
        result = gamestock::searchLaunchBoxIndex(index, options);
        QCOMPARE(result.size(), 2);
        QCOMPARE(result.at(0).value("name").toString(), QString("Mario Kart"));
        QCOMPARE(result.at(1).value("name").toString(), QString("Mario World"));

        options.query = QStringLiteral("mario 64");
        options.restrictPlatforms = false;
        options.allowedPlatforms = {};
        result = gamestock::searchLaunchBoxIndex(index, options);
        QCOMPARE(result.size(), 1);
        QCOMPARE(result.first().value("id").toString(), QString("3"));

        options.query = QStringLiteral("mario");
        options.restrictPlatforms = true;
        options.allowedPlatforms = {};
        QVERIFY(gamestock::searchLaunchBoxIndex(index, options).isEmpty());

        options.restrictPlatforms = false;
        options.limit = 1;
        QCOMPARE(gamestock::searchLaunchBoxIndex(index, options).size(), 1);
    }

    /** Aliases e nomes canônicos resolvem a plataforma, com fallback seguro. */
    void platformAliases() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
        }
        gamestock::PlatformService service;
        QString error;
        QVERIFY2(service.open(path, &error), qPrintable(error));
        qint64 snes = 0;
        qint64 nes = 0;
        for (const QVariant& value : service.items()) {
            const QVariantMap platform = value.toMap();
            if (platform.value("name").toString() == "Super Nintendo") snes = platform.value("id").toLongLong();
            if (platform.value("name").toString() == "Nintendo NES") nes = platform.value("id").toLongLong();
        }
        QVERIFY(snes > 0 && nes > 0);
        QCOMPARE(service.resolvePlatformByLaunchBoxName(QStringLiteral("Super Nintendo")), snes);
        QCOMPARE(service.resolvePlatformByLaunchBoxName(QStringLiteral("SNES")), snes);
        QCOMPARE(service.resolvePlatformByLaunchBoxName(QStringLiteral("Nintendo Entertainment System")), nes);
        QCOMPARE(service.resolvePlatformByLaunchBoxName(QStringLiteral("Inexistente")), static_cast<qint64>(0));
        QVERIFY(service.launchBoxAliases(snes).contains("SNES"));
    }

    /** A listagem Libretro normaliza regiões e prioriza o título exato. */
    void libretroTitles() {
        HttpTestServer server;
        const QString directory = QStringLiteral("/Nintendo%20-%20Super%20Nintendo%20Entertainment%20System/Named_Boxarts/");
        const QByteArray html =
            "<html><body>"
            "<a href=\"Super%20Mario%20World%20(USA).png\">x</a>"
            "<a href=\"Super%20Mario%20World%20(Europe).png\">x</a>"
            "<a href=\"Super%20Mario%20World%202%20(Japan).png\">x</a>"
            "<a href=\"Super%20Mario%20Bros.png\">x</a>"
            "</body></html>";
        server.add(directory, html);
        QVERIFY(server.listen());
        gamestock::LibretroClient client(server.baseUrl() + QStringLiteral("/"));
        const QStringList titles = client.searchTitles(QStringLiteral("Super Mario World"), QStringLiteral("Super Nintendo"));
        QCOMPARE(titles.size(), 2);
        QCOMPARE(titles.at(0), QString("Super Mario World"));
        QCOMPARE(titles.at(1), QString("Super Mario World 2"));
        QVERIFY(client.searchTitles(QStringLiteral("Mario"), QStringLiteral("Plataforma X")).isEmpty());

        HttpTestServer failing;
        failing.add(directory, {}, 500);
        QVERIFY(failing.listen());
        gamestock::LibretroClient broken(failing.baseUrl() + QStringLiteral("/"));
        QVERIFY(broken.searchTitles(QStringLiteral("Mario"), QStringLiteral("Super Nintendo")).isEmpty());
    }

    /** OpenVGDB baixa, valida, deduplica por riqueza e filtra por sistema. */
    void openVgdb() {
        const QString sevenZip = qEnvironmentVariable("GAMESTOCK_7Z_PATH");
        if (sevenZip.isEmpty()) QSKIP("7-Zip de teste não informado.");
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString fixtureDir = dir.filePath("fixture");
        QVERIFY(QDir().mkpath(fixtureDir));
        const QString sqlite = QDir(fixtureDir).filePath("openvgdb.sqlite");
        QVERIFY(createOpenVgdb(sqlite));
        const QByteArray zip = zipFile(fixtureDir, QStringLiteral("openvgdb.sqlite"), QStringLiteral("openvgdb.zip"));
        QVERIFY(!zip.isEmpty());
        HttpTestServer server;
        QVERIFY(server.listen());
        const QByteArray api = QStringLiteral("{\"assets\":[{\"name\":\"openvgdb.zip\",\"size\":%1,"
            "\"browser_download_url\":\"%2/openvgdb.zip\"}]}").arg(zip.size())
            .arg(server.baseUrl()).toUtf8();
        server.add(QStringLiteral("/api"), api);
        server.add(QStringLiteral("/openvgdb.zip"), zip);

        gamestock::OpenVgdb::Config config;
        config.cacheDir = dir.filePath("cache");
        config.apiUrl = server.baseUrl() + QStringLiteral("/api");
        config.sevenZipPath = sevenZip;
        config.allowCustomAssetUrl = true;
        gamestock::OpenVgdb openVgdb(config);
        QString error;
        QVERIFY2(openVgdb.ensureDatabase(&error), qPrintable(error));
        QCOMPARE(server.requests(QStringLiteral("/api")), 1);
        QCOMPARE(server.requests(QStringLiteral("/openvgdb.zip")), 1);

        const QList<QVariantMap> results = openVgdb.search(QStringLiteral("super mario world"), QStringLiteral("Super Nintendo"), &error);
        QVERIFY2(error.isEmpty(), qPrintable(error));
        QCOMPARE(results.size(), 1);
        QCOMPARE(results.first().value("id").toString(), QString("openvgdb:1"));
        QCOMPARE(results.first().value("platform").toString(), QString("Super Nintendo"));

        const QList<QVariantMap> partial = openVgdb.search(QStringLiteral("mario"), QStringLiteral("Super Nintendo"), &error);
        QCOMPARE(partial.size(), 2);
        QCOMPARE(partial.at(0).value("name").toString(), QString("Mario Kart"));
        QCOMPARE(partial.at(1).value("name").toString(), QString("Super Mario World"));
        QVERIFY(openVgdb.search(QStringLiteral("mario"), QStringLiteral("Plataforma X"), &error).isEmpty());

        const QVariantMap selected = openVgdb.get(QStringLiteral("openvgdb:1"), &error);
        QCOMPARE(selected.value("name").toString(), QString("Super Mario World"));
        QCOMPARE(selected.value("release").toString(), QString("1991"));
        QVERIFY(openVgdb.get(QStringLiteral("openvgdb:999"), &error).isEmpty());
        QVERIFY(!error.isEmpty());

        QVERIFY(openVgdb.ensureDatabase(&error));
        QCOMPARE(server.requests(QStringLiteral("/api")), 1);

        gamestock::MetadataSearchRequest combinedRequest;
        combinedRequest.query = QStringLiteral("super mario world");
        combinedRequest.platformName = QStringLiteral("Super Nintendo");
        combinedRequest.allowedPlatforms = {QStringLiteral("Super Nintendo")};
        combinedRequest.includeAlternatives = true;
        const QList<QVariantMap> combined = gamestock::searchMetadata(combinedRequest, &openVgdb, nullptr, &error);
        QCOMPARE(combined.size(), 1);
        QCOMPARE(combined.first().value("id").toString(), QString("openvgdb:1"));
    }

    /** Fallback usa OpenVGDB/Libretro somente quando o LaunchBox não é exato. */
    void combinedFallback() {
        HttpTestServer server;
        const QString directory = QStringLiteral("/Nintendo%20-%20Super%20Nintendo%20Entertainment%20System/Named_Boxarts/");
        server.add(directory, "<a href=\"Super%20Mario%20World.png\">x</a>");
        QVERIFY(server.listen());
        gamestock::LibretroClient libretro(server.baseUrl() + QStringLiteral("/"));
        gamestock::MetadataSearchRequest request;
        request.query = QStringLiteral("Super Mario World");
        request.platformName = QStringLiteral("Super Nintendo");
        request.allowedPlatforms = {QStringLiteral("Super Nintendo")};
        request.includeAlternatives = true;
        request.index.insert(QStringLiteral("1"), game(QStringLiteral("1"), QStringLiteral("Mario World"),
            QStringLiteral("Super Nintendo"), QJsonArray{QStringLiteral("Super Mario World")}));
        QList<QVariantMap> result = gamestock::searchMetadata(request, nullptr, &libretro);
        QCOMPARE(result.size(), 1);
        QCOMPARE(result.first().value("source").toString(), QString("launchbox"));
        QCOMPARE(server.requests(directory), 0);

        request.index = QJsonObject{};
        request.index.insert(QStringLiteral("2"), game(QStringLiteral("2"), QStringLiteral("Outro"),
            QStringLiteral("Super Nintendo")));
        result = gamestock::searchMetadata(request, nullptr, &libretro);
        QCOMPARE(result.size(), 1);
        QCOMPARE(result.first().value("source").toString(), QString("libretro"));
        QVERIFY(result.first().value("id").toString().startsWith("libretro:"));

        request.includeAlternatives = false;
        QVERIFY(gamestock::searchMetadata(request, nullptr, &libretro).isEmpty());
        request.includeAlternatives = true;
        request.platformName.clear();
        QVERIFY(gamestock::searchMetadata(request, nullptr, &libretro).isEmpty());
    }

    /** Falha de rede e pacote sem SQLite não publicam banco inválido. */
    void openVgdbFailures() {        const QString sevenZip = qEnvironmentVariable("GAMESTOCK_7Z_PATH");
        if (sevenZip.isEmpty()) QSKIP("7-Zip de teste não informado.");
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        HttpTestServer failing;
        failing.add(QStringLiteral("/api"), {}, 500);
        QVERIFY(failing.listen());
        gamestock::OpenVgdb::Config config;
        config.cacheDir = dir.filePath("cache-error");
        config.apiUrl = failing.baseUrl() + QStringLiteral("/api");
        config.sevenZipPath = sevenZip;
        config.allowCustomAssetUrl = true;
        gamestock::OpenVgdb openVgdb(config);
        QString error;
        QVERIFY(!openVgdb.ensureDatabase(&error));
        QVERIFY(!error.isEmpty());
        QVERIFY(!QFileInfo::exists(openVgdb.databaseFile()));

        const QString sourceDir = dir.filePath("bad");
        QVERIFY(QDir().mkpath(sourceDir));
        QFile text(QDir(sourceDir).filePath("readme.txt"));
        QVERIFY(text.open(QIODevice::WriteOnly));
        text.write("sem sqlite");
        text.close();
        const QByteArray badZip = zipFile(sourceDir, QStringLiteral("readme.txt"), QStringLiteral("openvgdb.zip"));
        HttpTestServer invalid;
        QVERIFY(invalid.listen());
        const QByteArray api = QStringLiteral("{\"assets\":[{\"name\":\"openvgdb.zip\",\"size\":%1,"
            "\"browser_download_url\":\"%2/openvgdb.zip\"}]}").arg(badZip.size())
            .arg(invalid.baseUrl()).toUtf8();
        invalid.add(QStringLiteral("/api"), api);
        invalid.add(QStringLiteral("/openvgdb.zip"), badZip);
        gamestock::OpenVgdb::Config second;
        second.cacheDir = dir.filePath("cache-invalid");
        second.apiUrl = invalid.baseUrl() + QStringLiteral("/api");
        second.sevenZipPath = sevenZip;
        second.allowCustomAssetUrl = true;
        gamestock::OpenVgdb invalidDb(second);
        QVERIFY(!invalidDb.ensureDatabase(&error));
        QVERIFY(!QFileInfo::exists(invalidDb.databaseFile()));
    }
};

QTEST_GUILESS_MAIN(MetadataSearchTest)
#include "MetadataSearchTest.moc"
