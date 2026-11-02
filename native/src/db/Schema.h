/** DDL idêntica ao schema do aplicativo Electron, com migrations incrementais. */
#pragma once

#include <QSqlDatabase>
#include <QString>

namespace gamestock {
/** Cria tabelas, índices, triggers e colunas incrementais sem apagar dados. */
bool applySchema(QSqlDatabase& database, QString* error = nullptr);

/** Adiciona uma coluna somente quando a tabela ainda não a possui. */
bool addColumnIfMissing(QSqlDatabase& database, const QString& table, const QString& column,
    const QString& definition, QString* error = nullptr);

/** Cria o índice único parcial de launchbox_id por plataforma. */
bool ensureGamesLaunchBoxUniqueIndex(QSqlDatabase& database, QString* error = nullptr);
} // namespace gamestock
