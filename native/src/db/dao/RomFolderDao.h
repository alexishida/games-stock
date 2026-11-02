/** Operações de registros de jogos por pasta de ROM, sem tocar nos arquivos físicos. */
#pragma once

#include <QSqlDatabase>
#include <QString>
#include <QStringList>

namespace gamestock {
/** Normaliza caminhos como o DAO Electron para comparação cross-platform. */
class RomFolderDao final {
public:
    explicit RomFolderDao(QSqlDatabase& database);

    /** Conta jogos cujo rom_path está dentro da pasta, opcionalmente por plataforma. */
    bool countInFolder(const QString& folderPath, qint64 platformId, qint64* count, QString* error) const;
    /** Lista os rom_path cadastrados dentro da pasta. */
    bool listPathsInFolder(const QString& folderPath, qint64 platformId, QStringList* result, QString* error) const;
    /** Remove somente os registros dentro da pasta, em transação; arquivos ficam intactos. */
    bool deleteInFolder(const QString& folderPath, qint64 platformId, qint64* deleted, QString* error) const;

    /** Resolve caminho absoluto, separadores e caixa no Windows, sem barra final. */
    static QString normalizePath(const QString& value);

private:
    /** Confirma se o caminho do jogo pertence à pasta normalizada. */
    static bool isInside(const QString& normalizedTarget, const QString& normalizedFolder);
    QSqlDatabase& database_;
};
} // namespace gamestock
