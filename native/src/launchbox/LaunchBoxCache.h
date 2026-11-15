/** Cache local do Metadata.xml e índice incremental do LaunchBox. */
#pragma once

#include <QJsonObject>
#include <QList>
#include <QRecursiveMutex>
#include <QString>
#include <QVariantMap>

#include <functional>
#include <memory>

namespace gamestock {
class LaunchBoxSearchIndex;
struct LaunchBoxSearchOptions;

/** Progresso compartilhado entre download, extração e indexação. */
struct LaunchBoxProgress {
    qint64 current = 0;
    qint64 total = 0;
    QString filename;
    QString status;
};

/** Baixa, extrai e indexa o catálogo sem carregar o XML inteiro em memória. */
class LaunchBoxCache final {
public:
    /** Resultado da garantia de metadados. */
    struct Result {
        /** `cached`, `downloaded` ou `error`. */
        QString status;
        QString error;
        bool ok() const { return error.isEmpty(); }
    };

    explicit LaunchBoxCache(QString cacheDir, QString metadataUrl = {}, QString sevenZipPath = {});

    /**
     * Garante Metadata.xml recente (24 h) ou baixa/extrai novamente.
     * Operações concorrentes no mesmo objeto são serializadas.
     */
    Result ensureMetadata(bool force = false,
        const std::function<void(const LaunchBoxProgress&)>& progress = {});

    /** Indica se o XML canônico já existe. */
    bool metadataExists() const;
    /** Data ISO 8601 da última atualização do XML, ou vazio. */
    QString metadataDownloadedAt() const;
    /** Caminho canônico do XML dentro do cache. */
    QString metadataFile() const;
    /** Caminho do índice JSON persistido. */
    QString indexFile() const;

    /** Retorna o índice, reutilizando memória, cache em disco ou reconstruindo do XML. */
    bool buildIndex(QJsonObject* index, QString* error = nullptr,
        const std::function<void(const LaunchBoxProgress&)>& progress = {});

    /** Retrato em memória, sem acionar download/indexação. */
    QJsonObject cachedIndex() const;

    /**
     * Busca no índice em memória reutilizando os textos normalizados e o agrupamento
     * por plataforma. Exige `buildIndex` anterior; não inicia download nem indexação.
     */
    bool search(const LaunchBoxSearchOptions& options, QList<QVariantMap>* result,
        QString* error = nullptr);

private:
    bool downloadMetadata(const QString& target, QString* error,
        const std::function<void(const LaunchBoxProgress&)>& progress);
    bool extractMetadata(const QString& zipPath, QString* error,
        const std::function<void(const LaunchBoxProgress&)>& progress);
    bool loadIndex(const QString& path, QJsonObject* index, QString* error) const;
    bool parseXml(const QString& path, QJsonObject* index, QString* error,
        const std::function<void(const LaunchBoxProgress&)>& progress) const;
    bool saveIndex(const QJsonObject& index, QString* error) const;
    /** Invalida índice em disco e memória após um XML novo. */
    void invalidateIndex();

    mutable QRecursiveMutex mutex_;
    QString cacheDir_;
    QString metadataUrl_;
    QString sevenZipPath_;
    QJsonObject memoryIndex_;
    // Derivada de memoryIndex_; descartada junto com o índice para não reter textos antigos.
    std::shared_ptr<LaunchBoxSearchIndex> searchIndex_;
};
} // namespace gamestock
