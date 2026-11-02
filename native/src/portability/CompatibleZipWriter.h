/** Escritor ZIP STORED compatível com o leitor do Electron (sem data descriptors). */
#pragma once

#include <QByteArray>
#include <QList>
#include <QString>

class QFile;

namespace gamestock {
/**
 * Gera ZIP/ZIP64 escrito sequencialmente com CRC e tamanhos no cabeçalho local.
 * O leitor legado do Electron lê o diretório central e depende desses campos.
 */
class CompatibleZipWriter final {
public:
    CompatibleZipWriter();
    ~CompatibleZipWriter();
    CompatibleZipWriter(const CompatibleZipWriter&) = delete;
    CompatibleZipWriter& operator=(const CompatibleZipWriter&) = delete;

    bool open(const QString& targetPath, bool forceZip64, QString* error);
    bool addData(const QString& entryName, const QByteArray& data, QString* error);
    bool addFile(const QString& entryName, const QString& sourcePath, QString* error);
    bool finish(QString* error);
    bool isOpen() const;

private:
    struct Entry {
        QByteArray name;
        quint32 crc = 0;
        quint64 size = 0;
        quint64 offset = 0;
    };
    bool addEntry(const QString& entryName, quint64 size, quint32 crc, const QString& sourcePath,
        const QByteArray* data, QString* error);
    bool writeBytes(const QByteArray& bytes, QString* error);
    void reset();

    QFile* file_ = nullptr;
    QList<Entry> entries_;
    quint64 offset_ = 0;
    bool open_ = false;
    bool forceZip64_ = false;
    bool failed_ = false;
};
} // namespace gamestock
