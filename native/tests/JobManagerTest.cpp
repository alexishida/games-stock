/** Verifica workers reais, sinais enfileirados e encerramento seguro. */
#include "jobs/JobManager.h"
#include "jobs/JobRegistry.h"

#include <QElapsedTimer>
#include <QJsonArray>
#include <QJsonObject>
#include <QSignalSpy>
#include <QThread>
#include <QTimer>
#include <QtTest>

namespace {
/** Monta o job mínimo aceito pelo registro. */
QJsonObject job(const QString& id, const QString& kind = QStringLiteral("test"))
{
    return QJsonObject{{QStringLiteral("jobId"), id}, {QStringLiteral("kind"), kind},
        {QStringLiteral("status"), QStringLiteral("running")}, {QStringLiteral("title"), id},
        {QStringLiteral("progress"), QJsonObject{}}};
}

/** Trabalho cooperativo que publica progresso e respeita cancelamento. */
gamestock::JobWorker::Work countingWork(int ticks, int delayMs, bool ignoreCancel = false)
{
    return [ticks, delayMs, ignoreCancel](gamestock::JobWorker* worker) {
        for (int tick = 0; tick < ticks; ++tick) {
            if (!ignoreCancel && worker->isCancelled()) return;
            worker->reportProgress(QJsonObject{{QStringLiteral("current"), tick},
                {QStringLiteral("total"), ticks}, {QStringLiteral("message"), QStringLiteral("etapa")}});
            QThread::msleep(static_cast<unsigned long>(delayMs));
        }
    };
}
} // namespace

/** Cobre UI responsiva, cancelamento, timeout e persistência por transição. */
class JobManagerTest : public QObject {
    Q_OBJECT
private slots:
    /** A thread da UI segue atendendo timers enquanto o worker progride. */
    void uiStaysResponsive() {
        gamestock::JobRegistry registry([](const QJsonArray&, QString*) { return true; });
        gamestock::JobManager manager(&registry);
        QString error;
        QVERIFY2(manager.start(job(QStringLiteral("responsive")), countingWork(100, 10), &error), qPrintable(error));
        int heartbeat = 0;
        QTimer timer;
        QObject::connect(&timer, &QTimer::timeout, [&heartbeat] { ++heartbeat; });
        timer.start(10);
        QTest::qWait(100);
        QVERIFY(heartbeat > 0);
        QCOMPARE(manager.activeCount(), 1);
        QTRY_VERIFY_WITH_TIMEOUT(manager.activeCount() == 0, 5000);
        QCOMPARE(registry.jobs()[0].toObject().value("status").toString(), QString("completed"));
    }

    /** Início e conclusão gravam; ticks de progresso não. */
    void persistenceOnlyOnTransitions() {
        int writes = 0;
        gamestock::JobRegistry registry([&writes](const QJsonArray&, QString*) { ++writes; return true; });
        gamestock::JobManager manager(&registry);
        QString error;
        QVERIFY2(manager.start(job(QStringLiteral("persist")), countingWork(15, 5), &error), qPrintable(error));
        QCOMPARE(writes, 1);
        QTRY_VERIFY_WITH_TIMEOUT(manager.activeCount() == 0, 5000);
        QCOMPARE(writes, 2);
        const QJsonObject finished = registry.jobs()[0].toObject();
        QCOMPARE(finished.value("status").toString(), QString("completed"));
        QCOMPARE(finished.value("progress").toObject().value("current").toInt(), 14);
        QVERIFY(manager.dismiss(QStringLiteral("persist")));
        QVERIFY(registry.jobs().isEmpty());
    }

    /** Cancelamento cooperativo marca falha/interrompido e libera a thread. */
    void cancelAndShutdown() {
        gamestock::JobRegistry registry([](const QJsonArray&, QString*) { return true; });
        gamestock::JobManager manager(&registry);
        QString error;
        QVERIFY2(manager.start(job(QStringLiteral("cancel")), countingWork(1000, 10), &error), qPrintable(error));
        QTest::qWait(60);
        QVERIFY(manager.shutdown(5000));
        QCOMPARE(manager.activeCount(), 0);
        const QJsonObject finished = registry.jobs()[0].toObject();
        QCOMPARE(finished.value("status").toString(), QString("failed"));
        QVERIFY(finished.value("error").toString().contains(QStringLiteral("Interrompido")));
    }

    /** Timeout não destrói thread em execução; segunda espera conclui. */
    void shutdownTimeout() {
        gamestock::JobRegistry registry([](const QJsonArray&, QString*) { return true; });
        gamestock::JobManager manager(&registry);
        QString error;
        QVERIFY2(manager.start(job(QStringLiteral("slow")), countingWork(1, 300, true), &error), qPrintable(error));
        QVERIFY(!manager.shutdown(20));
        QVERIFY(!manager.error().isEmpty());
        QVERIFY(manager.shutdown(5000));
        QCOMPARE(manager.activeCount(), 0);
    }
};

QTEST_GUILESS_MAIN(JobManagerTest)
#include "JobManagerTest.moc"
