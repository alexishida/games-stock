/** Implementação da ponte de jobs; nenhuma conexão SQLite cruza threads. */
#include "BackupCoordinator.h"

#include <QDateTime>
#include <QJsonObject>
#include <QUuid>

#include <stdexcept>

namespace gamestock {
BackupCoordinator::BackupCoordinator(QObject* parent) : QObject(parent) {}

bool BackupCoordinator::configure(JobManager* jobManager, const QString& databasePath, const QString& profileRoot,
    const QString& appVersion, QString* error) {
    jobManager_ = jobManager;
    databasePath_ = databasePath;
    profileRoot_ = profileRoot;
    appVersion_ = appVersion;
    QString localError;
    if (!previewService_.open(databasePath, profileRoot, appVersion, &localError)) {
        error_ = localError;
        if (error) *error = localError;
        emit changed();
        return false;
    }
    error_.clear();
    emit changed();
    if (error) error->clear();
    return true;
}

QVariantMap BackupCoordinator::preview(const QString& packagePath) {
    if (!previewService_.available()) {
        error_ = QStringLiteral("Serviço de backup indisponível.");
        emit changed();
        return QVariantMap{{QStringLiteral("success"), false}, {QStringLiteral("error"), error_}};
    }
    const QVariantMap result = previewService_.preview(packagePath);
    error_ = result.value(QStringLiteral("success")).toBool() ? QString() : result.value(QStringLiteral("error")).toString();
    emit changed();
    return result;
}

bool BackupCoordinator::startJob(const QString& kind, const QString& title, const QString& subtitle,
    const QVariantMap& request, bool exportJob) {
    if (!jobManager_ || databasePath_.isEmpty() || profileRoot_.isEmpty()) {
        error_ = QStringLiteral("Jobs de backup indisponíveis.");
        emit changed();
        return false;
    }
    const QString jobId = QStringLiteral("data-portability-") + kind + QLatin1Char('-')
        + QUuid::createUuid().toString(QUuid::WithoutBraces);
    QJsonObject job{{QStringLiteral("jobId"), jobId},
        {QStringLiteral("kind"), QStringLiteral("data-portability-") + kind},
        {QStringLiteral("status"), QStringLiteral("running")},
        {QStringLiteral("title"), title},
        {QStringLiteral("subtitle"), subtitle},
        {QStringLiteral("startedAt"), QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs)},
        {QStringLiteral("progress"), QJsonObject{{QStringLiteral("current"), 0}, {QStringLiteral("total"), 1},
            {QStringLiteral("message"), exportJob ? QStringLiteral("Preparando exportação")
                                                  : QStringLiteral("Preparando importação")},
            {QStringLiteral("stage"), QStringLiteral("preparing")}}}};
    const QString dbPath = databasePath_;
    const QString profile = profileRoot_;
    const QString version = appVersion_;
    JobManager::Work work = [dbPath, profile, version, request, exportJob](JobWorker* worker) {
        BackupService service;
        QString openError;
        if (!service.open(dbPath, profile, version, &openError)) {
            throw std::runtime_error(openError.isEmpty() ? "Banco de backup indisponível." : openError.toStdString());
        }
        QObject::connect(&service, &BackupService::progress, worker, [worker](const QVariantMap& progress) {
            worker->reportProgress(QJsonObject::fromVariantMap(progress));
        }, Qt::DirectConnection);
        const QVariantMap result = exportJob ? service.exportPackage(request) : service.importPackage(request);
        if (!result.value(QStringLiteral("success")).toBool()) {
            const QString message = result.value(QStringLiteral("error")).toString();
            throw std::runtime_error(message.isEmpty() ? "Falha na portabilidade." : message.toStdString());
        }
        worker->setResult(QJsonObject::fromVariantMap(result));
    };
    QString startError;
    if (!jobManager_->start(job, work, &startError)) {
        error_ = startError;
        emit changed();
        return false;
    }
    error_.clear();
    emit changed();
    return true;
}

bool BackupCoordinator::startExport(const QVariantMap& request) {
    return startJob(QStringLiteral("export"), QStringLiteral("Exportação de backup"),
        request.value(QStringLiteral("targetPath")).toString(), request, true);
}

bool BackupCoordinator::startImport(const QVariantMap& request) {
    return startJob(QStringLiteral("import"), QStringLiteral("Importação de backup"),
        request.value(QStringLiteral("packagePath")).toString(), request, false);
}
} // namespace gamestock
