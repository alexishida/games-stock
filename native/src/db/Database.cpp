/** Abre o SQLite de escrita e aplica o mesmo contrato de inicialização do Electron. */
#include "Database.h"

#include "Migrations.h"

#include <QDateTime>
#include <QDir>
#include <QFileInfo>
#include <QSqlError>
#include <QSqlQuery>
#include <QThread>
#include <QUuid>
#include <algorithm>

namespace gamestock {
namespace {
/** Abre uma conexão curta de leitura para inspecionar o arquivo sem escrevê-lo. */
class InspectionConnection {
public:
    InspectionConnection() : name_(QStringLiteral("gamestock_inspect_") + QUuid::createUuid().toString(QUuid::WithoutBraces)),
        database_(QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), name_)) {}
    ~InspectionConnection() {
        database_.close();
        database_ = QSqlDatabase();
        QSqlDatabase::removeDatabase(name_);
    }
    QSqlDatabase& database() { return database_; }
    bool open(const QString& path, QString* error) {
        database_.setDatabaseName(path);
        database_.setConnectOptions(QStringLiteral("QSQLITE_OPEN_READONLY;QSQLITE_BUSY_TIMEOUT=10000"));
        if (database_.open()) return true;
        if (error) *error = database_.lastError().text();
        return false;
    }
private:
    QString name_;
    QSqlDatabase database_;
};

/** Lista as migrations já aplicadas; ausência da tabela significa banco legado. */
bool readAppliedMigrations(const QString& path, QStringList* applied, QString* error) {
    InspectionConnection connection;
    if (!connection.open(path, error)) return false;
    QSqlDatabase& database = connection.database();
    QSqlQuery table(database);
    if (!table.exec(QStringLiteral("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'"))) {
        if (error) *error = table.lastError().text();
        return false;
    }
    if (!table.next()) return true;
    QSqlQuery query(database);
    if (!query.exec(QStringLiteral("SELECT name FROM schema_migrations ORDER BY name"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    while (query.next()) applied->append(query.value(0).toString());
    return true;
}

/** Cria um snapshot consistente com VACUUM INTO, que lê também o conteúdo do WAL. */
bool createSnapshot(const QString& source, const QString& target, QString* error) {
    if (QFileInfo::exists(target)) {
        if (error) *error = QStringLiteral("Snapshot já existe.");
        return false;
    }
    InspectionConnection connection;
    if (!connection.open(source, error)) return false;
    QString quoted = QDir::toNativeSeparators(target);
    quoted.replace(QLatin1Char('\''), QStringLiteral("''"));
    QSqlQuery query(connection.database());
    if (query.exec(QStringLiteral("VACUUM INTO '") + quoted + QLatin1Char('\''))) return true;
    if (error) *error = query.lastError().text();
    return false;
}

/** Caminho livre para o snapshot, sem sobrescrever um backup anterior. */
QString snapshotTarget(const QString& directory) {
    const QString stamp = QDateTime::currentDateTimeUtc().toString(QStringLiteral("yyyyMMdd'T'HHmmss'Z'"));
    QString base = QDir(directory).filePath(QStringLiteral("pre-migration-") + stamp);
    QString target = base + QStringLiteral(".db");
    for (int index = 1; QFileInfo::exists(target); ++index) {
        target = base + QLatin1Char('-') + QString::number(index) + QStringLiteral(".db");
    }
    return target;
}

/** Retorna a migration desconhecida que impede abrir um banco de versão futura. */
QString unknownMigration(const QStringList& applied) {
    const QStringList known = knownMigrationNames();
    for (const QString& name : applied) {
        if (!known.contains(name)) return name;
    }
    return {};
}
} // namespace

Database::Database() : name_(QStringLiteral("gamestock_") + QUuid::createUuid().toString(QUuid::WithoutBraces)),
    database_(QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), name_)) {}

Database::~Database() {
    // O contrato de thread é verificado em Release para evitar migração implícita do Qt SQL.
    close();
}

bool Database::open(const QString& path, const QString& imagesDir, QString* error) {
    if (database_.thread() != QThread::currentThread()) qFatal("Conexão SQLite acessada em outra thread.");
    if (database_.isOpen()) {
        if (error) *error = QStringLiteral("Conexão já aberta.");
        return false;
    }
    if (!QDir().mkpath(imagesDir)) {
        if (error) *error = QStringLiteral("Não foi possível criar o diretório de imagens.");
        return false;
    }
    if (QFileInfo::exists(path)) {
        QStringList applied;
        if (!readAppliedMigrations(path, &applied, error)) return false;
        const QString future = unknownMigration(applied);
        if (!future.isEmpty()) {
            if (error) *error = QStringLiteral("Banco de dados de uma versão futura; migration desconhecida: ") + future;
            return false;
        }
        const QStringList known = knownMigrationNames();
        const bool pending = std::any_of(known.cbegin(), known.cend(),
            [&applied](const QString& name) { return !applied.contains(name); });
        if (pending) {
            // Falha de backup impede a escrita: o perfil original permanece intacto.
            const QString backupDirectory = QDir(QFileInfo(path).absolutePath()).filePath(QStringLiteral("backups"));
            if (!QDir().mkpath(backupDirectory)) {
                if (error) *error = QStringLiteral("Não foi possível criar o diretório de snapshots.");
                return false;
            }
            const QString target = snapshotTarget(backupDirectory);
            if (!createSnapshot(path, target, error)) return false;
            lastSnapshot_ = target;
        }
    }
    path_ = path;
    database_.setDatabaseName(path);
    // O timeout evita travar a UI quando outra instância mantém uma transação curta.
    database_.setConnectOptions(QStringLiteral("QSQLITE_BUSY_TIMEOUT=10000"));
    if (!database_.open()) {
        if (error) *error = database_.lastError().text();
        return false;
    }
    QSqlQuery foreignKeys(database_);
    if (!foreignKeys.exec(QStringLiteral("PRAGMA foreign_keys = ON"))) {
        if (error) *error = foreignKeys.lastError().text();
        database_.close();
        return false;
    }
    // WAL permite leitura concorrente com a escrita curta dos jobs e reduz o custo de commit.
    // A mudança fica gravada no arquivo; sistemas de arquivos que não suportam WAL seguem no journal padrão.
    // O escopo finaliza as consultas de PRAGMA antes das transações de schema/migration.
    {
        QSqlQuery journal(database_);
        if (journal.exec(QStringLiteral("PRAGMA journal_mode = WAL"))) {
            // synchronous=NORMAL é seguro com WAL e evita um fsync extra por transação.
            QSqlQuery sync(database_);
            if (!sync.exec(QStringLiteral("PRAGMA synchronous = NORMAL")))
                qWarning("Não foi possível ajustar synchronous: %s", qPrintable(sync.lastError().text()));
        } else {
            qWarning("Não foi possível ativar WAL: %s", qPrintable(journal.lastError().text()));
        }
    }
    if (!initializeDatabase(database_, imagesDir, error)) {
        database_.close();
        return false;
    }
    if (error) error->clear();
    return true;
}

bool Database::isOpen() const {
    return database_.isOpen();
}

QSqlDatabase& Database::handle() {
    if (database_.thread() != QThread::currentThread()) qFatal("Conexão SQLite acessada em outra thread.");
    return database_;
}

QString Database::path() const {
    return path_;
}

QString Database::lastSnapshot() const {
    return lastSnapshot_;
}

void Database::close() {
    if (!database_.isValid()) return;
    if (database_.thread() == QThread::currentThread()) {
        database_.close();
        database_ = QSqlDatabase();
        QSqlDatabase::removeDatabase(name_);
    }
}
} // namespace gamestock
