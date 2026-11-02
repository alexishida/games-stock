/** Porta fiel de src/main/db/libraryGrouping.ts para o runtime nativo. */
#include "LibraryGrouping.h"

#include <QFileInfo>
#include <QRegularExpression>

namespace gamestock {
namespace {
/** Escapa texto antes de montar a expressão regular do subtítulo. */
QString escapeRegExp(const QString& value) {
    QString result;
    result.reserve(value.size() * 2);
    for (const QChar character : value) {
        if (QStringLiteral(".*+?^${}()|[]\\").contains(character)) result += QLatin1Char('\\');
        result += character;
    }
    return result;
}

/** Detecta subtítulo real no nome da ROM que distingue edição ou continuação. */
QString detectVariantDescriptor(const QString& romFileName, const QString& title) {
    const QFileInfo info(romFileName);
    const QString romStem = stripVersionTags(info.completeBaseName());
    const QString titleStem = stripVersionTags(title);
    if (romStem.isEmpty() || titleStem.isEmpty()) return {};
    if (normalizeTitleForMatch(romStem) == normalizeTitleForMatch(titleStem)) return {};

    const QRegularExpression prefix(QStringLiteral("^%1(?:\\s*[-:]+\\s*|\\s+)").arg(escapeRegExp(titleStem)),
        QRegularExpression::CaseInsensitiveOption);
    QString descriptor = romStem;
    descriptor.remove(prefix);
    descriptor = descriptor.trimmed();
    if (descriptor.isEmpty()) return {};
    return normalizeTitleForMatch(descriptor) != normalizeTitleForMatch(romStem) ? descriptor : QString();
}

/** Gera o título-base usando a ROM quando ela representa melhor a variante. */
QString buildVersionBaseTitle(const QString& title, const QString& romPath) {
    QString romBase;
    if (!romPath.isEmpty()) romBase = stripVersionTags(QFileInfo(romPath).completeBaseName());
    const QString titleBase = stripVersionTags(title);
    const QString candidate = romBase.size() >= qMax(6, titleBase.size() - 4) ? romBase : titleBase;
    return normalizeTitleForMatch(candidate);
}
} // namespace

QString stripVersionTags(const QString& value) {
    QString result = value;
    result.remove(QRegularExpression(QStringLiteral("\\.[a-z0-9]{1,5}$"), QRegularExpression::CaseInsensitiveOption));
    result.replace(QRegularExpression(QStringLiteral("[_]+")), QStringLiteral(" "));
    result.remove(QRegularExpression(QStringLiteral("\\([^)]*\\)|\\[[^\\]]*\\]|\\{[^}]*\\}")));
    result.remove(QRegularExpression(QStringLiteral("\\b(?:rev(?:ision)?\\.?\\s*[a-z0-9.]+|v\\d[\\w.]*)\\b"),
        QRegularExpression::CaseInsensitiveOption));
    result.replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral(" "));
    return result.trimmed();
}

QString normalizeTitleForMatch(const QString& value) {
    QString result = value.trimmed();
    result.replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral(" "));
    return result.toLower();
}

QString buildStoredLibraryGroupKey(const QString& title, const QString& romPath) {
    if (romPath.trimmed().isEmpty()) return {};
    return buildVersionGroupKey(title, romPath);
}

QString buildVersionGroupKey(const QString& title, const QString& romPath) {
    // Com ROM: variantes com subtítulo real usam o título-base da ROM.
    if (!romPath.trimmed().isEmpty()
        && !variantDescriptor(QFileInfo(romPath).fileName(), title).isEmpty()) return buildVersionBaseTitle(title, romPath);
    const QString normalizedTitleBase = normalizeTitleForMatch(stripVersionTags(title));
    return normalizedTitleBase.isEmpty() ? buildVersionBaseTitle(title, romPath) : normalizedTitleBase;
}

QString variantDescriptor(const QString& romFileName, const QString& title) {
    return detectVariantDescriptor(romFileName, title);
}
} // namespace gamestock
