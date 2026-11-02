/** Inicializa conexões SQLite por instância sem modificar schemas existentes. */
#include "ReadOnlyConnection.h"
#include <QFileInfo>
#include <QSqlError>
#include <QSqlQuery>
#include <QThread>
#include <QUuid>

namespace gamestock {
ReadOnlyConnection::ReadOnlyConnection() : name_(QUuid::createUuid().toString(QUuid::WithoutBraces)),
    database_(QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), name_)) {}

ReadOnlyConnection::~ReadOnlyConnection() {
    // O contrato não pode desaparecer em builds Release: Qt SQL não permite migração implícita de thread.
    if (database_.thread() != QThread::currentThread()) qFatal("Conexão SQLite destruída em outra thread.");
    database_.close();
    database_ = QSqlDatabase();
    QSqlDatabase::removeDatabase(name_);
}

bool ReadOnlyConnection::open(const QString& path, QString* error) {
    if (database_.thread() != QThread::currentThread()) qFatal("Conexão SQLite acessada em outra thread.");
    if (database_.isOpen()) { if (error) *error = QStringLiteral("Conexão já aberta."); return false; }
    if (!QFileInfo(path).isFile()) { if (error) *error = QStringLiteral("Banco de dados inexistente."); return false; }
    database_.setDatabaseName(path);
    database_.setConnectOptions(QStringLiteral("QSQLITE_OPEN_READONLY;QSQLITE_BUSY_TIMEOUT=10000"));
    if (!database_.open()) { if (error) *error = database_.lastError().text(); return false; }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral("PRAGMA foreign_keys = ON"))) {
        if (error) *error = query.lastError().text();
        database_.close();
        return false;
    }
    if (error) error->clear();
    return true;
}

QSqlDatabase& ReadOnlyConnection::database() {
    if (database_.thread() != QThread::currentThread()) qFatal("Conexão SQLite acessada em outra thread.");
    return database_;
}
}
