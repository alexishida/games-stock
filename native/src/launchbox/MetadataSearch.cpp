/** Implementa a ordem de fallback de launchbox/index.ts sem IPC. */
#include "MetadataSearch.h"

#include "launchbox/LaunchBoxSearch.h"
#include "launchbox/LibretroClient.h"
#include "launchbox/OpenVgdb.h"

#include <QJsonArray>
#include <QUrl>

namespace gamestock {
namespace {
/** Verifica correspondência exata por nome ou alias para evitar alternativas desnecessárias. */
bool hasExactMatch(const QList<QVariantMap>& games, const QString& query) {
    const QString normalized = normalizeLaunchBoxSearchText(query);
    for (const QVariantMap& game : games) {
        if (normalizeLaunchBoxSearchText(game.value(QStringLiteral("name")).toString()) == normalized) return true;
        for (const QVariant& alias : game.value(QStringLiteral("alternateNames")).toList()) {
            if (normalizeLaunchBoxSearchText(alias.toString()) == normalized) return true;
        }
    }
    return false;
}

/** Cria um resultado mínimo da Libretro, sem inventar metadados textuais. */
QVariantMap libretroGame(const QString& title, const QString& platformName) {
    return QVariantMap{
        {QStringLiteral("id"), QStringLiteral("libretro:") + QString::fromLatin1(QUrl::toPercentEncoding(platformName))
            + QLatin1Char(':') + QString::fromLatin1(QUrl::toPercentEncoding(title))},
        {QStringLiteral("source"), QStringLiteral("libretro")},
        {QStringLiteral("name"), title},
        {QStringLiteral("platform"), platformName},
        {QStringLiteral("release"), QString()},
        {QStringLiteral("developer"), QString()},
        {QStringLiteral("publisher"), QString()},
        {QStringLiteral("genres"), QString()},
        {QStringLiteral("overview"), QString()},
        {QStringLiteral("players"), QString()},
        {QStringLiteral("rating"), QString()},
        {QStringLiteral("cooperative"), QString()},
        {QStringLiteral("alternateNames"), QVariantList{}},
        {QStringLiteral("images"), QVariantList{}},
    };
}
} // namespace

QList<QVariantMap> searchMetadata(const MetadataSearchRequest& request, OpenVgdb* openVgdb,
    LibretroClient* libretro, QString* error) {
    if (error) error->clear();
    LaunchBoxSearchOptions options;
    options.query = request.query;
    options.allowedPlatforms = request.allowedPlatforms;
    options.restrictPlatforms = !request.platformName.trimmed().isEmpty();
    const QList<QVariantMap> launchBox = searchLaunchBoxIndex(request.index, options);
    if (!request.includeAlternatives) return launchBox;
    if (request.platformName.trimmed().isEmpty()) return {};
    if (hasExactMatch(launchBox, request.query)) return launchBox;

    QList<QVariantMap> openVgdbResults;
    if (openVgdb) {
        QString openVgdbError;
        openVgdbResults = openVgdb->search(request.query, request.platformName, &openVgdbError);
        if (!openVgdbError.isEmpty() && error) *error = openVgdbError;
    }
    QList<QVariantMap> combined = launchBox;
    combined.append(openVgdbResults);
    if (!combined.isEmpty()) return combined.mid(0, 100);

    if (!libretro) return {};
    const QStringList titles = libretro->searchTitles(request.query, request.platformName);
    QList<QVariantMap> results;
    for (const QString& title : titles) results.append(libretroGame(title, request.platformName));
    return results;
}
} // namespace gamestock
