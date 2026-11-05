/** Verifica schema, migrations e seeds contra o contrato do Electron. */
#include "db/Database.h"
#include "db/LibraryGrouping.h"
#include "db/Migrations.h"
#include "db/Schema.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QSqlError>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QtTest>

namespace {
/** Executa um comando simples e falha o teste com a mensagem do SQLite. */
bool exec(QSqlDatabase& database, const QString& sql) {
    QSqlQuery query(database);
    if (query.exec(sql)) return true;
    qWarning() << "SQL falhou:" << sql << query.lastError().text();
    return false;
}

/** Conta registros de uma tabela existente. */
qint64 countRows(QSqlDatabase& database, const QString& table) {
    QSqlQuery query(database);
    if (!query.exec(QStringLiteral("SELECT COUNT(*) FROM ") + table) || !query.next()) return -1;
    return query.value(0).toLongLong();
}

/** Lê um único valor escalar como texto, ou vazio quando não existe. */
QString scalar(QSqlDatabase& database, const QString& sql) {
    QSqlQuery query(database);
    if (!query.exec(sql) || !query.next()) return {};
    return query.value(0).toString();
}

/** Cria uma conexão avulsa para preparar cenários antes da inicialização. */
QString connectionName(const char* suffix) {
    return QStringLiteral("migrations-test-%1").arg(QString::fromLatin1(suffix));
}

/** Resumo estável de tabelas que não podem mudar quando o banco já está migrado. */
QString stableSnapshot(QSqlDatabase& database) {
    return QStringList{
        scalar(database, "SELECT COUNT(*) || ':' || COALESCE(SUM(id), 0) || ':' || COALESCE(SUM(launch_count), 0) FROM games"),
        scalar(database, "SELECT COUNT(*) || ':' || COALESCE(SUM(id), 0) FROM platforms"),
        scalar(database, "SELECT COUNT(*) || ':' || COALESCE(SUM(id), 0) FROM hardware_items"),
        scalar(database, "SELECT COUNT(*) || ':' || COALESCE(SUM(id), 0) FROM hardware_item_photos"),
        scalar(database, "SELECT COUNT(*) FROM app_state"),
        scalar(database, "SELECT COALESCE(group_concat(name, ','), '') FROM (SELECT name FROM schema_migrations ORDER BY name)"),
        scalar(database, "PRAGMA integrity_check"),
    }.join(QLatin1Char('|'));
}

/** Lê o resumo de um arquivo antes de aplicar o runtime nativo. */
QString snapshotFile(const QString& path) {
    const QString name = connectionName("snapshot");
    QString value;
    {
        QSqlDatabase raw = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), name);
        raw.setDatabaseName(path);
        if (!raw.open()) return {};
        value = stableSnapshot(raw);
        raw.close();
    }
    QSqlDatabase::removeDatabase(name);
    return value;
}
} // namespace

/** Cobre banco limpo, schema antigo, duplicatas, backfills e fixture Electron. */
class MigrationsTest : public QObject {
    Q_OBJECT
private slots:
    /** Banco limpo recebe schema, seeds e marcadores sem duplicar ao reabrir. */
    void cleanDatabase() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("gamestock.db");
        const QString images = dir.filePath("images");
        qint64 platformCount = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, images, &error), qPrintable(error));
            QSqlDatabase& handle = database.handle();
            platformCount = countRows(handle, QStringLiteral("platforms"));
            QCOMPARE(platformCount, 34);
            QCOMPARE(scalar(handle, "SELECT name FROM platforms WHERE id = 1"), QString("Arcade"));
            QCOMPARE(scalar(handle, "SELECT name FROM platforms WHERE id = 34"), QString("TeknoParrot"));
            QCOMPARE(countRows(handle, QStringLiteral("emulators")), 2);
            QCOMPARE(scalar(handle, "SELECT name FROM emulators WHERE id = 1"), QString("RetroArch"));
            QCOMPARE(scalar(handle, "SELECT args FROM emulators WHERE name = 'TeknoParrot'"),
                QString("--profile={romFileName} --startMinimized"));
            QCOMPARE(countRows(handle, QStringLiteral("item_types")), 8);
            QCOMPARE(countRows(handle, QStringLiteral("conservation_states")), 5);
            QVERIFY(scalar(handle, "SELECT COUNT(*) FROM conservation_states WHERE name = 'Com Defeito'").toInt() == 1);
            QVERIFY(countRows(handle, QStringLiteral("platform_launchbox_aliases")) > 34);
            QVERIFY(countRows(handle, QStringLiteral("platform_rom_extensions")) > 34);
            // TeknoParrot recebe vínculo padrão porque a plataforma ainda não tinha emulador.
            QCOMPARE(scalar(handle, "SELECT COUNT(*) FROM platform_emulators WHERE is_default = 1"), QString("1"));
            // Os marcadores do Electron mais a normalização de título ficam registrados uma única vez.
            QCOMPARE(countRows(handle, QStringLiteral("schema_migrations")), 8);
            // A lista pública precisa refletir exatamente o que foi registrado.
            QSqlQuery applied(handle);
            QVERIFY(applied.exec(QStringLiteral("SELECT name FROM schema_migrations ORDER BY name")));
            QStringList registered;
            while (applied.next()) registered.append(applied.value(0).toString());
            QStringList expected = gamestock::knownMigrationNames();
            expected.sort();
            QCOMPARE(registered, expected);
        }
        {
            gamestock::Database reopened;
            QString error;
            QVERIFY2(reopened.open(path, images, &error), qPrintable(error));
            QCOMPARE(countRows(reopened.handle(), QStringLiteral("platforms")), platformCount);
            // Reabrir não reaplica migrations já registradas.
            QCOMPARE(countRows(reopened.handle(), QStringLiteral("schema_migrations")), 8);
            QCOMPARE(countRows(reopened.handle(), QStringLiteral("emulators")), 2);
        }
        QVERIFY(QFileInfo(images).isDir());
    }

    /** Schema antigo ganha colunas novas e a plataforma legada é renomeada sem perder vínculos. */
    void legacySchema() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("legacy.db");
        const QString name = connectionName("legacy");
        {
            QSqlDatabase raw = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), name);
            raw.setDatabaseName(path);
            QVERIFY(raw.open());
            // Mesmo schema mínimo do fixture de migração, sem as colunas incrementais.
            QVERIFY(exec(raw, "CREATE TABLE platforms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, "
                "category TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"));
            QVERIFY(exec(raw, "CREATE TABLE games (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, "
                "platform_id INTEGER NOT NULL REFERENCES platforms(id), publisher TEXT, year INTEGER, genre TEXT, "
                "rating TEXT, box_art_path TEXT, background_path TEXT, screenshot_path TEXT, rom_path TEXT, "
                "favorite INTEGER NOT NULL DEFAULT 0, play_status TEXT NOT NULL DEFAULT 'unplayed', notes TEXT, "
                "launchbox_id TEXT, launch_count INTEGER NOT NULL DEFAULT 0, "
                "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"));
            QVERIFY(exec(raw, "INSERT INTO platforms (id, name, category) VALUES (90001, 'NES', 'Console')"));
            QVERIFY(exec(raw, "INSERT INTO games (id, title, platform_id, notes, favorite, launch_count) "
                "VALUES (90001, 'Aventura Legada', 90001, 'Anotação preservada', 1, 7)"));
            raw.close();
        }
        QSqlDatabase::removeDatabase(name);

        gamestock::Database database;
        QString error;
        QVERIFY2(database.open(path, dir.filePath("images"), &error), qPrintable(error));
        QSqlDatabase& handle = database.handle();
        QCOMPARE(scalar(handle, "SELECT name FROM platforms WHERE id = 90001"), QString("Nintendo NES"));
        QCOMPARE(scalar(handle, "SELECT platform_id FROM games WHERE id = 90001"), QString("90001"));
        QCOMPARE(scalar(handle, "SELECT notes FROM games WHERE id = 90001"), QString("Anotação preservada"));
        QCOMPARE(scalar(handle, "SELECT launch_count FROM games WHERE id = 90001"), QString("7"));
        // Colunas incrementais passam a existir sem recriar a tabela.
        QVERIFY(scalar(handle, "SELECT COUNT(*) FROM pragma_table_info('games') WHERE name IN "
            "('favorite','play_status','rom_path','launchbox_id','launch_count','library_group_key')").toInt() == 6);
        QVERIFY(scalar(handle, "SELECT COUNT(*) FROM pragma_table_info('platforms') WHERE name = 'is_default'").toInt() == 1);
    }

    /** Duplicatas reais são mescladas; variantes com ROMs diferentes perdem só o launchbox_id. */
    void dedupeAndVariants() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("dedupe.db");
        const QString name = connectionName("dedupe");
        {
            QSqlDatabase raw = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), name);
            raw.setDatabaseName(path);
            QVERIFY(raw.open());
            QString error;
            QVERIFY2(gamestock::applySchema(raw, &error), qPrintable(error));
            QVERIFY(exec(raw, "INSERT INTO platforms (id, name, category) VALUES (500, 'Nintendo SNES', 'Console')"));
            QVERIFY(exec(raw, "INSERT INTO games (id, title, platform_id, publisher, launchbox_id, favorite, launch_count, "
                "rom_path, notes, updated_at) VALUES "
                "(1, 'Jogo', 500, NULL, 'lb-1', 0, 2, 'C:/roms/a.sfc', NULL, '2026-01-01'),"
                "(2, 'Jogo', 500, 'Editora', 'lb-1', 1, 5, 'C:/roms/a.sfc', 'nota', '2026-02-01'),"
                "(3, 'Jogo', 500, NULL, 'lb-1', 0, 1, 'C:/roms/b.sfc', NULL, '2026-01-15')"));
            raw.close();
        }
        QSqlDatabase::removeDatabase(name);

        gamestock::Database database;
        QString error;
        QVERIFY2(database.open(path, dir.filePath("images"), &error), qPrintable(error));
        QSqlDatabase& handle = database.handle();
        // O sobrevivente é o mais recente (id 2) e herda o maior histórico e o favorito.
        QCOMPARE(scalar(handle, "SELECT title FROM games WHERE id = 2"), QString("Jogo"));
        QCOMPARE(scalar(handle, "SELECT publisher FROM games WHERE id = 2"), QString("Editora"));
        QCOMPARE(scalar(handle, "SELECT launch_count FROM games WHERE id = 2"), QString("5"));
        QCOMPARE(scalar(handle, "SELECT favorite FROM games WHERE id = 2"), QString("1"));
        QCOMPARE(scalar(handle, "SELECT notes FROM games WHERE id = 2"), QString("nota"));
        QCOMPARE(scalar(handle, "SELECT COUNT(*) FROM games WHERE launchbox_id = 'lb-1'"), QString("1"));
        // A variante com outra ROM permanece, apenas sem o vínculo LaunchBox duplicado.
        QCOMPARE(scalar(handle, "SELECT launchbox_id IS NULL FROM games WHERE id = 3"), QString("1"));
        QCOMPARE(countRows(handle, QStringLiteral("games")), static_cast<qint64>(2));
    }

    /** Título genérico de variante é corrigido pelo nome da ROM; títulos corretos ficam intactos. */
    void romVariantTitles() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("titles.db");
        const QString name = connectionName("titles");
        {
            QSqlDatabase raw = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), name);
            raw.setDatabaseName(path);
            QVERIFY(raw.open());
            QString error;
            QVERIFY2(gamestock::applySchema(raw, &error), qPrintable(error));
            QVERIFY(exec(raw, "INSERT INTO platforms (id, name, category) VALUES (600, 'Nintendo SNES', 'Console')"));
            QVERIFY(exec(raw, "INSERT INTO games (id, title, platform_id, rom_path) VALUES "
                "(1, 'GP-1', 600, 'C:/roms/GP-1 RS - Rapid Stream (Japan).sfc'),"
                "(2, 'Super Metroid', 600, 'C:/roms/Super Metroid (USA).sfc')"));
            raw.close();
        }
        QSqlDatabase::removeDatabase(name);

        gamestock::Database database;
        QString error;
        QVERIFY2(database.open(path, dir.filePath("images"), &error), qPrintable(error));
        QSqlDatabase& handle = database.handle();
        QCOMPARE(scalar(handle, "SELECT title FROM games WHERE id = 1"), QString("GP-1 RS - Rapid Stream"));
        QCOMPARE(scalar(handle, "SELECT title FROM games WHERE id = 2"), QString("Super Metroid"));
    }

    /** Capa existente no diretório de imagens preenche o caminho e a chave de agrupamento. */
    void cachedCoverAndGroupKey() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("covers.db");
        const QString images = dir.filePath("images");
        const QString coverDir = QDir(images).filePath("nintendo-snes/aventura-legada");
        QVERIFY(QDir().mkpath(coverDir));
        QFile cover(QDir(coverDir).filePath("cover.jpg"));
        QVERIFY(cover.open(QIODevice::WriteOnly));
        cover.write("jpeg sintetico");
        cover.close();
        const QString name = connectionName("covers");
        {
            QSqlDatabase raw = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), name);
            raw.setDatabaseName(path);
            QVERIFY(raw.open());
            QString error;
            QVERIFY2(gamestock::applySchema(raw, &error), qPrintable(error));
            QVERIFY(exec(raw, "INSERT INTO platforms (id, name, category) VALUES (700, 'Nintendo SNES', 'Console')"));
            QVERIFY(exec(raw, "INSERT INTO games (id, title, platform_id, rom_path) VALUES "
                "(1, 'Aventura Legada', 700, 'C:/roms/Aventura (Europa).nes')"));
            raw.close();
        }
        QSqlDatabase::removeDatabase(name);

        gamestock::Database database;
        QString error;
        QVERIFY2(database.open(path, images, &error), qPrintable(error));
        QSqlDatabase& handle = database.handle();
        QCOMPARE(scalar(handle, "SELECT box_art_path FROM games WHERE id = 1"),
            QDir::fromNativeSeparators(QDir(coverDir).filePath("cover.jpg")));
        QCOMPARE(scalar(handle, "SELECT library_group_key FROM games WHERE id = 1"), QString("aventura legada"));
    }

    /** A fixture já migrada pelo Electron mantém IDs, dados e marcadores ao ser reaberta. */
    void electronFixture() {
        const QString source = qEnvironmentVariable("GAMESTOCK_TEST_DATABASE");
        if (source.isEmpty()) QSKIP("Fixture de migração não informada.");
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("gamestock.db");
        QVERIFY(QFile::copy(source, path));
        // Um WAL pendente também precisa ir para a cópia; sem ele o banco ficaria incompleto.
        if (QFileInfo::exists(source + QStringLiteral("-wal"))) {
            QVERIFY(QFile::copy(source + QStringLiteral("-wal"), path + QStringLiteral("-wal")));
        }
        QFile::setPermissions(path, QFile::ReadOwner | QFile::WriteOwner);
        const QString baseline = snapshotFile(path);
        QVERIFY(!baseline.isEmpty());
        QVERIFY(baseline.endsWith(QStringLiteral("|ok")));

        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("images"), &error), qPrintable(error));
            QCOMPARE(stableSnapshot(database.handle()), baseline);
            QCOMPARE(countRows(database.handle(), QStringLiteral("schema_migrations")), 7);
        }
        {
            gamestock::Database reopened;
            QString error;
            QVERIFY2(reopened.open(path, dir.filePath("images"), &error), qPrintable(error));
            QCOMPARE(stableSnapshot(reopened.handle()), baseline);
        }

        // A ordem do catálogo precisa ser a mesma; o fixture usa IDs 90001+ por construção.
        gamestock::Database clean;
        QString cleanError;
        QVERIFY2(clean.open(dir.filePath("clean.db"), dir.filePath("clean-images"), &cleanError), qPrintable(cleanError));
        const auto orderedNames = [](QSqlDatabase& database, const QString& sql) {
            QSqlQuery query(database);
            QStringList values;
            if (!query.exec(sql)) return values;
            while (query.next()) values.append(query.value(0).toString());
            return values;
        };
        gamestock::Database fixture;
        QString fixtureError;
        QVERIFY2(fixture.open(path, dir.filePath("images"), &fixtureError), qPrintable(fixtureError));
        QCOMPARE(orderedNames(fixture.handle(), "SELECT name FROM platforms WHERE id > 90000 AND name != 'Fixture Console' ORDER BY id"),
            orderedNames(clean.handle(), "SELECT name FROM platforms ORDER BY id"));
        QCOMPARE(orderedNames(fixture.handle(), "SELECT name FROM emulators WHERE id <= 2 ORDER BY id"),
            orderedNames(clean.handle(), "SELECT name FROM emulators ORDER BY id"));
        QCOMPARE(orderedNames(fixture.handle(), "SELECT name FROM item_types WHERE id <= 8 ORDER BY id"),
            orderedNames(clean.handle(), "SELECT name FROM item_types ORDER BY id"));
        QCOMPARE(orderedNames(fixture.handle(), "SELECT name FROM conservation_states WHERE id <= 5 ORDER BY id"),
            orderedNames(clean.handle(), "SELECT name FROM conservation_states ORDER BY id"));
    }
};

QTEST_GUILESS_MAIN(MigrationsTest)
#include "MigrationsTest.moc"
