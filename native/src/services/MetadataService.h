/** Busca e importação LaunchBox com cache e downloads fora da thread da UI. */
#pragma once

#include "db/WriteConnection.h"
#include "jobs/JobManager.h"
#include "launchbox/LaunchBoxCache.h"

#include <QJsonObject>
#include <QObject>
#include <QStringList>
#include <QVariantList>
#include <QVariantMap>

#include <memory>

namespace gamestock {
class JobManager;

/** Fachada do importador de metadados; o QML recebe apenas mapas. */
class MetadataService final : public QObject {
    Q_OBJECT
    Q_PROPERTY(bool available READ available NOTIFY changed)
    Q_PROPERTY(bool busy READ busy NOTIFY changed)
    Q_PROPERTY(bool metadataReady READ metadataReady NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
    Q_PROPERTY(QVariantList results READ results NOTIFY changed)
public:
    explicit MetadataService(QObject* parent = nullptr);
    bool open(const QString& databasePath, const QString& cacheDir, const QString& imagesDir,
        QString* error = nullptr);
    bool available() const { return open_; }
    bool busy() const { return busy_; }
    bool metadataReady() const { return metadataReady_; }
    QString error() const { return error_; }
    QVariantList results() const { return results_; }
    void setJobManager(JobManager* manager);
    void setMetadataUrl(const QString& url);
    void setImagesBaseUrl(const QString& url) { imagesBaseUrl_ = url; }

public slots:
    /** Garante o Metadata.xml e o índice antes da primeira busca. */
    QVariantMap ensureMetadata();
    /** Busca por título e plataforma; resultados chegam por `changed`. */
    QVariantMap search(const QString& query, const QString& platformName);
    /** Importa o jogo selecionado baixando os tipos de imagem escolhidos. */
    QVariantMap importGame(const QVariantMap& game, const QStringList& imageTypes);

signals:
    void changed();
    /** Emitido após criar/atualizar um jogo pelo LaunchBox. */
    void imported(qint64 gameId);

private:
    /** Inicia um job de metadados e guarda seu ID para correlacionar o resultado. */
    QVariantMap startJob(const QString& kind, const QString& title, const QString& subtitle,
        const QVariantMap& payload, JobManager::Work work);
    void onJobFinished(const QString& id, const QJsonObject& job);
    /** Instância compartilhada entre jobs: o índice de ~300 MB fica em memória. */
    std::shared_ptr<LaunchBoxCache> sharedCache();

    WriteConnection connection_;
    JobManager* jobManager_ = nullptr;
    std::shared_ptr<LaunchBoxCache> cache_;
    QVariantList results_;
    QString databasePath_;
    QString cacheDir_;
    QString imagesDir_;
    QString metadataUrl_;
    QString imagesBaseUrl_;
    QString error_;
    QString activeJobId_;
    bool open_ = false;
    bool busy_ = false;
    bool metadataReady_ = false;
};
} // namespace gamestock
