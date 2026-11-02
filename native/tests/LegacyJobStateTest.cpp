/** Verifica leitura tolerante do estado legado sem alterar seus registros. */
#include "db/LegacyJobState.h"
#include "db/FolderStateStore.h"
#include "db/LibraryFilterState.h"
#include "db/ReadOnlyConnection.h"
#include "db/dao/AppStateReadDao.h"
#include <QJsonObject>
#include <QSqlQuery>
#include <QtTest>

/** Cobre o formato anterior de jobs e os valores JSON corrompidos. */
class LegacyJobStateTest : public QObject {
    Q_OBJECT
private slots:
    /** Preferências antigas conservam defaults, e valores inválidos não são gravados. */
    void libraryFilters() {
        {
            QSqlDatabase db = QSqlDatabase::addDatabase("QSQLITE", "library-filters-test");
            db.setDatabaseName(":memory:");
            QVERIFY(db.open());
            QSqlQuery query(db);
            QVERIFY(query.exec("CREATE TABLE app_state (key TEXT PRIMARY KEY, value_json TEXT, updated_at TEXT)"));
            gamestock::LibraryFilterStore store(db);
            gamestock::LibraryFilterState filters;
            bool present = true;
            QString error;
            QVERIFY2(store.load(&filters, &present, &error), qPrintable(error));
            QVERIFY(!present);
            QVERIFY(query.exec("INSERT INTO app_state VALUES ('gamestock.ui.libraryFilters', '{\"sortBy\":\"year\"}', '')"));
            QVERIFY2(store.load(&filters, &present, &error), qPrintable(error));
            QVERIFY(!present);
            QVERIFY(query.exec("UPDATE app_state SET value_json='{\"showGamesWithoutCover\":false,\"selectedCategory\":\"Ação\",\"sortBy\":\"inválido\"}'"));
            QVERIFY2(store.load(&filters, &present, &error), qPrintable(error));
            QVERIFY(present);
            QCOMPARE(filters.selectedCategory, QString::fromUtf8("Ação"));
            QCOMPARE(filters.sortBy, QString("title"));
            QCOMPARE(filters.collectionFilter, QString("all"));
            QCOMPARE(filters.viewMode, QString("grid"));
            QVERIFY(!filters.showGamesWithoutCover);
            filters.collectionFilter = "favorites";
            filters.sortBy = "mostPlayed";
            filters.viewMode = "list";
            QVERIFY2(store.save(filters, &error), qPrintable(error));
            gamestock::LibraryFilterState restored;
            QVERIFY2(store.load(&restored, &present, &error), qPrintable(error));
            QCOMPARE(restored.collectionFilter, QString("favorites"));
            QCOMPARE(restored.sortBy, QString("mostPlayed"));
            QCOMPARE(restored.viewMode, QString("list"));
            filters.viewMode = "inválido";
            QVERIFY(!store.save(filters, &error));
            QVERIFY2(store.load(&restored, &present, &error), qPrintable(error));
            QCOMPARE(restored.viewMode, QString("list"));
        }
        QSqlDatabase::removeDatabase("library-filters-test");
    }
    /** Mesclar pastas preserva registros antigos, substitui só a chave coincidente e reverte falhas. */
    void folderPersistence() {
        {
            QSqlDatabase db = QSqlDatabase::addDatabase("QSQLITE", "folder-state-test");
            db.setDatabaseName(":memory:");
            QVERIFY(db.open());
            QSqlQuery query(db);
            QVERIFY(query.exec("CREATE TABLE app_state (key TEXT PRIMARY KEY, value_json TEXT, updated_at TEXT)"));
            gamestock::FolderStateStore store(db);
            QString error;
            const QJsonObject original{{"folderPath", "C:/Jogos"}, {"platformId", 1}, {"extra", "preservado"}};
            const QJsonObject other{{"folderPath", "D:/Árvore"}, {"platformId", 2}, {"includeSubfolders", true}};
            QVERIFY2(store.save({original, other}, &error), qPrintable(error));
            const QJsonObject updated{{"folderPath", "D:/Árvore"}, {"platformId", 2}, {"indexedCount", 8}};
            const QJsonObject added{{"folderPath", "C:/Jogos"}, {"platformId", 3}};
            QVERIFY2(store.merge({updated, added, QJsonObject{{"folderPath", 7}}}, &error), qPrintable(error));
            gamestock::LegacyJobState state;
            QVERIFY2(gamestock::loadLegacyJobState(db, &state, &error), qPrintable(error));
            QCOMPARE(state.folders.size(), 3);
            QCOMPARE(state.folders[0].toObject().value("extra").toString(), QString("preservado"));
            QCOMPARE(state.folders[0].toObject().value("includeSubfolders").toBool(true), false);
            QCOMPARE(state.folders[1].toObject().value("indexedCount").toInt(), 8);
            QCOMPARE(state.folders[2].toObject().value("platformId").toInt(), 3);
            // A falha no SQLite deve conservar exatamente o retrato anterior.
            QVERIFY(query.exec("CREATE TRIGGER reject_folder_update BEFORE UPDATE ON app_state BEGIN SELECT RAISE(ABORT, 'falha simulada'); END"));
            QVERIFY(!store.merge({QJsonObject{{"folderPath", "E:/Novo"}, {"platformId", 4}}}, &error));
            QVERIFY2(gamestock::loadLegacyJobState(db, &state, &error), qPrintable(error));
            QCOMPARE(state.folders.size(), 3);
        }
        QSqlDatabase::removeDatabase("folder-state-test");
    }
    /** A hidratação converte estados em memória, preservando o conteúdo persistido. */
    void hydrate() {
        {
            QSqlDatabase db = QSqlDatabase::addDatabase("QSQLITE", "legacy-state-test");
            db.setDatabaseName(":memory:");
            QVERIFY(db.open());
            QSqlQuery query(db);
            QVERIFY(query.exec("CREATE TABLE app_state (key TEXT PRIMARY KEY, value_json TEXT)"));
            QVERIFY(query.prepare("INSERT INTO app_state VALUES (?, ?)"));
            const QList<QPair<QString, QString>> records = {
                {"gamestock.romImport.folderEntries", R"([{"folderPath":"C:/Jogos","platformId":1},{"folderPath":12}])"},
                {"gamestock.media.lastRomImportJob", R"({"jobId":"rom","status":"running","progress":{"current":2}})"},
                {"gamestock.media.lastMediaSyncJob", R"({"jobId":"media","title":"Capas","status":"running"})"},
                {"gamestock.dataPortability.jobs", R"([{"jobId":"backup","kind":"export","status":"running","progress":{}}])"},
                {"broken", "{inválido"}, {"scalar", "42"}
            };
            for (const auto& record : records) { query.bindValue(0, record.first); query.bindValue(1, record.second); QVERIFY(query.exec()); }
            gamestock::LegacyJobState state;
            QString error;
            QVERIFY2(gamestock::loadLegacyJobState(db, &state, &error), qPrintable(error));
            QCOMPARE(state.folders.size(), 1);
            QCOMPARE(state.folders[0].toObject().value("includeSubfolders").toBool(true), false);
            QCOMPARE(state.lastRomJob.toObject().value("status").toString(), QString("interrupted"));
            QCOMPARE(state.lastRomJob.toObject().value("progress").toObject().value("message").toString(), QString("Interrompido"));
            QCOMPARE(state.mediaJobs[0].toObject().value("progressLabel").toString(), QString("Interrompido"));
            QCOMPARE(state.portabilityJobs[0].toObject().value("status").toString(), QString("interrupted"));
            gamestock::AppStateReadDao dao(db);
            QJsonValue value;
            QVERIFY(dao.get("broken", &value, &error)); QVERIFY(value.isUndefined());
            QVERIFY(dao.get("scalar", &value, &error)); QCOMPARE(value.toInt(), 42);
            QVERIFY(dao.get("gamestock.media.lastRomImportJob", &value, &error));
            QCOMPARE(value.toObject().value("status").toString(), QString("running"));
        }
        QSqlDatabase::removeDatabase("legacy-state-test");
    }
    /** Lê o banco sintético usado na comparação Electron/Qt quando disponível. */
    void fixture() {
        const QString path = qEnvironmentVariable("GAMESTOCK_TEST_DATABASE");
        if (path.isEmpty()) QSKIP("Fixture de migração não informada.");
        gamestock::ReadOnlyConnection connection;
        QString error;
        QVERIFY2(connection.open(path, &error), qPrintable(error));
        gamestock::LegacyJobState state;
        QVERIFY2(gamestock::loadLegacyJobState(connection.database(), &state, &error), qPrintable(error));
        QCOMPARE(state.folders.size(), 1);
        QCOMPARE(state.folders[0].toObject().value("includeSubfolders").toBool(true), false);
        QCOMPARE(state.lastRomJob.toObject().value("status").toString(), QString("interrupted"));
        QCOMPARE(state.portabilityJobs[0].toObject().value("status").toString(), QString("interrupted"));
    }
};
QTEST_GUILESS_MAIN(LegacyJobStateTest)
#include "LegacyJobStateTest.moc"
