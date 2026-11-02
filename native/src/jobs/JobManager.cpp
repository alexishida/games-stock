/** Implementação do registro compartilhado e do ciclo de vida dos workers. */
#include "JobManager.h"

#include <QCoreApplication>
#include <QElapsedTimer>
#include <QThread>

namespace gamestock {
JobManager::JobManager(JobRegistry* registry, QObject* parent)
    : QObject(parent), registry_(registry) {
    if (registry_) {
        model_.setJobs(registry_->jobs());
        connect(registry_, &JobRegistry::changed, this, [this] {
            model_.setJobs(registry_->jobs());
            emit changed();
        });
    }
}

JobManager::~JobManager() {
    // Destrutor não pode destruir QThread em execução; espera cancelamento cooperativo.
    for (auto iterator = running_.begin(); iterator != running_.end(); ++iterator) {
        if (iterator.value().worker) iterator.value().worker->cancel();
    }
    for (auto iterator = running_.begin(); iterator != running_.end(); ++iterator) {
        if (iterator.value().thread) {
            iterator.value().thread->quit();
            iterator.value().thread->wait();
        }
    }
}

QAbstractItemModel* JobManager::model() { return &model_; }
QJsonArray JobManager::jobs() const { return registry_ ? registry_->jobs() : QJsonArray{}; }

QVariantMap JobManager::job(const QString& id) const { return currentJob(id).toVariantMap(); }

QJsonObject JobManager::currentJob(const QString& id) const {
    if (!registry_) return {};
    for (const auto& value : registry_->jobs()) {
        const QJsonObject job = value.toObject();
        if (job.value(QStringLiteral("jobId")).toString() == id) return job;
    }
    return {};
}

bool JobManager::start(const QJsonObject& job, Work work, QString* error) {
    error_.clear();
    if (!registry_) {
        error_ = QStringLiteral("Registro de jobs indisponível.");
        if (error) *error = error_;
        return false;
    }
    const QString id = job.value(QStringLiteral("jobId")).toString();
    if (id.isEmpty() || running_.contains(id)) {
        error_ = QStringLiteral("Job inválido ou já em execução.");
        if (error) *error = error_;
        return false;
    }
    QString registryError;
    if (!registry_->start(job, &registryError)) {
        error_ = registryError;
        if (error) *error = error_;
        return false;
    }

    auto* thread = new QThread;
    auto* worker = new JobWorker(id, std::move(work));
    worker->moveToThread(thread);
    connect(thread, &QThread::started, worker, &JobWorker::run);
    connect(worker, &JobWorker::progress, this, &JobManager::onProgress, Qt::QueuedConnection);
    connect(worker, &JobWorker::completed, this, &JobManager::onCompleted, Qt::QueuedConnection);
    connect(worker, &JobWorker::failed, this, &JobManager::onFailed, Qt::QueuedConnection);
    connect(thread, &QThread::finished, worker, &QObject::deleteLater);
    connect(thread, &QThread::finished, thread, &QObject::deleteLater);
    connect(thread, &QThread::finished, this, [this, id] { cleanup(id); }, Qt::QueuedConnection);
    running_.insert(id, Running{thread, worker});
    thread->start();
    emit changed();
    if (error) error->clear();
    return true;
}

bool JobManager::cancel(const QString& id) {
    const auto iterator = running_.constFind(id);
    if (iterator == running_.cend() || !iterator.value().worker) return false;
    // `cancel` só altera um atomic; chamar direto evita esperar o event loop do worker.
    iterator.value().worker->cancel();
    return true;
}

bool JobManager::dismiss(const QString& id) {
    if (!registry_ || running_.contains(id)) return false;
    QString error;
    if (!registry_->dismiss(id, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    error_.clear();
    return true;
}

void JobManager::onProgress(const QString& id, const QJsonObject& progress) {
    if (!registry_) return;
    registry_->updateProgress(id, progress);
}

void JobManager::finishJob(const QString& id, const QString& status, const QString& errorText,
    const QJsonObject& result) {
    if (!registry_) return;
    QJsonObject job = currentJob(id);
    if (job.isEmpty()) return;
    job.insert(QStringLiteral("status"), status);
    if (!result.isEmpty()) job.insert(QStringLiteral("result"), result);
    if (errorText.isEmpty()) job.remove(QStringLiteral("error"));
    else job.insert(QStringLiteral("error"), errorText);
    QString error;
    if (!registry_->finish(id, job, &error)) {
        error_ = error;
        emit changed();
        return;
    }
    error_.clear();
    emit jobFinished(id, job);
    const auto iterator = running_.constFind(id);
    if (iterator != running_.cend() && iterator.value().thread) {
        // A thread só é encerrada depois que o status terminal já está persistido.
        iterator.value().thread->quit();
    }
}

void JobManager::onCompleted(const QString& id, const QJsonObject& result) {
    finishJob(id, QStringLiteral("completed"), {}, result);
}

void JobManager::onFailed(const QString& id, const QString& error) {
    finishJob(id, QStringLiteral("failed"), error);
}

void JobManager::cleanup(const QString& id) {
    running_.remove(id);
    emit changed();
}

bool JobManager::shutdown(int timeoutMs) {
    QElapsedTimer timer;
    timer.start();
    for (auto iterator = running_.begin(); iterator != running_.end(); ++iterator) {
        if (iterator.value().worker) iterator.value().worker->cancel();
    }
    bool allStopped = true;
    for (auto iterator = running_.begin(); iterator != running_.end(); ++iterator) {
        QThread* thread = iterator.value().thread;
        if (!thread) continue;
        thread->quit();
        const qint64 remaining = timeoutMs < 0 ? -1 : qMax<qint64>(0, timeoutMs - timer.elapsed());
        if (!thread->wait(static_cast<unsigned long>(remaining))) allStopped = false;
    }
    // Entrega os sinais terminais enfileirados antes de liberar o retrato.
    QCoreApplication::processEvents();
    if (allStopped) {
        error_.clear();
        return true;
    }
    error_ = QStringLiteral("Alguns jobs não encerraram dentro do tempo de fechamento.");
    emit changed();
    return false;
}
} // namespace gamestock
