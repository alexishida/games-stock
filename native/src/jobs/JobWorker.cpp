/** Implementação do worker cooperativo, sem tocar no registro pela thread errada. */
#include "JobWorker.h"

namespace gamestock {
JobWorker::JobWorker(QString id, Work work, QObject* parent)
    : QObject(parent), id_(std::move(id)), work_(std::move(work)) {}

void JobWorker::run() {
    if (!work_) {
        emit failed(id_, QStringLiteral("Trabalho de job ausente."));
        return;
    }
    try {
        work_(this);
        if (cancelled_.load()) {
            emit failed(id_, QStringLiteral("Interrompido"));
            return;
        }
        emit completed(id_, result_);
    } catch (const std::exception& error) {
        emit failed(id_, QString::fromUtf8(error.what()));
    } catch (...) {
        emit failed(id_, QStringLiteral("Falha inesperada no job."));
    }
}

void JobWorker::cancel() { cancelled_.store(true); }

void JobWorker::reportProgress(const QJsonObject& progress) {
    if (cancelled_.load()) return;
    emit this->progress(id_, progress);
}
} // namespace gamestock
