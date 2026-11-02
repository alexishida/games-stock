/** Lock exclusivo de perfil compartilhado entre os runtimes Electron e Qt. */
#pragma once

#include <QJsonObject>
#include <QString>

namespace gamestock {
/**
 * Contrato comum: `<perfil>/gamestock.lock` é um JSON criado com O_EXCL, com `runtime`,
 * `pid`, `startedAt` e `token`. O lock é considerado obsoleto quando o processo não existe
 * mais; nunca é removido apenas por idade, para não derrubar um runtime lento.
 */
class ProfileLock {
public:
    ProfileLock() = default;
    ~ProfileLock();
    ProfileLock(const ProfileLock&) = delete;
    ProfileLock& operator=(const ProfileLock&) = delete;

    /** Cria o lock; falha com o conteúdo do detentor quando outro processo está ativo. */
    bool acquire(const QString& profileDirectory, const QString& runtime, QString* error = nullptr);
    /** Atualiza o horário do lock para diagnóstico; o detentor continua sendo o PID. */
    bool refresh(QString* error = nullptr);
    /** Remove o lock somente quando o token confere com o criado por esta instância. */
    void release();
    bool isHeld() const;
    /** Detentor atual, lido do disco; vazio quando não há lock válido. */
    QJsonObject holder() const;
    /** Caminho do arquivo de lock usado na última operação. */
    QString path() const;

    /** Indica se o PID existe no sistema operacional. */
    static bool processAlive(qint64 pid);

private:
    QString path_;
    QString token_;
};
} // namespace gamestock
