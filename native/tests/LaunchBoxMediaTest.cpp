/** Verifica download de mídia, prioridade regional e previews de capa. */
#include "HttpTestServer.h"
#include "launchbox/LaunchBoxMedia.h"

#include <QBuffer>
#include <QColor>
#include <QDir>
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
