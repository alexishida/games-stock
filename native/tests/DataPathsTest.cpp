/** Verifica resolução do perfil e limites canônicos de mídia com dados temporários. */
#include "app/DataPaths.h"
#include "app/MediaReader.h"
#include <QDir>
#include <QFile>
#include <QProcess>
#include <QTemporaryDir>
#include <QtTest>

/** Casos independentes do perfil real do usuário. */
class DataPathsTest : public QObject {
    Q_OBJECT
private slots:
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
