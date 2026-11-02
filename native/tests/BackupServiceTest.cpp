/** Exportação/importação das cinco categorias e matching cruzado com fixture Electron. */
#include "db/Database.h"
#include "portability/ZipArchive.h"
#include "services/BackupService.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QImage>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QtTest>

#ifndef GAMESTOCK_TEST_FIXTURES
#define GAMESTOCK_TEST_FIXTURES ""
#endif

namespace {
/** Cria uma imagem válida para mídia de capa ou foto. */
bool writeImage(const QString& path, const QColor& color) {
    if (!QDir().mkpath(QFileInfo(path).absolutePath())) return false;
    QImage image(8, 8, QImage::Format_RGB32);
    image.fill(color);
    return image.save(path, "PNG");
}

/** Cria banco limpo com schema/seeds e devolve o ID da plataforma SNES. */
qint64 prepareDatabase(const QString& path, const QString& profile, QString* error) {
    gamestock::Database database;
    if (!database.open(path, QDir(profile).filePath("images"), error)) return 0;
    QSqlQuery query(database.handle());
    query.prepare(QStringLiteral("SELECT id FROM platforms WHERE name = ?"));
    query.addBindValue(QStringLiteral("Super Nintendo"));
    if (!query.exec() || !query.next()) return 0;
    return query.value(0).toLongLong();
}

/** Popula o perfil de origem com jogo, mídia, emulador e inventário. */
bool seedProfile(const QString& path, const QString& profile) {
    QString error;
    const qint64 snes = prepareDatabase(path, profile, &error);
    if (!snes) return false;
    const QString rom = QDir(profile).filePath("ROMs/jogo.nes");
    const QString cover = QDir(profile).filePath("images/snes/cover.png");
    const QString photoPath = QDir(profile).filePath("inventario/images/1/foto.png");
    if (!writeImage(cover, QColor(10, 200, 220)) || !writeImage(photoPath, QColor(220, 120, 10))) return false;
    if (!QDir().mkpath(QFileInfo(rom).absolutePath())) return false;
    QFile romFile(rom);
    if (!romFile.open(QIODevice::WriteOnly)) return false;
    romFile.write("rom");
    romFile.close();

    gamestock::Database database;
    if (!database.open(path, QDir(profile).filePath("images"), &error)) return false;
    QSqlDatabase& handle = database.handle();
    QSqlQuery game(handle);
    game.prepare(QStringLiteral(
        "INSERT INTO games (title, platform_id, publisher, year, genre, rating, favorite, play_status, notes, "
        "launchbox_id, rom_path, box_art_path, library_group_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"));
    game.addBindValue(QStringLiteral("Jogo Exportado"));
    game.addBindValue(snes);
    game.addBindValue(QStringLiteral("Publisher X"));
    game.addBindValue(1999);
    game.addBindValue(QStringLiteral("Ação"));
    game.addBindValue(QStringLiteral("E"));
    game.addBindValue(1);
    game.addBindValue(QStringLiteral("playing"));
    game.addBindValue(QStringLiteral("Notas preservadas"));
    game.addBindValue(QStringLiteral("lb-export-1"));
    game.addBindValue(rom);
    game.addBindValue(cover);
    game.addBindValue(QString());
    if (!game.exec()) return false;

    QSqlQuery emulator(handle);
    emulator.prepare(QStringLiteral("INSERT INTO emulators (name, executable, args, is_retroarch) VALUES (?, ?, ?, 0)"));
    emulator.addBindValue(QStringLiteral("Dolphin Teste"));
    emulator.addBindValue(QStringLiteral("C:/emuladores/dolphin.exe"));
    emulator.addBindValue(QStringLiteral("-b"));
    if (!emulator.exec()) return false;
    const qint64 emulatorId = emulator.lastInsertId().toLongLong();
    QSqlQuery link(handle);
    link.prepare(QStringLiteral(
        "INSERT INTO platform_emulators (platform_id, emulator_id, is_default, core_path) VALUES (?, ?, 1, NULL)"));
    link.addBindValue(snes);
    link.addBindValue(emulatorId);
    if (!link.exec()) return false;

    QSqlQuery alias(handle);
    alias.prepare(QStringLiteral("INSERT OR IGNORE INTO platform_launchbox_aliases (platform_id, alias) VALUES (?, ?)"));
    alias.addBindValue(snes);
    alias.addBindValue(QStringLiteral("SNES Teste"));
    if (!alias.exec()) return false;
    QSqlQuery extension(handle);
    extension.prepare(QStringLiteral(
        "INSERT OR IGNORE INTO platform_rom_extensions (platform_id, extension, kind, is_primary) VALUES (?, ?, ?, 1)"));
    extension.addBindValue(snes);
    extension.addBindValue(QStringLiteral(".sfc"));
    extension.addBindValue(QStringLiteral("ROM"));
    if (!extension.exec()) return false;

    QSqlQuery typeId(handle);
    QSqlQuery stateId(handle);
    if (!typeId.exec(QStringLiteral("SELECT id FROM item_types WHERE name = 'Console'")) || !typeId.next()) return false;
    if (!stateId.exec(QStringLiteral("SELECT id FROM conservation_states WHERE name = 'Bom'")) || !stateId.next()) return false;
    QSqlQuery item(handle);
    item.prepare(QStringLiteral(
        "INSERT INTO hardware_items (name, platform_id, is_multiplatform, item_type_id, conservation_state_id, "
        "description, color, value) VALUES (?, ?, 0, ?, ?, ?, ?, ?)"));
    item.addBindValue(QStringLiteral("Console Físico"));
    item.addBindValue(snes);
    item.addBindValue(typeId.value(0));
    item.addBindValue(stateId.value(0));
    item.addBindValue(QStringLiteral("Item com foto"));
    item.addBindValue(QStringLiteral("Cinza"));
    item.addBindValue(150.0);
    if (!item.exec()) return false;
    const qint64 itemId = item.lastInsertId().toLongLong();
    QSqlQuery photo(handle);
    photo.prepare(QStringLiteral(
        "INSERT INTO hardware_item_photos (item_id, file_path, sort_order) VALUES (?, ?, 0)"));
    photo.addBindValue(itemId);
    photo.addBindValue(photoPath);
    if (!photo.exec()) return false;
    return true;
}

/** Conta linhas de uma tabela no banco de destino. */
qint64 countRows(const QString& path, const QString& table) {
    gamestock::Database database;
    QString error;
    if (!database.open(path, QFileInfo(path).absolutePath() + QStringLiteral("/images"), &error)) return -1;
    QSqlQuery query(database.handle());
    if (!query.exec(QStringLiteral("SELECT COUNT(*) FROM ") + table) || !query.next()) return -1;
    return query.value(0).toLongLong();
}
} // namespace

class BackupServiceTest : public QObject {
    Q_OBJECT
private slots:
    void exportAndRoundTripAllCategories() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString sourceProfile = dir.filePath("origem");
        const QString sourceDb = QDir(sourceProfile).filePath("gamestock.db");
        QVERIFY(seedProfile(sourceDb, sourceProfile));

        gamestock::BackupService source;
        QString error;
        QVERIFY2(source.open(sourceDb, sourceProfile, QStringLiteral("1.1.4"), &error), qPrintable(error));
        const QString target = dir.filePath("backup-exportado");
        const QVariantMap exported = source.exportPackage(QVariantMap{
            {QStringLiteral("categories"), QStringList{QStringLiteral("metadata"), QStringLiteral("images"),
                 QStringLiteral("platforms"), QStringLiteral("romLocations"), QStringLiteral("inventoryImages")}},
            {QStringLiteral("targetPath"), target}});
        QVERIFY2(exported.value(QStringLiteral("success")).toBool(), qPrintable(exported.value(QStringLiteral("error")).toString()));
        const QString packagePath = exported.value(QStringLiteral("filePath")).toString();
        QVERIFY(packagePath.endsWith(QStringLiteral(".gamestock-backup")));
        QVERIFY(QFileInfo::exists(packagePath));
        const QString exportOut = qEnvironmentVariable("GAMESTOCK_BACKUP_EXPORT_OUT");
        if (!exportOut.isEmpty() && !QFile::copy(packagePath, exportOut)) {
            qWarning() << "Falha ao copiar exportação de compatibilidade:" << exportOut;
        }
        const QVariantMap manifest = exported.value(QStringLiteral("manifest")).toMap();
        QCOMPARE(manifest.value(QStringLiteral("schemaVersion")).toInt(), 1);
        QCOMPARE(manifest.value(QStringLiteral("categories")).toStringList().size(), 5);

        gamestock::ZipReader zip;
        QVERIFY2(zip.open(packagePath, &error), qPrintable(error));
        for (const QString& required : {QStringLiteral("manifest.json"), QStringLiteral("data/games.json"),
                 QStringLiteral("data/platforms.json"), QStringLiteral("data/mediaMap.json"),
                 QStringLiteral("data/romLocations.json"), QStringLiteral("data/inventory.json")}) {
            QVERIFY2(zip.contains(required), qPrintable(required));
        }
        bool hasMedia = false;
        bool hasInventoryMedia = false;
        for (const gamestock::ZipEntryInfo& entry : zip.entries()) {
            if (entry.path.startsWith(QStringLiteral("media/"))) hasMedia = true;
            if (entry.path.startsWith(QStringLiteral("inventory-media/"))) hasInventoryMedia = true;
        }
        QVERIFY(hasMedia);
        QVERIFY(hasInventoryMedia);

        const QString destinationProfile = dir.filePath("destino");
        const QString destinationDb = QDir(destinationProfile).filePath("gamestock.db");
        QString dbError;
        QVERIFY(prepareDatabase(destinationDb, destinationProfile, &dbError) > 0);
        gamestock::BackupService destination;
        QVERIFY2(destination.open(destinationDb, destinationProfile, QStringLiteral("1.1.4"), &error), qPrintable(error));

        const QVariantMap preview = destination.preview(packagePath);
        QVERIFY2(preview.value(QStringLiteral("success")).toBool(), qPrintable(preview.value(QStringLiteral("error")).toString()));
        QCOMPARE(preview.value(QStringLiteral("availableCategories")).toStringList().size(), 5);
        QCOMPARE(preview.value(QStringLiteral("errors")).toList().size(), 0);
        const QVariantMap conflicts = preview.value(QStringLiteral("conflicts")).toMap();
        QCOMPARE(conflicts.value(QStringLiteral("games")).toMap().value(QStringLiteral("create")).toInt(), 1);
        QCOMPARE(conflicts.value(QStringLiteral("platforms")).toMap().value(QStringLiteral("create")).toInt(), 0);

        // Falha simulada após o staging deve reverter SQLite e restaurar a mídia preexistente.
        const QString existingCover = QDir(destinationProfile).filePath("images/snes/cover.png");
        QVERIFY(QDir().mkpath(QFileInfo(existingCover).absolutePath()));
        {
            QFile old(existingCover);
            QVERIFY(old.open(QIODevice::WriteOnly | QIODevice::Truncate));
            old.write("conteudo-antigo");
        }
        qputenv("GAMESTOCK_BACKUP_TEST_FAIL_AFTER_STAGE", "1");
        const QVariantMap failed = destination.importPackage(QVariantMap{
            {QStringLiteral("packagePath"), packagePath},
            {QStringLiteral("categories"), QStringList{QStringLiteral("metadata"), QStringLiteral("images"),
                 QStringLiteral("platforms"), QStringLiteral("romLocations"), QStringLiteral("inventoryImages")}}});
        qunsetenv("GAMESTOCK_BACKUP_TEST_FAIL_AFTER_STAGE");
        QVERIFY(!failed.value(QStringLiteral("success")).toBool());
        QCOMPARE(countRows(destinationDb, QStringLiteral("games")), qint64(0));
        QCOMPARE(countRows(destinationDb, QStringLiteral("hardware_items")), qint64(0));
        {
            QFile old(existingCover);
            QVERIFY(old.open(QIODevice::ReadOnly));
            QCOMPARE(old.readAll(), QByteArray("conteudo-antigo"));
        }
        QVERIFY(!QDir(QDir(destinationProfile).filePath(".backup-staging")).exists()
            || QDir(QDir(destinationProfile).filePath(".backup-staging")).isEmpty());

        const QVariantMap imported = destination.importPackage(QVariantMap{
            {QStringLiteral("packagePath"), packagePath},
            {QStringLiteral("categories"), QStringList{QStringLiteral("metadata"), QStringLiteral("images"),
                 QStringLiteral("platforms"), QStringLiteral("romLocations"), QStringLiteral("inventoryImages")}}});
        QVERIFY2(imported.value(QStringLiteral("success")).toBool(), qPrintable(imported.value(QStringLiteral("error")).toString()));
        const QVariantMap summary = imported.value(QStringLiteral("summary")).toMap();
        QCOMPARE(summary.value(QStringLiteral("metadata")).toMap().value(QStringLiteral("created")).toInt(), 1);
        QCOMPARE(summary.value(QStringLiteral("inventoryImages")).toMap().value(QStringLiteral("itemsCreated")).toInt(), 1);
        QCOMPARE(summary.value(QStringLiteral("inventoryImages")).toMap().value(QStringLiteral("photosImported")).toInt(), 1);
        QCOMPARE(countRows(destinationDb, QStringLiteral("games")), qint64(1));
        QCOMPARE(countRows(destinationDb, QStringLiteral("hardware_items")), qint64(1));

        {
            gamestock::Database database;
            QVERIFY2(database.open(destinationDb, QDir(destinationProfile).filePath("images"), &dbError), qPrintable(dbError));
            QSqlQuery game(database.handle());
            QVERIFY(game.exec(QStringLiteral("SELECT title, favorite, play_status, launchbox_id, box_art_path, rom_path FROM games")));
            QVERIFY(game.next());
            QCOMPARE(game.value(0).toString(), QString("Jogo Exportado"));
            QCOMPARE(game.value(1).toInt(), 1);
            QCOMPARE(game.value(2).toString(), QString("playing"));
            QCOMPARE(game.value(3).toString(), QString("lb-export-1"));
            QVERIFY(game.value(4).toString().contains(QStringLiteral("images/snes/cover.png")));
            QVERIFY(QFileInfo::exists(game.value(4).toString()));
            QVERIFY(QFileInfo::exists(game.value(5).toString()));
            QSqlQuery photo(database.handle());
            QVERIFY(photo.exec(QStringLiteral("SELECT file_path FROM hardware_item_photos")));
            QVERIFY(photo.next());
            QVERIFY(QFileInfo::exists(photo.value(0).toString()));
            QSqlQuery link(database.handle());
            QVERIFY(link.exec(QStringLiteral(
                "SELECT COUNT(*) FROM platform_emulators pe JOIN emulators e ON e.id = pe.emulator_id "
                "WHERE e.name = 'Dolphin Teste'")));
            QVERIFY(link.next());
            QCOMPARE(link.value(0).toInt(), 1);
        }

        // Reimportação não duplica jogo, item ou foto.
        const QVariantMap again = destination.importPackage(QVariantMap{
            {QStringLiteral("packagePath"), packagePath},
            {QStringLiteral("categories"), QStringList{QStringLiteral("metadata"), QStringLiteral("inventoryImages")}}});
        QVERIFY2(again.value(QStringLiteral("success")).toBool(), qPrintable(again.value(QStringLiteral("error")).toString()));
        const QVariantMap againSummary = again.value(QStringLiteral("summary")).toMap();
        QCOMPARE(againSummary.value(QStringLiteral("metadata")).toMap().value(QStringLiteral("created")).toInt(), 0);
        QCOMPARE(againSummary.value(QStringLiteral("metadata")).toMap().value(QStringLiteral("updated")).toInt(), 1);
        QCOMPARE(countRows(destinationDb, QStringLiteral("games")), qint64(1));
        QCOMPARE(countRows(destinationDb, QStringLiteral("hardware_items")), qint64(1));
        QCOMPARE(countRows(destinationDb, QStringLiteral("hardware_item_photos")), qint64(1));
    }

    void invalidPackageAndFileFailureRollback() {
        const QString fixtures = QString::fromUtf8(GAMESTOCK_TEST_FIXTURES);
        const QString packagePath = QDir(fixtures).filePath("complete.gamestock-backup");
        if (!QFile::exists(packagePath)) QSKIP("Fixture Electron ausente.");
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString profile = dir.filePath("perfil");
        const QString databasePath = QDir(profile).filePath("gamestock.db");
        QString error;
        QVERIFY(prepareDatabase(databasePath, profile, &error) > 0);
        gamestock::BackupService service;
        QVERIFY2(service.open(databasePath, profile, QStringLiteral("1.1.4"), &error), qPrintable(error));

        const QString corrupt = dir.filePath("corrompido.gamestock-backup");
        {
            QFile file(corrupt);
            QVERIFY(file.open(QIODevice::WriteOnly));
            file.write("isto nao e um zip");
        }
        const QVariantMap corruptPreview = service.preview(corrupt);
        QVERIFY(!corruptPreview.value(QStringLiteral("success")).toBool());
        const QVariantMap corruptImport = service.importPackage(QVariantMap{
            {QStringLiteral("packagePath"), corrupt},
            {QStringLiteral("categories"), QStringList{QStringLiteral("metadata")}}});
        QVERIFY(!corruptImport.value(QStringLiteral("success")).toBool());

        // O diretório de imagens vira arquivo: a aplicação do staging falha e o SQLite reverte.
        QDir(QDir(profile).filePath("images")).removeRecursively();
        {
            QFile blocker(QDir(profile).filePath("images"));
            QVERIFY(blocker.open(QIODevice::WriteOnly));
            blocker.write("bloqueio");
        }
        const QVariantMap failed = service.importPackage(QVariantMap{
            {QStringLiteral("packagePath"), packagePath},
            {QStringLiteral("categories"), QStringList{QStringLiteral("metadata"), QStringLiteral("images")}}});
        QVERIFY(!failed.value(QStringLiteral("success")).toBool());
        QVERIFY(QFileInfo(QDir(profile).filePath("images")).isFile());
        // Remove o bloqueio apenas para reabrir o banco e confirmar o rollback.
        QFile::remove(QDir(profile).filePath("images"));
        QVERIFY(QDir().mkpath(QDir(profile).filePath("images")));
        QCOMPARE(countRows(databasePath, QStringLiteral("games")), qint64(0));
        QVERIFY(!QDir(QDir(profile).filePath(".backup-staging")).exists()
            || QDir(QDir(profile).filePath(".backup-staging")).isEmpty());
    }

    void electronFixtureImportsWithoutDuplicates() {
        const QString fixtures = QString::fromUtf8(GAMESTOCK_TEST_FIXTURES);
        const QString packagePath = QDir(fixtures).filePath("complete.gamestock-backup");
        if (!QFile::exists(packagePath)) QSKIP("Fixture Electron ausente.");
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString profile = dir.filePath("perfil");
        const QString databasePath = QDir(profile).filePath("gamestock.db");
        QString error;
        QVERIFY(prepareDatabase(databasePath, profile, &error) > 0);
        gamestock::BackupService service;
        QVERIFY2(service.open(databasePath, profile, QStringLiteral("1.1.4"), &error), qPrintable(error));

        const QVariantMap preview = service.preview(packagePath);
        QVERIFY2(preview.value(QStringLiteral("success")).toBool(), qPrintable(preview.value(QStringLiteral("error")).toString()));
        QCOMPARE(preview.value(QStringLiteral("manifest")).toMap().value(QStringLiteral("schemaVersion")).toInt(), 1);
        QCOMPARE(preview.value(QStringLiteral("availableCategories")).toStringList().size(), 5);
        QCOMPARE(preview.value(QStringLiteral("errors")).toList().size(), 0);
        QVERIFY(preview.value(QStringLiteral("counts")).toMap().value(QStringLiteral("games")).toInt() >= 3);

        const QVariantMap imported = service.importPackage(QVariantMap{
            {QStringLiteral("packagePath"), packagePath},
            {QStringLiteral("categories"), QStringList{QStringLiteral("metadata"), QStringLiteral("images"),
                 QStringLiteral("platforms"), QStringLiteral("romLocations"), QStringLiteral("inventoryImages")}}});
        QVERIFY2(imported.value(QStringLiteral("success")).toBool(), qPrintable(imported.value(QStringLiteral("error")).toString()));
        const QVariantMap summary = imported.value(QStringLiteral("summary")).toMap();
        // O Electron também restaura 2 jogos: as duas variantes com mesmo título e
        // romFileName são reconciliadas com o placeholder criado pelos metadados.
        QCOMPARE(countRows(databasePath, QStringLiteral("games")), qint64(2));
        QCOMPARE(countRows(databasePath, QStringLiteral("hardware_items")), qint64(2));
        QVERIFY(summary.value(QStringLiteral("images")).toMap().value(QStringLiteral("imported")).toInt() >= 1);

        const QVariantMap again = service.importPackage(QVariantMap{
            {QStringLiteral("packagePath"), packagePath},
            {QStringLiteral("categories"), QStringList{QStringLiteral("inventoryImages")}}});
        QVERIFY2(again.value(QStringLiteral("success")).toBool(), qPrintable(again.value(QStringLiteral("error")).toString()));
        QCOMPARE(countRows(databasePath, QStringLiteral("games")), qint64(2));
        QCOMPARE(countRows(databasePath, QStringLiteral("hardware_items")), qint64(2));
        QCOMPARE(countRows(databasePath, QStringLiteral("hardware_item_photos")), qint64(1));
    }
};

QTEST_GUILESS_MAIN(BackupServiceTest)
#include "BackupServiceTest.moc"
