/** Varredura de pastas de ROM com detecção manual/automática de plataforma. */
#pragma once

#include <QSqlDatabase>
#include <QStringList>
#include <QVariantList>
#include <QVariantMap>

namespace gamestock {
/** Entrada do scan, equivalente a RomFolderScanRequest. */
struct RomFolderScanRequest {
    QStringList folderPaths;
    QStringList romFilePaths;
    qint64 platformId = 0;
    QString detectionMode;
    bool includeSubfolders = false;
};

/** Resultado do scan com candidatos, ignorados e plataformas detectadas. */
struct RomFolderScanResult {
    bool ok = false;
    QString error;
    QStringList folderPaths;
    QStringList romFilePaths;
    qint64 platformId = 0;
    QString platformName;
    QString detectionMode;
    bool includeSubfolders = false;
    QVariantList candidates;
    QVariantList ignoredItems;
    QVariantList detectedPlatforms;
};

/** Executa o scan sem escrever no banco e sem abrir arquivos de ROM. */
class RomFolderScanner final {
public:
    explicit RomFolderScanner(QSqlDatabase& database);
    RomFolderScanResult scan(const RomFolderScanRequest& request) const;
    /** Remove extensão/tags de região/revisão do nome da ROM. */
    static QString normalizeRomTitle(const QString& filename);

private:
    QSqlDatabase& database_;
};
} // namespace gamestock
