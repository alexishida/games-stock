/** Verifica jobs de backup no JobManager, persistência e resultado final. */
#include "db/Database.h"
#include "jobs/JobManager.h"
#include "jobs/JobRegistry.h"
#include "services/BackupCoordinator.h"

#include <QDir>
#include <QFile>
#include <QImage>
#include <QJsonArray>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QtTest>

namespace {
/** Cria uma imagem PNG pequena. */
bool writeImage(const QString& path) {
    if (!QDir().mkpath(QFileInfo(path).absolutePath())) return false;
    QImage image(4, 4, QImage::Format_RGB32);
    image.fill(QColor(20, 200, 220));
    return image.save(path, "PNG");
}

/** Banco mínimo com um jogo, mídia e um item de inventário. */
bool seed(const QString& path, const QString& profile) {
    gamestock::Database database;
    QString error;
    if (!database.open(path, QDir(profile).filePath("images"), &error)) return false;
    QSqlQuery platform(database.handle());
    if (!platform.exec(QStringLiteral("SELECT id FROM platforms LIMIT 1")) || !platform.next()) return false;
    const qint64 platformId = platform.value(0).toLongLong();
    const QString cover = QDir(profile).filePath("images/snes/cover.png");
    const QString photo = QDir(profile).filePath("inventario/images/1/foto.png");
    if (!writeImage(cover) || !writeImage(photo)) return false;
    QSqlQuery game(database.handle());
    game.prepare(QStringLiteral(
        "INSERT INTO games (title, platform_id, box_art_path, favorite) VALUES ('Jogo Job', ?, ?, 1)"));
    game.addBindValue(platformId);
    game.addBindValue(cover);
    if (!game.exec()) return false;
    QSqlQuery type(database.handle());
    QSqlQuery state(database.handle());
    if (!type.exec(QStringLiteral("SELECT id FROM item_types LIMIT 1")) || !type.next()) return false;
    if (!state.exec(QStringLiteral("SELECT id FROM conservation_states LIMIT 1")) || !state.next()) return false;
    QSqlQuery item(database.handle());
    item.prepare(QStringLiteral(
        "INSERT INTO hardware_items (name, item_type_id, conservation_state_id, description) VALUES ('Item Job', ?, ?, '')"));
    item.addBindValue(type.value(0));
    item.addBindValue(state.value(0));
    if (!item.exec()) return false;
    QSqlQuery photoRow(database.handle());
    photoRow.prepare(QStringLiteral(
        "INSERT INTO hardware_item_photos (item_id, file_path, sort_order) VALUES (?, ?, 0)"));
    photoRow.addBindValue(item.lastInsertId());
    photoRow.addBindValue(photo);
    return photoRow.exec();
}
} // namespace

class BackupCoordinatorTest : public QObject {
    Q_OBJECT
private slots:
    void exportAndImportRunAsJobs() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString profile = dir.filePath("perfil");
        const QString databasePath = QDir(profile).filePath("gamestock.db");
        QVERIFY(seed(databasePath, profile));

        QJsonArray persisted;
        gamestock::JobRegistry registry([&persisted](const QJsonArray& jobs, QString*) {
            persisted = jobs;
            return true;
        });
        gamestock::JobManager manager(&registry);
        gamestock::BackupCoordinator coordinator;
        QString error;
        QVERIFY2(coordinator.configure(&manager, databasePath, profile, QStringLiteral("1.1.4"), &error),
            qPrintable(error));

        QString finishedId;
        QJsonObject finishedJob;
        connect(&manager, &gamestock::JobManager::jobFinished, this,
            [&finishedId, &finishedJob](const QString& id, const QJsonObject& job) {
                finishedId = id;
                finishedJob = job;
            });

        const QString packagePath = dir.filePath("job-backup.gamestock-backup");
        QVERIFY(coordinator.startExport(QVariantMap{{QStringLiteral("categories"),
            QStringList{QStringLiteral("metadata"), QStringLiteral("images"), QStringLiteral("inventoryImages")}},
            {QStringLiteral("targetPath"), packagePath}}));
        QTRY_VERIFY_WITH_TIMEOUT(!finishedId.isEmpty(), 20000);
        QCOMPARE(finishedJob.value(QStringLiteral("status")).toString(), QStringLiteral("completed"));
        QCOMPARE(finishedJob.value(QStringLiteral("kind")).toString(), QStringLiteral("data-portability-export"));
        QVERIFY(QFileInfo::exists(packagePath));
        QVERIFY(finishedJob.value(QStringLiteral("result")).toObject().contains(QStringLiteral("manifest")));
        bool persistedExport = false;
        for (const QJsonValue& value : persisted) {
            if (value.toObject().value(QStringLiteral("kind")).toString() == QLatin1String("data-portability-export")) {
                persistedExport = true;
            }
        }
        QVERIFY(persistedExport);

        finishedId.clear();
        finishedJob = {};
        QVERIFY(coordinator.startImport(QVariantMap{{QStringLiteral("packagePath"), packagePath},
            {QStringLiteral("categories"), QStringList{QStringLiteral("metadata"), QStringLiteral("inventoryImages")}}}));
        QTRY_VERIFY_WITH_TIMEOUT(!finishedId.isEmpty(), 20000);
        QCOMPARE(finishedJob.value(QStringLiteral("status")).toString(), QStringLiteral("completed"));
        QCOMPARE(finishedJob.value(QStringLiteral("kind")).toString(), QStringLiteral("data-portability-import"));
        const QJsonObject result = finishedJob.value(QStringLiteral("result")).toObject();
        QVERIFY(result.value(QStringLiteral("success")).toBool());

        // Jobs terminais podem ser dispensados e o registro persiste a remoção.
        QVERIFY(manager.dismiss(finishedId));
        QTRY_VERIFY(manager.jobs().size() <= 1);
        QVERIFY(manager.shutdown(5000));
    }
};

QTEST_GUILESS_MAIN(BackupCoordinatorTest)
#include "BackupCoordinatorTest.moc"
