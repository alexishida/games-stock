/** Verifica extração/cache de ROM, argumentos e incremento somente no sucesso. */
#include "db/Database.h"
#include "db/dao/GameReadDao.h"
#include "db/dao/GameWriteDao.h"
#include "services/EmulatorService.h"
#include "services/LaunchService.h"

#include <QCoreApplication>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QProcess>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QtTest>

#ifdef Q_OS_WIN
#define FAKE_NAME "fake_emulator.exe"
#define RA_NAME "retroarch.exe"
#define CORE_SUFFIX ".dll"
#else
#define FAKE_NAME "fake_emulator"
#define RA_NAME "retroarch"
#define CORE_SUFFIX ".so"
#endif

namespace {
QString fakeEmulatorPath() {
    return QDir(QCoreApplication::applicationDirPath()).filePath(QString::fromLatin1(FAKE_NAME));
}

qint64 platformId(QSqlDatabase& database, const QString& name) {
    QSqlQuery query(database);
    query.prepare(QStringLiteral("SELECT id FROM platforms WHERE name = ?"));
    query.bindValue(0, name);
    if (!query.exec() || !query.next()) return 0;
    return query.value(0).toLongLong();
}

bool writeText(const QString& path, const QByteArray& content) {
    QFile file(path);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate)) return false;
    return file.write(content) == content.size();
}

QStringList readLines(const QString& path) {
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) return {};
    return QString::fromUtf8(file.readAll()).split(QLatin1Char('\n'), Qt::SkipEmptyParts);
}

/** Cria um zip/7z determinístico com o binário 7za disponível. */
bool createArchive(const QString& binary, const QString& workingDirectory, const QString& archive,
    const QString& sourceFile) {
    QProcess process;
    process.setWorkingDirectory(workingDirectory);
    process.setProgram(binary);
    process.setArguments({QStringLiteral("a"), archive, sourceFile});
    process.start();
    if (!process.waitForFinished(30000)) return false;
    return process.exitStatus() == QProcess::NormalExit && process.exitCode() == 0;
}

/** Confirma que o emulador falso gravou ao menos um argumento. */
bool waitForArguments(const QString& path) {
    for (int attempt = 0; attempt < 100; ++attempt) {
        if (QFileInfo(path).size() > 0) return true;
        QTest::qWait(50);
    }
    return false;
}
} // namespace

/** Sem abrir o perfil real, comprova o fluxo completo do launch. */
class LaunchServiceTest : public QObject {
    Q_OBJECT
private slots:
    /** Evita vazar overrides de teste entre casos. */
    void cleanup() {
        qunsetenv("GAMESTOCK_EXTRACTION_DIR");
        qunsetenv("FAKE_EMULATOR_OUTPUT");
    }

    /** Marcadores viram argumentos separados e a contagem sobe após o spawn. */
    void genericLaunchArgs() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
        }
        const QString argsFile = dir.filePath("args.txt");
        const QString rom = dir.filePath(QStringLiteral("Ação (USA).sfc"));
        QVERIFY(writeText(rom, "rom"));
        qint64 snes = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
            snes = platformId(database.handle(), QStringLiteral("Super Nintendo"));
            QVERIFY(snes > 0);
        }
        gamestock::EmulatorService emulators;
        QString error;
        QVERIFY2(emulators.open(path, &error), qPrintable(error));
        const QVariantMap emulator = emulators.create({{"name", "Fake"},
            {"executable", fakeEmulatorPath()},
            {"args", QStringLiteral("\"%1\" --file \"{romPath}\" --name \"{romFileName}\"").arg(argsFile)}});
        QVERIFY2(!emulator.isEmpty(), qPrintable(emulators.error()));
        QVERIFY(!emulators.link(emulator.value("id").toLongLong(), snes, true, QString()).isEmpty());

        qint64 gameId = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
            gamestock::GameWriteDao games(database.handle());
            QVERIFY2(games.create({{"title", "Aventura"}, {"platform_id", snes}, {"rom_path", rom}}, &gameId, &error),
                qPrintable(error));
        }
        gamestock::LaunchService launcher;
        QVERIFY2(launcher.open(path, &error), qPrintable(error));
        const QVariantMap result = launcher.launch(gameId);
        QVERIFY2(!result.isEmpty(), qPrintable(launcher.error()));
        QVERIFY(waitForArguments(argsFile));
        const QStringList args = readLines(argsFile);
        QCOMPARE(args.size(), 4);
        QCOMPARE(args.at(0), QString("--file"));
        QCOMPARE(args.at(1), QDir::cleanPath(rom));
        QCOMPARE(args.at(2), QString("--name"));
        QCOMPARE(args.at(3), QStringLiteral("Ação (USA).sfc"));

        QVariantMap stored;
        {
            gamestock::Database database;
            QString readError;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &readError), qPrintable(readError));
            gamestock::GameReadDao games(database.handle());
            QVERIFY(games.get(gameId, &stored, &readError));
        }
        QCOMPARE(stored.value("launch_count").toInt(), 1);
        // O caminho assíncrono sinaliza início/fim e não permite lançamentos duplicados.
        QSignalSpy launched(&launcher, &gamestock::LaunchService::launchFinished);
        QVERIFY(launcher.beginLaunch(gameId));
        QVERIFY(launcher.launching());
        QVERIFY(!launcher.beginLaunch(gameId));
        QTRY_COMPARE_WITH_TIMEOUT(launched.count(), 1, 5000);
        QVERIFY(!launcher.launching());
        QVERIFY(launched.first().at(1).toMap().value("success").toBool());
        {
            gamestock::Database database;
            QString readError;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &readError), qPrintable(readError));
            gamestock::GameReadDao games(database.handle());
            QVERIFY(games.get(gameId, &stored, &readError));
        }
        QCOMPARE(stored.value("launch_count").toInt(), 2);
        // Falhas também encerram o loading e entregam uma mensagem ao formulário.
        launched.clear();
        QVERIFY(launcher.beginLaunch(-1));
        QTRY_COMPARE_WITH_TIMEOUT(launched.count(), 1, 5000);
        QVERIFY(!launcher.launching());
        QVERIFY(!launched.first().at(1).toMap().value("success").toBool());
        QVERIFY(!launcher.error().isEmpty());
    }

    /** ZIP/7z extraem, cache reaproveita, falha usa o pacote e Arcade preserva o ZIP. */
    void archiveLaunch() {
        const QString sevenZip = qEnvironmentVariable("GAMESTOCK_7Z_PATH");
        if (sevenZip.isEmpty() || !QFileInfo(sevenZip).isFile()) QSKIP("7-Zip de teste não informado.");
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        qputenv("GAMESTOCK_EXTRACTION_DIR", dir.filePath("extracted-roms").toUtf8());
        const QString path = dir.filePath("db/gamestock.db");
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
        }
        const QString sourceDir = dir.filePath("roms");
        QVERIFY(QDir().mkpath(sourceDir));
        QVERIFY(writeText(QDir(sourceDir).filePath(QStringLiteral("Game (USA).sfc")), "rom"));
        QVERIFY(writeText(QDir(sourceDir).filePath("readme.txt"), "texto"));
        const QString zip = QDir(sourceDir).filePath("Game.zip");
        QVERIFY(createArchive(sevenZip, sourceDir, zip, QStringLiteral("Game (USA).sfc")));
        const QString seven = QDir(sourceDir).filePath("Game.7z");
        QVERIFY(createArchive(sevenZip, sourceDir, seven, QStringLiteral("Game (USA).sfc")));
        const QString broken = QDir(sourceDir).filePath("Broken.zip");
        QVERIFY(writeText(broken, "não é um zip"));

        qint64 snes = 0;
        qint64 arcade = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
            snes = platformId(database.handle(), QStringLiteral("Super Nintendo"));
            arcade = platformId(database.handle(), QStringLiteral("Arcade"));
            QVERIFY(snes > 0 && arcade > 0);
        }
        gamestock::EmulatorService emulators;
        QString error;
        QVERIFY2(emulators.open(path, &error), qPrintable(error));
        const QString argsFile = dir.filePath("args.txt");
        const QVariantMap emulator = emulators.create({{"name", "Fake"},
            {"executable", fakeEmulatorPath()},
            {"args", QStringLiteral("\"%1\" --rom \"{romPath}\"").arg(argsFile)}});
        QVERIFY(!emulator.isEmpty());
        const qint64 emulatorId = emulator.value("id").toLongLong();
        QVERIFY(!emulators.link(emulatorId, snes, true, QString()).isEmpty());
        QVERIFY(!emulators.link(emulatorId, arcade, true, QString()).isEmpty());

        gamestock::LaunchService launcher;
        QVERIFY2(launcher.open(path, &error), qPrintable(error));
        const auto launchRom = [&](const QString& title, qint64 platform, const QString& romPath) -> QStringList {
            qint64 id = 0;
            {
                gamestock::Database database;
                QString createError;
                if (!database.open(path, dir.filePath("db/images"), &createError)) return {};
                gamestock::GameWriteDao games(database.handle());
                if (!games.create({{"title", title}, {"platform_id", platform}, {"rom_path", romPath}}, &id, &createError)) {
                    return {};
                }
            }
            QFile::remove(argsFile);
            if (launcher.launch(id).isEmpty()) return {};
            if (!waitForArguments(argsFile)) return {};
            return readLines(argsFile);
        };

        QStringList args = launchRom("ZIP", snes, zip);
        QCOMPARE(args.size(), 2);
        QVERIFY(args.at(1).contains(QStringLiteral("extracted-roms")));
        QVERIFY(args.at(1).endsWith(QStringLiteral("Game (USA).sfc")));
        QVERIFY(QFileInfo::exists(args.at(1)));
        const QString cached = args.at(1);
        args = launchRom("ZIP cache", snes, zip);
        QCOMPARE(args.at(1), cached);

        args = launchRom("7z", snes, seven);
        QVERIFY(args.at(1).contains(QStringLiteral("extracted-roms")));
        QVERIFY(args.at(1).endsWith(QStringLiteral("Game (USA).sfc")));
        QVERIFY(QFileInfo::exists(args.at(1)));

        const QString brokenPath = QDir::cleanPath(broken);
        args = launchRom("Broken", snes, broken);
        QCOMPARE(args.at(1), brokenPath);

        args = launchRom("Arcade", arcade, zip);
        QCOMPARE(args.at(1), QDir::cleanPath(zip));

        int removed = 0;
        const QVariantMap cleared = launcher.clearExtractedRomCache();
        QVERIFY(!cleared.isEmpty());
        QVERIFY(QFileInfo::exists(dir.filePath("extracted-roms")));
        Q_UNUSED(removed);
        qunsetenv("GAMESTOCK_EXTRACTION_DIR");
    }

    /** Falhas de ROM/emulador/core não incrementam o histórico. */
    void failuresDoNotCount() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        const QString rom = dir.filePath("Jogo.sfc");
        QVERIFY(writeText(rom, "rom"));
        qint64 snes = 0;
        qint64 nes = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
            snes = platformId(database.handle(), QStringLiteral("Super Nintendo"));
            nes = platformId(database.handle(), QStringLiteral("Nintendo NES"));
            QVERIFY(snes > 0 && nes > 0);
        }
        gamestock::EmulatorService emulators;
        QString error;
        QVERIFY2(emulators.open(path, &error), qPrintable(error));
        const QVariantMap fake = emulators.create({{"name", "Fake"}, {"executable", fakeEmulatorPath()}});
        QVERIFY(!fake.isEmpty());
        QVERIFY(!emulators.link(fake.value("id").toLongLong(), snes, true, QString()).isEmpty());

        gamestock::LaunchService launcher;
        QVERIFY2(launcher.open(path, &error), qPrintable(error));
        const auto createGame = [&](const QString& title, qint64 platform, const QString& romPath) {
            qint64 id = 0;
            gamestock::Database database;
            QString createError;
            if (!database.open(path, dir.filePath("db/images"), &createError)) return qint64(0);
            gamestock::GameWriteDao games(database.handle());
            QVariantMap input{{"title", title}, {"platform_id", platform}};
            if (!romPath.isEmpty()) input.insert("rom_path", romPath);
            return games.create(input, &id, &createError) ? id : qint64(0);
        };
        const qint64 withoutRom = createGame("Sem ROM", snes, QString());
        QVERIFY(withoutRom > 0);
        QVERIFY(launcher.launch(withoutRom).isEmpty());
        QVERIFY(launcher.error().contains(QStringLiteral("ROM")));
        const qint64 noEmulator = createGame("Sem emulador", nes, rom);
        QVERIFY(noEmulator > 0);
        QVERIFY(launcher.launch(noEmulator).isEmpty());
        QVERIFY(launcher.error().contains(QStringLiteral("padrão")));

        const QVariantMap emptyExecutable = emulators.create({{"name", "Vazio"}, {"executable", ""}});
        QVERIFY(!emptyExecutable.isEmpty());
        QVERIFY(!emulators.link(emptyExecutable.value("id").toLongLong(), nes, true, QString()).isEmpty());
        QVERIFY(launcher.launch(noEmulator).isEmpty());
        QVERIFY(launcher.error().contains(QStringLiteral("Executável")));

        const QVariantMap missing = emulators.create({{"name", "Ausente"},
            {"executable", dir.filePath("nao-existe.exe")}});
        QVERIFY(!missing.isEmpty());
        QVERIFY(!emulators.link(missing.value("id").toLongLong(), nes, true, QString()).isEmpty());
        QVERIFY(launcher.launch(noEmulator).isEmpty());
        QVERIFY(launcher.error().contains(QStringLiteral("não encontrado")));

        const QString notExecutable = dir.filePath("not-executable.exe");
        QVERIFY(writeText(notExecutable, "texto"));
        const QVariantMap invalid = emulators.create({{"name", "Inválido"}, {"executable", notExecutable}});
        QVERIFY(!invalid.isEmpty());
        QVERIFY(!emulators.link(invalid.value("id").toLongLong(), nes, true, QString()).isEmpty());
        QVERIFY(launcher.launch(noEmulator).isEmpty());

        // RetroArch sem core configurado: copia o emulador falso sem pasta cores/.
        const QString raDir = dir.filePath("retroarch-sem-core");
        QVERIFY(QDir().mkpath(raDir));
        const QString raExecutable = QDir(raDir).filePath(QString::fromLatin1(RA_NAME));
        QVERIFY(QFile::copy(fakeEmulatorPath(), raExecutable));
        const QVariantMap retro = emulators.create({{"name", "RetroArch Sem Core"},
            {"executable", raExecutable}, {"is_retroarch", true}});
        QVERIFY(!retro.isEmpty());
        QVERIFY(!emulators.link(retro.value("id").toLongLong(), snes, true, QString()).isEmpty());
        const qint64 retroGame = createGame("RetroArch", snes, rom);
        QVERIFY(retroGame > 0);
        QVERIFY(launcher.launch(retroGame).isEmpty());
        QVERIFY(launcher.error().contains(QStringLiteral("Core")));

        // Nenhuma das falhas pode ter contado partida.
        gamestock::Database database;
        QString readError;
        QVERIFY2(database.open(path, dir.filePath("db/images"), &readError), qPrintable(readError));
        gamestock::GameReadDao games(database.handle());
        for (const qint64 id : {withoutRom, noEmulator, retroGame}) {
            QVariantMap game;
            QVERIFY(games.get(id, &game, &readError));
            QCOMPARE(game.value("launch_count").toInt(), 0);
        }
    }

    /** RetroArch recebe -L, core resolvido por fallback e a ROM separada. */
    void retroArchLaunch() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
        }
        const QString raDir = dir.filePath("retroarch");
        QVERIFY(QDir().mkpath(raDir));
        const QString raExecutable = QDir(raDir).filePath(QString::fromLatin1(RA_NAME));
        QVERIFY(QFile::copy(fakeEmulatorPath(), raExecutable));
#ifndef Q_OS_WIN
        QFile::setPermissions(raExecutable, QFile::ReadOwner | QFile::WriteOwner | QFile::ExeOwner);
#endif
        const QString coresDir = QDir(raDir).filePath("cores");
        QVERIFY(QDir().mkpath(coresDir));
        const QString corePath = QDir(coresDir).filePath(QStringLiteral("snes9x_libretro") + QString::fromLatin1(CORE_SUFFIX));
        QVERIFY(writeText(corePath, "core"));

        qint64 snes = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
            snes = platformId(database.handle(), QStringLiteral("Super Nintendo"));
            QVERIFY(snes > 0);
        }
        gamestock::EmulatorService emulators;
        QString error;
        QVERIFY2(emulators.open(path, &error), qPrintable(error));
        const QVariantMap emulator = emulators.create({{"name", "RetroArch Teste"},
            {"executable", raExecutable}, {"is_retroarch", true}});
        QVERIFY(!emulator.isEmpty());
        QVERIFY(!emulators.link(emulator.value("id").toLongLong(), snes, true, QString()).isEmpty());

        const QString rom = dir.filePath("Jogo.sfc");
        QVERIFY(writeText(rom, "rom"));
        qint64 gameId = 0;
        {
            gamestock::Database database;
            QString createError;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &createError), qPrintable(createError));
            gamestock::GameWriteDao games(database.handle());
            QVERIFY(games.create({{"title", "SNES"}, {"platform_id", snes}, {"rom_path", rom}}, &gameId, &createError));
        }
        const QString argsFile = dir.filePath("ra-args.txt");
        qputenv("FAKE_EMULATOR_OUTPUT", argsFile.toUtf8());
        gamestock::LaunchService launcher;
        QVERIFY2(launcher.open(path, &error), qPrintable(error));
        QVERIFY2(!launcher.launch(gameId).isEmpty(), qPrintable(launcher.error()));
        QVERIFY(waitForArguments(argsFile));
        qunsetenv("FAKE_EMULATOR_OUTPUT");
        const QStringList args = readLines(argsFile);
        QCOMPARE(args.size(), 3);
        QCOMPARE(args.at(0), QString("-L"));
        QCOMPARE(args.at(1), QDir::cleanPath(corePath));
        QCOMPARE(args.at(2), QDir::cleanPath(rom));
    }
};

QTEST_GUILESS_MAIN(LaunchServiceTest)
#include "LaunchServiceTest.moc"
