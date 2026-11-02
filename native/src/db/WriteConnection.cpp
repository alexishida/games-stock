/** Inicializa conexões SQLite de escrita sem reaplicar schema ou migrations. */
#include "WriteConnection.h"

#include <QFileInfo>
#include <QSqlError>
#include <QSqlQuery>
#include <QThread>
#include <QUuid>

namespace gamestock {
WriteConnection::WriteConnection() : name_(QStringLiteral("gamestock_rw_") + QUuid::createUuid().toString(QUuid::WithoutBraces)),
    database_(QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), name_)) {}

WriteConnection::~WriteConnection() {
    // Qt SQL não permite migração implícita de thread; falhar cedo evita corrupção silenciosa.
    if (database_.thread() != QThread::currentThread()) qFatal("Conexão SQLite de escrita destruída em outra thread.");
    database_.close();
    database_ = QSqlDatabase();
    QSqlDatabase::removeDatabase(name_);
}

bool WriteConnection::open(const QString& path, QString* error) {
    if (database_.thread() != QThread::currentThread()) qFatal("Conexão SQLite de escrita acessada em outra thread.");
    if (database_.isOpen()) {
        if (error) *error = QStringLiteral("Conexão já aberta.");
        return false;
    }
    if (!QFileInfo(path).isFile()) {
        if (error) *error = QStringLiteral("Banco de dados inexistente.");
        return false;
    }
    database_.setDatabaseName(path);
    // O timeout evita travar a UI quando outra instância mantém uma transação curta.
    database_.setConnectOptions(QStringLiteral("QSQLITE_BUSY_TIMEOUT=10000"));
    if (!database_.open()) {
        if (error) *error = database_.lastError().text();
        return false;
    }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral("PRAGMA foreign_keys = ON"))) {
        if (error) *error = query.lastError().text();
        database_.close();
        return false;
    }
    if (error) error->clear();
    return true;
}

QSqlDatabase& WriteConnection::database() {
    if (database_.thread() != QThread::currentThread()) qFatal("Conexão SQLite de escrita acessada em outra thread.");
    return database_;
}
} // namespace gamestock
