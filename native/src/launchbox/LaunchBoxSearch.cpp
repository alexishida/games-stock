/** Porta de searchGames de scraper.ts, sem download de mídia. */
#include "LaunchBoxSearch.h"

#include <QJsonArray>
#include <QRegularExpression>

#include <algorithm>

namespace gamestock {
QString normalizeLaunchBoxSearchText(const QString& value) {
    const QString decomposed = value.normalized(QString::NormalizationForm_D);
    QString withoutMarks;
    withoutMarks.reserve(decomposed.size());
    for (const QChar character : decomposed) {
        const auto category = character.category();
        if (category == QChar::Mark_NonSpacing || category == QChar::Mark_SpacingCombining
            || category == QChar::Mark_Enclosing) continue;
        withoutMarks += character;
    }
    QString normalized = withoutMarks.toLower();
    normalized.replace(QRegularExpression(QStringLiteral("[^a-z0-9]+")), QStringLiteral(" "));
    return normalized.trimmed().replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral(" "));
}

QList<QVariantMap> searchLaunchBoxIndex(const QJsonObject& index, const LaunchBoxSearchOptions& options) {
    const QString query = normalizeLaunchBoxSearchText(options.query);
    if (query.isEmpty()) return {};
    QStringList allowed;
    if (options.restrictPlatforms) {
        for (const QString& platform : options.allowedPlatforms) {
            const QString normalized = normalizeLaunchBoxSearchText(platform);
            if (!normalized.isEmpty() && !allowed.contains(normalized)) allowed.append(normalized);
        }
        if (allowed.isEmpty()) return {};
    }

    struct Entry {
        QVariantMap game;
        QStringList names;
        QString platform;
    };
    QList<Entry> entries;
    entries.reserve(index.size());
    for (auto iterator = index.constBegin(); iterator != index.constEnd(); ++iterator) {
        const QJsonObject game = iterator.value().toObject();
        Entry entry;
        entry.game = game.toVariantMap();
        entry.platform = normalizeLaunchBoxSearchText(game.value(QStringLiteral("platform")).toString());
        entry.names.append(normalizeLaunchBoxSearchText(game.value(QStringLiteral("name")).toString()));
        for (const QJsonValue& alias : game.value(QStringLiteral("alternateNames")).toArray()) {
            const QString normalized = normalizeLaunchBoxSearchText(alias.toString());
            if (!normalized.isEmpty() && !entry.names.contains(normalized)) entry.names.append(normalized);
        }
        entries.append(entry);
    }
    std::stable_sort(entries.begin(), entries.end(), [](const Entry& left, const Entry& right) {
        return QString::localeAwareCompare(left.game.value(QStringLiteral("name")).toString(),
            right.game.value(QStringLiteral("name")).toString()) < 0;
    });

    const int limit = qMax(1, options.limit);
    QList<QVariantMap> exact;
    QList<QVariantMap> partial;
    for (const Entry& entry : entries) {
        if (options.restrictPlatforms && !allowed.contains(entry.platform)) continue;
        bool isExact = false;
        bool isPartial = false;
        for (const QString& name : entry.names) {
            if (name == query) { isExact = true; break; }
            if (name.contains(query)) isPartial = true;
        }
        if (isExact) {
            exact.append(entry.game);
            if (exact.size() >= limit) break;
        } else if (isPartial && partial.size() < limit) {
            partial.append(entry.game);
        }
    }
    QList<QVariantMap> result = exact;
    for (const QVariantMap& game : partial) {
        if (result.size() >= limit) break;
        result.append(game);
    }
    return result;
}
} // namespace gamestock
