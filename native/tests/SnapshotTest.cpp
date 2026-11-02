/** Verifica snapshot antes de migrations, recusa de schema futuro e rollback. */
#include "db/Database.h"
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
/** Executa um comando simples e propaga a falha para o teste. */
bool exec(QSqlDatabase& database, const QString& sql) {
    QSqlQuery query(database);
    if (query.exec(sql)) return true;
    qWarning() << "SQL falhou:" << sql << query.lastError().text();
    return false;
}

/** Abre uma conexão avulsa para inspecionar banco ou snapshot. */
bool withConnection(const QString& path, const std::function<void(QSqlDatabase&)>& visit, bool readOnly = true) {
    const QString name = QStringLiteral("snapshot-test-%1").arg(QUuid::createUuid().toString(QUuid::WithoutBraces));
    bool ok = false;
    {
        QSqlDatabase raw = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), name);
        raw.setDatabaseName(path);
        if (readOnly) raw.setConnectOptions(QStringLiteral("QSQLITE_OPEN_READONLY"));
        if (raw.open()) {
            visit(raw);
            ok = true;
            raw.close();
        }
    }
    QSqlDatabase::removeDatabase(name);
    return ok;
}

/** Lê um escalar ou vazio quando não existe. */
QString scalar(QSqlDatabase& database, const QString& sql) {
    QSqlQuery query(database);
    if (!query.exec(sql) || !query.next()) return {};
    return query.value(0).toString();
}

/** Prepara um banco legado no mesmo formato do fixture de migração. */
bool createLegacyDatabase(QSqlDatabase& raw) {
    return exec(raw, "CREATE TABLE platforms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, "
               "category TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
        && exec(raw, "CREATE TABLE games (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, "
               "platform_id INTEGER NOT NULL REFERENCES platforms(id), publisher TEXT, year INTEGER, genre TEXT, "
               "rating TEXT, box_art_path TEXT, background_path TEXT, screenshot_path TEXT, rom_path TEXT, "
               "favorite INTEGER NOT NULL DEFAULT 0, play_status TEXT NOT NULL DEFAULT 'unplayed', notes TEXT, "
               "launchbox_id TEXT, launch_count INTEGER NOT NULL DEFAULT 0, "
               "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
        && exec(raw, "INSERT INTO platforms (id, name, category) VALUES (1, 'NES', 'Console')")
        && exec(raw, "INSERT INTO games (id, title, platform_id, notes) VALUES (1, 'Aventura', 1, 'nota')");
}

/** Lista os snapshots criados no diretório do banco. */
QStringList snapshots(const QString& databasePath) {
    QDir directory(QDir(QFileInfo(databasePath).absolutePath()).filePath(QStringLiteral("backups")));
    return directory.entryList({QStringLiteral("pre-migration-*.db")}, QDir::Files, QDir::Name);
}
} // namespace

/** Cobre snapshot consistente, falha de backup, schema futuro e rollback transacional. */
class SnapshotTest : public QObject {
    Q_OBJECT
private slots:
    /** Migration falha no meio: a transação reverte e o snapshot permite recuperar. */
    void migrationFailureRollsBack() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("gamestock.db");
        {
            const QString name = QStringLiteral("snapshot-rollback");
            QSqlDatabase raw = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), name);
            raw.setDatabaseName(path);
            QVERIFY(raw.open());
            QVERIFY(createLegacyDatabase(raw));
            QVERIFY(exec(raw, "INSERT INTO platforms (id, name, category) VALUES (2, 'Nintendo NES', 'Console')"));
            // Tabela compatível com o schema, mas com uma restrição que a consolidação viola.
            QVERIFY(exec(raw, "CREATE TABLE hardware_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, "
                "platform_id INTEGER, item_type_id INTEGER, conservation_state_id INTEGER, "
                "is_multiplatform INTEGER NOT NULL DEFAULT 0, UNIQUE(platform_id, name))"));
            // Duas linhas convivem; a consolidação faria "Controle" repetir na plataforma canônica.
            QVERIFY(exec(raw, "INSERT INTO hardware_items (id, name, platform_id) VALUES (1, 'Controle', 1), (2, 'Controle', 2)"));
            raw.close();
        }
        QSqlDatabase::removeDatabase(QStringLiteral("snapshot-rollback"));

        gamestock::Database database;
        QString error;
        QVERIFY(!database.open(path, dir.filePath("images"), &error));
        QVERIFY(!error.isEmpty());
        QCOMPARE(snapshots(path).size(), 1);

        // A leitura usa escrita porque o journal pendente exigiria recuperação; o teste não altera nada.
        withConnection(path, [&](QSqlDatabase& raw) {
            // A renomeação da plataforma pertence à transação revertida.
            QCOMPARE(scalar(raw, "SELECT name FROM platforms WHERE id = 1"), QString("NES"));
            QCOMPARE(scalar(raw, "SELECT COUNT(*) FROM games"), QString("1"));
            QCOMPARE(scalar(raw, "SELECT COUNT(*) FROM schema_migrations WHERE name = 'platform-aliases-v1'"), QString("0"));
        }, false);
    }

    /** Banco de versão futura é recusado sem qualquer escrita. */
    void futureSchemaRefused() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("gamestock.db");
        {
            QSqlDatabase raw = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), QStringLiteral("snapshot-future"));
            raw.setDatabaseName(path);
            QVERIFY(raw.open());
            QVERIFY(exec(raw, "CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"));
            QVERIFY(exec(raw, "INSERT INTO schema_migrations (name) VALUES ('future-migration-v99')"));
            raw.close();
        }
        QSqlDatabase::removeDatabase(QStringLiteral("snapshot-future"));

        gamestock::Database database;
        QString error;
        QVERIFY(!database.open(path, dir.filePath("images"), &error));
        QVERIFY(error.contains(QStringLiteral("futura")));
        QVERIFY(error.contains(QStringLiteral("future-migration-v99")));
        withConnection(path, [&](QSqlDatabase& raw) {
            // Nada do schema nativo pode ter sido criado antes da recusa.
            QCOMPARE(scalar(raw, "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'platforms'"), QString("0"));
            QCOMPARE(scalar(raw, "SELECT COUNT(*) FROM schema_migrations"), QString("1"));
        });
        QCOMPARE(snapshots(path).size(), 0);
    }

    /** Falha ao criar o snapshot bloqueia a escrita no perfil existente. */
    void backupFailureBlocksWrites() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("gamestock.db");
        {
            QSqlDatabase raw = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), QStringLiteral("snapshot-backup"));
            raw.setDatabaseName(path);
            QVERIFY(raw.open());
            QVERIFY(createLegacyDatabase(raw));
            raw.close();
        }
        QSqlDatabase::removeDatabase(QStringLiteral("snapshot-backup"));
        // Um arquivo com o nome do diretório impede a criação do snapshot.
        QFile blocker(dir.filePath("backups"));
        QVERIFY(blocker.open(QIODevice::WriteOnly));

        gamestock::Database database;
        QString error;
        QVERIFY(!database.open(path, dir.filePath("images"), &error));
        QVERIFY(!error.isEmpty());
        withConnection(path, [&](QSqlDatabase& raw) {
            QCOMPARE(scalar(raw, "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'"), QString("0"));
            QCOMPARE(scalar(raw, "SELECT COUNT(*) FROM pragma_table_info('platforms') WHERE name = 'is_default'"), QString("0"));
        });
    }

    /** Banco legado ganha snapshot antes das migrations e o snapshot preserva o estado anterior. */
    void snapshotBeforeMigration() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("gamestock.db");
        {
            QSqlDatabase raw = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), QStringLiteral("snapshot-legacy"));
            raw.setDatabaseName(path);
            QVERIFY(raw.open());
            QVERIFY(createLegacyDatabase(raw));
            raw.close();
        }
        QSqlDatabase::removeDatabase(QStringLiteral("snapshot-legacy"));

        gamestock::Database database;
        QString error;
        QVERIFY2(database.open(path, dir.filePath("images"), &error), qPrintable(error));
        const QStringList created = snapshots(path);
        QCOMPARE(created.size(), 1);
        QCOMPARE(QFileInfo(database.lastSnapshot()).fileName(), created.first());
        // O snapshot é anterior às migrations: mantém o schema legado e os dados originais.
        withConnection(database.lastSnapshot(), [&](QSqlDatabase& raw) {
            QCOMPARE(scalar(raw, "SELECT name FROM platforms WHERE id = 1"), QString("NES"));
            QCOMPARE(scalar(raw, "SELECT notes FROM games WHERE id = 1"), QString("nota"));
            QCOMPARE(scalar(raw, "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'"), QString("0"));
        });
        // O banco aberto seguiu adiante.
        QCOMPARE(scalar(database.handle(), "SELECT name FROM platforms WHERE id = 1"), QString("Nintendo NES"));
    }

    /** O snapshot inclui o conteúdo ainda não checkpointado do WAL. */
    void snapshotWithWal() {        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("gamestock.db");
        QSqlDatabase writer = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), QStringLiteral("snapshot-wal"));
        writer.setDatabaseName(path);
        QVERIFY(writer.open());
        QVERIFY(exec(writer, "PRAGMA journal_mode = WAL"));
        QVERIFY(createLegacyDatabase(writer));
        QVERIFY(exec(writer, "INSERT INTO games (id, title, platform_id) VALUES (2, 'Jogo no WAL', 1)"));
        // A conexão de escrita permanece aberta: o snapshot precisa ler o WAL, não só o arquivo.
        QVERIFY(QFileInfo::exists(path + QStringLiteral("-wal")));

        gamestock::Database database;
        QString error;
        QVERIFY2(database.open(path, dir.filePath("images"), &error), qPrintable(error));
        QCOMPARE(snapshots(path).size(), 1);
        withConnection(database.lastSnapshot(), [&](QSqlDatabase& raw) {
            QCOMPARE(scalar(raw, "SELECT COUNT(*) FROM games"), QString("2"));
            QCOMPARE(scalar(raw, "SELECT title FROM games WHERE id = 2"), QString("Jogo no WAL"));
        });
        database.close();
        writer.close();
        writer = QSqlDatabase();
        QSqlDatabase::removeDatabase(QStringLiteral("snapshot-wal"));
    }

    /** Repete o procedimento documentado de retorno: restaurar o snapshot sobre uma cópia. */
    void restoreProcedure() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("gamestock.db");
        {
            QSqlDatabase raw = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), QStringLiteral("snapshot-restore"));
            raw.setDatabaseName(path);
            QVERIFY(raw.open());
            QVERIFY(createLegacyDatabase(raw));
            raw.close();
        }
        QSqlDatabase::removeDatabase(QStringLiteral("snapshot-restore"));

        QString snapshot;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("images"), &error), qPrintable(error));
            snapshot = database.lastSnapshot();
            QVERIFY(!snapshot.isEmpty());
            // Dado novo gravado depois da migração, que o retorno explícito deve descartar.
            QVERIFY(exec(database.handle(), "INSERT INTO games (id, title, platform_id) VALUES (99, 'Dado novo', 1)"));
        }
        QVERIFY(QFileInfo::exists(snapshot));
        // Fecha, remove WAL/SHM e substitui o banco pelo snapshot do momento anterior.
        QFile::remove(path + QStringLiteral("-wal"));
        QFile::remove(path + QStringLiteral("-shm"));
        QVERIFY(QFile::remove(path));
        QVERIFY(QFile::copy(snapshot, path));

        gamestock::Database restored;
        QString error;
        QVERIFY2(restored.open(path, dir.filePath("images"), &error), qPrintable(error));
        QCOMPARE(scalar(restored.handle(), "SELECT COUNT(*) FROM games WHERE id = 99"), QString("0"));
        QCOMPARE(scalar(restored.handle(), "SELECT title FROM games WHERE id = 1"), QString("Aventura"));
        // A reabertura reaplica as migrations sobre o snapshot restaurado.
        QCOMPARE(scalar(restored.handle(), "SELECT name FROM platforms WHERE id = 1"), QString("Nintendo NES"));
    }
};

QTEST_GUILESS_MAIN(SnapshotTest)
#include "SnapshotTest.moc"
