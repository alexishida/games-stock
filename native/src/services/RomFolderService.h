/** Fachada do importador: pastas persistidas, scan, job e remoção de registros. */
#pragma once

#include "app/RomFolderScanner.h"
#include "db/WriteConnection.h"

#include <QObject>
#include <QVariantList>
#include <QVariantMap>

namespace gamestock {
class JobManager;

/**
 * Uma conexão por instância; SQL fica nos DAOs e o QML recebe apenas mapas.
 * A importação de produção roda em worker pelo JobManager; `import` permanece
 * síncrono para testes e para a retomada controlada.
 */
class RomFolderService final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QVariantList folders READ folders NOTIFY changed)
    Q_PROPERTY(bool available READ available NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
public:
    explicit RomFolderService(QObject* parent = nullptr);
    /** Abre o banco já inicializado; não cria schema nem migrations. */
    bool open(const QString& databasePath, QString* error = nullptr);
    bool isOpen() const;
    bool available() const { return open_; }
    QString error() const { return error_; }
    QVariantList folders() const { return folders_; }
    /** O manager pertence à thread da UI e executa o lote fora dela. */
    void setJobManager(JobManager* manager) { jobManager_ = manager; }
    QString databasePath() const { return databasePath_; }

    /** Converte o mapa do QML no pedido tipado do scanner. */
    static RomFolderScanRequest parseRequest(const QVariantMap& request);
    /** Serializa o scan para o mesmo formato usado pelo renderer legado. */
    static QVariantMap describeScan(const RomFolderScanResult& scan);

public slots:
    /** Varre pastas/arquivos sem escrever no banco. */
    QVariantMap scan(const QVariantMap& request);
    /** Importa os candidatos do scan, criando ou reutilizando placeholders por ROM. */
    QVariantMap import(const QVariantMap& request);
    /** Inicia o lote em background e devolve o job persistido; mapa vazio em erro. */
    QVariantMap startImport(const QVariantMap& request);
    /** Recarrega as entradas persistidas com plataforma e contagem indexada. */
    void refreshFolders();
    /** Associa pasta e plataforma, atualizando a contagem exibida. */
    bool saveFolder(const QString& folderPath, qint64 platformId, bool includeSubfolders);
    /** Remove registros da pasta e a entrada persistida, sem tocar nos arquivos. */
    qint64 removeFolder(const QString& folderPath, qint64 platformId);
    /** Conta registros com `rom_path` dentro da pasta; -1 em erro. */
    qint64 countFolderRecords(const QString& folderPath, qint64 platformId = 0);
    /** Remove apenas registros da pasta, sem tocar nos arquivos; -1 em erro. */
    qint64 removeFolderRecords(const QString& folderPath, qint64 platformId = 0);

signals:
    void changed();
    /** Progresso por candidato, no formato de `romFolderImport:progress`. */
    void progress(const QVariantMap& event);

private:
    /** Publica o erro, notifica a UI e devolve um resultado vazio. */
    QVariantMap fail(const QString& message);
    /** Converte as entradas para o formato observável usado pelo QML. */
    bool loadFolders(QVariantList* result, QString* error);

    WriteConnection connection_;
    JobManager* jobManager_ = nullptr;
    QVariantList folders_;
    QString databasePath_;
    QString error_;
    bool open_ = false;
};
} // namespace gamestock
