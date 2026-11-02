/** Verifica preferências persistentes da biblioteca e independência do inventário. */
#include "db/Database.h"
#include "db/dao/AppStateReadDao.h"
#include "services/GameService.h"
#include "services/InventoryPreferences.h"

#include <QJsonObject>
#include <QTemporaryDir>
#include <QtTest>

namespace {
/** Lê o objeto JSON persistido sem alterar o banco. */
bool readPreferences(gamestock::Database& database, QJsonObject* result, QString* error) {
    gamestock::AppStateReadDao dao(database.handle());
    QJsonValue value;
    if (!dao.get(QStringLiteral("gamestock.ui.libraryFilters"), &value, error)) return false;
    if (!value.isObject()) {
        if (error) *error = QStringLiteral("Preferências ausentes.");
        return false;
    }
    *result = value.toObject();
    return true;
}
} // namespace

/** Cobre round-trip no app_state e isolamento entre biblioteca e inventário. */
class ViewStateTest : public QObject {
    Q_OBJECT
private slots:
    /** Filtros e modo de visualização voltam iguais após reabrir o serviço. */
    void libraryPreferencesRoundTrip() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
        }
        {
            gamestock::GameService service;
            QString error;
            QVERIFY2(service.open(path, &error), qPrintable(error));
            QCOMPARE(service.viewMode(), QString("grid"));
            QCOMPARE(service.sortBy(), QString("title"));
            QCOMPARE(service.collection(), QString("all"));
            QCOMPARE(service.includeMissingCovers(), true);
            service.setViewMode("list");
            service.setSortBy("year");
            service.setGenre("Ação");
            service.setCollection("favorites");
            service.setIncludeMissingCovers(false);
            QVERIFY(service.error().isEmpty());
        }
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
            QJsonObject saved;
            QVERIFY2(readPreferences(database, &saved, &error), qPrintable(error));
            QCOMPARE(saved.value("viewMode").toString(), QString("list"));
            QCOMPARE(saved.value("sortBy").toString(), QString("year"));
            QCOMPARE(saved.value("selectedCategory").toString(), QString("Ação"));
            QCOMPARE(saved.value("collectionFilter").toString(), QString("favorites"));
            QCOMPARE(saved.value("showGamesWithoutCover").toBool(), false);
        }
        {
            gamestock::GameService restored;
            QString error;
            QVERIFY2(restored.open(path, &error), qPrintable(error));
            QCOMPARE(restored.viewMode(), QString("list"));
            QCOMPARE(restored.sortBy(), QString("year"));
            QCOMPARE(restored.genre(), QString("Ação"));
            QCOMPARE(restored.collection(), QString("favorites"));
            QCOMPARE(restored.includeMissingCovers(), false);
        }
    }

    /** Alterar preferências do inventário não toca no estado nem no JSON da biblioteca. */
    void inventoryIsIndependent() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
        }
        gamestock::GameService library;
        QString error;
        QVERIFY2(library.open(path, &error), qPrintable(error));
        library.setViewMode("list");
        library.setSortBy("recent");

        gamestock::InventoryPreferences inventory;
        QCOMPARE(inventory.viewMode(), QString("grid"));
        QCOMPARE(inventory.sortBy(), QString("name"));
        inventory.setViewMode("list");
        inventory.setSearch("controle");
        inventory.setSortBy("recent");
        // Valores inválidos preservam a preferência anterior.
        inventory.setViewMode("cards");
        inventory.setSortBy("title");
        QCOMPARE(inventory.viewMode(), QString("list"));
        QCOMPARE(inventory.sortBy(), QString("recent"));
        // A biblioteca permanece exatamente como estava.
        QCOMPARE(library.viewMode(), QString("list"));
        QCOMPARE(library.sortBy(), QString("recent"));
        QCOMPARE(library.collection(), QString("all"));

        library.setViewMode("grid");
        QCOMPARE(inventory.viewMode(), QString("list"));
        QCOMPARE(inventory.search(), QString("controle"));
    }
};

QTEST_GUILESS_MAIN(ViewStateTest)
#include "ViewStateTest.moc"
