/** Limita a leitura de imagens a arquivos abertos sob a raiz canônica do perfil. */
#include "MediaReader.h"
#include <QDir>
#include <QImageReader>
#include <QBuffer>
#include <QFile>
#include <QFileInfo>
#ifdef Q_OS_WIN
#include <qt_windows.h>
#include <vector>

namespace {
/** Fecha identificadores mesmo quando uma verificação intermediária falha. */
class FileHandle {
public:
    explicit FileHandle(HANDLE value) : value_(value) {}
    ~FileHandle() { if (value_ != INVALID_HANDLE_VALUE) CloseHandle(value_); }
    FileHandle(const FileHandle&) = delete;
    FileHandle& operator=(const FileHandle&) = delete;
    HANDLE get() const { return value_; }
private:
    HANDLE value_;
};

/** Resolve o destino associado ao identificador já aberto, inclusive junctions. */
QString finalPath(HANDLE handle) {
    const DWORD size = GetFinalPathNameByHandleW(handle, nullptr, 0, FILE_NAME_NORMALIZED);
    if (!size) return {};
    std::vector<wchar_t> buffer(static_cast<size_t>(size) + 1);
    const DWORD length = GetFinalPathNameByHandleW(handle, buffer.data(), static_cast<DWORD>(buffer.size()), FILE_NAME_NORMALIZED);
    if (!length || length >= buffer.size()) return {};
    return QDir::fromNativeSeparators(QString::fromWCharArray(buffer.data(), static_cast<qsizetype>(length)));
}
}
#elif defined(Q_OS_LINUX)
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

namespace gamestock {
namespace {
/** Aplica a redução no próprio decodificador; o cabeçalho do arquivo informa as dimensões originais. */
void applyScaledSize(QImageReader& reader, const QSize& targetSize) {
    if (targetSize.width() <= 0 || targetSize.height() <= 0) return;
    const QSize sourceSize = reader.size();
    reader.setScaledSize(sourceSize.isValid() ? sourceSize.scaled(targetSize, Qt::KeepAspectRatio) : targetSize);
}
} // namespace

QImage readProfileImage(const QString& profile, const QString& requested, const QSize& targetSize) {
#ifdef Q_OS_WIN
    if (profile.isEmpty() || !QDir::isAbsolutePath(requested)) return {};
    const QString rootNative = QDir::toNativeSeparators(profile);
    const QString fileNative = QDir::toNativeSeparators(requested);
    // Não compartilhamos exclusão ou escrita durante a leitura, evitando troca do arquivo aberto.
    FileHandle root(CreateFileW(reinterpret_cast<LPCWSTR>(rootNative.utf16()), 0, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, nullptr));
    FileHandle file(CreateFileW(reinterpret_cast<LPCWSTR>(fileNative.utf16()), GENERIC_READ, FILE_SHARE_READ,
        nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_SEQUENTIAL_SCAN, nullptr));
    if (root.get() == INVALID_HANDLE_VALUE || file.get() == INVALID_HANDLE_VALUE) return {};
    const QString rootPath = finalPath(root.get());
    const QString filePath = finalPath(file.get());
    if (rootPath.isEmpty() || filePath.isEmpty()) return {};
    const QString prefix = rootPath.endsWith(QLatin1Char('/')) ? rootPath : rootPath + QLatin1Char('/');
    // Caminhos finais normalizados preservam o nome real; comparação estrita também protege diretórios NTFS sensíveis a maiúsculas.
    if (!filePath.startsWith(prefix, Qt::CaseSensitive)) return {};
    LARGE_INTEGER size{};
    // O limite evita carregar imagens arbitrariamente grandes em memória.
    constexpr qint64 maxBytes = 64 * 1024 * 1024;
    if (!GetFileSizeEx(file.get(), &size) || size.QuadPart <= 0 || size.QuadPart > maxBytes) return {};
    QByteArray bytes(static_cast<qsizetype>(size.QuadPart), Qt::Uninitialized);
    DWORD read = 0;
    if (!ReadFile(file.get(), bytes.data(), static_cast<DWORD>(bytes.size()), &read, nullptr) || read != static_cast<DWORD>(bytes.size())) return {};
    QBuffer buffer(&bytes);
    if (!buffer.open(QIODevice::ReadOnly)) return {};
    QImageReader reader(&buffer);
    reader.setAutoTransform(true);
    // Decodificar já no tamanho do card evita alocar a resolução total da capa.
    applyScaledSize(reader, targetSize);
    return reader.read();
#elif defined(Q_OS_LINUX)
    if (profile.isEmpty() || !QDir::isAbsolutePath(requested)) return {};
    // /proc/self/fd identifica o destino dos descritores abertos, inclusive symlinks.
    const int rootFd = ::open(QFile::encodeName(profile).constData(), O_RDONLY | O_DIRECTORY | O_CLOEXEC);
    if (rootFd < 0) return {};
    const int fileFd = ::open(QFile::encodeName(requested).constData(), O_RDONLY | O_NONBLOCK | O_CLOEXEC);
    if (fileFd < 0) { ::close(rootFd); return {}; }
    QFile rootHandle;
    QFile fileHandle;
    if (!rootHandle.open(rootFd, QIODevice::ReadOnly, QFileDevice::AutoCloseHandle)) {
        ::close(rootFd); ::close(fileFd); return {};
    }
    if (!fileHandle.open(fileFd, QIODevice::ReadOnly, QFileDevice::AutoCloseHandle)) {
        ::close(fileFd); return {};
    }
    const QString rootPath = QFileInfo(QStringLiteral("/proc/self/fd/%1").arg(rootFd)).symLinkTarget();
    const QString filePath = QFileInfo(QStringLiteral("/proc/self/fd/%1").arg(fileFd)).symLinkTarget();
    const QString prefix = rootPath.endsWith(QLatin1Char('/')) ? rootPath : rootPath + QLatin1Char('/');
    struct stat info{};
    constexpr qint64 maxBytes = 64 * 1024 * 1024;
    if (rootPath.isEmpty() || filePath.isEmpty() || !filePath.startsWith(prefix, Qt::CaseSensitive)
        || ::fstat(fileFd, &info) != 0 || !S_ISREG(info.st_mode) || info.st_size <= 0 || info.st_size > maxBytes) return {};
    // A leitura limitada usa o mesmo descritor validado e recusa arquivos que cresceram.
    QByteArray bytes = fileHandle.read(maxBytes + 1);
    if (bytes.size() != info.st_size || bytes.size() > maxBytes) return {};
    QBuffer buffer(&bytes);
    if (!buffer.open(QIODevice::ReadOnly)) return {};
    QImageReader reader(&buffer);
    reader.setAutoTransform(true);
    // Mesmo contrato de redução do ramo Windows.
    applyScaledSize(reader, targetSize);
    return reader.read();
#else
    Q_UNUSED(profile);
    Q_UNUSED(requested);
    return {};
#endif
}
}
