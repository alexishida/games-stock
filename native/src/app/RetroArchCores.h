/** Correspondência entre plataformas e cores libretro, como src/shared/retroarch.ts. */
#pragma once

#include <QString>
#include <QStringList>

namespace gamestock {
/** Cores preferenciais para a plataforma, na ordem do catálogo. */
QStringList retroArchCoreCandidatesForPlatform(const QString& platformName);

/** Resolve core configurado ou candidato automático dentro de `<executável>/cores`. */
QString resolveRetroArchCorePath(const QString& configuredCore, const QString& executablePath,
    const QString& platformName);

/** Filtra cores instalados compatíveis, priorizando a ordem do catálogo. */
QStringList compatibleInstalledCores(const QString& platformName, const QStringList& installedCores);
} // namespace gamestock
