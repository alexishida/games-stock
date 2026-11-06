/** Executa jogos pelo emulador padrão, sem shell e sem acesso SQL na UI. */
#pragma once

#include "db/WriteConnection.h"

#include <QObject>
#include <QVariantMap>

namespace gamestock {
/** Resolve jogo, emulador, core e ROM; incrementa o histórico só após spawn. */
class LaunchService final : public QObject {
    Q_OBJECT
    Q_PROPERTY(bool available READ available NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
    Q_PROPERTY(bool launching READ launching NOTIFY changed)
public:
    explicit LaunchService(QObject* parent = nullptr);
    bool open(const QString& databasePath, QString* error = nullptr);
    bool isOpen() const;
    bool available() const { return open_; }
    QString error() const { return error_; }
    bool launching() const { return launching_; }

public slots:
    /** Prepara e inicia o jogo fora da interface; rejeita cliques duplicados. */
    bool beginLaunch(qint64 gameId);
    /** Retorna `{success:true}` ou mapa vazio com `error` observável. */
    QVariantMap launch(qint64 gameId);
    /** Remove somente o cache temporário de ROMs extraídas. */
    QVariantMap clearExtractedRomCache();

signals:
    void changed();
    /** Resultado do lançamento, depois da confirmação de início do processo. */
    void launchFinished(qint64 gameId, const QVariantMap& result);

private:
    WriteConnection connection_;
    QString error_;
    bool open_ = false;
    bool launching_ = false;
    QString databasePath_;
};
} // namespace gamestock
