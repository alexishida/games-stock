/** Implementa resolução de cores libretro sem depender de Node.js. */
#include "RetroArchCores.h"

#include "db/RetroArchCatalogData.h"

#include <QDir>
#include <QFileInfo>
#include <QHash>
#include <QRegularExpression>
#include <algorithm>

namespace gamestock {
namespace {
/** Normaliza nome de plataforma sem acentos, caixa ou pontuação. */
QString normalizePlatformName(const QString& value) {
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
    normalized.replace(QLatin1Char('&'), QStringLiteral("and"));
    normalized.replace(QRegularExpression(QStringLiteral("[^a-z0-9]+")), QStringLiteral(" "));
    return normalized.trimmed().replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral(" "));
}

/** Normaliza nome de core para comparar nome salvo, arquivo e variantes. */
QString normalizeCoreName(const QString& value) {
    QString normalized = value.trimmed().toLower();
    normalized.remove(QRegularExpression(QStringLiteral("\\.(dll|so|dylib)$")));
    normalized.remove(QRegularExpression(QStringLiteral("_libretro$")));
    return normalized;
}

/** Localiza a entrada do catálogo pelo nome canônico ou alias. */
const retroarch::CoreEntry* findPlatform(const QString& platformName) {
    const QString normalized = normalizePlatformName(platformName);
    for (const retroarch::CoreEntry& entry : retroarch::cores()) {
        if (normalizePlatformName(entry.platformName) == normalized) return &entry;
        for (const QString& alias : entry.aliases) {
            if (normalizePlatformName(alias) == normalized) return &entry;
        }
    }
    return nullptr;
}

/** Tenta caminho absoluto, relativo a cores/, ao pai e extensões nativas. */
QString resolveCoreCandidate(const QString& candidate, const QString& coresDir) {
    const QString normalized = candidate.trimmed();
    if (normalized.isEmpty()) return {};
    const QString direct = QFileInfo(normalized).absoluteFilePath();
    if (QFileInfo::exists(direct)) return QDir::cleanPath(direct);
    const QString baseDir = QFileInfo(coresDir).absolutePath();
    for (const QString& relativePath : {QDir(coresDir).filePath(normalized), QDir(baseDir).filePath(normalized)}) {
        if (QFileInfo::exists(relativePath)) return QDir::cleanPath(relativePath);
    }
    if (QFileInfo(normalized).fileName() != normalized) return {};
    for (const QString& extension : {QStringLiteral(".dll"), QStringLiteral(".so"), QStringLiteral(".dylib")}) {
        const QString withExtension = QDir(coresDir).filePath(normalized + extension);
        if (QFileInfo::exists(withExtension)) return QDir::cleanPath(withExtension);
    }
    return {};
}
} // namespace

QStringList retroArchCoreCandidatesForPlatform(const QString& platformName) {
    const retroarch::CoreEntry* entry = findPlatform(platformName);
    if (!entry) return {};
    QStringList candidates{entry->coreName};
    candidates.append(entry->fallbacks);
    return candidates;
}

QString resolveRetroArchCorePath(const QString& configuredCore, const QString& executablePath,
    const QString& platformName) {
    const QString coresDir = QDir(QFileInfo(executablePath).absolutePath()).filePath(QStringLiteral("cores"));
    if (!configuredCore.trimmed().isEmpty()) {
        const QString configured = resolveCoreCandidate(configuredCore, coresDir);
        if (!configured.isEmpty()) return configured;
    }
    if (!QFileInfo::exists(coresDir)) return {};
    for (const QString& candidate : retroArchCoreCandidatesForPlatform(platformName)) {
        const QString resolved = resolveCoreCandidate(candidate, coresDir);
        if (!resolved.isEmpty()) return resolved;
    }
    return {};
}

QStringList compatibleInstalledCores(const QString& platformName, const QStringList& installedCores) {
    const retroarch::CoreEntry* entry = findPlatform(platformName);
    if (!entry) return {};
    QStringList preferred{entry->coreName};
    preferred.append(entry->fallbacks);
    QHash<QString, int> preferredOrder;
    for (int index = 0; index < preferred.size(); ++index) preferredOrder.insert(normalizeCoreName(preferred[index]), index);

    QStringList prefixes;
    QStringList prefixSources = preferred;
    prefixSources.append(entry->compatiblePrefixes);
    for (const QString& source : prefixSources) {
        const QString normalized = normalizeCoreName(source);
        if (!normalized.isEmpty() && !prefixes.contains(normalized)) prefixes.append(normalized);
    }

    QStringList result;
    for (const QString& installed : installedCores) {
        const QString normalized = normalizeCoreName(installed);
        const bool compatible = std::any_of(prefixes.cbegin(), prefixes.cend(),
            [&normalized](const QString& prefix) { return normalized.startsWith(prefix); });
        if (compatible && !result.contains(installed)) result.append(installed);
    }
    std::stable_sort(result.begin(), result.end(), [&preferredOrder](const QString& left, const QString& right) {
        const int leftOrder = preferredOrder.value(normalizeCoreName(left), -1);
        const int rightOrder = preferredOrder.value(normalizeCoreName(right), -1);
        if (leftOrder >= 0 && rightOrder >= 0) return leftOrder < rightOrder;
        if (leftOrder >= 0) return true;
        if (rightOrder >= 0) return false;
        return QString::localeAwareCompare(left, right) < 0;
    });
    return result;
}
} // namespace gamestock
