/** Porta de scanRomFolder/romFolderImport.ts para C++. */
#include "RomFolderScanner.h"

#include "RomLaunchExtraction.h"
#include "db/dao/PlatformDao.h"

#include <QDir>
#include <QDirIterator>
#include <QFileInfo>
#include <QHash>
#include <QRegularExpression>
#include <QSet>

#include <algorithm>

namespace gamestock {
namespace {
const QString automaticName = QStringLiteral("Detecção automática");
const QSet<QString> genericExtensions{
    QStringLiteral(".7z"), QStringLiteral(".zip"), QStringLiteral(".rar"), QStringLiteral(".tar"),
    QStringLiteral(".gz"), QStringLiteral(".bz2"), QStringLiteral(".xz"), QStringLiteral(".bin"),
    QStringLiteral(".iso"), QStringLiteral(".img"), QStringLiteral(".cue"), QStringLiteral(".ccd"),
    QStringLiteral(".sub"), QStringLiteral(".mdf"), QStringLiteral(".mds"), QStringLiteral(".nrg"),
    QStringLiteral(".chd"), QStringLiteral(".rom"), QStringLiteral(".dat"), QStringLiteral(".pak"),
    QStringLiteral(".wad")
};

/** Extensão lowercase com ponto inicial. */
QString normalizeExtension(const QString& value) {
    const QString trimmed = value.trimmed().toLower();
    if (trimmed.isEmpty()) return {};
    return trimmed.startsWith(QLatin1Char('.')) ? trimmed : QLatin1Char('.') + trimmed;
}

/** Lista arquivos da pasta respeitando subpastas. */
bool listFolderEntries(const QString& folderPath, bool includeSubfolders, QVariantList* result, QString* error) {
    const QDir directory(folderPath);
    if (!directory.exists()) {
        if (error) *error = QStringLiteral("Pasta de ROM não encontrada: ") + folderPath;
        return false;
    }
    QDirIterator iterator(directory.absolutePath(), QDir::Files | QDir::NoDotAndDotDot,
        includeSubfolders ? QDirIterator::Subdirectories : QDirIterator::NoIteratorFlags);
    while (iterator.hasNext()) {
        const QString filePath = iterator.next();
        result->append(QVariantMap{{QStringLiteral("folderPath"), QFileInfo(filePath).absolutePath()},
            {QStringLiteral("romPath"), QFileInfo(filePath).absoluteFilePath()},
            {QStringLiteral("filename"), QFileInfo(filePath).fileName()}});
    }
    return true;
}

/** Monta um candidato com plataforma e título normalizado. */
QVariantMap candidate(const QVariantMap& entry, qint64 platformId, const QString& platformName) {
    const QString filename = entry.value(QStringLiteral("filename")).toString();
    return QVariantMap{
        {QStringLiteral("folderPath"), entry.value(QStringLiteral("folderPath"))},
        {QStringLiteral("romPath"), entry.value(QStringLiteral("romPath"))},
        {QStringLiteral("filename"), filename},
        {QStringLiteral("titleCandidate"), RomFolderScanner::normalizeRomTitle(filename)},
        {QStringLiteral("platformId"), platformId},
        {QStringLiteral("platformName"), platformName},
    };
}

/** Agrupa candidatos por plataforma para a revisão da UI. */
QVariantList detectedPlatforms(const QVariantList& candidates) {
    QHash<qint64, QPair<QString, qint64>> counts;
    for (const QVariant& value : candidates) {
        const QVariantMap item = value.toMap();
        const qint64 id = item.value(QStringLiteral("platformId")).toLongLong();
        auto& entry = counts[id];
        entry.first = item.value(QStringLiteral("platformName")).toString();
        entry.second += 1;
    }
    QList<QPair<QString, QVariantMap>> rows;
    for (auto iterator = counts.cbegin(); iterator != counts.cend(); ++iterator) {
        rows.append({iterator.value().first, QVariantMap{{QStringLiteral("platformId"), iterator.key()},
            {QStringLiteral("platformName"), iterator.value().first},
            {QStringLiteral("count"), iterator.value().second}}});
    }
    std::stable_sort(rows.begin(), rows.end(), [](const auto& left, const auto& right) {
        return QString::localeAwareCompare(left.first, right.first) < 0;
    });
    QVariantList result;
    for (const auto& row : rows) result.append(row.second);
    return result;
}
} // namespace

RomFolderScanner::RomFolderScanner(QSqlDatabase& database) : database_(database) {}

QString RomFolderScanner::normalizeRomTitle(const QString& filename) {
    QString title = filename;
    title.remove(QRegularExpression(QStringLiteral("\\.[^.]+$")));
    title.replace(QRegularExpression(QStringLiteral("[_+.]+")), QStringLiteral(" "));
    title.replace(QRegularExpression(QStringLiteral("\\[[^\\]]*]")), QStringLiteral(" "));
    title.replace(QRegularExpression(QStringLiteral(
        "\\([^)]*(?:USA|Europe|Japan|World|En|Fr|De|Es|It|Rev|Beta|Proto|Demo|Hack|Unl|v\\d|[0-9]{4})[^)]*\\)"),
        QRegularExpression::CaseInsensitiveOption), QStringLiteral(" "));
    title.replace(QRegularExpression(QStringLiteral("\\([^)]*\\)")), QStringLiteral(" "));
    title.replace(QRegularExpression(QStringLiteral("\\b(?:rev|version|v)\\s*\\d+\\b"),
        QRegularExpression::CaseInsensitiveOption), QStringLiteral(" "));
    title.replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral(" "));
    return title.trimmed();
}

RomFolderScanResult RomFolderScanner::scan(const RomFolderScanRequest& request) const {
    RomFolderScanResult output;
    output.includeSubfolders = request.includeSubfolders;
    output.detectionMode = request.detectionMode == QLatin1String("automatic") || request.platformId <= 0
        ? QStringLiteral("automatic") : QStringLiteral("manual");
    for (const QString& folder : request.folderPaths) output.folderPaths.append(QFileInfo(folder).absoluteFilePath());
    for (const QString& file : request.romFilePaths) output.romFilePaths.append(QFileInfo(file).absoluteFilePath());

    PlatformDao platforms(database_);
    QList<PlatformDao::ExtensionMapping> mappings;
    QString error;
    if (!platforms.listPrimaryExtensions(&mappings, &error)) {
        output.error = error;
        return output;
    }

    QVariantList entries;
    for (const QString& folder : output.folderPaths) {
        if (!listFolderEntries(folder, request.includeSubfolders, &entries, &error)) {
            output.error = error;
            return output;
        }
    }
    for (const QString& romPath : output.romFilePaths) {
        if (!QFileInfo(romPath).isFile()) {
            output.ignoredItems.append(QVariantMap{{QStringLiteral("folderPath"), QFileInfo(romPath).absolutePath()},
                {QStringLiteral("romPath"), romPath}, {QStringLiteral("filename"), QFileInfo(romPath).fileName()},
                {QStringLiteral("reason"), QStringLiteral("Arquivo de ROM não encontrado")}});
            continue;
        }
        entries.append(QVariantMap{{QStringLiteral("folderPath"), QFileInfo(romPath).absolutePath()},
            {QStringLiteral("romPath"), romPath}, {QStringLiteral("filename"), QFileInfo(romPath).fileName()}});
    }

    if (output.detectionMode == QLatin1String("manual")) {
        QVariantMap platform;
        if (!platforms.get(request.platformId, &platform, &error)) {
            output.error = error;
            return output;
        }
        const QString platformName = platform.value(QStringLiteral("name")).toString();
        output.platformId = request.platformId;
        output.platformName = platformName;
        QSet<QString> allowed;
        QVariantMap mappingMap;
        if (platforms.mappings(request.platformId, &mappingMap, &error)) {
            for (const QVariant& value : mappingMap.value(QStringLiteral("romExtensions")).toList()) {
                const QVariantMap mapping = value.toMap();
                if (mapping.value(QStringLiteral("isPrimary")).toBool()) {
                    allowed.insert(normalizeExtension(mapping.value(QStringLiteral("extension")).toString()));
                }
            }
        }
        if (allowed.isEmpty()) {
            // Mesmo fallback do Electron: catálogo completo de extensões primárias.
            for (const QString& extension : supportedRomExtensions()) allowed.insert(normalizeExtension(extension));
        }
        for (const QVariant& value : entries) {
            const QVariantMap entry = value.toMap();
            const QString extension = normalizeExtension(QFileInfo(entry.value(QStringLiteral("filename")).toString()).suffix());
            if (!allowed.contains(extension)) {
                output.ignoredItems.append(QVariantMap{{QStringLiteral("folderPath"), entry.value(QStringLiteral("folderPath"))},
                    {QStringLiteral("romPath"), entry.value(QStringLiteral("romPath"))},
                    {QStringLiteral("filename"), entry.value(QStringLiteral("filename"))},
                    {QStringLiteral("reason"), extension.isEmpty()
                        ? QStringLiteral("Arquivo sem extensão suportada para ") + platformName
                        : QStringLiteral("Extensão %1 não configurada para %2").arg(extension, platformName)}});
                continue;
            }
            output.candidates.append(candidate(entry, request.platformId, platformName));
        }
        output.ok = true;
    } else {
        QHash<QString, QList<QPair<qint64, QString>>> byExtension;
        for (const auto& mapping : mappings) {
            if (!mapping.primary) continue;
            const QString extension = normalizeExtension(mapping.extension);
            if (extension.isEmpty()) continue;
            auto& list = byExtension[extension];
            bool exists = false;
            for (const auto& entry : list) if (entry.first == mapping.platformId) { exists = true; break; }
            if (!exists) list.append({mapping.platformId, mapping.platformName});
        }
        output.platformName = automaticName;
        for (const QVariant& value : entries) {
            const QVariantMap entry = value.toMap();
            const QString extension = normalizeExtension(QFileInfo(entry.value(QStringLiteral("filename")).toString()).suffix());
            QString reason;
            QPair<qint64, QString> detected{0, {}};
            if (extension.isEmpty()) reason = QStringLiteral("Arquivo sem extensão para detecção automática");
            else if (genericExtensions.contains(extension)) {
                reason = QStringLiteral("Extensão %1 é genérica e não entra na detecção automática").arg(extension);
            } else {
                const auto list = byExtension.value(extension);
                if (list.isEmpty()) reason = QStringLiteral("Extensão %1 não cadastrada para detecção automática").arg(extension);
                else if (list.size() > 1) {
                    QStringList names;
                    for (int index = 0; index < qMin(4, list.size()); ++index) names.append(list.at(index).second);
                    reason = QStringLiteral("Extensão %1 pertence a várias plataformas: %2%3")
                        .arg(extension, names.join(QStringLiteral(", ")),
                            list.size() > 4 ? QStringLiteral(", +%1").arg(list.size() - 4) : QString());
                } else detected = list.first();
            }
            if (!reason.isEmpty()) {
                output.ignoredItems.append(QVariantMap{{QStringLiteral("folderPath"), entry.value(QStringLiteral("folderPath"))},
                    {QStringLiteral("romPath"), entry.value(QStringLiteral("romPath"))},
                    {QStringLiteral("filename"), entry.value(QStringLiteral("filename"))},
                    {QStringLiteral("reason"), reason}});
                continue;
            }
            output.candidates.append(candidate(entry, detected.first, detected.second));
        }
        output.ok = true;
    }
    output.detectedPlatforms = detectedPlatforms(output.candidates);
    error.clear();
    return output;
}
} // namespace gamestock
