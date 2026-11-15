/** Porta de searchGames de scraper.ts, sem download de mídia. */
#include "LaunchBoxSearch.h"

#include <QJsonArray>
#include <QRegularExpression>
#include <QSet>

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

LaunchBoxSearchIndex::LaunchBoxSearchIndex(const QJsonObject& index) {
    entries_.reserve(index.size());
    // A ordem de inserção do QJsonObject substitui a varredura original a cada busca.
    for (auto iterator = index.constBegin(); iterator != index.constEnd(); ++iterator) {
        const QJsonObject game = iterator.value().toObject();
        Entry entry;
        entry.game = game;
        entry.title = game.value(QStringLiteral("name")).toString();
        entry.name = normalizeLaunchBoxSearchText(entry.title);
        for (const auto& alias : game.value(QStringLiteral("alternateNames")).toArray()) {
            const QString normalized = normalizeLaunchBoxSearchText(alias.toString());
            if (!normalized.isEmpty()) entry.aliases.append(normalized);
        }
        entry.sequence = entries_.size();
        const QString platform = normalizeLaunchBoxSearchText(
            game.value(QStringLiteral("platform")).toString());
        entries_.append(entry);
        // Agrupar por plataforma é o que permite recusar o resto do catálogo sem normalizar.
        byPlatform_[platform].append(entry.sequence);
    }
}

QList<QVariantMap> LaunchBoxSearchIndex::search(const LaunchBoxSearchOptions& options) const {
    const QString query = normalizeLaunchBoxSearchText(options.query);
    if (query.isEmpty()) return {};

    // Plataformas permitidas viram consultas diretas ao mapa, sem comparar cada jogo do catálogo.
    QSet<QString> allowed;
    if (options.restrictPlatforms) {
        for (const QString& platform : options.allowedPlatforms) {
            const QString normalized = normalizeLaunchBoxSearchText(platform);
            if (!normalized.isEmpty()) allowed.insert(normalized);
        }
        if (allowed.isEmpty()) return {};
    }

    // Os candidatos apontam para entradas estáveis; a ordenação usa a posição original.
    QList<const Entry*> candidates;
    if (options.restrictPlatforms) {
        for (const QString& platform : allowed) {
            for (const qsizetype position : byPlatform_.value(platform)) candidates.append(&entries_.at(position));
        }
    } else {
        candidates.reserve(entries_.size());
        for (const Entry& entry : entries_) candidates.append(&entry);
    }

    QList<const Entry*> exact;
    QList<const Entry*> partial;
    for (const Entry* entry : candidates) {
        // Reproduz a regra anterior: nome exato interrompe aliases; caso contrário aliases ampliam.
        bool isExact = entry->name == query;
        bool isPartial = entry->name.contains(query);
        if (!isExact) {
            for (const QString& alias : entry->aliases) {
                if (alias == query) { isExact = true; break; }
                if (alias.contains(query)) isPartial = true;
            }
        }
        if (isExact) exact.append(entry);
        else if (isPartial) partial.append(entry);
    }
    const auto byTitle = [](const Entry* left, const Entry* right) {
        const int comparison = QString::localeAwareCompare(left->title, right->title);
        // Desempate pela posição original conserva a ordenação estável anterior.
        return comparison == 0 ? left->sequence < right->sequence : comparison < 0;
    };
    const int limit = qMax(1, options.limit);
    QList<QVariantMap> result;
    // Ordenar somente os primeiros resultados evita ordenar todo o catálogo em buscas amplas.
    for (QList<const Entry*>* matches : {&exact, &partial}) {
        const qsizetype count = qMin(static_cast<qsizetype>(limit) - result.size(), matches->size());
        if (count <= 0) continue;
        std::partial_sort(matches->begin(), matches->begin() + count, matches->end(), byTitle);
        for (qsizetype position = 0; position < count; ++position) {
            result.append(matches->at(position)->game.toVariantMap());
        }
    }
    return result;
}

QList<QVariantMap> searchLaunchBoxIndex(const QJsonObject& index, const LaunchBoxSearchOptions& options) {
    // Chamada única (testes e fluxos de matching): a visão preparada evita duplicar a regra.
    return LaunchBoxSearchIndex(index).search(options);
}
} // namespace gamestock
