/** Testa o fallback Libretro com servidor local e nenhuma rede externa. */
#include "HttpTestServer.h"
#include "launchbox/LibretroMedia.h"

#include <QBuffer>
#include <QColor>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QImage>
#include <QTemporaryDir>
#include <QtTest>

namespace {
/** Gera um PNG pequeno para servir como capa/screenshot. */
QByteArray pngBytes(const QColor& color, int size = 320) {
    QImage image(size, size, QImage::Format_ARGB32);
    image.fill(color);
    QByteArray bytes;
    QBuffer buffer(&bytes);
    buffer.open(QIODevice::WriteOnly);
    image.save(&buffer, "PNG");
    return bytes;
}
} // namespace

class LibretroMediaTest final : public QObject {
    Q_OBJECT
private slots:
    /** Baixa capa/screenshot e prioriza a região brasileira. */
    void downloadsCoverAndScreenshot() {
        HttpTestServer server;
        QVERIFY(server.listen());
        const QByteArray brazil = pngBytes(Qt::red);
        const QByteArray usa = pngBytes(Qt::blue);
        const QString platform = QStringLiteral("Nintendo%20-%20Nintendo%20Entertainment%20System");
        const QString boxarts = QStringLiteral("/%1/Named_Boxarts/").arg(platform);
        const QString snaps = QStringLiteral("/%1/Named_Snaps/").arg(platform);
        const QString usaFile = QString::fromUtf8(QUrl::toPercentEncoding(QStringLiteral("Aventura Legada (USA).png")));
        const QString brazilFile = QString::fromUtf8(QUrl::toPercentEncoding(QStringLiteral("Aventura Legada (Brazil).png")));
        server.add(boxarts, QByteArray("<a href=\"") + usaFile.toUtf8() + "\">x</a><a href=\""
            + brazilFile.toUtf8() + "\">x</a>");
        server.add(boxarts + usaFile, usa);
        server.add(boxarts + brazilFile, brazil);
        server.add(snaps, QByteArray("<a href=\"") + brazilFile.toUtf8() + "\">x</a>");
        server.add(snaps + brazilFile, pngBytes(Qt::green));

        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        gamestock::LibretroMedia media(server.baseUrl());
        const gamestock::LibretroMediaResult result = media.downloadMedia(
            {QStringLiteral("Aventura Legada")}, QStringLiteral("Nintendo NES"), dir.path(), true, true);
        QVERIFY(QFileInfo::exists(result.coverPath));
        QVERIFY(QFileInfo::exists(result.screenshotPath));
        QCOMPARE(server.requests(boxarts + brazilFile), 1);
        QCOMPARE(server.requests(boxarts + usaFile), 0);
        QImage cover(result.coverPath);
        QVERIFY(!cover.isNull());
        QVERIFY(cover.width() <= 280 && cover.height() <= 280);
        // JPEG 85 altera levemente os canais; a cor dominante continua vermelha.
        const QColor pixel = cover.pixelColor(0, 0);
        QVERIFY(pixel.red() > 200 && pixel.green() < 60 && pixel.blue() < 60);
    }

    /** Plataforma sem mapeamento retorna vazio sem tocar a rede. */
    void unmappedPlatformDoesNotRequest() {
        HttpTestServer server;
        QVERIFY(server.listen());
        QTemporaryDir dir;
        gamestock::LibretroMedia media(server.baseUrl());
        const gamestock::LibretroMediaResult result = media.downloadMedia(
            {QStringLiteral("Jogo")}, QStringLiteral("Plataforma Desconhecida"), dir.path(), true, true);
        QVERIFY(result.coverPath.isEmpty());
        QVERIFY(result.screenshotPath.isEmpty());
        QCOMPARE(server.requests(QStringLiteral("/")), 0);
    }
};

QTEST_GUILESS_MAIN(LibretroMediaTest)
#include "LibretroMediaTest.moc"
