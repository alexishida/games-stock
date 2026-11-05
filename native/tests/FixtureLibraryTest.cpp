/** Verifica paginação e busca do serviço usado somente por fixtures sintéticas. */
#include "app/FixtureLibrary.h"
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QtTest>

/** Confere transições observáveis sem inicializar interface gráfica. */
class FixtureLibraryTest : public QObject {
    Q_OBJECT
private slots:
    /** Mudanças de página e busca atualizam contagens e bloqueiam limites inválidos. */
    void paginationAndSearch() {
        QTemporaryDir dir;
        const QString path = dir.filePath("fixture.db");
        {
            QSqlDatabase db = QSqlDatabase::addDatabase("QSQLITE", "service-fixture");
            db.setDatabaseName(path);
            QVERIFY(db.open());
            QSqlQuery query(db);
            QVERIFY(query.exec("CREATE TABLE platforms (id INTEGER PRIMARY KEY, name TEXT)"));
            QVERIFY(query.exec("CREATE TABLE games (id INTEGER PRIMARY KEY, title TEXT, title_normalized TEXT, platform_id INTEGER, rom_path TEXT, library_group_key TEXT, year INTEGER, created_at TEXT, launch_count INTEGER, box_art_path TEXT, genre TEXT, favorite INTEGER DEFAULT 0, play_status TEXT DEFAULT 'unplayed')"));
            QVERIFY(query.exec("INSERT INTO platforms VALUES (1,'Fixture')"));
            QVERIFY(query.prepare("INSERT INTO games (id,title,platform_id,launch_count) VALUES (?, ?, 1, 0)"));
            for (int index = 1; index <= 80; ++index) {
                query.bindValue(0, index);
                query.bindValue(1, QStringLiteral("Jogo %1").arg(index, 3, 10, QLatin1Char('0')));
                QVERIFY(query.exec());
            }
            // A busca usa a coluna derivada; a fixture minimalista a preenche como o DAO faria.
            QVERIFY(query.exec("UPDATE games SET title_normalized = lower(title)"));
            QVERIFY(query.exec("UPDATE games SET genre='Ação; Plataforma', favorite=1, box_art_path='capa' WHERE id=80"));
        }
        QSqlDatabase::removeDatabase("service-fixture");
        gamestock::FixtureLibrary library;
        QSignalSpy changes(&library, &gamestock::FixtureLibrary::changed);
        QVERIFY(library.open(path));
        QCOMPARE(library.total(), 80);
        QCOMPARE(library.filtered(), 80);
        QCOMPARE(library.games().size(), 36);
        library.goToPage(2);
        QCOMPARE(library.page(), 2);
        QCOMPARE(library.games().first().toMap().value("title").toString(), QString("Jogo 037"));
        library.goToPage(99);
        QCOMPARE(library.page(), 2);
        library.setSearch("Jogo 080");
        QCOMPARE(library.page(), 1);
        QCOMPARE(library.total(), 80);
        QCOMPARE(library.filtered(), 1);
        QCOMPARE(library.games().first().toMap().value("title").toString(), QString("Jogo 080"));
        QCOMPARE(library.counts().value("favorites").toInt(), 1);
        library.setCollection("favorites");
        QCOMPARE(library.collection(), QString("favorites"));
        QCOMPARE(library.filtered(), 1);
        library.setSortBy("recent");
        QCOMPARE(library.sortBy(), QString("recent"));
        library.setSortBy("inválido");
        QCOMPARE(library.sortBy(), QString("recent"));
        QVERIFY(library.genres().contains("Ação"));
        library.setSearch("");
        library.setGenre("Ação");
        QCOMPARE(library.filtered(), 1);
        QCOMPARE(library.games().first().toMap().value("title").toString(), QString("Jogo 080"));
        library.setGenre("");
        library.setCollection("all");
        library.setIncludeMissingCovers(false);
        QCOMPARE(library.filtered(), 1);
        QVERIFY(!library.includeMissingCovers());
        QVERIFY(changes.size() >= 3);
    }
    /** A capa do primeiro jogo da fixture deve usar o provider restrito. */
    void fixtureCover() {
        const QString path = qEnvironmentVariable("GAMESTOCK_TEST_DATABASE");
        if (path.isEmpty()) QSKIP("Fixture de migração não informada.");
        gamestock::FixtureLibrary library;
        QVERIFY2(library.open(path), qPrintable(library.error()));
        QVERIFY(library.games().first().toMap().value("coverUrl").toString().startsWith("image://profilemedia/"));
    }
};
QTEST_GUILESS_MAIN(FixtureLibraryTest)
#include "FixtureLibraryTest.moc"
