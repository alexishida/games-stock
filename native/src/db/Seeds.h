/** Seeds idempotentes compartilhados pelo runtime nativo. */
#pragma once

#include <QSqlDatabase>
#include <QString>

namespace gamestock {
/** Insere plataformas do catálogo preservando a ordem de IDs do Electron. */
bool seedPlatforms(QSqlDatabase& database, QString* error = nullptr);

/** Popula aliases LaunchBox e extensões de ROM de cada plataforma. */
bool seedPlatformMappings(QSqlDatabase& database, QString* error = nullptr);

/** Insere RetroArch e TeknoParrot sem sobrescrever caminhos configurados. */
bool seedEmulators(QSqlDatabase& database, QString* error = nullptr);

/** Vincula TeknoParrot à plataforma homônima quando ainda não existe padrão. */
bool seedArcadeEmulatorAssociations(QSqlDatabase& database, QString* error = nullptr);

/** Insere tipos de item e estados de conservação padrão do inventário. */
bool seedHardwareInventoryDefaults(QSqlDatabase& database, QString* error = nullptr);
} // namespace gamestock
