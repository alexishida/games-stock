/** Benchmark do serviço de biblioteca em build Release, sem abrir janela. */
#include "db/Database.h"
#include "jobs/JobManager.h"
#include "jobs/JobRegistry.h"
#include "services/GameService.h"
#include "services/RomFolderService.h"

#include <QCoreApplication>
#include <QDir>
#include <QElapsedTimer>
#include <QEventLoop>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QTemporaryDir>
#include <QTextStream>
#include <QTimer>

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
} // namespace

int main(int argc, char** argv) {
    QCoreApplication app(argc, argv);
    if (argc >= 2 && QByteArray(argv[1]) == "--import") return runImportBenchmark(argc, argv);
    if (argc < 2) {
        QTextStream(stderr) << "Uso: native_benchmark <gamestock.db> [--import <total>]\n";
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
