/** Dados gerados do catálogo RetroArch compartilhado com o renderer. */
#pragma once

#include <QList>
#include <QString>
#include <QStringList>

namespace gamestock::retroarch {
/** Plataforma canônica e os cores libretro preferenciais/alternativos. */
struct CoreEntry {
    QString platformName;
    QString coreName;
    QStringList aliases;
    QStringList fallbacks;
    QStringList compatiblePrefixes;
};

/** Retorna o catálogo na mesma ordem de src/shared/retroarch.ts. */
const QList<CoreEntry>& cores();
} // namespace gamestock::retroarch
