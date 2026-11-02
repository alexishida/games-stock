/** Implementação própria do ZIP STORED/ZIP64 idêntica ao contrato do renderer legado. */
#include "CompatibleZipWriter.h"

#include <QDateTime>
#include <QFile>
#include <QFileInfo>
#include <QStringList>

namespace gamestock {
namespace {
constexpr quint32 kLocalSignature = 0x04034b50;
constexpr quint32 kCentralSignature = 0x02014b50;
constexpr quint32 kEndSignature = 0x06054b50;
constexpr quint32 kZip64EndSignature = 0x06064b50;
constexpr quint32 kZip64LocatorSignature = 0x07064b50;
constexpr quint16 kUtf8Flag = 0x0800;
constexpr quint16 kVersion = 20;
constexpr quint16 kZip64Version = 45;
constexpr quint32 kZip32Max = 0xFFFFFFFF;
constexpr quint16 kZip16Max = 0xFFFF;

/** Tabela CRC32 padrão usada pelo ZIP. */
const quint32* crcTable() {
    static quint32 table[256] = {};
    static bool initialized = false;
    if (!initialized) {
        for (quint32 index = 0; index < 256; ++index) {
            quint32 value = index;
            for (int bit = 0; bit < 8; ++bit) value = (value & 1) ? (0xEDB88320u ^ (value >> 1)) : (value >> 1);
            table[index] = value;
        }
        initialized = true;
    }
    return table;
}

quint32 crc32(const QByteArray& data) {
    quint32 crc = 0xFFFFFFFFu;
    const quint32* table = crcTable();
    for (const char character : data) crc = table[(crc ^ static_cast<quint8>(character)) & 0xFF] ^ (crc >> 8);
    return crc ^ 0xFFFFFFFFu;
}

void append16(QByteArray& bytes, quint16 value) {
    bytes.append(static_cast<char>(value & 0xFF));
    bytes.append(static_cast<char>((value >> 8) & 0xFF));
}

void append32(QByteArray& bytes, quint32 value) {
    append16(bytes, static_cast<quint16>(value & 0xFFFF));
    append16(bytes, static_cast<quint16>((value >> 16) & 0xFFFF));
}

void append64(QByteArray& bytes, quint64 value) {
    append32(bytes, static_cast<quint32>(value & 0xFFFFFFFFu));
    append32(bytes, static_cast<quint32>((value >> 32) & 0xFFFFFFFFu));
}

/** Extra ZIP64 com os campos na ordem exigida pelo formato. */
QByteArray zip64Extra(const QList<quint64>& values) {
    QByteArray extra;
    if (values.isEmpty()) return extra;
    append16(extra, 0x0001);
    append16(extra, static_cast<quint16>(values.size() * 8));
    for (quint64 value : values) append64(extra, value);
    return extra;
}

/** Data/hora DOS; datas anteriores a 1980 são limitadas ao mínimo válido. */
void dosDateTime(quint16* time, quint16* date) {
    const QDateTime now = QDateTime::currentDateTime();
    const QDate day = now.date();
    const QTime clock = now.time();
    const int year = qMax(1980, day.year());
    *date = static_cast<quint16>(((year - 1980) << 9) | (day.month() << 5) | day.day());
    *time = static_cast<quint16>((clock.hour() << 11) | (clock.minute() << 5) | (clock.second() / 2));
}
} // namespace

CompatibleZipWriter::CompatibleZipWriter() = default;

CompatibleZipWriter::~CompatibleZipWriter() { reset(); }

bool CompatibleZipWriter::isOpen() const { return open_ && !failed_; }

void CompatibleZipWriter::reset() {
    if (file_) {
        file_->close();
        delete file_;
        file_ = nullptr;
    }
    entries_.clear();
    offset_ = 0;
    open_ = false;
}

bool CompatibleZipWriter::open(const QString& targetPath, bool forceZip64, QString* error) {
    reset();
    file_ = new QFile(targetPath);
    if (!file_->open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        if (error) *error = QStringLiteral("Não foi possível criar o pacote: %1").arg(file_->errorString());
        reset();
        return false;
    }
    forceZip64_ = forceZip64;
    open_ = true;
    failed_ = false;
    if (error) error->clear();
    return true;
}

bool CompatibleZipWriter::writeBytes(const QByteArray& bytes, QString* error) {
    if (!file_ || file_->write(bytes) != bytes.size()) {
        failed_ = true;
        if (error) *error = QStringLiteral("Falha ao gravar o pacote ZIP.");
        return false;
    }
    offset_ += static_cast<quint64>(bytes.size());
    return true;
}

bool CompatibleZipWriter::addData(const QString& entryName, const QByteArray& data, QString* error) {
    return addEntry(entryName, static_cast<quint64>(data.size()), crc32(data), {}, &data, error);
}

bool CompatibleZipWriter::addFile(const QString& entryName, const QString& sourcePath, QString* error) {
    QFile source(sourcePath);
    if (!source.open(QIODevice::ReadOnly)) {
        if (error) *error = QStringLiteral("Não foi possível ler a mídia: %1").arg(QFileInfo(sourcePath).fileName());
        return false;
    }
    const quint64 size = static_cast<quint64>(source.size());
    quint32 crc = 0xFFFFFFFFu;
    const quint32* table = crcTable();
    while (!source.atEnd()) {
        const QByteArray chunk = source.read(1024 * 1024);
        if (chunk.isEmpty() && source.error() != QFileDevice::NoError) {
            if (error) *error = source.errorString();
            return false;
        }
        for (const char character : chunk) crc = table[(crc ^ static_cast<quint8>(character)) & 0xFF] ^ (crc >> 8);
    }
    crc ^= 0xFFFFFFFFu;
    return addEntry(entryName, size, crc, sourcePath, nullptr, error);
}

bool CompatibleZipWriter::addEntry(const QString& entryName, quint64 size, quint32 crc, const QString& sourcePath,
    const QByteArray* data, QString* error) {
    if (!isOpen()) {
        if (error) *error = QStringLiteral("ZIP não está aberto.");
        return false;
    }
    const QByteArray name = entryName.toUtf8();
    const bool sizeZip64 = size >= kZip32Max;
    const QByteArray localExtra = sizeZip64 ? zip64Extra({size, size}) : QByteArray();
    const quint16 version = sizeZip64 ? kZip64Version : kVersion;
    quint16 time = 0;
    quint16 date = 0;
    dosDateTime(&time, &date);

    QByteArray header;
    append32(header, kLocalSignature);
    append16(header, version);
    append16(header, kUtf8Flag);
    append16(header, 0); // STORED
    append16(header, time);
    append16(header, date);
    append32(header, crc);
    append32(header, sizeZip64 ? kZip32Max : static_cast<quint32>(size));
    append32(header, sizeZip64 ? kZip32Max : static_cast<quint32>(size));
    append16(header, static_cast<quint16>(name.size()));
    append16(header, static_cast<quint16>(localExtra.size()));

    const quint64 entryOffset = offset_;
    if (!writeBytes(header, error) || !writeBytes(name, error)) return false;
    if (!localExtra.isEmpty() && !writeBytes(localExtra, error)) return false;

    if (data) {
        if (!writeBytes(*data, error)) return false;
    } else {
        QFile source(sourcePath);
        if (!source.open(QIODevice::ReadOnly)) {
            failed_ = true;
            if (error) *error = QStringLiteral("Não foi possível reler a mídia para o pacote.");
            return false;
        }
        quint64 written = 0;
        while (!source.atEnd()) {
            const QByteArray chunk = source.read(1024 * 1024);
            if (chunk.isEmpty() && source.error() != QFileDevice::NoError) {
                failed_ = true;
                if (error) *error = source.errorString();
                return false;
            }
            if (!writeBytes(chunk, error)) return false;
            written += static_cast<quint64>(chunk.size());
        }
        if (written != size) {
            failed_ = true;
            if (error) *error = QStringLiteral("Arquivo mudou durante a exportação.");
            return false;
        }
    }

    entries_.append(Entry{name, crc, size, entryOffset});
    if (error) error->clear();
    return true;
}

bool CompatibleZipWriter::finish(QString* error) {
    if (!open_) {
        if (error) error->clear();
        return true;
    }
    if (failed_) {
        reset();
        if (error) *error = QStringLiteral("Falha anterior impediu finalizar o pacote.");
        return false;
    }
    quint16 time = 0;
    quint16 date = 0;
    dosDateTime(&time, &date);
    const quint64 centralOffset = offset_;
    QByteArray central;
    for (const Entry& entry : entries_) {
        const bool sizeZip64 = entry.size >= kZip32Max;
        const bool offsetZip64 = entry.offset >= kZip32Max;
        QList<quint64> values;
        if (sizeZip64) values.append(entry.size);
        if (sizeZip64) values.append(entry.size);
        if (offsetZip64) values.append(entry.offset);
        const QByteArray extra = zip64Extra(values);
        const quint16 version = extra.isEmpty() ? kVersion : kZip64Version;
        append32(central, kCentralSignature);
        append16(central, version);
        append16(central, version);
        append16(central, kUtf8Flag);
        append16(central, 0);
        append16(central, time);
        append16(central, date);
        append32(central, entry.crc);
        append32(central, sizeZip64 ? kZip32Max : static_cast<quint32>(entry.size));
        append32(central, sizeZip64 ? kZip32Max : static_cast<quint32>(entry.size));
        append16(central, static_cast<quint16>(entry.name.size()));
        append16(central, static_cast<quint16>(extra.size()));
        append16(central, 0);
        append16(central, 0);
        append16(central, 0);
        append32(central, 0);
        append32(central, offsetZip64 ? kZip32Max : static_cast<quint32>(entry.offset));
        central.append(entry.name);
        central.append(extra);
    }
    if (!writeBytes(central, error)) {
        reset();
        return false;
    }
    const quint64 centralSize = offset_ - centralOffset;
    const quint64 count = static_cast<quint64>(entries_.size());
    const bool needsZip64 = forceZip64_ || count >= kZip16Max || centralSize >= kZip32Max
        || centralOffset >= kZip32Max;

    QByteArray end;
    if (needsZip64) {
        const quint64 zip64EndOffset = offset_;
        append32(end, kZip64EndSignature);
        append64(end, 44); // tamanho do registro sem assinatura e este campo
        append16(end, kZip64Version);
        append16(end, kZip64Version);
        append32(end, 0);
        append32(end, 0);
        append64(end, count);
        append64(end, count);
        append64(end, centralSize);
        append64(end, centralOffset);
        append32(end, kZip64LocatorSignature);
        append32(end, 0);
        append64(end, zip64EndOffset);
        append32(end, 1);
    }
    append32(end, kEndSignature);
    append16(end, 0);
    append16(end, 0);
    append16(end, needsZip64 ? kZip16Max : static_cast<quint16>(count));
    append16(end, needsZip64 ? kZip16Max : static_cast<quint16>(count));
    append32(end, needsZip64 ? kZip32Max : static_cast<quint32>(centralSize));
    append32(end, needsZip64 ? kZip32Max : static_cast<quint32>(centralOffset));
    append16(end, 0);
    if (!writeBytes(end, error)) {
        reset();
        return false;
    }
    file_->close();
    reset();
    if (error) error->clear();
    return true;
}
} // namespace gamestock
