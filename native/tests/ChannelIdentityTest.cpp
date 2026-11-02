/** Verifica detecção e persistência do canal instalado/portátil. */
#include "app/ChannelIdentity.h"
#include "db/Database.h"

#include <QDir>
#include <QFile>
#include <QProcessEnvironment>
#include <QTemporaryDir>
#include <QtTest>

namespace {
/** Cria o arquivo do executável falso e devolve o caminho. */
QString fakeExecutable(const QString& directory) {
    const QString path = QDir(directory).filePath("GameStock.exe");
    QFile file(path);
    if (file.open(QIODevice::WriteOnly)) file.write("exe");
    return path;
}
} // namespace

class ChannelIdentityTest : public QObject {
    Q_OBJECT
private slots:
    void detectsMarkersAndOverrides() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString executable = fakeExecutable(dir.path());
        const QProcessEnvironment empty;

        QCOMPARE(gamestock::detectChannel(executable, empty).channel, QString("development"));
        QCOMPARE(gamestock::detectChannel(executable, empty, QStringLiteral("portable")).channel,
            QString("portable"));

        QFile portable(QDir(dir.path()).filePath("portable.marker"));
        QVERIFY(portable.open(QIODevice::WriteOnly));
        portable.close();
        QCOMPARE(gamestock::detectChannel(executable, empty).channel, QString("portable"));
        QCOMPARE(gamestock::detectChannel(executable, empty).markerPath,
            QDir(dir.path()).filePath("portable.marker"));

        QVERIFY(QFile::remove(QDir(dir.path()).filePath("portable.marker")));
        QFile install(QDir(dir.path()).filePath("install.marker"));
        QVERIFY(install.open(QIODevice::WriteOnly));
        install.close();
        QCOMPARE(gamestock::detectChannel(executable, empty).channel, QString("installed"));

        QVERIFY(QFile::remove(QDir(dir.path()).filePath("install.marker")));
        QFile uninstall(QDir(dir.path()).filePath("uninstall GameStock.exe"));
        QVERIFY(uninstall.open(QIODevice::WriteOnly));
        uninstall.close();
        QCOMPARE(gamestock::detectChannel(executable, empty).channel, QString("installed"));

        QProcessEnvironment portableEnvironment = QProcessEnvironment::systemEnvironment();
        portableEnvironment.insert(QStringLiteral("PORTABLE_EXECUTABLE_DIR"), dir.path());
        QCOMPARE(gamestock::detectChannel(executable, portableEnvironment).channel, QString("portable"));
    }

    void persistsChannelInAppState() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString databasePath = dir.filePath("gamestock.db");
        gamestock::Database database;
        QString error;
        QVERIFY2(database.open(databasePath, dir.filePath("images"), &error), qPrintable(error));
        QVERIFY(gamestock::persistedChannel(database.handle()).isEmpty());
        gamestock::ChannelInfo info{QStringLiteral("portable"), dir.path(), dir.filePath("portable.marker")};
        QVERIFY2(gamestock::saveChannelIdentity(database.handle(), info, &error), qPrintable(error));
        QCOMPARE(gamestock::persistedChannel(database.handle()), QString("portable"));
        QVERIFY(error.isEmpty());
    }
};

QTEST_GUILESS_MAIN(ChannelIdentityTest)
#include "ChannelIdentityTest.moc"
