/** Verifica download de mídia, prioridade regional e previews de capa. */
#include "HttpTestServer.h"
#include "launchbox/LaunchBoxMedia.h"

#include <QBuffer>
#include <QColor>
#include <QDir>
#include <QElapsedTimer>
#include <QFileInfo>
#include <QImage>
#include <QImageReader>
#include <QTemporaryDir>
#include <QVariantList>
#include <QtTest>

namespace {
/** Gera PNG determinístico em memória. */
QByteArray png(int width, int height, const QColor& color)
{
    QImage image(width, height, QImage::Format_RGB32);
    image.fill(color);
    QByteArray bytes;
    QBuffer buffer(&bytes);
    buffer.open(QIODevice::WriteOnly);
    image.save(&buffer, "PNG");
    return bytes;
}

QImage readImage(const QString& path)
{
    QImageReader reader(path);
    reader.setAutoTransform(true);
    return reader.read();
}

/** Jogo com quatro imagens indexadas. */
QVariantMap sampleGame()
{
    return QVariantMap{
        {QStringLiteral("id"), QStringLiteral("42")},
        {QStringLiteral("name"), QStringLiteral("Mário Teste")},
        {QStringLiteral("platform"), QStringLiteral("Super Nintendo")},
        {QStringLiteral("images"), QVariantList{
            QVariantMap{{QStringLiteral("filename"), QStringLiteral("box-front-brazil.png")},
                {QStringLiteral("type"), QStringLiteral("Box - Front")}, {QStringLiteral("region"), QStringLiteral("Brazil")}},
            QVariantMap{{QStringLiteral("filename"), QStringLiteral("box-front-europe.png")},
                {QStringLiteral("type"), QStringLiteral("Box - Front")}, {QStringLiteral("region"), QStringLiteral("Europe")}},
            QVariantMap{{QStringLiteral("filename"), QStringLiteral("box-front-north-america.png")},
                {QStringLiteral("type"), QStringLiteral("Box - Front")}, {QStringLiteral("region"), QStringLiteral("North America")}},
            QVariantMap{{QStringLiteral("filename"), QStringLiteral("screenshot-gameplay.png")},
                {QStringLiteral("type"), QStringLiteral("Screenshot - Gameplay")}, {QStringLiteral("region"), QString()}},
        }},
    };
}
} // namespace

/** Cobre região, orientação, dimensões e reuso de arquivos existentes. */
class LaunchBoxMediaTest : public QObject {
    Q_OBJECT
private slots:
    /** Brasil vence Europa/América; portrait vira cover 195x280 e repetição não baixa. */
    void priorityAndCache() {
        HttpTestServer server;
        server.add(QStringLiteral("/box-front-brazil.png"), png(400, 600, Qt::blue));
        server.add(QStringLiteral("/box-front-europe.png"), png(300, 300, Qt::red));
        server.add(QStringLiteral("/box-front-north-america.png"), png(300, 300, Qt::green));
        server.add(QStringLiteral("/screenshot-gameplay.png"), png(320, 240, Qt::yellow));
        QVERIFY(server.listen());
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        gamestock::LaunchBoxMedia media(server.baseUrl() + QStringLiteral("/"));
        const gamestock::LaunchBoxMediaResult first = media.downloadImages(sampleGame(), dir.path());
        QCOMPARE(first.success, 4);
        QCOMPARE(first.failed, 0);
        QCOMPARE(server.requests(QStringLiteral("/box-front-brazil.png")), 1);
        const QString cover = QDir(gamestock::LaunchBoxMedia::gameImageDir(dir.path(), sampleGame()))
            .filePath(QStringLiteral("cover.jpg"));
        QVERIFY(QFileInfo::exists(cover));
        const QImage image = readImage(cover);
        QVERIFY(!image.isNull());
        QVERIFY(image.height() == 280);
        QVERIFY(image.width() <= 195);
        QVERIFY(image.height() > image.width());
        QVERIFY(QFileInfo::exists(QDir(gamestock::LaunchBoxMedia::gameImageDir(dir.path(), sampleGame()))
            .filePath(QStringLiteral("metadata.json"))));
        QCOMPARE(gamestock::LaunchBoxMedia::preferredBoxArt({
            QStringLiteral("box-front-europe-01.png"), QStringLiteral("box-front-brazil-02.png")}),
            QString("box-front-brazil-02.png"));

        const gamestock::LaunchBoxMediaResult second = media.downloadImages(sampleGame(), dir.path());
        QCOMPARE(second.success, 0);
        QCOMPARE(second.skipped, 4);
        QCOMPARE(second.failed, 0);
        QCOMPARE(server.requests(QStringLiteral("/box-front-brazil.png")), 1);
    }

    /** A fila baixa até três imagens ao mesmo tempo e mantém a ordem dos arquivos. */
    void parallelDownloads() {
        HttpTestServer server;
        QVariantList images;
        const QString type = QStringLiteral("Screenshot - Gameplay");
        for (int index = 0; index < 6; ++index) {
            const QString filename = QStringLiteral("shot-%1.png").arg(index);
            server.add(QStringLiteral("/") + filename, png(40, 30, QColor::fromHsv(index * 40, 200, 200)),
                200, 150);
            images.append(QVariantMap{{QStringLiteral("filename"), filename},
                {QStringLiteral("type"), type}, {QStringLiteral("region"), QStringLiteral("Brazil")}});
        }
        QVERIFY(server.listen());
        QVariantMap game{{QStringLiteral("id"), QStringLiteral("99")},
            {QStringLiteral("name"), QStringLiteral("Paralelo")},
            {QStringLiteral("platform"), QStringLiteral("Super Nintendo")},
            {QStringLiteral("images"), images}};
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        gamestock::LaunchBoxMedia media(server.baseUrl() + QStringLiteral("/"));
        const gamestock::LaunchBoxMediaResult result = media.downloadImages(game, dir.path(),
            QStringList{type});
        QCOMPARE(result.success, 6);
        QCOMPARE(result.failed, 0);
        // Duas ou três conexões simultâneas comprovam a fila; uma execução sequencial daria 1.
        QVERIFY(server.maxConcurrent() >= 2);
        QVERIFY(server.maxConcurrent() <= 3);
        QCOMPARE(result.files.size(), 6);
        for (int index = 0; index < result.files.size(); ++index) {
            QVERIFY(QFileInfo::exists(result.files.at(index)));
            QVERIFY(result.files.at(index).contains(
                QStringLiteral("-%1.png").arg(index + 1, 2, 10, QLatin1Char('0'))));
        }
    }

    /** Mede a fila sequencial e a paralela com a mesma latência sintética. */
    void mediaDownloadMeasurement() {
        constexpr int total = 12;
        constexpr int delayMs = 100;
        HttpTestServer server;
        QVariantList images;
        for (int index = 0; index < total; ++index) {
            const QString filename = QStringLiteral("measure-%1.png").arg(index);
            server.add(QStringLiteral("/") + filename, png(20, 20, Qt::gray), 200, delayMs);
            images.append(QVariantMap{{QStringLiteral("filename"), filename},
                {QStringLiteral("type"), QStringLiteral("Screenshot - Gameplay")},
                {QStringLiteral("region"), QString()}});
        }
        QVERIFY(server.listen());
        QVariantMap game{{QStringLiteral("id"), QStringLiteral("measure")},
            {QStringLiteral("name"), QStringLiteral("Measure")},
            {QStringLiteral("platform"), QStringLiteral("Super Nintendo")},
            {QStringLiteral("images"), images}};
        gamestock::LaunchBoxMedia media(server.baseUrl() + QStringLiteral("/"));
        QTemporaryDir sequentialDir;
        QTemporaryDir parallelDir;
        QVERIFY(sequentialDir.isValid() && parallelDir.isValid());
        QElapsedTimer timer;
        timer.start();
        const auto sequential = media.downloadImages(game, sequentialDir.path(), {}, nullptr, false, 1);
        const qint64 sequentialMs = timer.elapsed();
        timer.restart();
        const auto parallel = media.downloadImages(game, parallelDir.path(), {}, nullptr, false, 3);
        const qint64 parallelMs = timer.elapsed();
        qInfo() << "Downloads sequencial/paralelo (ms):" << sequentialMs << parallelMs;
        QCOMPARE(sequential.success, total);
        QCOMPARE(parallel.success, total);
        // Sem concorrência o tempo é a soma das latências; com três, cai para cerca de um terço.
        QVERIFY(parallelMs < sequentialMs);
    }

    /** Landscape usa 280x195 e imagens menores não são ampliadas. */
    void orientationAndNoUpscale() {
        HttpTestServer server;
        server.add(QStringLiteral("/landscape.png"), png(600, 300, Qt::cyan));
        server.add(QStringLiteral("/small.png"), png(50, 70, Qt::magenta));
        QVERIFY(server.listen());
        QTemporaryDir dir;
        gamestock::LaunchBoxMedia media(server.baseUrl() + QStringLiteral("/"));
        QVariantMap landscape{{"id", "1"}, {"name", "Landscape"}, {"platform", "Super Nintendo"},
            {"images", QVariantList{QVariantMap{{"filename", "landscape.png"}, {"type", "Box - Front"},
                {"region", "Brazil"}}}}};
        QCOMPARE(media.downloadImages(landscape, dir.path()).success, 1);
        const QImage wide = readImage(QDir(gamestock::LaunchBoxMedia::gameImageDir(dir.path(), landscape))
            .filePath("cover.jpg"));
        QCOMPARE(wide.width(), 280);
        QCOMPARE(wide.height(), 140);

        QVariantMap small{{"id", "2"}, {"name", "Small"}, {"platform", "Super Nintendo"},
            {"images", QVariantList{QVariantMap{{"filename", "small.png"}, {"type", "Box - Front"},
                {"region", "Brazil"}}}}};
        QCOMPARE(media.downloadImages(small, dir.path()).success, 1);
        const QImage tiny = readImage(QDir(gamestock::LaunchBoxMedia::gameImageDir(dir.path(), small))
            .filePath("cover.jpg"));
        QCOMPARE(tiny.width(), 50);
        QCOMPARE(tiny.height(), 70);
    }

    /** Filtro de tipo evita baixar screenshots; falha não apaga arquivo anterior. */
    void typeFilterAndFailure() {
        HttpTestServer server;
        server.add(QStringLiteral("/box-front-brazil.png"), png(200, 300, Qt::blue));
        server.add(QStringLiteral("/screenshot-gameplay.png"), png(320, 240, Qt::red));
        server.add(QStringLiteral("/box-front-north-america.png"), png(210, 300, Qt::green));
        server.add(QStringLiteral("/box-front-europe.png"), {}, 500);
        QVERIFY(server.listen());
        QTemporaryDir dir;
        gamestock::LaunchBoxMedia media(server.baseUrl() + QStringLiteral("/"));
        const gamestock::LaunchBoxMediaResult boxes = media.downloadImages(sampleGame(), dir.path(),
            {QStringLiteral("Box - Front")});
        QCOMPARE(boxes.success, 2);
        QCOMPARE(boxes.failed, 1);
        QVERIFY(!QFileInfo::exists(QDir(gamestock::LaunchBoxMedia::gameImageDir(dir.path(), sampleGame()))
            .filePath(QStringLiteral("screenshot-gameplay-no-region-04.png"))));
        QVERIFY(QFileInfo::exists(QDir(gamestock::LaunchBoxMedia::gameImageDir(dir.path(), sampleGame()))
            .filePath(QStringLiteral("cover.jpg"))));
        // Com force, a imagem que falhou mantém o arquivo anterior.
        const gamestock::LaunchBoxMediaResult forced = media.downloadImages(sampleGame(), dir.path(), {}, nullptr, true);
        QCOMPARE(forced.failed, 1);
        QVERIFY(QFileInfo::exists(QDir(gamestock::LaunchBoxMedia::gameImageDir(dir.path(), sampleGame()))
            .filePath(QStringLiteral("box-front-brazil-01.png"))));
    }
};

QTEST_GUILESS_MAIN(LaunchBoxMediaTest)
#include "LaunchBoxMediaTest.moc"
