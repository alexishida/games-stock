/** Orquestra workers em threads próprias e publica progresso na thread da UI. */
#pragma once

#include "jobs/JobRegistry.h"
#include "jobs/JobWorker.h"
#include "models/JobListModel.h"

#include <QHash>
#include <QJsonArray>
#include <QJsonObject>
#include <QObject>
#include <QString>
#include <QVariantMap>

class QThread;

namespace gamestock {
/** Registro compartilhado de jobs + execução cooperativa e encerramento seguro. */
class JobManager final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QAbstractItemModel* model READ model CONSTANT)
    Q_PROPERTY(int activeCount READ activeCount NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
public:
    using Work = JobWorker::Work;
    /** O registro precisa viver mais que o manager e pertencer à thread da UI. */
    explicit JobManager(JobRegistry* registry, QObject* parent = nullptr);
    ~JobManager() override;

    QAbstractItemModel* model();
    int activeCount() const { return static_cast<int>(running_.size()); }
    QString error() const { return error_; }
    /* Q_INVOKABLE permite ao QML consultar o registro sem expor mutação. */
    Q_INVOKABLE QJsonArray jobs() const;
    /** Retrato completo de um job, usado pela retomada no NotificationCenter. */
    Q_INVOKABLE QVariantMap job(const QString& id) const;

public slots:
    /** Persiste o início antes de criar a thread do worker. */
    bool start(const QJsonObject& job, Work work, QString* error = nullptr);
    /** Solicita cancelamento cooperativo ao worker. */
    bool cancel(const QString& id);
    /** Remove um job já concluído/falho do registro. */
    bool dismiss(const QString& id);
    /**
     * Cancela e aguarda os workers até `timeoutMs`. Retorna falso se algum
     * continuar executando; nesse caso o estado `running` permanece para a
     * restauração converter em `interrupted` na próxima abertura.
     */
    bool shutdown(int timeoutMs);

signals:
    void changed();
    /** Entrega o job terminal completo, inclusive o resultado serializado. */
    void jobFinished(const QString& id, const QJsonObject& job);

private slots:
    void onProgress(const QString& id, const QJsonObject& progress);
    void onCompleted(const QString& id, const QJsonObject& result);
    void onFailed(const QString& id, const QString& error);

private:
    struct Running {
        QThread* thread = nullptr;
        JobWorker* worker = nullptr;
    };
    /** Localiza o job atual no registro sem expor mutação. */
    QJsonObject currentJob(const QString& id) const;
    void finishJob(const QString& id, const QString& status, const QString& error,
        const QJsonObject& result = {});
    /** Remove a thread concluída e libera os objetos. */
    void cleanup(const QString& id);
    JobRegistry* registry_;
    JobListModel model_;
    QHash<QString, Running> running_;
    QString error_;
};
} // namespace gamestock
