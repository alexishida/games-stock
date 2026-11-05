/** Verifica download, extração, índice incremental e concorrência do cache. */
#include "launchbox/LaunchBoxCache.h"

#include <QCoreApplication>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QHash>
#include <QHostAddress>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QProcess>
#include <QTcpServer>
#include <QTcpSocket>
#include <QTemporaryDir>
#include <QtTest>

#include <atomic>
#include <thread>

namespace {
const char* sampleXml = R"(<?xml version="1.0" encoding="utf-8"?>
<LaunchBox>
  <Game>
    <DatabaseID>10</DatabaseID><Name>Game One</Name><Platform>Super Nintendo</Platform>
    <ReleaseDate>1994-08-01T00:00:00-05:00</ReleaseDate><Developer>Dev</Developer>
    <Publisher>Pub</Publisher><Genres>Action; Platform</Genres><Overview>Overview</Overview>
    <MaxPlayers>2</MaxPlayers><ESRB>E</ESRB><Cooperative>true</Cooperative>
  </Game>
  <Game>
    <DatabaseID>11</DatabaseID><Name>Game Two</Name><Platform>Nintendo NES</Platform>
    <ReleaseDate>1989-01-01T00:00:00-05:00</ReleaseDate>
  </Game>
  <GameAlternateName><DatabaseID>10</DatabaseID><AlternateName>Alias One</AlternateName></GameAlternateName>
  <GameImage><DatabaseID>10</DatabaseID><FileName>box.png</FileName><Type>Box - Front</Type><Region>Brazil</Region></GameImage>
</LaunchBox>
)";

/** Cria um ZIP real com o XML usando o 7-Zip do ambiente de teste. */
QByteArray makeZip(const QString& xml, const QString& directory, const QString& name)
{
    QFile source(QDir(directory).filePath(name + QStringLiteral(".xml")));
    if (!source.open(QIODevice::WriteOnly | QIODevice::Truncate)) return {};
    source.write(xml.toUtf8());
    source.close();
    const QString archive = QDir(directory).filePath(name + QStringLiteral(".zip"));
    QProcess process;
    process.setWorkingDirectory(directory);
    process.setProgram(qEnvironmentVariable("GAMESTOCK_7Z_PATH"));
    process.setArguments({QStringLiteral("a"), archive, QFileInfo(source).fileName()});
    process.start();
    if (!process.waitForFinished(30000)) return {};
    QFile zip(archive);
    if (!zip.open(QIODevice::ReadOnly)) return {};
    return zip.readAll();
}

/** Cria um ZIP real com vários XMLs, preservando a ordem informada. */
QByteArray makeZipFiles(const QList<QPair<QString, QString>>& files, const QString& directory,
    const QString& archiveName)
{
    QStringList names;
    for (const auto& file : files) {
        QFile source(QDir(directory).filePath(file.first + QStringLiteral(".xml")));
        if (!source.open(QIODevice::WriteOnly | QIODevice::Truncate)) return {};
        source.write(file.second.toUtf8());
        source.close();
        names.append(QFileInfo(source).fileName());
    }
    const QString archive = QDir(directory).filePath(archiveName + QStringLiteral(".zip"));
    QProcess process;
    process.setWorkingDirectory(directory);
    process.setProgram(qEnvironmentVariable("GAMESTOCK_7Z_PATH"));
    QStringList arguments{QStringLiteral("a"), archive};
    arguments.append(names);
    process.setArguments(arguments);
    process.start();
    if (!process.waitForFinished(30000)) return {};
    QFile zip(archive);
    if (!zip.open(QIODevice::ReadOnly)) return {};
    return zip.readAll();
}

/** Servidor HTTP mínimo que entrega um ZIP fixo e conta requisições. */
class ZipServer : public QObject {
    Q_OBJECT
public:
    explicit ZipServer(QByteArray body, int status = 200)
        : body_(std::move(body)), status_(status) {
        connect(&server_, &QTcpServer::newConnection, this, &ZipServer::accept);
    }
    bool listen() { return server_.listen(QHostAddress::LocalHost, 0); }
    QString url() const { return QStringLiteral("http://127.0.0.1:%1/Metadata.zip").arg(server_.serverPort()); }
    int requests() const { return requests_; }

private slots:
    void accept() {
        while (QTcpSocket* socket = server_.nextPendingConnection()) {
            buffers_.insert(socket, {});
            connect(socket, &QTcpSocket::readyRead, this, [this, socket] {
                QByteArray& buffer = buffers_[socket];
                buffer += socket->readAll();
                if (!buffer.contains("\r\n\r\n") || socket->property("sent").toBool()) return;
                socket->setProperty("sent", true);
                ++requests_;
                const QByteArray reason = status_ == 200 ? QByteArray("OK") : QByteArray("Erro");
                QByteArray response = QByteArray("HTTP/1.1 ") + QByteArray::number(status_) + " " + reason +
                    "\r\nContent-Type: application/zip\r\nConnection: close\r\nContent-Length: " +
                    QByteArray::number(body_.size()) + "\r\n\r\n";
                response += body_;
                socket->write(response);
                socket->disconnectFromHost();
            });
            connect(socket, &QTcpSocket::disconnected, this, [this, socket] {
                buffers_.remove(socket);
                socket->deleteLater();
            });
        }
    }

private:
    QTcpServer server_;
    QByteArray body_;
    int status_;
    int requests_ = 0;
    QHash<QTcpSocket*, QByteArray> buffers_;
};
} // namespace

/** Cobre cache recente, corrupção, rede e reconstrução idempotente. */
class LaunchBoxCacheTest : public QObject {
    Q_OBJECT
private slots:
    /** Download, extração e índice reutilizam disco/memória sem novo HTTP. */
    void downloadAndIndex() {
        const QString sevenZip = qEnvironmentVariable("GAMESTOCK_7Z_PATH");
        if (sevenZip.isEmpty() || !QFileInfo(sevenZip).isFile()) QSKIP("7-Zip de teste não informado.");
        QTemporaryDir work;
        QVERIFY(work.isValid());
        const QByteArray zip = makeZip(QString::fromUtf8(sampleXml), work.path(), QStringLiteral("Metadata"));
        QVERIFY(!zip.isEmpty());
        ZipServer server(zip);
        QVERIFY(server.listen());
        const QString cacheDir = work.filePath("launchbox_cache");
        gamestock::LaunchBoxCache cache(cacheDir, server.url(), sevenZip);
        const auto result = cache.ensureMetadata(false);
        QVERIFY2(result.ok(), qPrintable(result.error));
        QCOMPARE(result.status, QString("downloaded"));
        QCOMPARE(server.requests(), 1);
        QVERIFY(cache.metadataExists());
        QVERIFY(!cache.metadataDownloadedAt().isEmpty());

        QJsonObject index;
        QString error;
        QVERIFY2(cache.buildIndex(&index, &error), qPrintable(error));
        QCOMPARE(index.size(), 2);
        const QJsonObject first = index.value(QStringLiteral("10")).toObject();
        QCOMPARE(first.value("name").toString(), QString("Game One"));
        QCOMPARE(first.value("platform").toString(), QString("Super Nintendo"));
        QCOMPARE(first.value("release").toString(), QString("1994-08-01"));
        QCOMPARE(first.value("players").toString(), QString("2"));
        QCOMPARE(first.value("alternateNames").toArray().size(), 1);
        QCOMPARE(first.value("images").toArray().size(), 1);
        QCOMPARE(first.value("images").toArray().first().toObject().value("region").toString(), QString("Brazil"));
        QVERIFY(QFileInfo::exists(cache.indexFile()));

        QJsonObject cached;
        QVERIFY2(cache.buildIndex(&cached, &error), qPrintable(error));
        QCOMPARE(server.requests(), 1);
        QCOMPARE(cached.size(), 2);
        const auto recent = cache.ensureMetadata(false);
        QCOMPARE(recent.status, QString("cached"));
    }

    /** O ZIP atual do LaunchBox traz vários XMLs; só Metadata.xml contém jogos. */
    void prefersMetadataXmlInMultiFileZip() {
        const QString sevenZip = qEnvironmentVariable("GAMESTOCK_7Z_PATH");
        if (sevenZip.isEmpty() || !QFileInfo(sevenZip).isFile()) QSKIP("7-Zip de teste não informado.");
        QTemporaryDir work;
        QVERIFY(work.isValid());
        const QString filesXml = QStringLiteral(
            "<?xml version=\"1.0\"?><LaunchBox><File><FileName>x</FileName></File></LaunchBox>");
        const QString mameXml = QStringLiteral(
            "<?xml version=\"1.0\"?><LaunchBox><Machine><Name>x</Name></Machine></LaunchBox>");
        const QByteArray zip = makeZipFiles({
            {QStringLiteral("Files"), filesXml},
            {QStringLiteral("Mame"), mameXml},
            {QStringLiteral("Metadata"), QString::fromUtf8(sampleXml)}}, work.path(), QStringLiteral("Bundle"));
        QVERIFY(!zip.isEmpty());
        ZipServer server(zip);
        QVERIFY(server.listen());
        gamestock::LaunchBoxCache cache(work.filePath("launchbox_cache"), server.url(), sevenZip);
        const auto result = cache.ensureMetadata(false);
        QVERIFY2(result.ok(), qPrintable(result.error));
        QJsonObject index;
        QString error;
        QVERIFY2(cache.buildIndex(&index, &error), qPrintable(error));
        QCOMPARE(index.size(), 2);
        QCOMPARE(server.requests(), 1);
    }

    /** Um Metadata.xml antigo com o dataset errado não é aceito como cache válido. */
    void rejectsWrongDatasetInCache() {
        const QString sevenZip = qEnvironmentVariable("GAMESTOCK_7Z_PATH");
        if (sevenZip.isEmpty() || !QFileInfo(sevenZip).isFile()) QSKIP("7-Zip de teste não informado.");
        QTemporaryDir work;
        QVERIFY(work.isValid());
        const QString cacheDir = work.filePath("launchbox_cache");
        QVERIFY(QDir().mkpath(cacheDir));
        QFile wrong(QDir(cacheDir).filePath(QStringLiteral("Metadata.xml")));
        QVERIFY(wrong.open(QIODevice::WriteOnly | QIODevice::Truncate));
        wrong.write("<?xml version=\"1.0\"?><LaunchBox><File><FileName>x</FileName></File></LaunchBox>");
        wrong.close();
        const QByteArray zip = makeZip(QString::fromUtf8(sampleXml), work.path(), QStringLiteral("Metadata"));
        QVERIFY(!zip.isEmpty());
        ZipServer server(zip);
        QVERIFY(server.listen());
        gamestock::LaunchBoxCache cache(cacheDir, server.url(), sevenZip);
        const auto result = cache.ensureMetadata(false);
        QVERIFY2(result.ok(), qPrintable(result.error));
        QCOMPARE(result.status, QString("downloaded"));
        QCOMPARE(server.requests(), 1);
        QJsonObject index;
        QString error;
        QVERIFY2(cache.buildIndex(&index, &error), qPrintable(error));
        QCOMPARE(index.size(), 2);
    }

    /** XML válido sem <Game> falha e não grava índice vazio. */
    void emptyDatasetFails() {
        const QString sevenZip = qEnvironmentVariable("GAMESTOCK_7Z_PATH");
        if (sevenZip.isEmpty() || !QFileInfo(sevenZip).isFile()) QSKIP("7-Zip de teste não informado.");
        QTemporaryDir work;
        QVERIFY(work.isValid());
        const QByteArray zip = makeZip(
            QStringLiteral("<?xml version=\"1.0\"?><LaunchBox><File><FileName>x</FileName></File></LaunchBox>"),
            work.path(), QStringLiteral("Metadata"));
        QVERIFY(!zip.isEmpty());
        ZipServer server(zip);
        QVERIFY(server.listen());
        gamestock::LaunchBoxCache cache(work.filePath("cache"), server.url(), sevenZip);
        QVERIFY(cache.ensureMetadata(false).ok());
        QJsonObject index;
        QString error;
        QVERIFY(!cache.buildIndex(&index, &error));
        QVERIFY(error.contains(QStringLiteral("não contém jogos")));
        QVERIFY(!QFileInfo::exists(cache.indexFile()));
    }

    /** Valida o parser contra um Metadata.xml real quando o caminho é informado. */
    void realMetadataIfProvided() {
        const QString xmlPath = qEnvironmentVariable("GAMESTOCK_TEST_LAUNCHBOX_XML");
        if (xmlPath.isEmpty()) QSKIP("Metadata.xml real não informado.");
        QTemporaryDir work;
        QVERIFY(work.isValid());
        const QString cacheDir = work.filePath("launchbox_cache");
        QVERIFY(QDir().mkpath(cacheDir));
        const QString target = QDir(cacheDir).filePath(QStringLiteral("Metadata.xml"));
        // Hard link evita copiar centenas de MB no teste opt-in.
        QVERIFY2(QFile::link(xmlPath, target), "Não foi possível ligar o Metadata.xml ao cache de teste.");
        gamestock::LaunchBoxCache cache(cacheDir, {}, {});
        QJsonObject index;
        QString error;
        QVERIFY2(cache.buildIndex(&index, &error), qPrintable(error));
        QVERIFY(index.size() > 10000);
        QVERIFY(QFileInfo::exists(cache.indexFile()));
    }

    /** Índice inválido é descartado e reconstruído a partir do XML. */
    void corruptIndexRebuilds() {
        const QString sevenZip = qEnvironmentVariable("GAMESTOCK_7Z_PATH");
        if (sevenZip.isEmpty()) QSKIP("7-Zip de teste não informado.");
        QTemporaryDir work;
        const QByteArray zip = makeZip(QString::fromUtf8(sampleXml), work.path(), QStringLiteral("Metadata"));
        ZipServer server(zip);
        QVERIFY(server.listen());
        gamestock::LaunchBoxCache cache(work.filePath("cache"), server.url(), sevenZip);
        QVERIFY(cache.ensureMetadata(false).ok());
        QJsonObject index;
        QString error;
        QVERIFY2(cache.buildIndex(&index, &error), qPrintable(error));

        QFile broken(cache.indexFile());
        QVERIFY(broken.open(QIODevice::WriteOnly | QIODevice::Truncate));
        broken.write("{invalido");
        broken.close();
        QFile metadata(cache.metadataFile());
        QVERIFY(metadata.open(QIODevice::ReadOnly));
        QVERIFY(broken.open(QIODevice::ReadWrite));
        QVERIFY(broken.setFileTime(metadata.fileTime(QFileDevice::FileModificationTime).addSecs(1),
            QFileDevice::FileModificationTime));
        broken.close();
        metadata.close();

        // Um objeto novo força a leitura do cache em disco, que deve ser recusado.
        gamestock::LaunchBoxCache reopened(work.filePath("cache"), server.url(), sevenZip);
        QJsonObject rebuilt;
        QVERIFY2(reopened.buildIndex(&rebuilt, &error), qPrintable(error));
        QCOMPARE(rebuilt.size(), 2);
        QCOMPARE(server.requests(), 1);
        QFile valid(reopened.indexFile());
        QVERIFY(valid.open(QIODevice::ReadOnly));
        const QJsonDocument document = QJsonDocument::fromJson(valid.readAll());
        QVERIFY(document.isObject());
        QCOMPARE(document.object().size(), 2);
    }

    /** XML inválido falha sem gravar índice parcial. */
    void invalidXmlFails() {
        const QString sevenZip = qEnvironmentVariable("GAMESTOCK_7Z_PATH");
        if (sevenZip.isEmpty()) QSKIP("7-Zip de teste não informado.");
        QTemporaryDir work;
        const QByteArray zip = makeZip(QStringLiteral("<LaunchBox><Game>"), work.path(), QStringLiteral("Broken"));
        ZipServer server(zip);
        QVERIFY(server.listen());
        gamestock::LaunchBoxCache cache(work.filePath("cache"), server.url(), sevenZip);
        const auto downloaded = cache.ensureMetadata(false);
        QVERIFY2(downloaded.ok(), qPrintable(downloaded.error));
        QJsonObject index;
        QString error;
        QVERIFY(!cache.buildIndex(&index, &error));
        QVERIFY(error.contains(QStringLiteral("Metadata.xml")));
        QVERIFY(!QFileInfo::exists(cache.indexFile()));
    }

    /** Erro HTTP preserva o XML anterior e remove o download parcial. */
    void networkErrorKeepsOldMetadata() {
        const QString sevenZip = qEnvironmentVariable("GAMESTOCK_7Z_PATH");
        if (sevenZip.isEmpty()) QSKIP("7-Zip de teste não informado.");
        QTemporaryDir work;
        const QByteArray zip = makeZip(QString::fromUtf8(sampleXml), work.path(), QStringLiteral("Metadata"));
        ZipServer good(zip);
        QVERIFY(good.listen());
        const QString cacheDir = work.filePath("cache");
        gamestock::LaunchBoxCache cache(cacheDir, good.url(), sevenZip);
        QVERIFY(cache.ensureMetadata(false).ok());
        QFile metadata(cache.metadataFile());
        QVERIFY(metadata.open(QIODevice::ReadOnly));
        const QByteArray original = metadata.readAll();
        metadata.close();

        ZipServer bad({}, 500);
        QVERIFY(bad.listen());
        gamestock::LaunchBoxCache failing(cacheDir, bad.url(), sevenZip);
        const auto result = failing.ensureMetadata(true);
        QVERIFY(!result.ok());
        QVERIFY(result.error.contains(QStringLiteral("HTTP 500")));
        QVERIFY(QFileInfo::exists(cache.metadataFile()));
        QFile preserved(cache.metadataFile());
        QVERIFY(preserved.open(QIODevice::ReadOnly));
        QCOMPARE(preserved.readAll(), original);
        QVERIFY(!QFileInfo::exists(QDir(cacheDir).filePath("Metadata.zip.part")));
    }

    /** Duas chamadas concorrentes compartilham um único download/indexação. */
    void concurrentBuildsShareCache() {
        const QString sevenZip = qEnvironmentVariable("GAMESTOCK_7Z_PATH");
        if (sevenZip.isEmpty()) QSKIP("7-Zip de teste não informado.");
        QTemporaryDir work;
        const QByteArray zip = makeZip(QString::fromUtf8(sampleXml), work.path(), QStringLiteral("Metadata"));
        ZipServer server(zip);
        QVERIFY(server.listen());
        gamestock::LaunchBoxCache cache(work.filePath("cache"), server.url(), sevenZip);
        std::atomic<int> ok{0};
        std::atomic<int> failed{0};
        std::atomic<int> done{0};
        const auto workItem = [&] {
            QJsonObject index;
            QString error;
            if (cache.buildIndex(&index, &error) && index.size() == 2) ++ok;
            else ++failed;
            ++done;
        };
        std::thread first(workItem);
        std::thread second(workItem);
        for (int attempt = 0; attempt < 600 && done.load() < 2; ++attempt) {
            QCoreApplication::processEvents();
            QTest::qWait(10);
        }
        first.join();
        second.join();
        QCOMPARE(ok.load(), 2);
        QCOMPARE(failed.load(), 0);
        QCOMPARE(server.requests(), 1);
    }
};

QTEST_GUILESS_MAIN(LaunchBoxCacheTest)
#include "LaunchBoxCacheTest.moc"
