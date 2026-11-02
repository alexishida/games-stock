/** Verifica emuladores, vínculos, executáveis e inventário RetroArch. */
#include "app/ExecutableResolver.h"
#include "app/RetroArchCores.h"
#include "db/Database.h"
#include "services/EmulatorService.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QProcessEnvironment>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QtTest>

#ifdef Q_OS_WIN
#define FAKE_EXE "fake.exe"
#define RA_EXE "retroarch.exe"
#else
#define FAKE_EXE "fake"
#define RA_EXE "retroarch"
#endif

namespace {
/** Cria um arquivo vazio e devolve o caminho absoluto. */
QString touch(const QString& path) {
    QFile file(path);
    if (!file.open(QIODevice::WriteOnly)) return {};
    file.write("x");
    file.close();
    return QFileInfo(path).absoluteFilePath();
}

/** Localiza o ID de plataforma semeada. */
qint64 platformId(QSqlDatabase& database, const QString& name) {
    QSqlQuery query(database);
    query.prepare(QStringLiteral("SELECT id FROM platforms WHERE name = ?"));
    query.bindValue(0, name);
    if (!query.exec() || !query.next()) return 0;
    return query.value(0).toLongLong();
}

/** Localiza um emulador pelo nome na lista observável. */
QVariantMap findByName(const QVariantList& items, const QString& name) {
    for (const QVariant& entry : items) {
        if (entry.toMap().value(QStringLiteral("name")).toString() == name) return entry.toMap();
    }
    return {};
}
} // namespace

/** Cobre CRUD, vínculos e resolução de arquivos sem abrir perfil real. */
class EmulatorServiceTest : public QObject {
    Q_OBJECT
private slots:
    /** Nome vazio/duplicado, atualização parcial e bloqueio do RetroArch. */
    void crudAndValidation() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
        }
        gamestock::EmulatorService service;
        QString error;
        QVERIFY2(service.open(path, &error), qPrintable(error));
        QVERIFY(service.items().size() >= 2);
        const QVariantMap retroArch = findByName(service.items(), QStringLiteral("RetroArch"));
        QVERIFY(!retroArch.isEmpty());
        QCOMPARE(retroArch.value("is_retroarch").toInt(), 1);

        QVERIFY(service.create({{"name", "   "}}).isEmpty());
        QVERIFY(service.error().contains(QStringLiteral("Nome")));
        const QVariantMap created = service.create({{"name", "Dolphin"}, {"executable", ""}, {"args", ""}});
        QVERIFY2(!created.isEmpty(), qPrintable(service.error()));
        const qint64 dolphin = created.value("id").toLongLong();
        QVERIFY(dolphin > 0);
        QVERIFY(service.create({{"name", "Dolphin"}}).isEmpty());
        QVERIFY2(service.error().contains(QStringLiteral("já existe")), qPrintable(service.error()));

        QVERIFY(service.update(dolphin, {{"name", "Dolphin Emulator"}, {"executable", "dolphin"}, {"args", "-b"}}));
        QVariantMap updated = service.get(dolphin);
        QCOMPARE(updated.value("name").toString(), QString("Dolphin Emulator"));
        QCOMPARE(updated.value("executable").toString(), QString("dolphin"));
        QVERIFY(service.update(dolphin, {{"args", "--batch"}}));
        updated = service.get(dolphin);
        QCOMPARE(updated.value("name").toString(), QString("Dolphin Emulator"));
        QCOMPARE(updated.value("args").toString(), QString("--batch"));
        QVERIFY(!service.update(dolphin, {{"name", "RetroArch"}}));
        QVERIFY(service.error().contains(QStringLiteral("já existe")));
        QVERIFY(!service.update(999999, {{"name", "Fantasma"}}));
        QVERIFY(service.error().contains(QStringLiteral("não encontrado")));

        QVERIFY(!service.remove(retroArch.value("id").toLongLong()));
        QVERIFY(service.error().contains(QStringLiteral("RetroArch")));
        QVERIFY(service.remove(dolphin));
        QVERIFY(service.get(dolphin).isEmpty());
        QVERIFY(!service.remove(dolphin));
    }

    /** Vínculo padrão único, consulta em lote e rollback transacional. */
    void platformLinks() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        qint64 snes = 0;
        qint64 nes = 0;
        qint64 retro = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
            snes = platformId(database.handle(), QStringLiteral("Super Nintendo"));
            nes = platformId(database.handle(), QStringLiteral("Nintendo NES"));
            QVERIFY(snes > 0 && nes > 0);
        }
        gamestock::EmulatorService service;
        QString error;
        QVERIFY2(service.open(path, &error), qPrintable(error));
        retro = findByName(service.items(), QStringLiteral("RetroArch")).value("id").toLongLong();
        QVERIFY(retro > 0);
        const QVariantMap dolphinMap = service.create({{"name", "Dolphin"}, {"executable", "dolphin"}});
        QVERIFY2(!dolphinMap.isEmpty(), qPrintable(service.error()));
        const qint64 dolphin = dolphinMap.value("id").toLongLong();

        QVERIFY(!service.link(retro, snes, true, QStringLiteral("snes9x_libretro")).isEmpty());
        QCOMPARE(service.getDefault(snes).value("emulator_id").toLongLong(), retro);
        QVERIFY(!service.link(dolphin, snes, true, QString()).isEmpty());
        QCOMPARE(service.getDefault(snes).value("emulator_id").toLongLong(), dolphin);
        const QVariantList snesLinks = service.listByPlatform(snes);
        QCOMPARE(snesLinks.size(), 2);
        QCOMPARE(snesLinks.at(0).toMap().value("emulator_id").toLongLong(), dolphin);
        QCOMPARE(snesLinks.at(0).toMap().value("is_default").toInt(), 1);

        QVERIFY(!service.link(dolphin, nes, false, QString()).isEmpty());
        const QVariantMap grouped = service.listByPlatforms(QVariantList{snes, nes, 999});
        QCOMPARE(grouped.value(QString::number(snes)).toList().size(), 2);
        QCOMPARE(grouped.value(QString::number(nes)).toList().size(), 1);
        QCOMPARE(grouped.value(QStringLiteral("999")).toList().size(), 0);
        QVERIFY(service.unlink(dolphin, nes));
        QCOMPARE(service.listByPlatform(nes).size(), 0);

        QVariantList changes{
            QVariantMap{{"platformId", snes}, {"emulatorId", retro}, {"isDefault", false}, {"corePath", "snes9x"}},
            QVariantMap{{"platformId", nes}, {"emulatorId", retro}, {"isDefault", true}}
        };
        QVERIFY(service.savePlatformLinks(changes));
        QCOMPARE(service.getDefault(nes).value("emulator_id").toLongLong(), retro);
        const int before = service.listByPlatform(nes).size();
        QVariantList invalid{
            QVariantMap{{"platformId", nes}, {"emulatorId", dolphin}, {"isDefault", true}},
            QVariantMap{{"platformId", 999999}, {"emulatorId", dolphin}, {"isDefault", true}}
        };
        QVERIFY(!service.savePlatformLinks(invalid));
        QCOMPARE(service.listByPlatform(nes).size(), before);
        QVERIFY(service.link(0, snes, false, QString()).isEmpty());

        // Excluir emulador remove vínculos por CASCADE.
        QVERIFY(service.remove(dolphin));
        QCOMPARE(service.listByPlatform(snes).size(), 1);
    }

    /** Caminho absoluto, relativo, PATH e erro acionável. */
    void executableResolution() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString executable = touch(dir.filePath(FAKE_EXE));
        QVERIFY(!executable.isEmpty());

        gamestock::ExecutableResolution absolute = gamestock::resolveConfiguredExecutable(executable);
        QVERIFY2(absolute.error.isEmpty(), qPrintable(absolute.error));
        QCOMPARE(absolute.source, QString("filesystem"));
        const gamestock::ExecutableResolution emptyResolution = gamestock::resolveConfiguredExecutable(QString());
        QCOMPARE(emptyResolution.code, QString("NOT_FOUND"));

        const QString previousDirectory = QDir::currentPath();
        QVERIFY(QDir::setCurrent(dir.path()));
        gamestock::ExecutableResolution relative = gamestock::resolveConfiguredExecutable(QStringLiteral("./") + FAKE_EXE);
        QDir::setCurrent(previousDirectory);
        QVERIFY2(relative.error.isEmpty(), qPrintable(relative.error));
        QCOMPARE(relative.source, QString("filesystem"));

        const QByteArray previousPath = qgetenv("PATH");
        qputenv("PATH", (dir.path() + QDir::listSeparator() + QString::fromLocal8Bit(previousPath)).toUtf8());
        gamestock::ExecutableResolution fromPath = gamestock::resolveConfiguredExecutable(QStringLiteral("fake"));
        qputenv("PATH", previousPath);
        QVERIFY2(fromPath.error.isEmpty(), qPrintable(fromPath.error));
        QCOMPARE(fromPath.source, QString("path"));

        const gamestock::ExecutableResolution missing = gamestock::resolveConfiguredExecutable(dir.filePath("nao-existe.exe"));
        QCOMPARE(missing.code, QString("NOT_FOUND"));
        QVERIFY(missing.error.contains(QStringLiteral("não encontrado")));
#ifndef Q_OS_WIN
        const QString plain = touch(dir.filePath("sem-permissao"));
        QFile::setPermissions(plain, QFile::ReadOwner | QFile::WriteOwner);
        const auto denied = gamestock::resolveConfiguredExecutable(plain);
        QCOMPARE(denied.code, QString("NOT_EXECUTABLE"));
#endif
    }

    /** Inventário, duplicatas e resolução manual/fallback de cores. */
    void retroArchInventoryAndCores() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString executable = touch(dir.filePath(RA_EXE));
        QVERIFY(!executable.isEmpty());
        const QString coresDir = dir.filePath("cores");
        QVERIFY(QDir().mkpath(coresDir));
        QVERIFY(!touch(QDir(coresDir).filePath("snes9x_libretro.dll")).isEmpty());
        QVERIFY(!touch(QDir(coresDir).filePath("snes9x_libretro.dylib")).isEmpty());
        QVERIFY(!touch(QDir(coresDir).filePath("nestopia_libretro.so")).isEmpty());
        QVERIFY(!touch(QDir(coresDir).filePath("notas.txt")).isEmpty());

        const QString path = dir.filePath("db/gamestock.db");
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
        }
        gamestock::EmulatorService service;
        QString error;
        QVERIFY2(service.open(path, &error), qPrintable(error));
        const QVariantMap emulator = service.create({{"name", "RetroArch Temp"}, {"executable", executable},
            {"is_retroarch", true}});
        QVERIFY2(!emulator.isEmpty(), qPrintable(service.error()));
        const qint64 id = emulator.value("id").toLongLong();

        const QVariantMap inventory = service.listRetroArchCores(id);
        QCOMPARE(inventory.value("coresDirExists").toBool(), true);
        QCOMPARE(inventory.value("executableConfigured").toBool(), true);
        QStringList installed;
        for (const QVariant& core : inventory.value("installedCores").toList()) installed.append(core.toString());
        QCOMPARE(installed, QStringList({QStringLiteral("nestopia_libretro"), QStringLiteral("snes9x_libretro")}));

        const QVariantMap seedRetro = findByName(service.items(), QStringLiteral("RetroArch"));
        const QVariantMap empty = service.listRetroArchCores(seedRetro.value("id").toLongLong());
        QCOMPARE(empty.value("executableConfigured").toBool(), false);
        QCOMPARE(empty.value("coresDirExists").toBool(), false);
        QVERIFY(service.listRetroArchCores(999999).isEmpty());
        QVERIFY(service.error().contains(QStringLiteral("RetroArch")));

        QVERIFY(!gamestock::resolveRetroArchCorePath(QStringLiteral("snes9x_libretro"), executable,
            QStringLiteral("Super Nintendo")).isEmpty());
        QVERIFY(gamestock::resolveRetroArchCorePath(QStringLiteral("snes9x_libretro"), executable,
            QStringLiteral("Super Nintendo")).endsWith(QStringLiteral(".dll")));
        const QString manual = QDir(coresDir).filePath("nestopia_libretro.so");
        QCOMPARE(gamestock::resolveRetroArchCorePath(manual, executable, QStringLiteral("Qualquer")), QDir::cleanPath(manual));

        // Remove o core principal e comprova o fallback do catálogo.
        QFile::remove(QDir(coresDir).filePath("snes9x_libretro.dll"));
        QFile::remove(QDir(coresDir).filePath("snes9x_libretro.dylib"));
        QVERIFY(!touch(QDir(coresDir).filePath("bsnes_libretro.dll")).isEmpty());
        const QString fallback = gamestock::resolveRetroArchCorePath(QString(), executable, QStringLiteral("Super Nintendo"));
        QVERIFY(fallback.endsWith(QStringLiteral("bsnes_libretro.dll")));
        QVERIFY(gamestock::resolveRetroArchCorePath(QString(), executable, QStringLiteral("Plataforma inexistente")).isEmpty());

        const QStringList candidates = gamestock::retroArchCoreCandidatesForPlatform(QStringLiteral("NES"));
        QVERIFY(candidates.contains(QStringLiteral("nestopia_libretro")));
        QVERIFY(candidates.contains(QStringLiteral("fceumm_libretro")));
        QVERIFY(gamestock::retroArchCoreCandidatesForPlatform(QStringLiteral("Inexistente")).isEmpty());
        const QStringList compatible = gamestock::compatibleInstalledCores(QStringLiteral("Super Nintendo"),
            {QStringLiteral("snes9x_libretro"), QStringLiteral("mesen-s_libretro"), QStringLiteral("genesis_plus_gx_libretro")});
        QVERIFY(compatible.contains(QStringLiteral("snes9x_libretro")));
        QVERIFY(compatible.contains(QStringLiteral("mesen-s_libretro")));
        QVERIFY(!compatible.contains(QStringLiteral("genesis_plus_gx_libretro")));
    }
};

QTEST_GUILESS_MAIN(EmulatorServiceTest)
#include "EmulatorServiceTest.moc"
