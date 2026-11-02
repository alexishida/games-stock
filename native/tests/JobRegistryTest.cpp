/** Verifica transições, falhas de persistência e sinais enfileirados de jobs. */
#include "jobs/JobRegistry.h"
#include "db/JobStateStore.h"
#include "db/LegacyJobState.h"
#include <QSqlQuery>
#include <QThread>
#include <QtTest>

/** Emissor simples que representa um worker em outra thread. */
class ProgressEmitter : public QObject {
    Q_OBJECT
signals:
    /** Entrega um progresso que deve chegar à thread do registro. */
    void progress(const QString& id, const QJsonObject& value);
};

/** O armazenamento simulado evidencia a quantidade de transições persistidas. */
class JobRegistryTest : public QObject {
    Q_OBJECT
private slots:
    /** Ticks nunca gravam; falhas de persistência não publicam transição incompleta. */
    void transitions() {
        int writes = 0;
        bool fail = false;
        QJsonArray saved;
        gamestock::JobRegistry registry([&](const QJsonArray& jobs, QString* error) {
            if (fail) { if (error) *error = "disco"; return false; }
            ++writes; saved = jobs; return true;
        });
        QString error;
        const QJsonObject running{{"jobId", "one"}, {"status", "running"}};
        QVERIFY(registry.start(running, &error));
        QCOMPARE(writes, 1);
        QVERIFY(!registry.start(running, &error));
        for (int tick = 0; tick < 100; ++tick) registry.updateProgress("one", {{"current", tick}});
        QCOMPARE(writes, 1);
        QCOMPARE(registry.jobs()[0].toObject().value("progress").toObject().value("current").toInt(), 99);
        QJsonObject completed = registry.jobs()[0].toObject(); completed.insert("status", "completed");
        fail = true;
        QVERIFY(!registry.finish("one", completed, &error));
        QCOMPARE(registry.jobs()[0].toObject().value("status").toString(), QString("running"));
        fail = false;
        QVERIFY(registry.finish("one", completed, &error));
        QCOMPARE(writes, 2);
        registry.updateProgress("one", {{"current", 0}});
        QCOMPARE(registry.jobs()[0].toObject().value("progress").toObject().value("current").toInt(), 99);
        QVERIFY(registry.dismiss("one", &error));
        QCOMPARE(writes, 3);
        QVERIFY(saved.isEmpty());
        registry.restore({running});
        QCOMPARE(registry.jobs()[0].toObject().value("status").toString(), QString("interrupted"));
        QCOMPARE(writes, 3);
    }
    /** Conexão enfileirada entrega atualizações do worker na thread do registro. */
    void queuedWorker() {
        gamestock::JobRegistry registry([](const QJsonArray&, QString*) { return true; });
        QString error;
        QVERIFY(registry.start({{"jobId", "worker"}, {"status", "running"}}, &error));
        QThread thread;
        auto* emitter = new ProgressEmitter;
        emitter->moveToThread(&thread);
        QObject::connect(&thread, &QThread::finished, emitter, &QObject::deleteLater);
        QObject::connect(emitter, &ProgressEmitter::progress, &registry, &gamestock::JobRegistry::updateProgress, Qt::QueuedConnection);
        thread.start();
        QMetaObject::invokeMethod(emitter, [emitter] { emit emitter->progress("worker", {{"current", 42}}); }, Qt::QueuedConnection);
        QSignalSpy changed(&registry, &gamestock::JobRegistry::changed);
        const bool received = changed.wait(5000);
        thread.quit();
        QVERIFY(thread.wait(5000));
        QVERIFY(received);
        QCOMPARE(registry.jobs()[0].toObject().value("progress").toObject().value("current").toInt(), 42);
    }
    /** Um banco temporário registra somente início, conclusão e dispensa. */
    void sqliteTransitions() {
        {
            QSqlDatabase db = QSqlDatabase::addDatabase("QSQLITE", "job-registry-test");
            db.setDatabaseName(":memory:");
            QVERIFY(db.open());
            QSqlQuery query(db);
            QVERIFY(query.exec("CREATE TABLE app_state (key TEXT PRIMARY KEY, value_json TEXT, updated_at TEXT)"));
            QVERIFY(query.exec("CREATE TABLE audit (kind TEXT)"));
            QVERIFY(query.exec("CREATE TRIGGER audit_insert AFTER INSERT ON app_state BEGIN INSERT INTO audit VALUES ('insert'); END"));
            QVERIFY(query.exec("CREATE TRIGGER audit_update AFTER UPDATE ON app_state BEGIN INSERT INTO audit VALUES ('update'); END"));
            QVERIFY(query.exec("CREATE TRIGGER audit_delete AFTER DELETE ON app_state BEGIN INSERT INTO audit VALUES ('delete'); END"));
            gamestock::JobStateStore store(db, "gamestock.dataPortability.jobs");
            gamestock::JobRegistry registry([&store](const QJsonArray& jobs, QString* error) { return store.persist(jobs, error); });
            QString error;
            QJsonObject job{{"jobId", "backup"}, {"kind", "export"}, {"status", "running"}, {"progress", QJsonObject{}}};
            QVERIFY2(registry.start(job, &error), qPrintable(error));
            for (int tick = 0; tick < 100; ++tick) registry.updateProgress("backup", {{"current", tick}});
            QVERIFY(query.exec("SELECT COUNT(*) FROM audit")); QVERIFY(query.next()); QCOMPARE(query.value(0).toInt(), 1);
            gamestock::LegacyJobState recovered;
            QVERIFY2(gamestock::loadLegacyJobState(db, &recovered, &error), qPrintable(error));
            QCOMPARE(recovered.portabilityJobs[0].toObject().value("status").toString(), QString("interrupted"));
            job = registry.jobs()[0].toObject(); job.insert("status", "completed");
            QVERIFY2(registry.finish("backup", job, &error), qPrintable(error));
            QVERIFY2(registry.dismiss("backup", &error), qPrintable(error));
            QVERIFY(query.exec("SELECT COUNT(*) FROM audit")); QVERIFY(query.next()); QCOMPARE(query.value(0).toInt(), 3);
            gamestock::JobStateStore romStore(db, "gamestock.media.lastRomImportJob");
            QJsonObject rom{{"jobId", "rom"}, {"status", "running"}, {"progress", QJsonObject{}}};
            QVERIFY2(romStore.persist({rom}, &error), qPrintable(error));
            QVERIFY2(gamestock::loadLegacyJobState(db, &recovered, &error), qPrintable(error));
            QCOMPARE(recovered.lastRomJob.toObject().value("status").toString(), QString("interrupted"));
            QVERIFY(!romStore.persist({rom, rom}, &error));
            QJsonArray history;
            for (int index = 0; index < 7; ++index) history.append(QJsonObject{{"jobId", QString::number(index)}, {"kind", "export"}, {"status", "completed"}, {"progress", QJsonObject{}}});
            QVERIFY2(store.persist(history, &error), qPrintable(error));
            QVERIFY2(gamestock::loadLegacyJobState(db, &recovered, &error), qPrintable(error));
            QCOMPARE(recovered.portabilityJobs.size(), 5);
            QCOMPARE(recovered.portabilityJobs[0].toObject().value("jobId").toString(), QString("0"));
            QCOMPARE(recovered.portabilityJobs[4].toObject().value("jobId").toString(), QString("4"));
        }
        QSqlDatabase::removeDatabase("job-registry-test");
    }
};
QTEST_GUILESS_MAIN(JobRegistryTest)
#include "JobRegistryTest.moc"
