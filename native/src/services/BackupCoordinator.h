/** Ponte entre a UI de backup e o registro de jobs em background. */
#pragma once

#include "jobs/JobManager.h"
#include "services/BackupService.h"

#include <QObject>
#include <QVariantMap>

namespace gamestock {
/** Pré-visualiza na thread da UI e agenda exportação/importação no JobManager. */
class BackupCoordinator final : public QObject {
    Q_OBJECT
    Q_PROPERTY(bool available READ available NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
public:
    explicit BackupCoordinator(QObject* parent = nullptr);
    /** Abre o serviço de preview; os jobs criam a própria conexão na thread do worker. */
    bool configure(JobManager* jobManager, const QString& databasePath, const QString& profileRoot,
        const QString& appVersion, QString* error = nullptr);
    bool available() const { return previewService_.available(); }
    QString error() const { return error_; }

    Q_INVOKABLE QVariantMap preview(const QString& packagePath);
    Q_INVOKABLE bool startExport(const QVariantMap& request);
    Q_INVOKABLE bool startImport(const QVariantMap& request);

signals:
    void changed();

private:
    bool startJob(const QString& kind, const QString& title, const QString& subtitle, const QVariantMap& request,
        bool exportJob);
    JobManager* jobManager_ = nullptr;
    BackupService previewService_;
    QString databasePath_;
    QString profileRoot_;
    QString appVersion_;
    QString error_;
};
} // namespace gamestock
