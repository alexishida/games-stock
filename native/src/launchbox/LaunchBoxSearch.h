/** Busca determinística no índice LaunchBox e normalização compartilhada. */
#pragma once

#include <QJsonObject>
#include <QList>
#include <QStringList>
#include <QVariantMap>

namespace gamestock {
/** Filtros da busca LaunchBox. */
struct LaunchBoxSearchOptions {
    QString query;
    /** Nomes/aliases aceitos; vazio com `restrictPlatforms` recusa tudo. */
    QStringList allowedPlatforms;
    bool restrictPlatforms = false;
    int limit = 100;
};

/** Normaliza título/plataforma sem aproximar jogos diferentes. */
QString normalizeLaunchBoxSearchText(const QString& value);

/** Retorna jogos exatos primeiro e depois parciais, ordenados por nome. */
QList<QVariantMap> searchLaunchBoxIndex(const QJsonObject& index, const LaunchBoxSearchOptions& options);
} // namespace gamestock
