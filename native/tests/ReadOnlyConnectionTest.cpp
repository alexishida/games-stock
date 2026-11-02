/** Exercita conexões QSQLITE isoladas com arquivo temporário. */
#include "db/ReadOnlyConnection.h"
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QtTest>

/** Confere pragmas e garante que a conexão experimental não modifica dados. */
class ReadOnlyConnectionTest : public QObject {
    Q_OBJECT
private slots:
    /** O arquivo ausente não deve ser criado implicitamente. */
    void missingFile() {
        QTemporaryDir dir;
        gamestock::ReadOnlyConnection connection;
        QString error;
        const QString path = dir.filePath("ausente.db");
        QVERIFY(!connection.open(path, &error));
        QVERIFY(!error.isEmpty());
        QVERIFY(!QFileInfo::exists(path));
    }
    /** A conexão ativa foreign keys, timeout e recusa escrita no banco existente. */
    void readOnlyAndPragmas() {
        QTemporaryDir dir;
        const QString path = dir.filePath("fixture.db");
        {
            QSqlDatabase setup = QSqlDatabase::addDatabase("QSQLITE", "fixture-setup");
            setup.setDatabaseName(path);
            QVERIFY(setup.open());
            QSqlQuery query(setup);
            QVERIFY(query.exec("CREATE TABLE games (id INTEGER PRIMARY KEY, title TEXT)"));
            QVERIFY(query.exec("INSERT INTO games VALUES (1, 'Legado')"));
            query.finish();
            setup.close();
        }
        QSqlDatabase::removeDatabase("fixture-setup");
        gamestock::ReadOnlyConnection connection;
        QString error;
        QVERIFY2(connection.open(path, &error), qPrintable(error));
        QSqlQuery query(connection.database());
        QVERIFY(query.exec("PRAGMA foreign_keys")); QVERIFY(query.next()); QCOMPARE(query.value(0).toInt(), 1);
        QVERIFY(query.exec("PRAGMA busy_timeout")); QVERIFY(query.next()); QCOMPARE(query.value(0).toInt(), 10000);
        QVERIFY(query.exec("SELECT title FROM games WHERE id = 1")); QVERIFY(query.next()); QCOMPARE(query.value(0).toString(), QString("Legado"));
        QVERIFY(!query.exec("DELETE FROM games"));
    }
};
QTEST_GUILESS_MAIN(ReadOnlyConnectionTest)
#include "ReadOnlyConnectionTest.moc"
