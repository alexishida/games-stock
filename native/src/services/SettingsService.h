/** Diagnóstico local: logs persistidos, estatísticas do perfil e manutenção segura. */
#pragma once

#include <QObject>
#include <QElapsedTimer>
#include <QVariantList>
#include <QString>

namespace gamestock {
/** Alimenta as seções Logs e Sobre de Configurações sem expor filesystem ao QML. */
class SettingsService final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QVariantList logEntries READ logEntries NOTIFY logsChanged)
    Q_PROPERTY(QString logFilePath READ logFilePath NOTIFY logsChanged)
    Q_PROPERTY(QString dataDirPath READ dataDirPath NOTIFY statsChanged)
    Q_PROPERTY(qint64 totalGames READ totalGames NOTIFY statsChanged)
    Q_PROPERTY(qint64 totalInventoryItems READ totalInventoryItems NOTIFY statsChanged)
    Q_PROPERTY(double dataDirSizeMb READ dataDirSizeMb NOTIFY statsChanged)
    Q_PROPERTY(bool statsLoading READ statsLoading NOTIFY statsChanged)
    Q_PROPERTY(QString buildLabel READ buildLabel WRITE setBuildLabel NOTIFY buildChanged)
    Q_PROPERTY(QString channel READ channel WRITE setChannel NOTIFY buildChanged)
    Q_PROPERTY(QString executableDir READ executableDir WRITE setExecutableDir NOTIFY buildChanged)
    Q_PROPERTY(QString error READ error NOTIFY logsChanged)
    Q_PROPERTY(QString cacheFeedback READ cacheFeedback NOTIFY cacheFeedbackChanged)
public:
    explicit SettingsService(QObject* parent = nullptr);
    ~SettingsService() override;

    /** Perfil e banco usados nas estatísticas; o serviço nunca escreve no SQLite. */
    void configure(const QString& profileRoot, const QString& logFile, const QString& databasePath);

    QVariantList logEntries() const { return entries_; }
    QString logFilePath() const { return logFile_; }
    QString dataDirPath() const { return profileRoot_; }
    qint64 totalGames() const { return totalGames_; }
    qint64 totalInventoryItems() const { return totalInventoryItems_; }
    double dataDirSizeMb() const { return dataDirSizeMb_; }
    bool statsLoading() const { return statsLoading_; }
    QString buildLabel() const { return buildLabel_; }
    void setBuildLabel(const QString& value);
    QString channel() const { return channel_; }
    void setChannel(const QString& value);
    QString executableDir() const { return executableDir_; }
    void setExecutableDir(const QString& value);
    QString error() const { return error_; }
    QString cacheFeedback() const { return cacheFeedback_; }

public slots:
    /** Lê até 500 entradas do log sem bloquear em arquivos ausentes. */
    void refreshLogs();
    /** Trunca o arquivo de log e recarrega a lista. */
    bool clearLogs();
    /** Abre a pasta do log no gerenciador de arquivos do sistema. */
    bool openLogsFolder();
    /** Abre a pasta de dados do perfil. */
    bool openDataDir();
    /** Calcula jogos, itens e tamanho do perfil; a varredura é síncrona e cacheada pela UI. */
    void refreshStats();
    /** Remove apenas o cache temporário de ROMs extraídas. */
    bool clearRomCache();

signals:
    void logsChanged();
    void statsChanged();
    void buildChanged();
    void cacheFeedbackChanged();

private:
    QVariantList entries_;
    QString profileRoot_;
    QString logFile_;
    QString databasePath_;
    QString buildLabel_;
    QString channel_;
    QString executableDir_;
    QString error_;
    QString cacheFeedback_;
    qint64 totalGames_ = -1;
    qint64 totalInventoryItems_ = -1;
    double dataDirSizeMb_ = -1;
    bool statsLoading_ = false;
    QElapsedTimer statsTimer_;
};
} // namespace gamestock
