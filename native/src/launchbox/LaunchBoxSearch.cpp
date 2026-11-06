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
    // As expressões são constantes: recompilá-las para cada jogo domina catálogos grandes.
    static const QRegularExpression punctuation(QStringLiteral("[^a-z0-9]+"));
    static const QRegularExpression spaces(QStringLiteral("\\s+"));
    QString normalized = withoutMarks.toLower();
    normalized.replace(punctuation, QStringLiteral(" "));
    return normalized.trimmed().replace(spaces, QStringLiteral(" "));
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

    struct Match {
        QJsonObject game;
        QString title;
    };
    QList<Match> exact;
    QList<Match> partial;
    for (auto iterator = index.constBegin(); iterator != index.constEnd(); ++iterator) {
        const QJsonObject game = iterator.value().toObject();
        // Recusa outras plataformas antes de normalizar títulos ou percorrer aliases.
        if (options.restrictPlatforms && !allowed.contains(normalizeLaunchBoxSearchText(
                game.value(QStringLiteral("platform")).toString()))) continue;
        const QString title = game.value(QStringLiteral("name")).toString();
        const QString name = normalizeLaunchBoxSearchText(title);
        bool isExact = name == query;
        bool isPartial = name.contains(query);
        if (!isExact) {
            for (const auto& alias : game.value(QStringLiteral("alternateNames")).toArray()) {
                const QString normalized = normalizeLaunchBoxSearchText(alias.toString());
                if (normalized == query) { isExact = true; break; }
                if (normalized.contains(query)) isPartial = true;
            }
        }
        if (isExact) exact.append({game, title});
        else if (isPartial) partial.append({game, title});
    }
    const auto byTitle = [](const Match& left, const Match& right) {
        return QString::localeAwareCompare(left.title, right.title) < 0;
    };
    // Ordena somente correspondências; as imagens viram QVariant apenas para os itens retornados.
    std::stable_sort(exact.begin(), exact.end(), byTitle);
    std::stable_sort(partial.begin(), partial.end(), byTitle);
    const int limit = qMax(1, options.limit);
    QList<QVariantMap> result;
    for (const auto& matches : {exact, partial}) {
        for (const auto& match : matches) {
            if (result.size() >= limit) return result;
            result.append(match.game.toVariantMap());
        }
    }
    return result;
}
} // namespace gamestock
