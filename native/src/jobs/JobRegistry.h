/** Coordena estados de jobs na thread proprietária sem gravar ticks de progresso. */
#pragma once
#include <QJsonArray>
#include <QJsonObject>
#include <QObject>
#include <functional>

namespace gamestock {
/** Armazena jobs observáveis e delega persistência somente nas transições. */
class JobRegistry final : public QObject {
    Q_OBJECT
public:
    /** Persiste um retrato completo e retorna erro quando a gravação falha. */
    using Persist = std::function<bool(const QJsonArray&, QString*)>;
    /** O callback é injetado para que SQLite e testes mantenham suas próprias transações. */
    explicit JobRegistry(Persist persist, QObject* parent = nullptr);
    /** Recupera retrato já persistido; jobs em execução passam a interrompidos em memória. */
    void restore(const QJsonArray& jobs);
    /** Retorna uma cópia estável do retrato atual. */
    QJsonArray jobs() const;
    /** Persiste o início antes de publicar o job em execução. */
    bool start(const QJsonObject& job, QString* error);
    /** Persiste uma transição terminal sem permitir ressuscitar job encerrado. */
    bool finish(const QString& id, const QJsonObject& job, QString* error);
    /** Remove e persiste somente jobs já encerrados ou interrompidos. */
    bool dismiss(const QString& id, QString* error);
public slots:
    /** Atualiza progresso em memória; workers devem enviar este slot por conexão enfileirada. */
    void updateProgress(const QString& id, const QJsonObject& progress);
signals:
    /** Informa consumidores que o retrato em memória mudou. */
    void changed();
private:
    /** Falha imediatamente se a conexão de um worker não for enfileirada. */
    void checkThread() const;
    /** Localiza um identificador sem expor estado mutável. */
    int indexOf(const QString& id) const;
    /** Publica estado apenas após confirmação do armazenamento. */
    bool commit(const QJsonArray& next, QString* error);
    Persist persist_;
    QJsonArray jobs_;
};
}
