/** Implementa transições idempotentes de jobs independentes da interface. */
#include "JobRegistry.h"
#include <QThread>
#include <utility>

namespace gamestock {
JobRegistry::JobRegistry(Persist persist, QObject* parent) : QObject(parent), persist_(std::move(persist)) {}
void JobRegistry::checkThread() const {
    if (thread() != QThread::currentThread()) qFatal("Registro de jobs acessado fora da thread proprietária.");
}
int JobRegistry::indexOf(const QString& id) const {
    for (qsizetype index = 0; index < jobs_.size(); ++index)
        if (jobs_.at(index).toObject().value("jobId").toString() == id) return static_cast<int>(index);
    return -1;
}
QJsonArray JobRegistry::jobs() const { checkThread(); return jobs_; }
void JobRegistry::restore(const QJsonArray& jobs) {
    checkThread();
    QJsonArray restored;
    for (const auto& value : jobs) {
        if (!value.isObject()) continue;
        QJsonObject job = value.toObject();
        if (job.value("jobId").toString().isEmpty()) continue;
        if (job.value("status").toString() == QLatin1String("running")) {
            job.insert("status", "interrupted");
            QJsonObject progress = job.value("progress").toObject();
            progress.insert("message", "Interrompido");
            job.insert("progress", progress);
        }
        restored.append(job);
    }
    jobs_ = restored;
    emit changed();
}
bool JobRegistry::commit(const QJsonArray& next, QString* error) {
    if (!persist_) { if (error) *error = QStringLiteral("Persistência de jobs indisponível."); return false; }
    if (!persist_(next, error)) return false;
    jobs_ = next;
    if (error) error->clear();
    emit changed();
    return true;
}
bool JobRegistry::start(const QJsonObject& job, QString* error) {
    checkThread();
    const QString id = job.value("jobId").toString();
    if (id.isEmpty() || indexOf(id) >= 0 || job.value("status").toString() != QLatin1String("running")) {
        if (error) *error = QStringLiteral("Job inicial inválido ou duplicado."); return false;
    }
    QJsonArray next = jobs_;
    next.prepend(job);
    return commit(next, error);
}
void JobRegistry::updateProgress(const QString& id, const QJsonObject& progress) {
    checkThread();
    const int index = indexOf(id);
    if (index < 0) return;
    QJsonObject job = jobs_[index].toObject();
    if (job.value("status").toString() != QLatin1String("running")) return;
    job.insert("progress", progress);
    jobs_[index] = job;
    emit changed();
}
bool JobRegistry::finish(const QString& id, const QJsonObject& job, QString* error) {
    checkThread();
    const int index = indexOf(id);
    const QString status = job.value("status").toString();
    if (index < 0 || jobs_.at(index).toObject().value("status").toString() != QLatin1String("running")
        || job.value("jobId").toString() != id || (status != QLatin1String("completed") && status != QLatin1String("failed"))) {
        if (error) *error = QStringLiteral("Transição terminal inválida."); return false;
    }
    QJsonArray next = jobs_;
    next[index] = job;
    return commit(next, error);
}
bool JobRegistry::dismiss(const QString& id, QString* error) {
    checkThread();
    const int index = indexOf(id);
    if (index < 0 || jobs_.at(index).toObject().value("status").toString() == QLatin1String("running")) {
        if (error) *error = QStringLiteral("Job ausente ou ainda em execução."); return false;
    }
    QJsonArray next = jobs_;
    next.removeAt(index);
    return commit(next, error);
}
}
