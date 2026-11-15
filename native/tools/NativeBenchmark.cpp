/** Benchmark do serviço de biblioteca em build Release, sem abrir janela. */
#include "db/Database.h"
#include "db/ReadOnlyConnection.h"
#include "db/dao/GameReadDao.h"
#include "jobs/JobManager.h"
#include "jobs/JobRegistry.h"
#include "launchbox/LaunchBoxSearch.h"
#include "services/GameService.h"
#include "services/RomFolderService.h"

#include <QCoreApplication>
#include <QDir>
#include <QDirIterator>
#include <QElapsedTimer>
#include <QEventLoop>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSqlError>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QTextStream>
#include <QTimer>

#include <algorithm>
#include <functional>

#ifdef Q_OS_WIN
#include <windows.h>
#include <psapi.h>
#endif

namespace {
/** Memória residente do processo em bytes (0 quando indisponível). */
quint64 workingSetBytes() {
#ifdef Q_OS_WIN
    PROCESS_MEMORY_COUNTERS counters{};
    if (GetProcessMemoryInfo(GetCurrentProcess(), &counters, sizeof(counters))) return counters.WorkingSetSize;
#endif
    return 0;
}

/** Executa uma consulta e devolve o tempo em ms junto do resultado. */
QJsonObject measure(gamestock::GameService& service, const QJsonObject& filters) {
    // Ajustes de filtro podem recarregar a página; a medição conta apenas a consulta final.
    service.setCollection(filters.value(QStringLiteral("collection")).toString(QStringLiteral("all")));
    service.setGenre(filters.value(QStringLiteral("genre")).toString());
    service.setSearch(filters.value(QStringLiteral("search")).toString());
    service.setSortBy(filters.value(QStringLiteral("sortBy")).toString(QStringLiteral("title")));
    service.setIncludeMissingCovers(true);
    service.setPlatformId(static_cast<qint64>(filters.value(QStringLiteral("platformId")).toDouble()));
    service.setPageSize(36);
    service.goToPage(static_cast<int>(filters.value(QStringLiteral("page")).toDouble(1)));
    QElapsedTimer timer;
    timer.start();
    service.refresh();
    return QJsonObject{{QStringLiteral("filters"), filters},
        {QStringLiteral("ms"), static_cast<double>(timer.nsecsElapsed()) / 1'000'000.0},
        {QStringLiteral("items"), service.items().size()},
        {QStringLiteral("total"), static_cast<double>(service.total())},
        {QStringLiteral("filtered"), static_cast<double>(service.filtered())}};
}
/** Filtros reproduzíveis usados tanto no banco existente quanto na massa recém-importada. */
QJsonArray benchmarkFilters() {
    return QJsonArray{
        QJsonObject{{QStringLiteral("page"), 1}},
        QJsonObject{{QStringLiteral("page"), 2}},
        QJsonObject{{QStringLiteral("page"), 10}},
        QJsonObject{{QStringLiteral("page"), 1}, {QStringLiteral("search"), QStringLiteral("sint\u00e9tico 00001")},
            {QStringLiteral("collection"), QStringLiteral("favorites")}},
        QJsonObject{{QStringLiteral("page"), 1}, {QStringLiteral("sortBy"), QStringLiteral("mostPlayed")}},
        QJsonObject{{QStringLiteral("page"), 1}, {QStringLiteral("genre"), QStringLiteral("A\u00c7\u00c3O")},
            {QStringLiteral("collection"), QStringLiteral("favorites")}},
        QJsonObject{{QStringLiteral("page"), 1}, {QStringLiteral("genre"), QStringLiteral("\u03c2")}},
        QJsonObject{{QStringLiteral("page"), 1}, {QStringLiteral("genre"), QStringLiteral("\u0130")}}};
}

/** Cria um lote sintético e mede a importação completa em banco temporário. */
int runImportBenchmark(int argc, char** argv) {
    Q_UNUSED(argc);
    const int total = argv[2] ? QByteArray(argv[2]).toInt() : 1200;
    QTemporaryDir dir;
    if (!dir.isValid()) return 8;
    const QDir roms(dir.filePath(QStringLiteral("roms")));
    if (!roms.mkpath(QStringLiteral("."))) return 9;
    for (int index = 0; index < total; ++index) {
        QFile file(roms.filePath(QStringLiteral("Game %1 (USA).nes").arg(index, 4, 10, QLatin1Char('0'))));
        if (!file.open(QIODevice::WriteOnly)) return 10;
        file.write("rom");
    }
    const QString databasePath = dir.filePath(QStringLiteral("db/gamestock.db"));
    gamestock::Database database;
    QString error;
    if (!database.open(databasePath, dir.filePath(QStringLiteral("db/images")), &error)) {
        QTextStream(stderr) << error << "\n";
        return 11;
    }
    gamestock::RomFolderService service;
    if (!service.open(databasePath, &error)) {
        QTextStream(stderr) << error << "\n";
        return 12;
    }
    gamestock::JobRegistry registry([](const QJsonArray&, QString*) { return true; });
    gamestock::JobManager manager(&registry);
    service.setJobManager(&manager);
    QEventLoop loop;
    QString finishedStatus;
    QObject::connect(&manager, &gamestock::JobManager::jobFinished, &loop,
        [&](const QString&, const QJsonObject& job) {
            finishedStatus = job.value(QStringLiteral("status")).toString();
            loop.quit();
        });
    QElapsedTimer timer;
    timer.start();
    const QVariantMap job = service.startImport(QVariantMap{
        {QStringLiteral("folderPaths"), QStringList{roms.absolutePath()}},
        {QStringLiteral("detectionMode"), QStringLiteral("automatic")}});
    if (job.isEmpty()) {
        QTextStream(stderr) << service.error() << "\n";
        return 13;
    }
    // O trabalho real roda em worker; o timeout evita benchmark travado.
    QTimer::singleShot(180000, &loop, &QEventLoop::quit);
    loop.exec();
    const double elapsed = static_cast<double>(timer.nsecsElapsed()) / 1'000'000.0;
    // A mesma massa mede as consultas de biblioteca que a UI dispara após a importação.
    QJsonArray results;
    {
        gamestock::GameService library;
        QString libraryError;
        if (library.open(databasePath, &libraryError)) {
            for (const QJsonValue& filter : benchmarkFilters()) results.append(measure(library, filter.toObject()));
        } else {
            QTextStream(stderr) << libraryError << "\n";
        }
    }
    const QJsonObject output{{QStringLiteral("importMs"), elapsed},
        {QStringLiteral("total"), total},
        {QStringLiteral("status"), finishedStatus},
        {QStringLiteral("records"), static_cast<double>(service.countFolderRecords(roms.absolutePath()))},
        {QStringLiteral("pagination"), results}};
    QTextStream(stdout) << QJsonDocument(output).toJson(QJsonDocument::Compact) << "\n";
    return finishedStatus == QLatin1String("completed") ? 0 : 14;
}

/** Executa a mesma leitura várias vezes e devolve a mediana, reduzindo ruído do sistema. */
double medianMs(const std::function<double()>& run, int rounds = 3) {
    QList<double> samples;
    for (int index = 0; index < rounds; ++index) samples.append(run());
    std::sort(samples.begin(), samples.end());
    return samples.at(samples.size() / 2);
}

/** Uma consulta de página medida sem e com cache de contagens. */
struct LibraryScenario {
    QString name;
    int page = 1;
    gamestock::GameListFilters filters;
};

/** Mede uma página sem cache (comportamento anterior) e com cache aquecido. */
QJsonObject measureLibraryScenario(gamestock::GameReadDao& dao, const LibraryScenario& scenario) {
    const auto run = [&](gamestock::GameCountCache* cache) {
        return [&dao, &scenario, cache] {
            gamestock::GamePage page;
            QString error;
            QElapsedTimer timer;
            timer.start();
            const bool ok = dao.list(scenario.page, 36, &page, &error, scenario.filters, cache);
            if (!ok) return -1.0;
            return static_cast<double>(timer.nsecsElapsed()) / 1'000'000.0;
        };
    };
    // O cache sempre é preenchido por uma leitura descartada antes da medição.
    gamestock::GameCountCache cache;
    cache.setGeneration(1);
    run(&cache)();
    return QJsonObject{
        {QStringLiteral("name"), scenario.name},
        {QStringLiteral("page"), scenario.page},
        {QStringLiteral("withoutCacheMs"), medianMs(run(nullptr))},
        {QStringLiteral("withCacheMs"), medianMs(run(&cache))},
    };
}

/** Cria catálogo sintético em transação; nenhum perfil real é aberto. */
bool buildSyntheticLibrary(const QString& databasePath, int total, QString* error) {
    gamestock::Database database;
    if (!database.open(databasePath, QFileInfo(databasePath).absolutePath() + QStringLiteral("/images"), error))
        return false;
    QSqlQuery query(database.handle());
    if (!query.exec(QStringLiteral("INSERT OR IGNORE INTO platforms (id, name, category) VALUES "
            "(1,'Console 1','Console'),(2,'Console 2','Console'),(3,'Console 3','Console'),"
            "(4,'Console 4','Console'),(5,'Console 5','Console'),(6,'Console 6','Console')"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (!database.handle().transaction()) {
        if (error) *error = database.handle().lastError().text();
        return false;
    }
    QSqlQuery insert(database.handle());
    if (!insert.prepare(QStringLiteral(
            "INSERT INTO games (title, title_normalized, platform_id, year, genre, box_art_path, rom_path, "
            "favorite, play_status, launch_count, library_group_key, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"))) {
        if (error) *error = insert.lastError().text();
        return false;
    }
    const QStringList genres{QStringLiteral("Ação; Plataforma"), QStringLiteral("RPG"),
        QStringLiteral("Aventura"), QStringLiteral("Corrida")};
    for (int index = 0; index < total; ++index) {
        // Duas variantes por grupo; a cada quatro grupos um registro manual independente.
        const int group = index / 2;
        const bool manual = group % 4 == 3;
        const QString title = QStringLiteral("Jogo sintético %1").arg(group, 5, 10, QLatin1Char('0'));
        insert.addBindValue(title);
        insert.addBindValue(title.toCaseFolded());
        insert.addBindValue(1 + (index % 6));
        insert.addBindValue(1990 + (index % 30));
        insert.addBindValue(genres.at(index % genres.size()));
        insert.addBindValue(index % 5 == 0 ? QVariant(QMetaType(QMetaType::QString))
                                           : QVariant(QStringLiteral("C:/capas/capa.jpg")));
        insert.addBindValue(manual ? QVariant(QMetaType(QMetaType::QString))
                                   : QVariant(QStringLiteral("C:/roms/%1 (USA).rom").arg(group)));
        insert.addBindValue(index % 7 == 0 ? 1 : 0);
        insert.addBindValue(index % 3 == 0 ? QStringLiteral("unplayed")
            : index % 3 == 1 ? QStringLiteral("playing") : QStringLiteral("completed"));
        insert.addBindValue(index % 11);
        insert.addBindValue(manual ? QVariant(QMetaType(QMetaType::QString))
                                   : QVariant(QStringLiteral("grupo-%1").arg(group, 6, 10, QLatin1Char('0'))));
        insert.addBindValue(QStringLiteral("2024-01-%1 00:00:00").arg(1 + (index % 28), 2, 10, QLatin1Char('0')));
        if (!insert.exec()) {
            if (error) *error = insert.lastError().text();
            database.handle().rollback();
            return false;
        }
    }
    if (!database.handle().commit()) {
        if (error) *error = database.handle().lastError().text();
        return false;
    }
    return true;
}

/** Mede paginação, contagens e índices candidatos em catálogo sintético. */
int runLibraryBenchmark(int argc, char** argv) {
    const int total = argv[2] ? QByteArray(argv[2]).toInt() : 50000;
    if (total < 1000) {
        QTextStream(stderr) << "Informe pelo menos 1000 jogos.\n";
        return 15;
    }
    QTemporaryDir temporary;
    const QString databasePath = argc > 3 ? QString::fromLocal8Bit(argv[3])
        : temporary.filePath(QStringLiteral("db/gamestock.db"));
    if (!temporary.isValid() && argc <= 3) return 16;
    QString error;
    if (argc > 3 && QFile::exists(databasePath)) QFile::remove(databasePath);
    if (!buildSyntheticLibrary(databasePath, total, &error)) {
        QTextStream(stderr) << error << "\n";
        return 17;
    }
    gamestock::ReadOnlyConnection connection;
    if (!connection.open(databasePath, &error)) {
        QTextStream(stderr) << error << "\n";
        return 18;
    }
    gamestock::GameReadDao dao(connection.database());
    QList<LibraryScenario> scenarios{
        {QStringLiteral("primeira pagina"), 1, {}},
        {QStringLiteral("pagina 100"), 100, {}},
        {QStringLiteral("busca e favoritos"), 1, [] { gamestock::GameListFilters f; f.search = QStringLiteral("sintético 0001"); f.collection = QStringLiteral("favorites"); return f; }()},
        {QStringLiteral("genero e favoritos"), 1, [] { gamestock::GameListFilters f; f.genre = QStringLiteral("Ação"); f.collection = QStringLiteral("favorites"); return f; }()},
        {QStringLiteral("mais jogados"), 1, [] { gamestock::GameListFilters f; f.sortBy = QStringLiteral("mostPlayed"); return f; }()},
        {QStringLiteral("sem capas"), 1, [] { gamestock::GameListFilters f; f.includeMissingCovers = false; return f; }()},
    };
    QJsonArray pages;
    for (const LibraryScenario& scenario : scenarios) pages.append(measureLibraryScenario(dao, scenario));

    // Contadores da sidebar: mesmo custo de agrupamento executado a cada busca na UI.
    const auto sidebarRun = [&](gamestock::GameCountCache* cache) {
        return [&, cache] {
            gamestock::GameReadDao::SidebarCounts counts;
            QString sidebarError;
            QElapsedTimer timer;
            timer.start();
            if (!dao.sidebarCounts({}, &counts, &sidebarError, cache)) return -1.0;
            return static_cast<double>(timer.nsecsElapsed()) / 1'000'000.0;
        };
    };
    gamestock::GameCountCache sidebarCache;
    sidebarCache.setGeneration(1);
    sidebarRun(&sidebarCache)();
    const QJsonObject sidebar{
        {QStringLiteral("withoutCacheMs"), medianMs(sidebarRun(nullptr))},
        {QStringLiteral("withCacheMs"), medianMs(sidebarRun(&sidebarCache))},
    };

    // Índices candidatos: criados só neste banco temporário e removidos em seguida.
    // O controle sem índice vem primeiro para que o cache de sistema aquecido seja comparável.
    QJsonArray indexSamples;
    {
        QJsonArray control;
        for (qsizetype index = 0; index < 2; ++index) control.append(measureLibraryScenario(dao, scenarios.at(index)));
        indexSamples.append(QJsonObject{
            {QStringLiteral("index"), QStringLiteral("controle")},
            {QStringLiteral("pages"), control},
            {QStringLiteral("sidebarMs"), medianMs(sidebarRun(nullptr))},
        });
    }
    const QList<QPair<QString, QString>> candidates{
        {QStringLiteral("idx_bench_group_title"),
            QStringLiteral("CREATE INDEX idx_bench_group_title ON games(platform_id, library_group_key, title COLLATE NOCASE)")},
        {QStringLiteral("idx_bench_favorite_group"),
            QStringLiteral("CREATE INDEX idx_bench_favorite_group ON games(favorite, platform_id, library_group_key)")},
        {QStringLiteral("idx_bench_recent_group"),
            QStringLiteral("CREATE INDEX idx_bench_recent_group ON games(created_at DESC, id DESC, platform_id, library_group_key)")},
    };
    // A conexão medida é somente leitura; cada comando de índice usa uma conexão curta.
    const auto runIndexSql = [&databasePath](const QString& sql) {
        bool ok = false;
        {
            QSqlDatabase writer = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), QStringLiteral("bench-index-writer"));
            writer.setDatabaseName(databasePath);
            if (writer.open()) {
                {
                    QSqlQuery query(writer);
                    ok = query.exec(sql);
                }
                writer.close();
            }
        }
        QSqlDatabase::removeDatabase(QStringLiteral("bench-index-writer"));
        return ok;
    };
    for (const auto& candidate : candidates) {
        if (!runIndexSql(candidate.second)) continue;
        QJsonArray baseline;
        for (qsizetype index = 0; index < 2; ++index) baseline.append(measureLibraryScenario(dao, scenarios.at(index)));
        indexSamples.append(QJsonObject{
            {QStringLiteral("index"), candidate.first},
            {QStringLiteral("pages"), baseline},
            {QStringLiteral("sidebarMs"), medianMs(sidebarRun(nullptr))},
        });
        runIndexSql(QStringLiteral("DROP INDEX IF EXISTS ") + candidate.first);
    }

    const QJsonObject output{{QStringLiteral("games"), total},
        {QStringLiteral("pages"), pages},
        {QStringLiteral("sidebar"), sidebar},
        {QStringLiteral("candidateIndexes"), indexSamples}};
    QTextStream(stdout) << QJsonDocument(output).toJson(QJsonDocument::Compact) << "\n";
    return 0;
}
/** Mede a varredura recursiva usada pelas estatísticas de armazenamento. */
int runProfileSizeBenchmark(int argc, char** argv) {
    if (argc < 3) {
        QTextStream(stderr) << "Informe o diretório do perfil.\n";
        return 20;
    }
    const QString directory = QString::fromLocal8Bit(argv[2]);
    if (!QDir(directory).exists()) {
        QTextStream(stderr) << "Diretório inexistente.\n";
        return 21;
    }
    QElapsedTimer timer;
    timer.start();
    qint64 files = 0;
    qint64 bytes = 0;
    QDirIterator iterator(directory, QDir::Files | QDir::Hidden | QDir::System | QDir::NoDotAndDotDot,
        QDirIterator::Subdirectories);
    while (iterator.hasNext()) {
        iterator.next();
        ++files;
        bytes += iterator.fileInfo().size();
    }
    const double elapsed = static_cast<double>(timer.nsecsElapsed()) / 1'000'000.0;
    const QJsonObject output{{QStringLiteral("files"), static_cast<double>(files)},
        {QStringLiteral("bytes"), static_cast<double>(bytes)},
        {QStringLiteral("scanMs"), elapsed},
        {QStringLiteral("megabytes"), static_cast<double>(bytes) / (1024.0 * 1024.0)}};
    QTextStream(stdout) << QJsonDocument(output).toJson(QJsonDocument::Compact) << "\n";
    return 0;
}

/** Mede busca LaunchBox isolada versus visão normalizada reutilizada. */
int runLaunchBoxBenchmark(int argc, char** argv) {
    const int total = argv[2] ? QByteArray(argv[2]).toInt() : 50000;
    if (total < 1000) {
        QTextStream(stderr) << "Informe pelo menos 1000 jogos.\n";
        return 19;
    }
    QJsonObject index;
    QJsonArray images{QJsonObject{{QStringLiteral("filename"), QStringLiteral("cover.png")},
        {QStringLiteral("type"), QStringLiteral("Box - Front")},
        {QStringLiteral("region"), QJsonValue(QJsonValue::Null)}}};
    for (int indexValue = 0; indexValue < total; ++indexValue) {
        const QString id = QString::number(indexValue);
        const QString name = indexValue == total / 2 ? QStringLiteral("Needle")
            : QStringLiteral("Game %1").arg(indexValue, 6, 10, QLatin1Char('0'));
        QJsonArray aliases;
        if (indexValue % 10 == 0) aliases.append(QStringLiteral("Alias %1").arg(indexValue));
        index.insert(id, QJsonObject{
            {QStringLiteral("id"), id},
            {QStringLiteral("name"), name},
            {QStringLiteral("platform"), QStringLiteral("Platform %1").arg(indexValue % 40)},
            {QStringLiteral("alternateNames"), aliases},
            {QStringLiteral("images"), images},
        });
    }
    gamestock::LaunchBoxSearchOptions broad;
    broad.query = QStringLiteral("game 0000");
    broad.limit = 100;
    gamestock::LaunchBoxSearchOptions restricted;
    restricted.query = QStringLiteral("game 0000");
    restricted.allowedPlatforms = {QStringLiteral("Platform 7"), QStringLiteral("Platform 7")};
    restricted.restrictPlatforms = true;
    restricted.limit = 100;

    const auto measure = [](const std::function<QList<QVariantMap>()>& run) {
        return medianMs([&run] {
            QElapsedTimer timer;
            timer.start();
            const QList<QVariantMap> value = run();
            Q_UNUSED(value);
            return static_cast<double>(timer.nsecsElapsed()) / 1'000'000.0;
        });
    };
    // Caminho isolado: a visão normalizada é construída a cada chamada, como no fallback.
    const double isolatedBroadMs = measure([&] { return gamestock::searchLaunchBoxIndex(index, broad); });
    const double isolatedRestrictedMs = measure([&] { return gamestock::searchLaunchBoxIndex(index, restricted); });
    const quint64 memoryBefore = workingSetBytes();
    QElapsedTimer buildTimer;
    buildTimer.start();
    gamestock::LaunchBoxSearchIndex prepared(index);
    const double buildMs = static_cast<double>(buildTimer.nsecsElapsed()) / 1'000'000.0;
    const quint64 memoryAfter = workingSetBytes();
    const double preparedBroadMs = measure([&] { return prepared.search(broad); });
    const double preparedRestrictedMs = measure([&] { return prepared.search(restricted); });
    const QJsonObject output{
        {QStringLiteral("games"), total},
        {QStringLiteral("preparedBuildMs"), buildMs},
        {QStringLiteral("isolatedBroadMs"), isolatedBroadMs},
        {QStringLiteral("preparedBroadMs"), preparedBroadMs},
        {QStringLiteral("isolatedRestrictedMs"), isolatedRestrictedMs},
        {QStringLiteral("preparedRestrictedMs"), preparedRestrictedMs},
        {QStringLiteral("preparedWorkingSetBytes"), static_cast<double>(memoryAfter - memoryBefore)},
        {QStringLiteral("broadResults"), prepared.search(broad).size()},
        {QStringLiteral("restrictedResults"), prepared.search(restricted).size()},
    };
    QTextStream(stdout) << QJsonDocument(output).toJson(QJsonDocument::Compact) << "\n";
    return 0;
}
} // namespace

int main(int argc, char** argv) {
    QCoreApplication app(argc, argv);
    if (argc >= 2 && QByteArray(argv[1]) == "--launchbox") return runLaunchBoxBenchmark(argc, argv);
    if (argc >= 2 && QByteArray(argv[1]) == "--profile-size") return runProfileSizeBenchmark(argc, argv);
    if (argc >= 2 && QByteArray(argv[1]) == "--import") return runImportBenchmark(argc, argv);
    if (argc >= 2 && QByteArray(argv[1]) == "--library") return runLibraryBenchmark(argc, argv);
    if (argc < 2) {
        QTextStream(stderr) << "Uso: native_benchmark <gamestock.db> [--import <total>] "
            "[--library <total> [<db>]] [--launchbox <total>] [--profile-size <dir>]\n";
        return 2;
    }
    gamestock::GameService service;
    QString error;
    QElapsedTimer openTimer;
    openTimer.start();
    if (!service.open(QString::fromLocal8Bit(argv[1]), &error)) {
        QTextStream(stderr) << error << "\n";
        return 3;
    }
    const double openMs = static_cast<double>(openTimer.nsecsElapsed()) / 1'000'000.0;
    QJsonArray results;
    for (const QJsonValue& filter : benchmarkFilters()) results.append(measure(service, filter.toObject()));
    const QJsonObject output{{QStringLiteral("openMs"), openMs},
        {QStringLiteral("workingSetBytes"), static_cast<double>(workingSetBytes())},
        {QStringLiteral("pagination"), results}};
    QTextStream(stdout) << QJsonDocument(output).toJson(QJsonDocument::Compact) << "\n";
    return 0;
}
