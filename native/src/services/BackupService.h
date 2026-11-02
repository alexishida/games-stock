/** Exportação, pré-visualização e importação de `.gamestock-backup` schemaVersion 1. */
#pragma once

#include "db/WriteConnection.h"
#include "portability/CompatibleZipWriter.h"
#include "portability/ZipArchive.h"

#include <QObject>
#include <QPair>
#include <QString>
#include <QStringList>
#include <QVariantList>
#include <QVariantMap>

namespace gamestock {
/** Serviço síncrono; jobs/UI agendam a chamada e consomem progresso por sinal. */
class BackupService final : public QObject {
    Q_OBJECT
    Q_PROPERTY(bool available READ available NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
    Q_PROPERTY(QString lastPackagePath READ lastPackagePath NOTIFY changed)
public:
    explicit BackupService(QObject* parent = nullptr);
    /** Abre o banco do perfil e guarda raízes de mídia e versão do app. */
    bool open(const QString& databasePath, const QString& profileRoot, const QString& appVersion,
        QString* error = nullptr);
    bool available() const { return open_; }
    QString error() const { return error_; }
    QString lastPackagePath() const { return lastPackagePath_; }

    /** Categorias válidas na ordem canônica. */
    Q_INVOKABLE QStringList categories() const;

    /** Lê manifesto/dados e calcula contagens, avisos, erros e conflitos sem alterar o banco. */
    Q_INVOKABLE QVariantMap preview(const QString& packagePath);
    /** Cria o pacote em arquivo temporário, valida e só então substitui o destino. */
    Q_INVOKABLE QVariantMap exportPackage(const QVariantMap& request);
    /** Importa categorias selecionadas em uma transação e remove arquivos em caso de falha. */
    Q_INVOKABLE QVariantMap importPackage(const QVariantMap& request);

signals:
    void changed();
    void progress(const QVariantMap& progress);

private:
    struct Loaded;
    bool load(const QString& packagePath, Loaded* loaded, QString* error);
    bool validate(const Loaded& loaded, QVariantList* warnings, QVariantList* errors, QString* error) const;
    QStringList detectCategories(const Loaded& loaded) const;
    QVariantMap previewCounts(const Loaded& loaded, const QStringList& categories) const;
    bool writeJson(CompatibleZipWriter& writer, const QString& entryName, const QVariant& value, QString* error) const;
    bool readJson(Loaded& loaded, const QString& entryName, bool required, QVariant* value,
        QString* error, QVariantList* warnings) const;
    bool exportImages(CompatibleZipWriter& writer, QVariantList* mediaMap, QVariantList* warnings, QString* error);
    bool importMedia(Loaded& loaded, const QString& stagingRoot, QVariantMap* summary,
        QList<QPair<QString, QString>>* moves, QString* error);
    bool importInventoryMedia(Loaded& loaded, const QString& stagingRoot, QVariantMap* summary,
        QList<QPair<QString, QString>>* moves, QString* error);
    void report(int current, int total, const QString& stage, const QString& message);
    QString imagesDir() const;
    QString inventoryImagesDir() const;
    QString resolveInside(const QString& root, const QString& relative, bool* ok) const;
    static QString normalizedLookupPath(const QString& path);
    static QString relativeInside(const QString& root, const QString& path);
    static QVariantMap warningEntry(const QString& code, const QString& message, const QString& path = {});
    static QVariantMap errorMap(const QString& message, const QVariantList& errors = {});

    WriteConnection connection_;
    QString profileRoot_;
    QString appVersion_;
    QString error_;
    QString lastPackagePath_;
    bool open_ = false;
};
} // namespace gamestock
