/** Implementa a resolução compatível com Electron e a fronteira de mídia local. */
#include "DataPaths.h"

#include <QDir>
#include <QFileInfo>
#ifdef Q_OS_WIN
#include <qt_windows.h>
#include <vector>
#endif

namespace gamestock {
namespace {
/** Obtém o destino real de junctions no Windows, onde canonicalFilePath pode preservá-las. */
QString resolvedPath(const QString& path) {
#ifdef Q_OS_WIN
    const QString native = QDir::toNativeSeparators(path);
    const HANDLE handle = CreateFileW(reinterpret_cast<LPCWSTR>(native.utf16()), 0,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING,
        FILE_FLAG_BACKUP_SEMANTICS, nullptr);
    if (handle == INVALID_HANDLE_VALUE) return {};
    const DWORD length = GetFinalPathNameByHandleW(handle, nullptr, 0, FILE_NAME_NORMALIZED);
    if (!length) { CloseHandle(handle); return {}; }
    std::vector<wchar_t> buffer(static_cast<size_t>(length) + 1);
    const DWORD written = GetFinalPathNameByHandleW(handle, buffer.data(), static_cast<DWORD>(buffer.size()), FILE_NAME_NORMALIZED);
    CloseHandle(handle);
    if (!written || written >= buffer.size()) return {};
    return QDir::fromNativeSeparators(QString::fromWCharArray(buffer.data(), static_cast<qsizetype>(written)));
#else
    return QFileInfo(path).canonicalFilePath();
#endif
}
} // namespace

QString userDataPath(const QProcessEnvironment& environment, const QString& home, bool windows) {
    const QString overridePath = environment.value(QStringLiteral("GAMESTOCK_USER_DATA_DIR"));
    if (!overridePath.isEmpty()) return overridePath;
    QString base = windows ? environment.value(QStringLiteral("APPDATA")) : environment.value(QStringLiteral("XDG_DATA_HOME"));
    if (base.isEmpty()) base = QDir(home).filePath(windows ? QStringLiteral("AppData/Roaming") : QStringLiteral(".local/share"));
    return QDir(base).filePath(QStringLiteral("gamestock"));
}

QString validatedMediaPath(const QString& profile, const QString& requested) {
    if (profile.isEmpty() || requested.isEmpty() || !QDir::isAbsolutePath(requested)) return {};
    const QFileInfo rootInfo(profile);
    const QFileInfo fileInfo(requested);
    if (!rootInfo.isDir() || !fileInfo.isFile()) return {};
    // Resolver ambos pelos identificadores impede que junctions escondam destinos externos.
    const QString root = resolvedPath(profile);
    const QString file = resolvedPath(requested);
    if (root.isEmpty() || file.isEmpty()) return {};
    // Comparação estrita evita autorizar um irmão distinto em diretórios sensíveis a maiúsculas.
    constexpr auto comparison = Qt::CaseSensitive;
    const QString prefix = root.endsWith(QLatin1Char('/')) ? root : root + QLatin1Char('/');
    return file.startsWith(prefix, comparison) ? file : QString();
}
} // namespace gamestock
