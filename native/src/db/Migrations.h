/** Migrations de dados uma única vez, com as mesmas regras do Electron. */
#pragma once

#include <QSqlDatabase>
#include <QString>
#include <QStringList>

namespace gamestock {
/** Aplica schema, migrations e seeds na ordem exata de inicialização do Electron. */
bool initializeDatabase(QSqlDatabase& database, const QString& imagesDir, QString* error = nullptr);

/** Nomes registrados em schema_migrations por esta versão do runtime. */
QStringList knownMigrationNames();
} // namespace gamestock
