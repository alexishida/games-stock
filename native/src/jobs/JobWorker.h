/** Worker genérico executado fora da thread da UI. */
#pragma once

#include <QJsonObject>
#include <QObject>

#include <atomic>
#include <functional>

namespace gamestock {
/** Executa um trabalho cancelável e entrega progresso por sinal. */
class JobWorker final : public QObject {
    Q_OBJECT
public:
    using Work = std::function<void(JobWorker*)>;
    explicit JobWorker(QString id, Work work, QObject* parent = nullptr);

    QString jobId() const { return id_; }
    bool isCancelled() const { return cancelled_.load(); }
    /** Envia progresso somente enquanto o trabalho não foi cancelado. */
    void reportProgress(const QJsonObject& progress);
    /** Publica o resultado serializável junto da conclusão. */
    void setResult(const QJsonObject& result) { result_ = result; }

public slots:
    /** Executa na thread do worker; sempre emite completed ou failed. */
    void run();
    /** Sinaliza cancelamento cooperativo para o trabalho em andamento. */
    void cancel();

signals:
    void progress(const QString& jobId, const QJsonObject& progress);
    void completed(const QString& jobId, const QJsonObject& result);
    void failed(const QString& jobId, const QString& error);

private:
    QString id_;
    Work work_;
    QJsonObject result_;
    std::atomic_bool cancelled_{false};
};
} // namespace gamestock
