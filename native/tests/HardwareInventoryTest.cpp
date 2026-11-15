/** Verifica regras do inventário físico, fotos e cadastros auxiliares. */
#include "db/Database.h"
#include "services/InventoryService.h"
#include "jobs/JobManager.h"
#include "jobs/JobRegistry.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QElapsedTimer>
#include <QImage>
#include <QSqlError>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QTimer>
#include <QtTest>

namespace {
/** Cria o banco temporário com schema, migrations e seeds do Electron. */
bool prepareDatabase(const QString& path, const QString& imagesDir, QString* error) {
    gamestock::Database database;
    return database.open(path, imagesDir, error);
}

/** Localiza uma plataforma semeada pelo nome. */
qint64 platformId(const QString& path, const QString& name) {
    gamestock::Database database;
    QString error;
    if (!database.open(path, QFileInfo(path).absolutePath() + QStringLiteral("/images"), &error)) return 0;
    QSqlQuery query(database.handle());
    query.prepare(QStringLiteral("SELECT id FROM platforms WHERE name = ?"));
    query.bindValue(0, name);
    if (!query.exec() || !query.next()) return 0;
    return query.value(0).toLongLong();
}

/** Encontra um item da página pelo nome. */
QVariantMap findByName(const QVariantList& items, const QString& name) {
    for (const QVariant& entry : items) {
        if (entry.toMap().value(QStringLiteral("name")).toString() == name) return entry.toMap();
    }
    return {};
}

/** Localiza o ID de um tipo/estado pelo nome. */
qint64 idForName(const QVariantList& values, const QString& name) {
    for (const QVariant& entry : values) {
        if (entry.toMap().value(QStringLiteral("name")).toString() == name) {
            return entry.toMap().value(QStringLiteral("id")).toLongLong();
        }
    }
    return 0;
}

/** Gera uma imagem válida para o teste de cópia. */
QString makePng(const QString& path) {
    QImage image(4, 4, QImage::Format_RGB32);
    image.fill(QColor(0, 210, 230));
    if (!image.save(path, "PNG")) return {};
    return QFileInfo(path).absoluteFilePath();
}
} // namespace

/** Cobre CRUD, filtros, ordenação, fotos e catálogos sem tocar no perfil real. */
class HardwareInventoryTest : public QObject {
    Q_OBJECT
private slots:
    void defaultsAndCreate() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        const QString profile = dir.filePath("profile");
        QVERIFY(QDir().mkpath(profile));
        QString error;
        QVERIFY2(prepareDatabase(path, dir.filePath("db/images"), &error), qPrintable(error));
        const qint64 snes = platformId(path, QStringLiteral("Super Nintendo"));
        const qint64 nes = platformId(path, QStringLiteral("Nintendo NES"));
        QVERIFY(snes > 0 && nes > 0);

        gamestock::InventoryService service;
        QVERIFY2(service.open(path, profile, &error), qPrintable(error));
        QCOMPARE(service.types().size(), 8);
        QCOMPARE(service.states().size(), 5);
        QCOMPARE(service.types().first().toMap().value("is_default").toInt(), 1);
        QCOMPARE(service.states().first().toMap().value("is_default").toInt(), 1);

        const qint64 typeId = idForName(service.types(), QStringLiteral("Console"));
        const qint64 stateId = idForName(service.states(), QStringLiteral("Bom"));
        QVERIFY(typeId > 0 && stateId > 0);
        const QVariantMap created = service.create({{"name", "  Super Nintendo original  "},
            {"platform_id", snes}, {"item_type_id", typeId}, {"conservation_state_id", stateId},
            {"description", "Console com caixa"}, {"value", 350.0}, {"color", "Cinza"}});
        QVERIFY2(!created.isEmpty(), qPrintable(service.error()));
        QCOMPARE(created.value("name").toString(), QString("Super Nintendo original"));
        QCOMPARE(created.value("platform_name").toString(), QString("Super Nintendo"));
        QCOMPARE(created.value("item_type_name").toString(), QString("Console"));
        QCOMPARE(created.value("conservation_state_name").toString(), QString("Bom"));
        QCOMPARE(created.value("is_multiplatform").toInt(), 0);
        QVERIFY(created.value("coverUrl").toString().isEmpty());
        QCOMPARE(service.total(), qint64(1));
        QCOMPARE(service.filtered(), qint64(1));

        // Nome vazio é recusado pelo DAO com a mesma mensagem do renderer.
        QVERIFY(service.create({{"name", "   "}, {"platform_id", snes},
            {"item_type_id", typeId}, {"conservation_state_id", stateId}, {"description", ""}}).isEmpty());
        QVERIFY2(service.error().contains(QStringLiteral("Nome")), qPrintable(service.error()));

        const QVariantMap multi = service.create({{"name", "Cartucho multi"},
            {"platform_id", snes}, {"is_multiplatform", true},
            {"item_type_id", typeId}, {"conservation_state_id", stateId}, {"description", ""}});
        QVERIFY2(!multi.isEmpty(), qPrintable(service.error()));
        const qint64 multiId = multi.value("id").toLongLong();
        QCOMPARE(multi.value("is_multiplatform").toInt(), 1);
        QVERIFY(multi.value("platform_id").isNull());
        QCOMPARE(multi.value("platform_name").toString(), QString("Multiplataforma"));
        // O marcador não cria plataforma: apenas a SNES tem itens físicos.
        QCOMPARE(service.platformsWithItems().size(), 1);

        // Atualizar a plataforma sem a flag preserva o marcador atual.
        QVERIFY(service.update(multiId, {{"platform_id", nes}}));
        QVariantMap updated = service.get(multiId);
        QCOMPARE(updated.value("is_multiplatform").toInt(), 1);
        QVERIFY(updated.value("platform_id").isNull());

        // Desligar o marcador grava a plataforma real e o JOIN passa a resolvê-la.
        QVERIFY(service.update(multiId, {{"platform_id", nes}, {"is_multiplatform", false}}));
        updated = service.get(multiId);
        QCOMPARE(updated.value("is_multiplatform").toInt(), 0);
        QCOMPARE(updated.value("platform_id").toLongLong(), nes);
        QCOMPARE(updated.value("platform_name").toString(), QString("Nintendo NES"));

        // Atualização parcial preserva campos omitidos.
        QVERIFY(service.update(multiId, {{"name", "Cartucho NES"}}));
        updated = service.get(multiId);
        QCOMPARE(updated.value("name").toString(), QString("Cartucho NES"));
        QCOMPARE(updated.value("platform_id").toLongLong(), nes);
        QCOMPARE(updated.value("item_type_id").toLongLong(), typeId);

        QVERIFY(service.remove(multiId));
        QVERIFY(service.get(multiId).isEmpty());
        QCOMPARE(service.total(), qint64(1));
    }

    /** Consultas em voo não podem sobrescrever filtros novos ou resultados de mutações. */
    void asyncQueriesKeepLatestResult() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        QString error;
        QVERIFY2(prepareDatabase(path, dir.filePath("db/images"), &error), qPrintable(error));
        const qint64 platform = platformId(path, QStringLiteral("Super Nintendo"));
        gamestock::InventoryService service;
        QVERIFY2(service.open(path, dir.filePath("profile"), &error, true), qPrintable(error));
        service.ensureLoaded();
        QTRY_VERIFY_WITH_TIMEOUT(!service.queryPending(), 5000);
        // Criações em sequência devem publicar os dois catálogos, mesmo com consulta em voo.
        const QVariantMap newType = service.createType(QStringLiteral("Acessório sintético"));
        const QVariantMap newState = service.createState(QStringLiteral("Conservado sintético"));
        QVERIFY(newType.value("id").toLongLong() > 0);
        QVERIFY(newState.value("id").toLongLong() > 0);
        QTRY_VERIFY_WITH_TIMEOUT(!service.queryPending(), 5000);
        QVERIFY(idForName(service.types(), QStringLiteral("Acessório sintético")) > 0);
        QVERIFY(idForName(service.states(), QStringLiteral("Conservado sintético")) > 0);
        const qint64 type = idForName(service.types(), QStringLiteral("Console"));
        const qint64 state = idForName(service.states(), QStringLiteral("Novo"));
        QVERIFY(!service.create({{"name", "Alpha"}, {"platform_id", platform}, {"item_type_id", type}, {"conservation_state_id", state}}).isEmpty());
        QVERIFY(!service.create({{"name", "Beta"}, {"platform_id", platform}, {"item_type_id", type}, {"conservation_state_id", state}}).isEmpty());
        service.setSearch(QStringLiteral("Alpha"));
        service.setSearch(QStringLiteral("Beta"));
        QVERIFY(service.queryPending());
        QTRY_VERIFY_WITH_TIMEOUT(!service.queryPending(), 5000);
        QCOMPARE(service.total(), qint64(2));
        QCOMPARE(service.filtered(), qint64(1));
        QCOMPARE(service.items().first().toMap().value("name").toString(), QString("Beta"));
        service.setSearch(QStringLiteral("ausente"));
        QTRY_VERIFY_WITH_TIMEOUT(!service.queryPending(), 5000);
        QVERIFY(service.items().isEmpty());
    }

    void filtersAndOrdering() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        QString error;
        QVERIFY2(prepareDatabase(path, dir.filePath("db/images"), &error), qPrintable(error));
        const qint64 snes = platformId(path, QStringLiteral("Super Nintendo"));
        const qint64 nes = platformId(path, QStringLiteral("Nintendo NES"));

        gamestock::InventoryService service;
        QVERIFY2(service.open(path, dir.filePath("profile"), &error), qPrintable(error));
        const qint64 consoleType = idForName(service.types(), QStringLiteral("Console"));
        const qint64 controlType = idForName(service.types(), QStringLiteral("Controle"));
        const qint64 newState = idForName(service.states(), QStringLiteral("Novo"));
        const qint64 goodState = idForName(service.states(), QStringLiteral("Bom"));

        const QVariantMap alpha = service.create({{"name", "Alpha"}, {"platform_id", snes},
            {"item_type_id", consoleType}, {"conservation_state_id", newState}, {"description", ""}});
        const QVariantMap beta = service.create({{"name", "Beta"}, {"platform_id", snes},
            {"item_type_id", consoleType}, {"conservation_state_id", goodState}, {"description", ""}});
        const QVariantMap gamma = service.create({{"name", "Gama"}, {"platform_id", nes},
            {"item_type_id", controlType}, {"conservation_state_id", newState}, {"description", ""}});
        QVERIFY(!alpha.isEmpty() && !beta.isEmpty() && !gamma.isEmpty());

        service.setItemTypeId(consoleType);
        QCOMPARE(service.filtered(), qint64(2));
        service.setConservationStateId(goodState);
        QCOMPARE(service.filtered(), qint64(1));
        QCOMPARE(service.items().first().toMap().value("name").toString(), QString("Beta"));
        service.setItemTypeId(0);
        service.setConservationStateId(0);
        service.setPlatformId(nes);
        QCOMPARE(service.filtered(), qint64(1));
        QCOMPARE(service.items().first().toMap().value("name").toString(), QString("Gama"));
        service.setPlatformId(0);

        // Busca textual usa LIKE NOCASE, como o painel Electron.
        service.setSearch(QStringLiteral("BET"));
        QCOMPARE(service.filtered(), qint64(1));
        QCOMPARE(service.items().first().toMap().value("name").toString(), QString("Beta"));
        service.setSearch(QStringLiteral("sem-correspondencia"));
        QCOMPARE(service.filtered(), qint64(0));
        QVERIFY(service.items().isEmpty());
        service.setSearch(QString());

        // Ordenação por tipo agrupa Console antes de Controle.
        service.setSortBy(QStringLiteral("type"));
        QCOMPARE(service.items().first().toMap().value("item_type_name").toString(), QString("Console"));
        service.setSortBy(QStringLiteral("recent"));
        QCOMPARE(service.items().first().toMap().value("id").toLongLong(), gamma.value("id").toLongLong());
        service.setSortBy(QStringLiteral("name"));
        QCOMPARE(service.items().first().toMap().value("name").toString(), QString("Alpha"));

        // Paginação de 36 é configurável no teste para validar deslocamento.
        service.setPageSize(2);
        QCOMPARE(service.page(), 1);
        QCOMPARE(service.items().size(), 2);
        service.goToPage(2);
        QCOMPARE(service.page(), 2);
        QCOMPARE(service.items().size(), 1);
        QCOMPARE(service.filtered(), qint64(3));
        QCOMPARE(service.total(), qint64(3));

        // Um filtro novo sempre reabre na primeira página.
        service.setItemTypeId(controlType);
        QCOMPARE(service.page(), 1);
        QCOMPARE(service.filtered(), qint64(1));
    }

    /** Fotos em job preservam integridade ao concluir, cancelar ou encontrar entrada inválida. */
    void photoImportJobs() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        const QString profile = dir.filePath("profile");
        QVERIFY(QDir().mkpath(profile));
        QString error;
        QVERIFY2(prepareDatabase(path, dir.filePath("db/images"), &error), qPrintable(error));
        const qint64 platform = platformId(path, QStringLiteral("Super Nintendo"));
        gamestock::JobRegistry registry([](const QJsonArray&, QString*) { return true; });
        gamestock::JobManager manager(&registry);
        gamestock::InventoryService service;
        service.setJobManager(&manager);
        QVERIFY2(service.open(path, profile, &error, true), qPrintable(error));
        service.ensureLoaded();
        QTRY_VERIFY_WITH_TIMEOUT(!service.queryPending(), 5000);
        const qint64 type = idForName(service.types(), QStringLiteral("Console"));
        const qint64 state = idForName(service.states(), QStringLiteral("Novo"));
        const QVariantMap item = service.create({{"name", "Item de foto"}, {"platform_id", platform},
            {"item_type_id", type}, {"conservation_state_id", state}});
        const qint64 itemId = item.value("id").toLongLong();
        QVERIFY(itemId > 0);
        const QString source = makePng(dir.filePath("source.png"));
        QVERIFY(!source.isEmpty());
        const QString largeSource = makePng(dir.filePath("large.png"));
        QFile large(largeSource);
        QVERIFY(large.open(QIODevice::ReadWrite));
        // Bytes adicionais criam uma cópia longa sem depender de arquivos pessoais.
        QVERIFY(large.resize(48 * 1024 * 1024));
        large.close();
        QSignalSpy finished(&service, &gamestock::InventoryService::photoImportFinished);

        const QString cancelled = service.startPhotoImport(itemId, largeSource);
        QVERIFY(!cancelled.isEmpty());
        QVERIFY(manager.cancel(cancelled));
        QTRY_COMPARE_WITH_TIMEOUT(finished.size(), 1, 10000);
        QCOMPARE(finished.at(0).at(1).toBool(), false);
        QVERIFY(service.listPhotos(itemId).isEmpty());
        const QDir cancelledDirectory(QDir(profile).filePath(QStringLiteral("inventario/images/") + QString::number(itemId)));
        QVERIFY(cancelledDirectory.entryList(QDir::Files | QDir::Hidden | QDir::System).isEmpty());

        const QString invalid = service.startPhotoImport(itemId, dir.filePath("missing.png"));
        QVERIFY(!invalid.isEmpty());
        QTRY_COMPARE_WITH_TIMEOUT(finished.size(), 2, 10000);
        QCOMPARE(finished.at(1).at(1).toBool(), false);
        QVERIFY(service.listPhotos(itemId).isEmpty());

        const QString success = service.startPhotoImport(itemId, source);
        QVERIFY(!success.isEmpty());
        QVERIFY(service.photoImporting());
        QVERIFY(service.startPhotoImport(itemId, source).isEmpty());
        QTRY_COMPARE_WITH_TIMEOUT(finished.size(), 3, 10000);
        QVERIFY(finished.at(2).at(1).toBool());
        QVERIFY(!service.photoImporting());
        QCOMPARE(service.listPhotos(itemId).size(), 1);
        const QString copied = service.listPhotos(itemId).first().toMap().value("file_path").toString();
        QVERIFY(QFileInfo::exists(copied));

        // O método síncrono fornece referência local, sem gravar no perfil do usuário.
        int syncTicks = 0;
        QTimer syncTimer;
        connect(&syncTimer, &QTimer::timeout, [&syncTicks] { ++syncTicks; });
        syncTimer.start(1);
        QElapsedTimer syncElapsed;
        syncElapsed.start();
        const QVariantMap syncPhoto = service.addPhoto(itemId, largeSource);
        const qint64 syncMs = syncElapsed.elapsed();
        syncTimer.stop();
        QVERIFY2(!syncPhoto.isEmpty(), qPrintable(service.error()));
        QVERIFY(service.removePhoto(syncPhoto.value("id").toLongLong()));

        int ticks = 0;
        QTimer timer;
        connect(&timer, &QTimer::timeout, [&ticks] { ++ticks; });
        timer.start(1);
        QElapsedTimer elapsed;
        elapsed.start();
        const QString largeJob = service.startPhotoImport(itemId, largeSource);
        const qint64 dispatchUs = elapsed.nsecsElapsed() / 1000;
        QVERIFY(!largeJob.isEmpty());
        QTRY_COMPARE_WITH_TIMEOUT(finished.size(), 4, 15000);
        const qint64 totalMs = elapsed.elapsed();
        timer.stop();
        QVERIFY(finished.at(3).at(1).toBool());
        QCOMPARE(service.listPhotos(itemId).size(), 2);
        qInfo() << "Foto sintética 48 MiB: cópia síncrona ms/eventos" << syncMs << syncTicks
                << "despacho assíncrono us" << dispatchUs << "total ms" << totalMs << "eventos da interface" << ticks;

        // Excluir o item durante a cópia nunca pode deixar foto associada ou arquivo órfão.
        const QVariantMap deletedItem = service.create({{"name", "Item removido durante cópia"}, {"platform_id", platform},
            {"item_type_id", type}, {"conservation_state_id", state}});
        const qint64 deletedId = deletedItem.value("id").toLongLong();
        QVERIFY(deletedId > 0);
        QVERIFY(!service.startPhotoImport(deletedId, largeSource).isEmpty());
        QVERIFY(service.remove(deletedId));
        QTRY_COMPARE_WITH_TIMEOUT(finished.size(), 5, 15000);
        QVERIFY(service.listPhotos(deletedId).isEmpty());
        const QDir deletedDirectory(QDir(profile).filePath(QStringLiteral("inventario/images/") + QString::number(deletedId)));
        QVERIFY(deletedDirectory.entryList(QDir::Files | QDir::Hidden | QDir::System).isEmpty());
        QVERIFY(manager.shutdown(5000));
    }

    /** Compara custo do filtro síncrono e despacho assíncrono sem depender de dados reais. */
    void inventoryResponsivenessMeasurement() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        const QString profile = dir.filePath("profile");
        QVERIFY(QDir().mkpath(profile));
        QString error;
        QVERIFY2(prepareDatabase(path, dir.filePath("db/images"), &error), qPrintable(error));
        {
            gamestock::Database database;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
            QSqlQuery query(database.handle());
            QVERIFY2(query.exec(QStringLiteral("WITH RECURSIVE seq(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM seq WHERE n<30000) "
                "INSERT INTO hardware_items (name) SELECT 'Item sintetico ' || printf('%05d', n) FROM seq")), qPrintable(query.lastError().text()));
        }
        gamestock::InventoryService sync;
        QVERIFY2(sync.open(path, profile, &error), qPrintable(error));
        QElapsedTimer elapsed;
        elapsed.start();
        sync.setSearch(QStringLiteral("29999"));
        const qint64 syncUs = elapsed.nsecsElapsed() / 1000;
        QCOMPARE(sync.filtered(), qint64(1));

        gamestock::InventoryService async;
        QVERIFY2(async.open(path, profile, &error, true), qPrintable(error));
        async.ensureLoaded();
        QTRY_VERIFY_WITH_TIMEOUT(!async.queryPending(), 10000);
        int ticks = 0;
        QTimer timer;
        connect(&timer, &QTimer::timeout, [&ticks] { ++ticks; });
        timer.start(1);
        elapsed.restart();
        async.setSearch(QStringLiteral("29999"));
        const qint64 dispatchUs = elapsed.nsecsElapsed() / 1000;
        QVERIFY(async.queryPending());
        QTRY_VERIFY_WITH_TIMEOUT(!async.queryPending(), 10000);
        const qint64 completionMs = elapsed.elapsed();
        timer.stop();
        QCOMPARE(async.filtered(), sync.filtered());
        QCOMPARE(async.items().first().toMap().value("name"), sync.items().first().toMap().value("name"));
        qInfo() << "Inventário sintético 30000 itens: filtro síncrono us" << syncUs
                << "despacho assíncrono us" << dispatchUs << "conclusão ms" << completionMs << "eventos da interface" << ticks;
    }

    void photosLifecycle() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        const QString profile = dir.filePath("profile");
        QVERIFY(QDir().mkpath(profile));
        QString error;
        QVERIFY2(prepareDatabase(path, dir.filePath("db/images"), &error), qPrintable(error));
        const qint64 snes = platformId(path, QStringLiteral("Super Nintendo"));

        gamestock::InventoryService service;
        QVERIFY2(service.open(path, profile, &error), qPrintable(error));
        const qint64 typeId = idForName(service.types(), QStringLiteral("Console"));
        const qint64 stateId = idForName(service.states(), QStringLiteral("Novo"));
        const QVariantMap item = service.create({{"name", "Console fotos"}, {"platform_id", snes},
            {"item_type_id", typeId}, {"conservation_state_id", stateId}, {"description", ""}});
        QVERIFY2(!item.isEmpty(), qPrintable(service.error()));
        const qint64 itemId = item.value("id").toLongLong();

        const QString firstSource = makePng(dir.filePath("primeira.png"));
        const QString secondSource = makePng(dir.filePath("segunda.png"));
        QVERIFY(!firstSource.isEmpty() && !secondSource.isEmpty());

        const QVariantMap first = service.addPhoto(itemId, firstSource);
        QVERIFY2(!first.isEmpty(), qPrintable(service.error()));
        const QString firstPath = first.value("file_path").toString();
        QVERIFY(QFileInfo::exists(firstPath));
        QVERIFY(firstPath.contains(QStringLiteral("inventario/images/") + QString::number(itemId)));
        QVERIFY(first.value("fileUrl").toString().startsWith(QStringLiteral("image://profilemedia/")));
        QCOMPARE(service.listPhotos(itemId).size(), 1);
        // A primeira foto vira capa e aparece na listagem paginada.
        QVERIFY(!service.get(itemId).value("coverUrl").toString().isEmpty());

        const QVariantMap second = service.addPhoto(itemId, secondSource);
        QVERIFY2(!second.isEmpty(), qPrintable(service.error()));
        QCOMPARE(service.listPhotos(itemId).size(), 2);
        QCOMPARE(service.listPhotos(itemId).at(0).toMap().value("id").toLongLong(), first.value("id").toLongLong());
        QCOMPARE(service.listPhotos(itemId).at(1).toMap().value("id").toLongLong(), second.value("id").toLongLong());

        // Reordenar troca sort_order e, portanto, a capa.
        QVERIFY(service.reorderPhotos(second.value("id").toLongLong(), first.value("id").toLongLong()));
        QCOMPARE(service.listPhotos(itemId).at(0).toMap().value("id").toLongLong(), second.value("id").toLongLong());

        // Arquivo sem assinatura de imagem é recusado antes de qualquer cópia.
        const QString fakePath = dir.filePath("falsa.jpg");
        QFile fake(fakePath);
        QVERIFY(fake.open(QIODevice::WriteOnly));
        fake.write("nao e imagem");
        fake.close();
        QVERIFY(service.addPhoto(itemId, fakePath).isEmpty());
        QVERIFY2(service.error().contains(QStringLiteral("imagem")), qPrintable(service.error()));
        QCOMPARE(service.listPhotos(itemId).size(), 2);

        QVERIFY(service.removePhoto(first.value("id").toLongLong()));
        QVERIFY(!QFileInfo::exists(firstPath));
        QCOMPARE(service.listPhotos(itemId).size(), 1);

        const QString third = makePng(dir.filePath("terceira.png"));
        QVERIFY(!service.addPhoto(itemId, third).isEmpty());
        const QString itemDir = QDir(profile).filePath(QStringLiteral("inventario/images/") + QString::number(itemId));
        QVERIFY(QDir(itemDir).exists());

        // Excluir o item remove registros (CASCADE) e o diretório gerenciado.
        QVERIFY(service.remove(itemId));
        QVERIFY(!QDir(itemDir).exists());
        QCOMPARE(service.listPhotos(itemId).size(), 0);
        QCOMPARE(service.total(), qint64(0));
    }

    void typeAndStateManagement() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        QString error;
        QVERIFY2(prepareDatabase(path, dir.filePath("db/images"), &error), qPrintable(error));
        const qint64 snes = platformId(path, QStringLiteral("Super Nintendo"));

        gamestock::InventoryService service;
        QVERIFY2(service.open(path, dir.filePath("profile"), &error), qPrintable(error));
        const QVariantMap type = service.createType(QStringLiteral("  Protótipo "));
        QVERIFY2(!type.isEmpty(), qPrintable(service.error()));
        QCOMPARE(type.value("name").toString(), QString("Protótipo"));
        QCOMPARE(type.value("is_default").toInt(), 0);
        QCOMPARE(service.types().size(), 9);
        QVERIFY(service.createType(QStringLiteral("Protótipo")).isEmpty());
        QVERIFY2(service.error().contains(QStringLiteral("já existe")), qPrintable(service.error()));
        QVERIFY(service.createType(QStringLiteral("   ")).isEmpty());

        const QVariantMap state = service.createState(QStringLiteral("Perfeito"));
        QVERIFY2(!state.isEmpty(), qPrintable(service.error()));
        QCOMPARE(state.value("is_default").toInt(), 0);
        QVERIFY(service.createState(QStringLiteral("Perfeito")).isEmpty());

        // Contagens incluem tipos e estados sem itens.
        bool foundEmptyType = false;
        for (const QVariant& entry : service.typeCounts()) {
            if (entry.toMap().value("name").toString() == QStringLiteral("Protótipo")
                && entry.toMap().value("count").toInt() == 0) foundEmptyType = true;
        }
        QVERIFY(foundEmptyType);

        const QVariantMap item = service.create({{"name", "Item protótipo"}, {"platform_id", snes},
            {"item_type_id", type.value("id")}, {"conservation_state_id", state.value("id")}, {"description", ""}});
        QVERIFY(!item.isEmpty());
        const qint64 itemId = item.value("id").toLongLong();
        QVERIFY(service.removeType(type.value("id").toLongLong()));
        // ON DELETE SET NULL preserva o item e apenas limpa o vínculo.
        QVERIFY(service.get(itemId).value("item_type_id").isNull());
        QVERIFY(service.removeState(state.value("id").toLongLong()));
        QVERIFY(service.get(itemId).value("conservation_state_id").isNull());
        QVERIFY(service.get(itemId).value("name").toString() == QString("Item protótipo"));
    }
};

QTEST_GUILESS_MAIN(HardwareInventoryTest)
#include "HardwareInventoryTest.moc"
