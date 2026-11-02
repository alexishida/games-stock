/** Feed de atualização assinado, download verificado e aplicação do instalador. */
#pragma once

#include "update/UpdateManifest.h"
#include "update/UpdateConfig.h"

#include <QObject>
#include <QString>
#include <QStringList>

class QFile;
class QNetworkAccessManager;
class QNetworkReply;
class QTimer;

namespace gamestock {
/** Estado observável consumido pela splash e por Configurações → Sobre. */
class UpdateService final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QString phase READ phase NOTIFY changed)
    Q_PROPERTY(QString message READ message NOTIFY changed)
    Q_PROPERTY(int percent READ percent NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
    Q_PROPERTY(QString version READ version NOTIFY changed)
    Q_PROPERTY(QString buildNumber READ buildNumber NOTIFY changed)
    Q_PROPERTY(QString releaseDate READ releaseDate NOTIFY changed)
    Q_PROPERTY(QString notes READ notes NOTIFY changed)
    Q_PROPERTY(bool requiresAction READ requiresAction NOTIFY changed)
    Q_PROPERTY(bool startupVisible READ startupVisible NOTIFY changed)
    Q_PROPERTY(bool running READ running NOTIFY changed)
    Q_PROPERTY(QString channel READ channel NOTIFY changed)
    Q_PROPERTY(QString appVersion READ appVersion NOTIFY changed)
public:
    explicit UpdateService(QObject* parent = nullptr);
    ~UpdateService() override;

    /** Configura canal, versões, URL do feed e chave pública (testes usam chave efêmera). */
    bool configure(const QString& channel, const QString& appVersion, const QString& buildNumber,
        const QString& manifestUrl, const QByteArray& publicKeyX, const QByteArray& publicKeyY,
        QString* error = nullptr);
    /** Sobrescreve o executável/args de aplicação para testes; não usar em produção. */
    void setApplyCommandForTest(const QString& program, const QStringList& arguments);
    void setAutoApply(bool value) { autoApply_ = value; }
    void setQuitOnApply(bool value) { quitOnApply_ = value; }
    void setStartupTimeoutForTest(int milliseconds) { startupTimeoutMs_ = milliseconds; }

    QString phase() const { return phase_; }
    QString message() const { return message_; }
    int percent() const { return percent_; }
    QString error() const { return error_; }
    QString version() const { return version_; }
    QString buildNumber() const { return buildNumber_; }
    QString releaseDate() const { return releaseDate_; }
    QString notes() const { return notes_; }
    bool requiresAction() const { return requiresAction_; }
    bool startupVisible() const { return startupVisible_; }
    bool running() const { return running_; }
    QString channel() const { return channel_; }
    QString appVersion() const { return appVersion_; }
    QString packagePath() const { return packagePath_; }

public slots:
    /** Check automático com timeout de 30 s; usado pela splash. */
    void startupCheck();
    /** Estado sintético usado somente em captura visual do protótipo. */
    void showStartupPreview();
    /** Busca manual disparada em Configurações → Sobre. */
    void checkNow();
    /** Libera o app sem aguardar rede; a splash deixa de bloquear. */
    void skip();
    /** Executa apenas o pacote já baixado e verificado. */
    bool applyReadyUpdate();

signals:
    void changed();
    /** Emitido depois de iniciar o instalador verificado. */
    void updateLaunched(const QString& packagePath);

private:
    void check(bool automatic);
    void fail(const QString& phase, const QString& message, bool requiresAction);
    void startPackageDownload();
    void finishPackageDownload();
    bool verifyDownloadedPackage(QString* error) const;
    void cleanupDownload();
    void setPhase(const QString& phase, const QString& message);

    QNetworkAccessManager* network_ = nullptr;
    QNetworkReply* manifestReply_ = nullptr;
    QNetworkReply* packageReply_ = nullptr;
    QTimer* timeout_ = nullptr;
    QFile* packageFile_ = nullptr;
    UpdateManifest manifest_;
    QString manifestUrl_;
    QByteArray publicKeyX_;
    QByteArray publicKeyY_;
    QString channel_;
    QString appVersion_;
    QString localBuildNumber_;
    QString phase_ = QStringLiteral("idle");
    QString message_;
    QString error_;
    QString version_;
    QString buildNumber_;
    QString releaseDate_;
    QString notes_;
    QString packagePath_;
    QString applyProgram_;
    QStringList applyArguments_;
    int percent_ = 0;
    bool requiresAction_ = false;
    bool startupVisible_ = false;
    bool running_ = false;
    bool verified_ = false;
    bool automatic_ = false;
    bool autoApply_ = true;
    bool quitOnApply_ = true;
    int startupTimeoutMs_ = kUpdateStartupTimeoutMs;
};
} // namespace gamestock
