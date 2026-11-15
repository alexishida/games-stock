/** Verifica resolução do perfil e limites canônicos de mídia com dados temporários. */
#include "app/DataPaths.h"
#include "app/MediaReader.h"
#include <QDir>
#include <QFile>
#include <QProcess>
#include <QElapsedTimer>
#include <QTemporaryDir>
#include <QtTest>

/** Casos independentes do perfil real do usuário. */
class DataPathsTest : public QObject {
    Q_OBJECT
private slots:
    /** Miniaturas panorâmicas mantêm resolução suficiente para recorte em 100% e 200%. */
    void croppedThumbnails() {
        QTemporaryDir temp;
        QVERIFY(temp.isValid());
        const QString path = temp.filePath("panorama.png");
        QImage source(2400, 600, QImage::Format_RGB32);
        source.fill(QColor("#3698c2"));
        QVERIFY(source.save(path));
        for (const int scale : {1, 2}) {
            const QSize target(180 * scale, 160 * scale);
            const QImage thumbnail = gamestock::readProfileImage(temp.path(), path, target, Qt::KeepAspectRatioByExpanding);
            QVERIFY(!thumbnail.isNull());
            QVERIFY(thumbnail.width() >= target.width());
            QVERIFY(thumbnail.height() >= target.height());
            QCOMPARE(thumbnail.size(), QSize(640 * scale, 160 * scale));
            QCOMPARE(thumbnail.pixelColor(thumbnail.width() / 2, thumbnail.height() / 2), QColor("#3698c2"));
            QVERIFY(thumbnail.sizeInBytes() < source.sizeInBytes());
        }
        QImage tall(600, 2400, QImage::Format_RGB32);
        tall.fill(Qt::blue);
        const QString portraitPath = temp.filePath("portrait.png");
        QVERIFY(tall.save(portraitPath));
        const QImage portrait = gamestock::readProfileImage(temp.path(), portraitPath, QSize(180, 160), Qt::KeepAspectRatioByExpanding);
        QCOMPARE(portrait.size(), QSize(180, 720));
        // A largura isolada mantém a orientação usada pelo card da biblioteca.
        const QImage wideCover = gamestock::readProfileImage(temp.path(), path, QSize(260, -1));
        QCOMPARE(wideCover.size(), QSize(260, 65));
        const QImage tallCover = gamestock::readProfileImage(temp.path(), portraitPath, QSize(260, -1));
        QCOMPARE(tallCover.size(), QSize(260, 1040));
        QImage extreme(6000, 20, QImage::Format_RGB32);
        extreme.fill(Qt::red);
        const QString extremePath = temp.filePath("extreme.png");
        QVERIFY(extreme.save(extremePath));
        const QImage limited = gamestock::readProfileImage(temp.path(), extremePath, QSize(180, 160), Qt::KeepAspectRatioByExpanding);
        QVERIFY(!limited.isNull());
        QVERIFY(limited.width() <= 4096 && limited.height() <= 4096);
    }

    /** Mede uma foto JPEG sintética, incluindo leitura e decodificação, sem usar o perfil real. */
    void thumbnailDecodeMeasurement() {
        QTemporaryDir temp;
        QVERIFY(temp.isValid());
        QImage original(3200, 2400, QImage::Format_RGB32);
        for (int y = 0; y < original.height(); ++y) {
            auto* line = reinterpret_cast<QRgb*>(original.scanLine(y));
            for (int x = 0; x < original.width(); ++x)
                line[x] = qRgb((x / 8) % 256, (y / 8) % 256, ((x + y) / 16) % 256);
        }
        const QString path = temp.filePath("synthetic.jpg");
        QVERIFY(original.save(path, "JPEG", 90));
        for (const int scale : {1, 2}) {
            QElapsedTimer timer;
            timer.start();
            QImage full;
            for (int i = 0; i < 5; ++i) full = gamestock::readProfileImage(temp.path(), path);
            const qint64 fullMs = timer.elapsed();
            timer.restart();
            QImage thumbnail;
            for (int i = 0; i < 5; ++i)
                thumbnail = gamestock::readProfileImage(temp.path(), path, QSize(180 * scale, 160 * scale), Qt::KeepAspectRatioByExpanding);
            const qint64 scaledMs = timer.elapsed();
            QVERIFY(!full.isNull() && !thumbnail.isNull());
            QVERIFY(thumbnail.width() >= 180 * scale && thumbnail.height() >= 160 * scale);
            QVERIFY(thumbnail.sizeInBytes() < full.sizeInBytes());
            const QSize target(180 * scale, 160 * scale);
            // Compara o mesmo recorte central do card em ambas as decodificações.
            const auto render = [target](const QImage& image) {
                const QImage resized = image.scaled(target, Qt::KeepAspectRatioByExpanding, Qt::SmoothTransformation);
                return resized.copy((resized.width() - target.width()) / 2, (resized.height() - target.height()) / 2,
                    target.width(), target.height()).convertToFormat(QImage::Format_RGB32);
            };
            const QImage reference = render(full);
            const QImage result = render(thumbnail);
            quint64 error = 0;
            for (int y = 0; y < target.height(); ++y) {
                for (int x = 0; x < target.width(); ++x) {
                    const QRgb a = reference.pixel(x, y);
                    const QRgb b = result.pixel(x, y);
                    error += qAbs(qRed(a) - qRed(b)) + qAbs(qGreen(a) - qGreen(b)) + qAbs(qBlue(a) - qBlue(b));
                }
            }
            const double meanError = static_cast<double>(error) / (target.width() * target.height() * 3);
            QVERIFY2(meanError < 5.0, "A miniatura divergiu excessivamente do recorte da imagem integral.");
            qInfo() << "Miniatura escala" << scale << "leituras 5: original ms/bytes" << fullMs << full.sizeInBytes()
                    << "reduzida ms/bytes" << scaledMs << thumbnail.sizeInBytes() << "dimensões" << thumbnail.size()
                    << "erro médio por canal" << meanError;
        }
    }

    /** Compara o recorte/encaixe das capas da biblioteca em duas escalas de tela. */
    void libraryCoverDecodeMeasurement() {
        QTemporaryDir temp;
        QVERIFY(temp.isValid());
        for (const bool horizontal : {true, false}) {
            const QSize sourceSize = horizontal ? QSize(3000, 1000) : QSize(1000, 3000);
            QImage source(sourceSize, QImage::Format_RGB32);
            for (int y = 0; y < source.height(); ++y) {
                auto* line = reinterpret_cast<QRgb*>(source.scanLine(y));
                for (int x = 0; x < source.width(); ++x)
                    line[x] = qRgb((x / 8) % 256, (y / 8) % 256, ((x + y) / 16) % 256);
            }
            const QString path = temp.filePath(horizontal ? "wide.jpg" : "tall.jpg");
            QVERIFY(source.save(path, "JPEG", 90));
            for (const int scale : {1, 2}) {
                QElapsedTimer timer;
                timer.start();
                QImage full;
                for (int i = 0; i < 5; ++i) full = gamestock::readProfileImage(temp.path(), path);
                const qint64 fullMs = timer.elapsed();
                timer.restart();
                QImage reduced;
                for (int i = 0; i < 5; ++i) reduced = gamestock::readProfileImage(temp.path(), path, QSize(260 * scale, -1));
                const qint64 reducedMs = timer.elapsed();
                QVERIFY(!full.isNull() && !reduced.isNull());
                QCOMPARE(reduced.width() > reduced.height(), horizontal);
                QVERIFY(reduced.sizeInBytes() < full.sizeInBytes());
                const QSize target(212 * scale, 260 * scale);
                const auto aspect = horizontal ? Qt::KeepAspectRatio : Qt::KeepAspectRatioByExpanding;
                const auto render = [target, aspect](const QImage& image) {
                    const QImage scaled = image.scaled(target, aspect, Qt::SmoothTransformation);
                    if (aspect == Qt::KeepAspectRatio) return scaled.convertToFormat(QImage::Format_RGB32);
                    return scaled.copy((scaled.width() - target.width()) / 2, (scaled.height() - target.height()) / 2,
                        target.width(), target.height()).convertToFormat(QImage::Format_RGB32);
                };
                const QImage reference = render(full);
                const QImage actual = render(reduced);
                QCOMPARE(actual.size(), reference.size());
                quint64 error = 0;
                for (int y = 0; y < actual.height(); ++y) {
                    for (int x = 0; x < actual.width(); ++x) {
                        const QRgb a = reference.pixel(x, y), b = actual.pixel(x, y);
                        error += qAbs(qRed(a) - qRed(b)) + qAbs(qGreen(a) - qGreen(b)) + qAbs(qBlue(a) - qBlue(b));
                    }
                }
                const double mean = static_cast<double>(error) / (actual.width() * actual.height() * 3);
                QVERIFY2(mean < 5.0, "A miniatura divergiu excessivamente da capa integral.");
                qInfo() << "Capa horizontal" << horizontal << "escala" << scale << "5 leituras original ms/bytes"
                        << fullMs << full.sizeInBytes() << "reduzida ms/bytes" << reducedMs << reduced.sizeInBytes()
                        << "dimensões" << reduced.size() << "erro médio por canal" << mean;
            }
        }
    }

    /** Prioridade do override e caminhos padrão dos dois sistemas previstos. */
    void resolution() {
        QProcessEnvironment env;
        env.insert("APPDATA", "C:/Usuários/Perfil com espaço");
        QCOMPARE(gamestock::userDataPath(env, "C:/Home", true), QString("C:/Usuários/Perfil com espaço/gamestock"));
        env.insert("GAMESTOCK_USER_DATA_DIR", "D:/Perfil próprio");
        QCOMPARE(gamestock::userDataPath(env, "C:/Home", true), QString("D:/Perfil próprio"));
        env.remove("GAMESTOCK_USER_DATA_DIR");
        env.insert("XDG_DATA_HOME", "/dados pessoais");
        QCOMPARE(gamestock::userDataPath(env, "/home/a", false), QString("/dados pessoais/gamestock"));
        env.remove("XDG_DATA_HOME");
        QCOMPARE(gamestock::userDataPath(env, "/home/a", false), QString("/home/a/.local/share/gamestock"));
        env.remove("APPDATA");
        QCOMPARE(gamestock::userDataPath(env, "C:/Home", true), QString("C:/Home/AppData/Roaming/gamestock"));
    }
    /** Arquivos irmãos, traversal e entradas ausentes não ultrapassam a raiz canônica. */
    void mediaBoundaries() {
        QTemporaryDir temp;
        QVERIFY(temp.isValid());
        QDir dir(temp.path());
        QVERIFY(dir.mkpath("perfil espaço/área"));
        QVERIFY(dir.mkpath("perfil espaço-externo"));
        QFile inside(dir.filePath("perfil espaço/área/capa.png"));
        QVERIFY(inside.open(QIODevice::WriteOnly)); inside.write("x"); inside.close();
        QFile outside(dir.filePath("perfil espaço-externo/segredo.png"));
        QVERIFY(outside.open(QIODevice::WriteOnly)); outside.write("x"); outside.close();
        const QString root = dir.filePath("perfil espaço");
        QVERIFY(!gamestock::validatedMediaPath(root, inside.fileName()).isEmpty());
        QVERIFY(gamestock::validatedMediaPath(root, outside.fileName()).isEmpty());
        QVERIFY(gamestock::validatedMediaPath(root, root + "/../perfil espaço-externo/segredo.png").isEmpty());
        QVERIFY(gamestock::validatedMediaPath(root, root + "/ausente.png").isEmpty());
        QVERIFY(gamestock::validatedMediaPath(root, "área/capa.png").isEmpty());
        QVERIFY(gamestock::validatedMediaPath(root, root).isEmpty());
#ifdef Q_OS_WIN
        // Junctions não exigem privilégio de criação de symlink no Windows.
        QProcess junction;
        junction.start("cmd.exe", {"/d", "/c", "mklink", "/J", QDir::toNativeSeparators(root + "/atalho"), QDir::toNativeSeparators(dir.filePath("perfil espaço-externo"))});
        QVERIFY(junction.waitForFinished());
        QCOMPARE(junction.exitCode(), 0);
        QVERIFY(gamestock::validatedMediaPath(root, root + "/atalho/segredo.png").isEmpty());
#else
        QVERIFY(QFile::link(outside.fileName(), root + "/atalho"));
        QVERIFY(gamestock::validatedMediaPath(root, root + "/atalho").isEmpty());
#endif
    }
    /** A leitura da imagem ocorre pelo mesmo identificador que teve o destino validado. */
    void imageAccess() {
        QTemporaryDir temp;
        QVERIFY(temp.isValid());
        QDir dir(temp.path());
        QVERIFY(dir.mkpath("perfil"));
        QImage source(4, 4, QImage::Format_ARGB32);
        source.fill(Qt::red);
        const QString inside = dir.filePath("perfil/capa.png");
        const QString outside = dir.filePath("fora.png");
        QVERIFY(source.save(inside));
        QVERIFY(source.save(outside));
#if defined(Q_OS_WIN) || defined(Q_OS_LINUX)
        QCOMPARE(gamestock::readProfileImage(dir.filePath("perfil"), inside).pixelColor(0, 0), QColor(Qt::red));
        QVERIFY(gamestock::readProfileImage(dir.filePath("perfil"), outside).isNull());
#ifdef Q_OS_WIN
        QProcess junction;
        junction.start("cmd.exe", {"/d", "/c", "mklink", "/J", QDir::toNativeSeparators(dir.filePath("perfil/fora")), QDir::toNativeSeparators(temp.path())});
        QVERIFY(junction.waitForFinished());
        QCOMPARE(junction.exitCode(), 0);
        QVERIFY(gamestock::readProfileImage(dir.filePath("perfil"), dir.filePath("perfil/fora/fora.png")).isNull());
#else
        // Um symlink externo não pode expor uma imagem fora da raiz autorizada.
        QVERIFY(QFile::link(outside, dir.filePath("perfil/atalho.png")));
        QVERIFY(gamestock::readProfileImage(dir.filePath("perfil"), dir.filePath("perfil/atalho.png")).isNull());
#endif
#endif
    }
    /** A imagem legada usada na referência também deve ser decodificada pelo provider. */
    void fixtureImage() {
        const QString database = qEnvironmentVariable("GAMESTOCK_TEST_DATABASE");
        if (database.isEmpty()) QSKIP("Fixture de migração não informada.");
        const QString root = QFileInfo(database).absolutePath();
        const QString file = QDir(root).filePath("images/fixture/cover.png");
        const QImage image = gamestock::readProfileImage(root, file);
        QVERIFY(!image.isNull());
        QCOMPARE(image.size(), QSize(1, 1));
        QCOMPARE(image.pixelColor(0, 0), QColor(0, 0, 0, 255));
    }
};
QTEST_GUILESS_MAIN(DataPathsTest)
#include "DataPathsTest.moc"
