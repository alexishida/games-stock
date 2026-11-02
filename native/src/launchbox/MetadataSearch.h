/** Combina LaunchBox, OpenVGDB e Libretro na ordem do renderer Electron. */
#pragma once

#include <QJsonObject>
#include <QList>
#include <QStringList>
#include <QVariantMap>

namespace gamestock {
class LibretroClient;
class OpenVgdb;

/** Entrada da busca de metadados com fallback. */
struct MetadataSearchRequest {
    QJsonObject index;
    QString query;
    QString platformName;
    QStringList allowedPlatforms;
    bool includeAlternatives = false;
};

/** Retorna até 100 jogos, usando alternativas só quando a busca principal não basta. */
QList<QVariantMap> searchMetadata(const MetadataSearchRequest& request, OpenVgdb* openVgdb,
    LibretroClient* libretro, QString* error = nullptr);
} // namespace gamestock
