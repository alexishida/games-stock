/** Verifica scan, detecção automática, importação e remoção de registros por pasta. */
#include "app/RomFolderScanner.h"
#include "db/Database.h"
#include "db/JobStateStore.h"
#include "db/WriteConnection.h"
#include "db/dao/AppStateReadDao.h"
#include "db/dao/GameWriteDao.h"
#include "db/dao/PlatformDao.h"
#include "jobs/JobManager.h"
#include "jobs/JobRegistry.h"
#include "services/GameService.h"
#include "services/RomFolderService.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonObject>
#include <QJsonValue>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QTimer>
#include <QtTest>

namespace {
/** Cria o arquivo (e as pastas) e devolve o caminho absoluto. */
QString writeRom(const QDir& root, const QString& relativePath) {
    const QFileInfo info(root.filePath(relativePath));
    QDir().mkpath(info.absolutePath());
    QFile file(info.absoluteFilePath());
    if (!file.open(QIODevice::WriteOnly)) return {};
    file.write("rom");
    file.close();
    return info.absoluteFilePath();
}

/** Lê o ID semeado pelo catálogo de plataformas. */
qint64 platformId(QSqlDatabase& database, const QString& name) {
    QSqlQuery query(database);
    query.prepare(QStringLiteral("SELECT id FROM platforms WHERE name = ?"));
    query.bindValue(0, name);
    if (!query.exec() || !query.next()) return 0;
    return query.value(0).toLongLong();
}

/** Caminhos dos candidatos, ordenados para comparação estável. */
QStringList candidatePaths(const QVariantMap& scan) {
    QStringList paths;
    for (const QVariant& entry : scan.value(QStringLiteral("candidates")).toList()) {
        paths.append(entry.toMap().value(QStringLiteral("romPath")).toString());
    }
    paths.sort();
    return paths;
}

/** Motivos dos itens ignorados, na ordem do scan. */
QStringList ignoredReasons(const QVariantMap& scan) {
    QStringList reasons;
    for (const QVariant& entry : scan.value(QStringLiteral("ignoredItems")).toList()) {
        reasons.append(entry.toMap().value(QStringLiteral("reason")).toString());
    }
    return reasons;
}

/** Localiza o candidato importado pelo nome do arquivo. */
QVariantMap itemForFile(const QVariantMap& result, const QString& filename) {
    for (const QVariant& entry : result.value(QStringLiteral("items")).toList()) {
        const QVariantMap item = entry.toMap();
        if (item.value(QStringLiteral("candidate")).toMap().value(QStringLiteral("filename")).toString()
            == filename) {
            return item;
        }
    }
    return {};
}
} // namespace

/** Contratos da tarefa 7.5, sem QML e apenas com diretórios temporários. */
class RomFolderTest : public QObject {
    Q_OBJECT
private slots:
    /** Modo manual filtra extensões e respeita a opção de subpastas. */
    void manualScanRespectsSubfoldersAndExtensions() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QDir roms(dir.filePath(QStringLiteral("roms")));
        QVERIFY(roms.mkpath(QStringLiteral(".")));
        const QString topFile = writeRom(roms, QStringLiteral("Super Mario World (USA).sfc"));
        const QString nestedFile = writeRom(roms, QStringLiteral("sub/Donkey Kong Country (Europe).sfc"));
        QVERIFY(!topFile.isEmpty() && !nestedFile.isEmpty());
        writeRom(roms, QStringLiteral("leiame.txt"));
        writeRom(roms, QStringLiteral("disco.iso"));

        const QString databasePath = dir.filePath(QStringLiteral("db/gamestock.db"));
        qint64 snes = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(databasePath, dir.filePath(QStringLiteral("db/images")), &error),
                qPrintable(error));
            snes = platformId(database.handle(), QStringLiteral("Super Nintendo"));
            QVERIFY(snes > 0);
        }

        gamestock::RomFolderService service;
        QString error;
        QVERIFY2(service.open(databasePath, &error), qPrintable(error));
        QVERIFY(service.isOpen());

        QVariantMap request{
            {QStringLiteral("folderPaths"), QStringList{roms.absolutePath()}},
            {QStringLiteral("platformId"), snes},
            {QStringLiteral("detectionMode"), QStringLiteral("manual")},
        };
        QVariantMap scan = service.scan(request);
        QVERIFY2(scan.value(QStringLiteral("ok")).toBool(),
            qPrintable(scan.value(QStringLiteral("error")).toString()));
        QCOMPARE(scan.value(QStringLiteral("detectionMode")).toString(), QStringLiteral("manual"));
        QCOMPARE(scan.value(QStringLiteral("platformName")).toString(), QStringLiteral("Super Nintendo"));
        QCOMPARE(scan.value(QStringLiteral("platformId")).toLongLong(), snes);
        QStringList expected{topFile};
        QCOMPARE(candidatePaths(scan), expected);
        QCOMPARE(scan.value(QStringLiteral("ignored")).toInt(), 2);
        QCOMPARE(scan.value(QStringLiteral("detectedPlatforms")).toList().size(), 1);
        QCOMPARE(scan.value(QStringLiteral("candidates")).toList().first().toMap()
            .value(QStringLiteral("titleCandidate")).toString(), QStringLiteral("Super Mario World"));

        // A tabela de motivos precisa ser acionável para a revisão na UI.
        const QStringList reasons = ignoredReasons(scan);
        QCOMPARE(reasons.size(), 2);
        QVERIFY(reasons.at(0).contains(QStringLiteral("Super Nintendo")));

        request.insert(QStringLiteral("includeSubfolders"), true);
        scan = service.scan(request);
        QVERIFY(scan.value(QStringLiteral("ok")).toBool());
        QVERIFY(scan.value(QStringLiteral("includeSubfolders")).toBool());
        expected = QStringList{topFile, nestedFile};
        expected.sort();
        QCOMPARE(candidatePaths(scan), expected);
        QCOMPARE(scan.value(QStringLiteral("ignored")).toInt(), 2);

        // Pasta inexistente não pode ser silenciosamente aceita.
        QVariantMap missing{
            {QStringLiteral("folderPaths"), QStringList{dir.filePath(QStringLiteral("ausente"))}},
            {QStringLiteral("detectionMode"), QStringLiteral("automatic")},
        };
        const QVariantMap failure = service.scan(missing);
        QVERIFY(!failure.value(QStringLiteral("ok")).toBool());
        QVERIFY(!service.error().isEmpty());
    }

    /** Modo automático ignora extensões genéricas e recusa extensões ambíguas. */
    void automaticDetectionIgnoresGenericAndAmbiguousExtensions() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QDir roms(dir.filePath(QStringLiteral("roms")));
        QVERIFY(roms.mkpath(QStringLiteral(".")));
        const QString sonic = writeRom(roms, QStringLiteral("Sonic (USA).md"));
        const QString mario = writeRom(roms, QStringLiteral("Mario World (USA).sfc"));
        QVERIFY(!sonic.isEmpty() && !mario.isEmpty());
        writeRom(roms, QStringLiteral("Sonic.zip"));
        writeRom(roms, QStringLiteral("LEIAME.txt"));
        writeRom(roms, QStringLiteral("desconhecido.xyz"));

        const QString databasePath = dir.filePath(QStringLiteral("db/gamestock.db"));
        qint64 clone = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(databasePath, dir.filePath(QStringLiteral("db/images")), &error),
                qPrintable(error));
            gamestock::PlatformDao platforms(database.handle());
            QVERIFY2(platforms.create(QStringLiteral("Clone Console"), QStringLiteral("Consoles"), &clone, &error),
                qPrintable(error));
            QList<QVariantMap> mappings{
                {{QStringLiteral("extension"), QStringLiteral(".md")},
                    {QStringLiteral("kind"), QStringLiteral("Cartucho ROM")},
                    {QStringLiteral("is_primary"), true}},
            };
            QVERIFY2(platforms.saveMappings(clone, {QStringLiteral("Clone Console")}, mappings, &error),
                qPrintable(error));
        }

        gamestock::RomFolderService service;
        QString error;
        QVERIFY2(service.open(databasePath, &error), qPrintable(error));
        const QVariantMap scan = service.scan(QVariantMap{
            {QStringLiteral("folderPaths"), QStringList{roms.absolutePath()}},
            {QStringLiteral("detectionMode"), QStringLiteral("automatic")},
        });
        QVERIFY2(scan.value(QStringLiteral("ok")).toBool(),
            qPrintable(scan.value(QStringLiteral("error")).toString()));
        QCOMPARE(scan.value(QStringLiteral("detectionMode")).toString(), QStringLiteral("automatic"));
        QCOMPARE(scan.value(QStringLiteral("platformName")).toString(), QStringLiteral("Detecção automática"));
        QVERIFY(scan.value(QStringLiteral("platformId")).isNull());
        // .sfc continua inequívoca; .md, .zip e .txt/.xyz ficam de fora.
        QStringList expected{mario};
        QCOMPARE(candidatePaths(scan), expected);
        QCOMPARE(scan.value(QStringLiteral("ignored")).toInt(), 4);
        QCOMPARE(scan.value(QStringLiteral("detectedPlatforms")).toList().size(), 1);

        const QStringList reasons = ignoredReasons(scan);
        bool ambiguous = false;
        bool generic = false;
        bool unknown = false;
        for (const QString& reason : reasons) {
            if (reason.contains(QStringLiteral("várias plataformas"))) ambiguous = true;
            if (reason.contains(QStringLiteral(".zip")) && reason.contains(QStringLiteral("genérica"))) generic = true;
            if (reason.contains(QStringLiteral(".xyz"))) unknown = true;
        }
        QVERIFY2(ambiguous, qPrintable(reasons.join(QStringLiteral(" | "))));
        QVERIFY(generic);
        QVERIFY(unknown);
    }

    /** Importação cria placeholders, agrupa variantes e não duplica ROMs. */
    void importCreatesPlaceholdersAndGroupsVariants() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QDir roms(dir.filePath(QStringLiteral("roms")));
        QVERIFY(roms.mkpath(QStringLiteral(".")));
        const QString sonicUsa = writeRom(roms, QStringLiteral("Sonic (USA).md"));
        const QString sonicEurope = writeRom(roms, QStringLiteral("Sonic (Europe).md"));
        const QString streets = writeRom(roms, QStringLiteral("Streets of Rage 2 (USA).md"));
        QVERIFY(!sonicUsa.isEmpty() && !sonicEurope.isEmpty() && !streets.isEmpty());

        const QString databasePath = dir.filePath(QStringLiteral("db/gamestock.db"));
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(databasePath, dir.filePath(QStringLiteral("db/images")), &error),
                qPrintable(error));
        }

        gamestock::RomFolderService service;
        QString error;
        QVERIFY2(service.open(databasePath, &error), qPrintable(error));
        const QVariantMap request{
            {QStringLiteral("folderPaths"), QStringList{roms.absolutePath()}},
            {QStringLiteral("detectionMode"), QStringLiteral("automatic")},
            {QStringLiteral("includeSubfolders"), true},
        };
        const QVariantMap result = service.import(request);
        QVERIFY2(result.value(QStringLiteral("ok")).toBool(),
            qPrintable(result.value(QStringLiteral("error")).toString()));
        QVERIFY(result.value(QStringLiteral("includeSubfolders")).toBool());
        const QVariantMap summary = result.value(QStringLiteral("summary")).toMap();
        QCOMPARE(summary.value(QStringLiteral("created")).toLongLong(), qint64(3));
        QCOMPARE(summary.value(QStringLiteral("updated")).toLongLong(), qint64(0));
        QCOMPARE(summary.value(QStringLiteral("unmatched")).toLongLong(), qint64(3));
        QCOMPARE(summary.value(QStringLiteral("skipped")).toLongLong(), qint64(0));
        QCOMPARE(summary.value(QStringLiteral("processed")).toLongLong(), qint64(3));
        QCOMPARE(result.value(QStringLiteral("items")).toList().size(), 3);

        const QVariantMap sonicItem = itemForFile(result, QStringLiteral("Sonic (USA).md"));
        QCOMPARE(sonicItem.value(QStringLiteral("status")).toString(), QStringLiteral("unmatched"));
        const qint64 sonicId = sonicItem.value(QStringLiteral("gameId")).toLongLong();
        QVERIFY(sonicId > 0);
        QCOMPARE(service.countFolderRecords(roms.absolutePath()), qint64(3));
        QCOMPARE(service.countFolderRecords(roms.absolutePath(), 0), qint64(3));

        // A biblioteca agrupa variantes: 3 registros, 2 cartões visuais.
        gamestock::GameService library;
        QVERIFY2(library.open(databasePath, &error), qPrintable(error));
        QCOMPARE(library.total(), qint64(2));
        QCOMPARE(library.model()->rowCount(), 2);
        QCOMPARE(library.listVersions(sonicId).size(), 2);
        const QVariantMap streetsItem = itemForFile(result, QStringLiteral("Streets of Rage 2 (USA).md"));
        QCOMPARE(library.listVersions(streetsItem.value(QStringLiteral("gameId")).toLongLong()).size(), 1);

        // Reimportar o mesmo lote atualiza os registros em vez de duplicá-los.
        const QVariantMap reimport = service.import(request);
        QVERIFY(reimport.value(QStringLiteral("ok")).toBool());
        const QVariantMap secondSummary = reimport.value(QStringLiteral("summary")).toMap();
        QCOMPARE(secondSummary.value(QStringLiteral("created")).toLongLong(), qint64(0));
        QCOMPARE(secondSummary.value(QStringLiteral("updated")).toLongLong(), qint64(3));
        QCOMPARE(service.countFolderRecords(roms.absolutePath()), qint64(3));
        QCOMPARE(itemForFile(reimport, QStringLiteral("Sonic (Europe).md"))
            .value(QStringLiteral("status")).toString(), QStringLiteral("unmatched"));

        // Importar nunca remove ou reescreve os arquivos físicos.
        QVERIFY(QFileInfo::exists(sonicUsa));
        QVERIFY(QFileInfo::exists(sonicEurope));
        QVERIFY(QFileInfo::exists(streets));
    }

    /** Remoção por pasta apaga somente registros, respeitando subpastas e plataforma. */
    void removalDeletesOnlyFolderRecordsAndKeepsFiles() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QDir folderA(dir.filePath(QStringLiteral("roms/A")));
        const QDir folderB(dir.filePath(QStringLiteral("roms/B")));
        QVERIFY(folderA.mkpath(QStringLiteral(".")));
        QVERIFY(folderB.mkpath(QStringLiteral(".")));
        const QString aTop = writeRom(folderA, QStringLiteral("Sonic (USA).md"));
        const QString aNested = writeRom(folderA, QStringLiteral("sub/Sonic 2 (USA).md"));
        const QString bFile = writeRom(folderB, QStringLiteral("Streets of Rage 2 (USA).md"));
        QVERIFY(!aTop.isEmpty() && !aNested.isEmpty() && !bFile.isEmpty());

        const QString databasePath = dir.filePath(QStringLiteral("db/gamestock.db"));
        qint64 snes = 0;
        qint64 megaDrive = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(databasePath, dir.filePath(QStringLiteral("db/images")), &error),
                qPrintable(error));
            snes = platformId(database.handle(), QStringLiteral("Super Nintendo"));
            megaDrive = platformId(database.handle(), QStringLiteral("Sega Mega Drive"));
            QVERIFY(snes > 0 && megaDrive > 0);
            gamestock::GameWriteDao games(database.handle());
            qint64 id = 0;
            // Registro de outra plataforma dentro da pasta A: a remoção por plataforma não o toca.
            QVERIFY2(games.create({{QStringLiteral("title"), QStringLiteral("Extra SNES")},
                {QStringLiteral("platform_id"), snes},
                {QStringLiteral("rom_path"), folderA.filePath(QStringLiteral("extra.sfc"))}}, &id, &error),
                qPrintable(error));
        }

        gamestock::RomFolderService service;
        QString error;
        QVERIFY2(service.open(databasePath, &error), qPrintable(error));
        const QVariantMap imported = service.import(QVariantMap{
            {QStringLiteral("folderPaths"), QStringList{folderA.absolutePath(), folderB.absolutePath()}},
            {QStringLiteral("detectionMode"), QStringLiteral("automatic")},
            {QStringLiteral("includeSubfolders"), true},
        });
        QVERIFY2(imported.value(QStringLiteral("ok")).toBool(),
            qPrintable(imported.value(QStringLiteral("error")).toString()));
        QCOMPARE(imported.value(QStringLiteral("summary")).toMap()
            .value(QStringLiteral("created")).toLongLong(), qint64(3));

        QCOMPARE(service.countFolderRecords(folderA.absolutePath()), qint64(3));
        QCOMPARE(service.countFolderRecords(folderA.absolutePath(), megaDrive), qint64(2));
        QCOMPARE(service.countFolderRecords(folderA.absolutePath(), snes), qint64(1));
        QCOMPARE(service.countFolderRecords(folderB.absolutePath()), qint64(1));

        // Filtro por plataforma remove as duas ROMs de Mega Drive, inclusive na subpasta.
        QCOMPARE(service.removeFolderRecords(folderA.absolutePath(), megaDrive), qint64(2));
        QCOMPARE(service.countFolderRecords(folderA.absolutePath(), megaDrive), qint64(0));
        QCOMPARE(service.countFolderRecords(folderA.absolutePath(), snes), qint64(1));
        QCOMPARE(service.countFolderRecords(folderB.absolutePath()), qint64(1));

        // Sem filtro, o registro restante da pasta A é removido e a pasta B permanece.
        QCOMPARE(service.removeFolderRecords(folderA.absolutePath()), qint64(1));
        QCOMPARE(service.countFolderRecords(folderA.absolutePath()), qint64(0));
        QCOMPARE(service.countFolderRecords(folderB.absolutePath()), qint64(1));
        QCOMPARE(service.removeFolderRecords(folderA.absolutePath()), qint64(0));

        // Nenhum arquivo físico pode ser removido junto com os registros.
        QVERIFY(QFileInfo::exists(aTop));
        QVERIFY(QFileInfo::exists(aNested));
        QVERIFY(QFileInfo::exists(bFile));
    }

    /** Job em background persiste conclusão e some do app_state ao dispensar. */
    void backgroundJobPersistsAndDismisses() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QDir roms(dir.filePath(QStringLiteral("roms")));
        QVERIFY(roms.mkpath(QStringLiteral(".")));
        QVERIFY(!writeRom(roms, QStringLiteral("Sonic (USA).md")).isEmpty());
        const QString databasePath = dir.filePath(QStringLiteral("db/gamestock.db"));
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(databasePath, dir.filePath(QStringLiteral("db/images")), &error),
                qPrintable(error));
        }

        gamestock::RomFolderService service;
        QString error;
        QVERIFY2(service.open(databasePath, &error), qPrintable(error));
        gamestock::WriteConnection jobDatabase;
        QVERIFY2(jobDatabase.open(databasePath, &error), qPrintable(error));
        gamestock::JobStateStore store(jobDatabase.database(),
            QStringLiteral("gamestock.media.lastRomImportJob"));
        gamestock::JobRegistry registry([&store](const QJsonArray& jobs, QString* persistError) {
            return store.persist(jobs, persistError);
        });
        gamestock::JobManager manager(&registry);
        service.setJobManager(&manager);

        const QVariantMap job = service.startImport(QVariantMap{
            {QStringLiteral("folderPaths"), QStringList{roms.absolutePath()}},
            {QStringLiteral("detectionMode"), QStringLiteral("automatic")},
        });
        QVERIFY2(!job.isEmpty(), qPrintable(service.error()));
        const QString jobId = job.value(QStringLiteral("jobId")).toString();
        QVERIFY(!jobId.isEmpty());
        QTRY_VERIFY_WITH_TIMEOUT(manager.job(jobId).value(QStringLiteral("status")).toString()
            == QStringLiteral("completed"), 20000);
        const QVariantMap completed = manager.job(jobId);
        QCOMPARE(completed.value(QStringLiteral("result")).toMap()
            .value(QStringLiteral("summary")).toMap()
            .value(QStringLiteral("created")).toLongLong(), qint64(1));
        QCOMPARE(service.countFolderRecords(roms.absolutePath()), qint64(1));

        gamestock::AppStateReadDao reader(jobDatabase.database());
        QJsonValue persisted;
        QVERIFY2(reader.get(QStringLiteral("gamestock.media.lastRomImportJob"), &persisted, &error),
            qPrintable(error));
        QCOMPARE(persisted.toObject().value(QStringLiteral("status")).toString(), QStringLiteral("completed"));

        QVERIFY(manager.dismiss(jobId));
        QVERIFY2(reader.get(QStringLiteral("gamestock.media.lastRomImportJob"), &persisted, &error),
            qPrintable(error));
        QVERIFY(persisted.isUndefined());
    }

    /** Reinício converte job em execução em interrompido, preservando os parâmetros. */
    void restoreMarksRunningJobInterrupted() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString databasePath = dir.filePath(QStringLiteral("db/gamestock.db"));
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(databasePath, dir.filePath(QStringLiteral("db/images")), &error),
                qPrintable(error));
        }
        gamestock::WriteConnection jobDatabase;
        QString error;
        QVERIFY2(jobDatabase.open(databasePath, &error), qPrintable(error));
        gamestock::JobStateStore store(jobDatabase.database(),
            QStringLiteral("gamestock.media.lastRomImportJob"));
        gamestock::JobRegistry registry([&store](const QJsonArray& jobs, QString* persistError) {
            return store.persist(jobs, persistError);
        });
        const QJsonObject running{
            {QStringLiteral("jobId"), QStringLiteral("rom-antigo")},
            {QStringLiteral("kind"), QStringLiteral("rom-folder-import")},
            {QStringLiteral("status"), QStringLiteral("running")},
            {QStringLiteral("title"), QStringLiteral("Importando ROMs")},
            {QStringLiteral("folderPaths"), QJsonArray{QStringLiteral("C:/roms")}},
            {QStringLiteral("progress"), QJsonObject{{QStringLiteral("current"), 2},
                {QStringLiteral("total"), 5}, {QStringLiteral("message"), QStringLiteral("Importando")}}},
        };
        registry.restore(QJsonArray{running});
        gamestock::JobManager manager(&registry);
        const QVariantMap restored = manager.job(QStringLiteral("rom-antigo"));
        QCOMPARE(restored.value(QStringLiteral("status")).toString(), QStringLiteral("interrupted"));
        QCOMPARE(restored.value(QStringLiteral("folderPaths")).toStringList().value(0),
            QStringLiteral("C:/roms"));
        QCOMPARE(restored.value(QStringLiteral("progress")).toMap()
            .value(QStringLiteral("message")).toString(), QStringLiteral("Interrompido"));
        QVERIFY(manager.dismiss(QStringLiteral("rom-antigo")));
    }

    /** Lote grande não grava SQLite por tick e mantém a thread da UI livre. */
    void largeBatchKeepsUiResponsiveAndPersistsOnlyTransitions() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QDir roms(dir.filePath(QStringLiteral("roms")));
        QVERIFY(roms.mkpath(QStringLiteral(".")));
        constexpr int total = 1200;
        for (int index = 0; index < total; ++index) {
            QFile file(roms.filePath(QStringLiteral("Game %1 (USA).md").arg(index, 4, 10, QLatin1Char('0'))));
            QVERIFY(file.open(QIODevice::WriteOnly));
            file.write("rom");
        }
        const QString databasePath = dir.filePath(QStringLiteral("db/gamestock.db"));
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(databasePath, dir.filePath(QStringLiteral("db/images")), &error),
                qPrintable(error));
        }
        gamestock::RomFolderService service;
        QString error;
        QVERIFY2(service.open(databasePath, &error), qPrintable(error));
        gamestock::WriteConnection jobDatabase;
        QVERIFY2(jobDatabase.open(databasePath, &error), qPrintable(error));
        gamestock::JobStateStore store(jobDatabase.database(),
            QStringLiteral("gamestock.media.lastRomImportJob"));
        int writes = 0;
        gamestock::JobRegistry registry([&store, &writes](const QJsonArray& jobs, QString* persistError) {
            ++writes;
            return store.persist(jobs, persistError);
        });
        gamestock::JobManager manager(&registry);
        service.setJobManager(&manager);

        int heartbeat = 0;
        QTimer timer;
        timer.setInterval(1);
        QObject::connect(&timer, &QTimer::timeout, [&heartbeat] { ++heartbeat; });
        timer.start();
        const QVariantMap job = service.startImport(QVariantMap{
            {QStringLiteral("folderPaths"), QStringList{roms.absolutePath()}},
            {QStringLiteral("detectionMode"), QStringLiteral("automatic")},
        });
        QVERIFY2(!job.isEmpty(), qPrintable(service.error()));
        const QString jobId = job.value(QStringLiteral("jobId")).toString();
        QTRY_VERIFY_WITH_TIMEOUT(manager.activeCount() == 0, 120000);
        timer.stop();
        QVERIFY(heartbeat > 0);
        QCOMPARE(writes, 2);
        const QVariantMap finished = manager.job(jobId);
        QCOMPARE(finished.value(QStringLiteral("status")).toString(), QStringLiteral("completed"));
        QCOMPARE(finished.value(QStringLiteral("progress")).toMap()
            .value(QStringLiteral("total")).toLongLong(), qint64(total));
        QCOMPARE(service.countFolderRecords(roms.absolutePath()), qint64(total));
    }

    /** Títulos de ROM perdem extensão, região e revisão como no renderer legado. */
    void romTitleNormalization() {
        QCOMPARE(gamestock::RomFolderScanner::normalizeRomTitle(
            QStringLiteral("Super Mario World (USA) [!].sfc")), QStringLiteral("Super Mario World"));
        QCOMPARE(gamestock::RomFolderScanner::normalizeRomTitle(
            QStringLiteral("Sonic_The_Hedgehog (Rev 1).md")), QStringLiteral("Sonic The Hedgehog"));
        QCOMPARE(gamestock::RomFolderScanner::normalizeRomTitle(
            QStringLiteral("Game (Japan) (En) (Beta).gba")), QStringLiteral("Game"));
        QCOMPARE(gamestock::RomFolderScanner::normalizeRomTitle(
            QStringLiteral("sem_tags.gb")), QStringLiteral("sem tags"));
    }
};

QTEST_MAIN(RomFolderTest)
#include "RomFolderTest.moc"
