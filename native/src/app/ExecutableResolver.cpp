/** Porta de src/main/executableResolver.ts com validação de permissão em POSIX. */
#include "ExecutableResolver.h"

#include <QDir>
#include <QFileInfo>
#include <QProcessEnvironment>
#include <QStringList>

namespace gamestock {
namespace {
/** O mesmo critério do Electron para decidir entre caminho e comando. */
bool looksLikePath(const QString& value) {
    return QDir::isAbsolutePath(value) || value.startsWith(QStringLiteral("./"))
        || value.startsWith(QStringLiteral("../")) || value.startsWith(QStringLiteral(".\\"))
        || value.startsWith(QStringLiteral("..\\")) || value.contains(QLatin1Char('/'))
        || value.contains(QLatin1Char('\\'));
}

/** Indica se o caminho existe e, em POSIX, se pode ser executado. */
bool isUsableExecutable(const QString& path, QString* error, QString* code) {
    const QFileInfo info(path);
    if (!info.isFile()) return false;
#ifdef Q_OS_WIN
    Q_UNUSED(error);
    Q_UNUSED(code);
    return true;
#else
    if (!info.isExecutable()) {
        if (error) *error = QStringLiteral("Executável do emulador sem permissão de execução: ") + path;
        if (code) *code = QStringLiteral("NOT_EXECUTABLE");
        return false;
    }
    return true;
#endif
}

/** Extensões tentadas ao procurar um comando no PATH. */
QStringList commandExtensions(const QString& commandName) {
#ifdef Q_OS_WIN
    if (!QFileInfo(commandName).suffix().isEmpty()) return {QString()};
    QStringList extensions{QString()};
    const QString raw = QProcessEnvironment::systemEnvironment().value(QStringLiteral("PATHEXT"),
        QStringLiteral(".EXE;.CMD;.BAT;.COM"));
    for (const QString& entry : raw.split(QLatin1Char(';'), Qt::SkipEmptyParts)) {
        const QString trimmed = entry.trimmed();
        if (!trimmed.isEmpty()) extensions.append(trimmed);
    }
    return extensions;
#else
    Q_UNUSED(commandName);
    return {QString()};
#endif
}
} // namespace

ExecutableResolution resolveConfiguredExecutable(const QString& configured) {
    ExecutableResolution result;
    result.configuredValue = configured;
    const QString value = configured.trimmed();
    if (value.isEmpty()) {
        result.error = QStringLiteral("Executável do emulador não configurado");
        result.code = QStringLiteral("NOT_FOUND");
        return result;
    }
    if (looksLikePath(value)) {
        const QString absolute = QFileInfo(value).absoluteFilePath();
        QString permissionError;
        QString permissionCode;
        if (QFileInfo::exists(absolute) && isUsableExecutable(absolute, &permissionError, &permissionCode)) {
            result.resolvedPath = QDir::cleanPath(absolute);
            result.source = QStringLiteral("filesystem");
            return result;
        }
        if (!permissionError.isEmpty()) {
            result.error = permissionError;
            result.code = permissionCode;
            return result;
        }
        result.error = QStringLiteral("Executável do emulador não encontrado: ") + configured;
        result.code = QStringLiteral("NOT_FOUND");
        return result;
    }

    const QStringList pathEntries = QProcessEnvironment::systemEnvironment()
        .value(QStringLiteral("PATH")).split(QDir::listSeparator(), Qt::SkipEmptyParts);
    const QStringList extensions = commandExtensions(value);
    for (const QString& directory : pathEntries) {
        for (const QString& extension : extensions) {
            const QString candidate = QDir(directory).filePath(value + extension);
            if (!QFileInfo(candidate).isFile()) continue;
            QString permissionError;
            QString permissionCode;
            if (!isUsableExecutable(candidate, &permissionError, &permissionCode)) continue;
            result.resolvedPath = QDir::cleanPath(QFileInfo(candidate).absoluteFilePath());
            result.source = QStringLiteral("path");
            return result;
        }
    }
    result.error = QStringLiteral("Executável do emulador não encontrado: ") + configured;
    result.code = QStringLiteral("NOT_FOUND");
    return result;
}
} // namespace gamestock
