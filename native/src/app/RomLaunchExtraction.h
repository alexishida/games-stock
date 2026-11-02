/** Extrai ROMs .zip/.7z para cache temporário com marcador de launch. */
#pragma once

#include <QString>

namespace gamestock {
/** Retorna o arquivo a passar ao emulador; falhas preservam o pacote original. */
QString prepareRomPathForLaunch(const QString& romPath, QString* warning = nullptr,
    const QString& extractionRootOverride = {}, const QString& sevenZipPathOverride = {});

/** Remove o cache de ROMs extraídas e recria a raiz vazia. */
bool clearExtractedRomCache(int* removedEntries, QString* error = nullptr,
    const QString& extractionRootOverride = {});

/** Extensões primárias do catálogo, usadas na escolha do arquivo principal. */
QStringList supportedRomExtensions();

/** Localiza 7za/7z/7zz para extração; vazio quando ausente. */
QString sevenZipBinaryPath(const QString& overridePath = {});

/** Extrai um pacote em diretório limpo, aceitando o código 1 como aviso. */
bool extractArchiveWithSevenZip(const QString& archivePath, const QString& targetDir,
    const QString& binary, QString* error);
} // namespace gamestock
