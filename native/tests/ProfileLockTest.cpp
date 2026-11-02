/** Verifica o contrato de lock exclusivo compartilhado entre Electron e Qt. */
#include "app/ProfileLock.h"

#include <QCoreApplication>
#include <QDir>
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QTemporaryDir>
#include <QtTest>

namespace {
/** Grava um lock manual para simular outro runtime. */
bool writeLock(const QString& directory, const QJsonObject& content) {
    QFile file(QDir(directory).filePath(QStringLiteral("gamestock.lock")));
    if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate)) return false;
    return file.write(QJsonDocument(content).toJson(QJsonDocument::Compact)) > 0;
}

/** Lê o lock do disco como o outro runtime faria. */
QJsonObject readLock(const QString& directory) {
    QFile file(QDir(directory).filePath(QStringLiteral("gamestock.lock")));
    if (!file.open(QIODevice::ReadOnly)) return {};
    return QJsonDocument::fromJson(file.readAll()).object();
}
} // namespace

/** Cobre exclusão, retomada de lock obsoleto e recusa de runtime ativo. */
class ProfileLockTest : public QObject {
    Q_OBJECT
private slots:
    /** Só um detentor por perfil; liberar permite nova aquisição. */
    void acquireAndRelease() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        gamestock::ProfileLock first;
        QString error;
        QVERIFY2(first.acquire(dir.path(), "qt", &error), qPrintable(error));
        QVERIFY(first.isHeld());
        QCOMPARE(first.holder().value("runtime").toString(), QString("qt"));
        QCOMPARE(first.holder().value("pid").toInt(), static_cast<int>(QCoreApplication::applicationPid()));

        gamestock::ProfileLock second;
        QVERIFY(!second.acquire(dir.path(), "qt", &error));
        QVERIFY(error.contains(QStringLiteral("em uso")));
        QVERIFY(!second.isHeld());
        first.release();
        QVERIFY(!first.isHeld());
        QVERIFY2(second.acquire(dir.path(), "qt", &error), qPrintable(error));
        QVERIFY(second.isHeld());
    }

    /** Processo morto deixa o lock obsoleto, que é retomado sem apagar dados. */
    void staleLockTakenOver() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        QVERIFY(writeLock(dir.path(), {{"runtime", "electron"}, {"pid", 999999999.0}, {"token", "antigo"}}));
        gamestock::ProfileLock lock;
        QString error;
        QVERIFY2(lock.acquire(dir.path(), "qt", &error), qPrintable(error));
        QCOMPARE(lock.holder().value("runtime").toString(), QString("qt"));
        QVERIFY(lock.holder().value("token").toString() != QString("antigo"));
    }

    /** JSON parcialmente gravado por um processo que caiu no meio é recuperado. */
    void brokenLockRecovered() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        QFile file(QDir(dir.path()).filePath(QStringLiteral("gamestock.lock")));
        QVERIFY(file.open(QIODevice::WriteOnly));
        QVERIFY(file.write("{\"runtime\":") > 0);
        file.close();
        gamestock::ProfileLock lock;
        QString error;
        QVERIFY2(lock.acquire(dir.path(), "qt", &error), qPrintable(error));
        QCOMPARE(lock.holder().value("runtime").toString(), QString("qt"));
    }

    /** Um Electron ainda ativo não pode ser derrubado; o erro identifica o detentor. */
    void liveElectronRefused() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        QVERIFY(writeLock(dir.path(), {{"runtime", "electron"},
            {"pid", static_cast<double>(QCoreApplication::applicationPid())}, {"token", "electron-1"}}));
        gamestock::ProfileLock lock;
        QString error;
        QVERIFY(!lock.acquire(dir.path(), "qt", &error));
        QVERIFY(error.contains(QStringLiteral("electron")));
        QCOMPARE(readLock(dir.path()).value("token").toString(), QString("electron-1"));
    }

    /** Atualizar o lock preserva o token e não remove lock retomado por outro processo. */
    void refreshAndSafeRelease() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        gamestock::ProfileLock lock;
        QString error;
        QVERIFY2(lock.acquire(dir.path(), "qt", &error), qPrintable(error));
        const QString token = lock.holder().value("token").toString();
        QVERIFY2(lock.refresh(&error), qPrintable(error));
        QCOMPARE(lock.holder().value("token").toString(), token);
        QVERIFY(lock.holder().contains(QStringLiteral("refreshedAt")));

        // Outro processo retoma o lock (só possível após queda ou remoção manual).
        QVERIFY(writeLock(dir.path(), {{"runtime", "qt"}, {"pid", 123.0}, {"token", "outro"}}));
        lock.release();
        QCOMPARE(readLock(dir.path()).value("token").toString(), QString("outro"));
    }
};

QTEST_GUILESS_MAIN(ProfileLockTest)
#include "ProfileLockTest.moc"
