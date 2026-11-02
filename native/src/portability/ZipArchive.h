/** ZIP/ZIP64 via libarchive; mantém a porta C fora do restante do código. */
#pragma once

#include <QByteArray>
#include <QList>
#include <QPair>
#include <QString>

namespace gamestock {
/** Metadados de uma entrada sem carregar o conteúdo. */
struct ZipEntryInfo {
    QString path;
    qint64 size = 0;
    qint64 compressedSize = 0;
};

/** Escritor sequencial de ZIP padrão; otimizado para STORED em mídia já comprimida. */
class ZipWriter final {
public:
    enum class Compression { Store, Deflate };
    ZipWriter();
    ~ZipWriter();
    ZipWriter(const ZipWriter&) = delete;
    ZipWriter& operator=(const ZipWriter&) = delete;

    /** Abre o destino; `forceZip64` gera um pacote ZIP64 mesmo abaixo de 4 GiB. */
    bool open(const QString& targetPath, bool forceZip64, Compression compression, QString* error);
    bool addData(const QString& entryName, const QByteArray& data, QString* error);
    bool addFile(const QString& entryName, const QString& sourcePath, QString* error);
    /** Finaliza diretório central e fecha o arquivo; chamar mesmo em caminho de erro. */
    bool finish(QString* error);
    bool isOpen() const;

private:
    bool addHeader(const QString& entryName, qint64 size, QString* error);
    struct Impl;
    Impl* impl_;
};

/** Leitor ZIP que aceita STORED/DEFLATED e entradas ZIP64. */
class ZipReader final {
public:
    ZipReader();
    ~ZipReader();
    ZipReader(const ZipReader&) = delete;
    ZipReader& operator=(const ZipReader&) = delete;

    /** Lê o diretório central e mantém apenas metadados; o conteúdo é lido sob demanda. */
    bool open(const QString& archivePath, QString* error);
    bool isOpen() const;
    QStringList paths() const;
    QList<ZipEntryInfo> entries() const;
    bool contains(const QString& entryName) const;
    /** Lê uma entrada JSON/dados com limite explícito de bytes. */
    bool readEntry(const QString& entryName, qint64 maxBytes, QByteArray* data, QString* error);
    /** Extrai uma entrada para o destino, respeitando o limite de bytes. */
    bool extractEntry(const QString& entryName, const QString& destinationPath, qint64 maxBytes, QString* error);
    /**
     * Extrai, em uma única passada, todas as entradas sob `prefix` para `destinationRoot`.
     * Devolve pares (nome no pacote, caminho extraído) e remove o que já escreveu em caso de falha.
     */
    bool extractPrefix(const QString& prefix, const QString& destinationRoot, qint64 maxEntryBytes,
        qint64 maxTotalBytes, QList<QPair<QString, QString>>* extracted, QString* error);

    /** Rejeita caminhos absolutos, unidades Windows e segmentos `..`. */
    static bool isSafeEntryPath(const QString& entryName);

private:
    struct Impl;
    Impl* impl_;
};
} // namespace gamestock
