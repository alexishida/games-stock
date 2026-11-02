/** Implementação libarchive isolada; erros viram mensagens curtas para a UI. */
#include "ZipArchive.h"

#include <archive.h>
#include <archive_entry.h>

#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QRegularExpression>
#include <QSaveFile>
#include <QStringList>

#include <cstdio>

namespace gamestock {
namespace {
/** Bloco de leitura/escrita; mantém memória previsível em pacotes grandes. */
constexpr qint64 kChunkBytes = 1024 * 1024;

/** Diagnóstico de libarchive sem perder o contexto de erro do próprio arquivo. */
QString archiveError(archive* handle, const QString& fallback) {
    const char* message = archive_error_string(handle);
    return message && *message ? QString::fromUtf8(message) : fallback;
}

/** Estado compartilhado pelos callbacks de leitura. */
struct ReaderState {
    QFile file;
    QByteArray buffer;
};

int readerOpen(archive*, void* client) {
    auto* state = static_cast<ReaderState*>(client);
    return state->file.open(QIODevice::ReadOnly) ? ARCHIVE_OK : ARCHIVE_FATAL;
}

la_ssize_t readerRead(archive*, void* client, const void** buffer) {
    auto* state = static_cast<ReaderState*>(client);
    state->buffer.resize(static_cast<qsizetype>(kChunkBytes));
    const qint64 read = state->file.read(state->buffer.data(), kChunkBytes);
    if (read < 0) return -1;
    state->buffer.resize(static_cast<qsizetype>(read));
    *buffer = state->buffer.constData();
    return read;
}

la_int64_t readerSkip(archive*, void* client, la_int64_t request) {
    auto* state = static_cast<ReaderState*>(client);
    const qint64 target = state->file.pos() + static_cast<qint64>(request);
    if (state->file.seek(target)) return request;
    return 0;
}

/** Permite que libarchive leia o diretório central e devolva tamanhos reais. */
la_int64_t readerSeek(archive*, void* client, la_int64_t offset, int whence) {
    auto* state = static_cast<ReaderState*>(client);
    qint64 target = 0;
    if (whence == SEEK_SET) target = offset;
    else if (whence == SEEK_CUR) target = state->file.pos() + offset;
    else if (whence == SEEK_END) target = state->file.size() + offset;
    else return -1;
    if (target < 0 || !state->file.seek(target)) return -1;
    return state->file.pos();
}

int readerClose(archive*, void* client) {
    auto* state = static_cast<ReaderState*>(client);
    state->file.close();
    return ARCHIVE_OK;
}

/** Executa a iteração completa sobre um ZIP; o callback recebe cada cabeçalho. */
template <typename Callback>
bool iterateArchive(const QString& path, Callback callback, QString* error) {
    if (!QFileInfo(path).isFile()) {
        if (error) *error = QStringLiteral("Pacote não encontrado.");
        return false;
    }
    archive* handle = archive_read_new();
    if (!handle) {
        if (error) *error = QStringLiteral("Não foi possível iniciar o leitor ZIP.");
        return false;
    }
    archive_read_support_filter_all(handle);
    archive_read_support_format_zip(handle);
    archive_read_set_seek_callback(handle, readerSeek);
    ReaderState state;
    state.file.setFileName(path);
    if (archive_read_open2(handle, &state, readerOpen, readerRead, readerSkip, readerClose) != ARCHIVE_OK) {
        if (error) *error = archiveError(handle, QStringLiteral("Pacote ZIP inválido."));
        archive_read_free(handle);
        return false;
    }
    bool ok = true;
    archive_entry* entry = nullptr;
    while (true) {
        const int status = archive_read_next_header(handle, &entry);
        if (status == ARCHIVE_EOF) break;
        if (status != ARCHIVE_OK) {
            if (error) *error = archiveError(handle, QStringLiteral("Falha ao ler o diretório ZIP."));
            ok = false;
            break;
        }
        if (!callback(handle, entry, error)) {
            ok = false;
            break;
        }
    }
    archive_read_close(handle);
    archive_read_free(handle);
    if (ok && error) error->clear();
    return ok;
}

/** Nome portátil em UTF-8, com fallback para o nome bruto em pacotes antigos. */
QString archiveEntryName(archive_entry* entry) {
    const char* utf8 = archive_entry_pathname_utf8(entry);
    if (!utf8) utf8 = archive_entry_pathname(entry);
    return utf8 ? QString::fromUtf8(utf8) : QString();
}
} // namespace

struct ZipWriter::Impl {
    archive* handle = nullptr;
    QFile file;
    QString error;
    Compression compression = Compression::Store;
    bool open = false;
    bool failed = false;
};

ZipWriter::ZipWriter() : impl_(new Impl) {}

ZipWriter::~ZipWriter() {
    if (impl_->handle) {
        archive_write_close(impl_->handle);
        archive_write_free(impl_->handle);
    }
    delete impl_;
}

bool ZipWriter::isOpen() const { return impl_->open && !impl_->failed; }

bool ZipWriter::open(const QString& targetPath, bool forceZip64, Compression compression, QString* error) {
    if (impl_->open) {
        if (error) *error = QStringLiteral("ZIP já aberto para escrita.");
        return false;
    }
    impl_->compression = compression;
    impl_->handle = archive_write_new();
    if (!impl_->handle) {
        if (error) *error = QStringLiteral("Não foi possível iniciar o escritor ZIP.");
        return false;
    }
    archive_write_set_format_zip(impl_->handle);
    archive_write_add_filter_none(impl_->handle);
    // Opções de formato só podem ser definidas antes de abrir o arquivo.
    archive_write_set_format_option(impl_->handle, "zip", "compression",
        compression == Compression::Store ? "store" : "deflate");
    if (forceZip64) archive_write_set_options(impl_->handle, "zip:zip64");
    impl_->file.setFileName(targetPath);

    struct WriterCallbacks {
        static int openCb(archive*, void* client) {
            auto* self = static_cast<Impl*>(client);
            return self->file.open(QIODevice::WriteOnly | QIODevice::Truncate) ? ARCHIVE_OK : ARCHIVE_FATAL;
        }
        static la_ssize_t writeCb(archive*, void* client, const void* buffer, size_t size) {
            auto* self = static_cast<Impl*>(client);
            return self->file.write(static_cast<const char*>(buffer), static_cast<qint64>(size));
        }
        static int closeCb(archive*, void* client) {
            auto* self = static_cast<Impl*>(client);
            self->file.close();
            return ARCHIVE_OK;
        }
    };
    if (archive_write_open(impl_->handle, impl_, WriterCallbacks::openCb,
            WriterCallbacks::writeCb, WriterCallbacks::closeCb) != ARCHIVE_OK) {
        if (error) *error = archiveError(impl_->handle, QStringLiteral("Não foi possível criar o pacote."));
        archive_write_free(impl_->handle);
        impl_->handle = nullptr;
        return false;
    }
    impl_->open = true;
    if (error) error->clear();
    return true;
}

bool ZipWriter::addHeader(const QString& entryName, qint64 size, QString* error) {
    if (!isOpen()) {
        if (error) *error = QStringLiteral("ZIP não está aberto.");
        return false;
    }
    const QByteArray name = entryName.toUtf8();
    archive_entry* entry = archive_entry_new();
    archive_entry_set_pathname(entry, name.constData());
    archive_entry_set_filetype(entry, AE_IFREG);
    archive_entry_set_perm(entry, 0644);
    archive_entry_set_size(entry, size);
    archive_entry_set_mtime(entry, QDateTime::currentSecsSinceEpoch(), 0);
    const int status = archive_write_header(impl_->handle, entry);
    archive_entry_free(entry);
    if (status != ARCHIVE_OK) {
        impl_->failed = true;
        if (error) *error = archiveError(impl_->handle, QStringLiteral("Falha ao gravar cabeçalho no pacote."));
        return false;
    }
    return true;
}

bool ZipWriter::addData(const QString& entryName, const QByteArray& data, QString* error) {
    if (!addHeader(entryName, data.size(), error)) return false;
    if (!data.isEmpty()) {
        const la_ssize_t written = archive_write_data(impl_->handle, data.constData(), static_cast<size_t>(data.size()));
        if (written != data.size()) {
            impl_->failed = true;
            if (error) *error = archiveError(impl_->handle, QStringLiteral("Falha ao gravar conteúdo no pacote."));
            return false;
        }
    }
    if (error) error->clear();
    return true;
}

bool ZipWriter::addFile(const QString& entryName, const QString& sourcePath, QString* error) {
    QFile source(sourcePath);
    if (!source.open(QIODevice::ReadOnly)) {
        if (error) *error = QStringLiteral("Não foi possível ler o arquivo de mídia.");
        return false;
    }
    const qint64 size = source.size();
    if (!addHeader(entryName, size, error)) return false;
    qint64 writtenTotal = 0;
    while (!source.atEnd()) {
        const QByteArray chunk = source.read(kChunkBytes);
        if (chunk.isEmpty() && source.error() != QFileDevice::NoError) {
            impl_->failed = true;
            if (error) *error = source.errorString();
            return false;
        }
        const la_ssize_t written = archive_write_data(impl_->handle, chunk.constData(),
            static_cast<size_t>(chunk.size()));
        if (written != chunk.size()) {
            impl_->failed = true;
            if (error) *error = archiveError(impl_->handle, QStringLiteral("Falha ao gravar mídia no pacote."));
            return false;
        }
        writtenTotal += written;
        if (writtenTotal > size) {
            impl_->failed = true;
            if (error) *error = QStringLiteral("Arquivo mudou durante a exportação.");
            return false;
        }
    }
    if (writtenTotal != size) {
        impl_->failed = true;
        if (error) *error = QStringLiteral("Arquivo mudou durante a exportação.");
        return false;
    }
    if (error) error->clear();
    return true;
}

bool ZipWriter::finish(QString* error) {
    if (!impl_->handle) {
        if (error) error->clear();
        return true;
    }
    const int status = archive_write_close(impl_->handle);
    const QString message = status == ARCHIVE_OK ? QString() : archiveError(impl_->handle, QStringLiteral("Falha ao finalizar o pacote."));
    archive_write_free(impl_->handle);
    impl_->handle = nullptr;
    impl_->open = false;
    if (status != ARCHIVE_OK || impl_->failed) {
        if (error) *error = message.isEmpty() ? QStringLiteral("Falha ao finalizar o pacote.") : message;
        return false;
    }
    if (error) error->clear();
    return true;
}

struct ZipReader::Impl {
    QString path;
    QList<ZipEntryInfo> entries;
    bool open = false;
};

ZipReader::ZipReader() : impl_(new Impl) {}

ZipReader::~ZipReader() { delete impl_; }

bool ZipReader::isOpen() const { return impl_->open; }
QStringList ZipReader::paths() const {
    QStringList result;
    for (const ZipEntryInfo& entry : impl_->entries) result.append(entry.path);
    return result;
}
QList<ZipEntryInfo> ZipReader::entries() const { return impl_->entries; }
bool ZipReader::contains(const QString& entryName) const {
    for (const ZipEntryInfo& entry : impl_->entries) {
        if (entry.path == entryName) return true;
    }
    return false;
}

bool ZipReader::open(const QString& archivePath, QString* error) {
    impl_->entries.clear();
    impl_->path = archivePath;
    impl_->open = false;
    QList<ZipEntryInfo> collected;
    const bool ok = iterateArchive(archivePath, [&collected](archive* handle, archive_entry* entry, QString* callbackError) {
        Q_UNUSED(callbackError);
        ZipEntryInfo info;
        info.path = archiveEntryName(entry);
        info.size = archive_entry_size_is_set(entry) ? archive_entry_size(entry) : 0;
        info.compressedSize = 0;
        if (!info.path.isEmpty()) collected.append(info);
        archive_read_data_skip(handle);
        return true;
    }, error);
    // A iteração apenas coleta cabeçalhos; o conteúdo é lido sob demanda.
    if (!ok) return false;
    impl_->entries = collected;
    impl_->open = true;
    return true;
}

bool ZipReader::readEntry(const QString& entryName, qint64 maxBytes, QByteArray* data, QString* error) {
    if (!impl_->open || !data) {
        if (error) *error = QStringLiteral("Pacote ZIP não está aberto.");
        return false;
    }
    if (maxBytes <= 0) {
        if (error) *error = QStringLiteral("Limite de leitura inválido.");
        return false;
    }
    QByteArray result;
    QString localError;
    const bool ok = iterateArchive(impl_->path, [&](archive* handle, archive_entry* entry, QString* callbackError) {
        if (archiveEntryName(entry) != entryName) {
            archive_read_data_skip(handle);
            return true;
        }
        const qint64 announced = archive_entry_size_is_set(entry) ? archive_entry_size(entry) : -1;
        if (announced > maxBytes) {
            if (callbackError) *callbackError = QStringLiteral("Entrada do pacote excede o limite permitido.");
            return false;
        }
        qint64 total = 0;
        char buffer[64 * 1024];
        while (true) {
            const la_ssize_t read = archive_read_data(handle, buffer, sizeof(buffer));
            if (read == 0) break;
            if (read < 0) {
                if (callbackError) *callbackError = archiveError(handle, QStringLiteral("Falha ao ler entrada do pacote."));
                return false;
            }
            total += read;
            if (total > maxBytes) {
                if (callbackError) *callbackError = QStringLiteral("Entrada do pacote excede o limite permitido.");
                return false;
            }
            result.append(buffer, static_cast<qsizetype>(read));
        }
        return true;
    }, &localError);
    if (!ok) {
        if (error) *error = localError;
        return false;
    }
    if (result.isEmpty() && !contains(entryName)) {
        if (error) *error = QStringLiteral("Entrada não encontrada no pacote.");
        return false;
    }
    *data = result;
    if (error) error->clear();
    return true;
}

bool ZipReader::extractEntry(const QString& entryName, const QString& destinationPath, qint64 maxBytes, QString* error) {
    if (!isSafeEntryPath(entryName)) {
        if (error) *error = QStringLiteral("Caminho de entrada inválido no pacote.");
        return false;
    }
    if (entryName.isEmpty() || maxBytes <= 0) {
        if (error) *error = QStringLiteral("Extração inválida.");
        return false;
    }
    const QString parent = QFileInfo(destinationPath).absolutePath();
    if (!QDir().mkpath(parent)) {
        if (error) *error = QStringLiteral("Não foi possível criar o diretório de destino.");
        return false;
    }
    QSaveFile output(destinationPath);
    if (!output.open(QIODevice::WriteOnly)) {
        if (error) *error = output.errorString();
        return false;
    }
    QString localError;
    bool found = false;
    const bool ok = iterateArchive(impl_->path, [&](archive* handle, archive_entry* entry, QString* callbackError) {
        if (archiveEntryName(entry) != entryName) {
            archive_read_data_skip(handle);
            return true;
        }
        found = true;
        if (archive_entry_filetype(entry) != AE_IFREG) {
            if (callbackError) *callbackError = QStringLiteral("Entrada do pacote não é um arquivo regular.");
            return false;
        }
        const qint64 announced = archive_entry_size_is_set(entry) ? archive_entry_size(entry) : -1;
        if (announced > maxBytes) {
            if (callbackError) *callbackError = QStringLiteral("Entrada do pacote excede o limite permitido.");
            return false;
        }
        qint64 total = 0;
        char buffer[64 * 1024];
        while (true) {
            const la_ssize_t read = archive_read_data(handle, buffer, sizeof(buffer));
            if (read == 0) break;
            if (read < 0) {
                if (callbackError) *callbackError = archiveError(handle, QStringLiteral("Falha ao ler entrada do pacote."));
                return false;
            }
            total += read;
            if (total > maxBytes) {
                if (callbackError) *callbackError = QStringLiteral("Entrada do pacote excede o limite permitido.");
                return false;
            }
            if (output.write(buffer, read) != read) {
                if (callbackError) *callbackError = output.errorString();
                return false;
            }
        }
        return true;
    }, &localError);
    if (!ok || !found) {
        output.cancelWriting();
        if (error) *error = found ? localError : QStringLiteral("Entrada não encontrada no pacote.");
        return false;
    }
    if (!output.commit()) {
        if (error) *error = output.errorString();
        return false;
    }
    if (error) error->clear();
    return true;
}

bool ZipReader::extractPrefix(const QString& prefix, const QString& destinationRoot, qint64 maxEntryBytes,
    qint64 maxTotalBytes, QList<QPair<QString, QString>>* extracted, QString* error) {
    if (!impl_->open || prefix.isEmpty() || destinationRoot.isEmpty() || maxEntryBytes <= 0 || maxTotalBytes <= 0) {
        if (error) *error = QStringLiteral("Parâmetros de extração inválidos.");
        return false;
    }
    QDir().mkpath(destinationRoot);
    const QString normalizedRoot = QDir::cleanPath(QFileInfo(destinationRoot).absoluteFilePath());
    const auto insideRoot = [&normalizedRoot](const QString& path) {
        const QString clean = QDir::cleanPath(QFileInfo(path).absoluteFilePath());
#ifdef Q_OS_WIN
        constexpr auto comparison = Qt::CaseInsensitive;
#else
        constexpr auto comparison = Qt::CaseSensitive;
#endif
        return clean == normalizedRoot || clean.startsWith(normalizedRoot + QLatin1Char('/'), comparison);
    };

    QList<QPair<QString, QString>> written;
    qint64 total = 0;
    QString localError;
    const bool ok = iterateArchive(impl_->path, [&](archive* handle, archive_entry* entry, QString* callbackError) {
        const QString name = archiveEntryName(entry);
        if (!name.startsWith(prefix)) {
            archive_read_data_skip(handle);
            return true;
        }
        if (archive_entry_filetype(entry) == AE_IFDIR || name.endsWith(QLatin1Char('/'))) {
            archive_read_data_skip(handle);
            return true;
        }
        // Links simbólicos/dispositivos nunca são materializados durante a importação.
        if (archive_entry_filetype(entry) != AE_IFREG) {
            archive_read_data_skip(handle);
            return true;
        }
        const QString relative = name.mid(prefix.size());
        if (!isSafeEntryPath(relative)) {
            if (callbackError) *callbackError = QStringLiteral("Caminho de entrada inválido no pacote.");
            return false;
        }
        const QString destination = QDir(destinationRoot).filePath(relative);
        if (!insideRoot(destination)) {
            if (callbackError) *callbackError = QStringLiteral("Destino de extração fora da raiz permitida.");
            return false;
        }
        if (!QDir().mkpath(QFileInfo(destination).absolutePath())) {
            if (callbackError) *callbackError = QStringLiteral("Não foi possível criar o diretório de destino.");
            return false;
        }
        const qint64 announced = archive_entry_size_is_set(entry) ? archive_entry_size(entry) : -1;
        if (announced > maxEntryBytes) {
            if (callbackError) *callbackError = QStringLiteral("Entrada do pacote excede o limite permitido.");
            return false;
        }
        QSaveFile output(destination);
        if (!output.open(QIODevice::WriteOnly)) {
            if (callbackError) *callbackError = output.errorString();
            return false;
        }
        qint64 entryTotal = 0;
        char buffer[64 * 1024];
        while (true) {
            const la_ssize_t read = archive_read_data(handle, buffer, sizeof(buffer));
            if (read == 0) break;
            if (read < 0) {
                if (callbackError) *callbackError = archiveError(handle, QStringLiteral("Falha ao ler entrada do pacote."));
                return false;
            }
            entryTotal += read;
            total += read;
            if (entryTotal > maxEntryBytes || total > maxTotalBytes) {
                if (callbackError) *callbackError = QStringLiteral("Pacote excede o limite de extração.");
                return false;
            }
            if (output.write(buffer, read) != read) {
                if (callbackError) *callbackError = output.errorString();
                return false;
            }
        }
        if (!output.commit()) {
            if (callbackError) *callbackError = output.errorString();
            return false;
        }
        written.append({name, destination});
        return true;
    }, &localError);
    if (!ok) {
        for (const auto& pair : written) QFile::remove(pair.second);
        if (error) *error = localError;
        return false;
    }
    if (extracted) *extracted = written;
    if (error) error->clear();
    return true;
}

bool ZipReader::isSafeEntryPath(const QString& entryName) {
    if (entryName.isEmpty() || entryName.contains(QChar(u'\0'))) return false;
    if (entryName.startsWith(QLatin1Char('/')) || entryName.startsWith(QLatin1Char('\\'))) return false;
    if (entryName.size() > 1 && entryName.at(1) == QLatin1Char(':')) return false;
    const QStringList parts = entryName.split(QRegularExpression(QStringLiteral("[/\\\\]")));
    for (const QString& part : parts) {
        if (part == QLatin1String("..")) return false;
    }
    return true;
}
} // namespace gamestock
