/** Sincronização de capas e metadados LaunchBox em job de background. */
#pragma once

#include "db/WriteConnection.h"

#include <QObject>
#include <QVariantMap>

namespace gamestock {
class JobManager;

/** Uma conexão por instância; downloads e SQL rodam no worker do JobManager. */
class MediaSyncService final : public QObject {
    Q_OBJECT
    Q_PROPERTY(bool available READ available NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
public:
    explicit MediaSyncService(QObject* parent = nullptr);
    /** Define banco, cache LaunchBox e raiz de imagens; não executa migrations. */
    bool open(const QString& databasePath, const QString& cacheDir, const QString& imagesDir,
        QString* error = nullptr);
    bool available() const { return open_; }
    QString error() const { return error_; }
    void setJobManager(JobManager* manager) { jobManager_ = manager; }
    /** Overrides determinísticos para testes com servidor local. */
    void setMetadataUrl(const QString& url) { metadataUrl_ = url; }
    void setImagesBaseUrl(const QString& url) { imagesBaseUrl_ = url; }
    void setLibretroBaseUrl(const QString& url) { libretroBaseUrl_ = url; }

public slots:
    /** Inicia o job; `refreshAll` baixa novamente capas e fundos existentes. */
    QVariantMap startSync(bool refreshAll = false);
    /** Estatísticas atuais de capas para a seção de mídia. */
    QVariantMap stats();

signals:
    void changed();

private:
    WriteConnection connection_;
    JobManager* jobManager_ = nullptr;
    QString databasePath_;
    QString cacheDir_;
    QString imagesDir_;
    QString metadataUrl_;
    QString imagesBaseUrl_;
    QString libretroBaseUrl_;
    QString error_;
    bool open_ = false;
};
} // namespace gamestock
