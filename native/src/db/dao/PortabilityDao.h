/** DAO da portabilidade: exporta/importa as cinco categorias sem IDs externos. */
#pragma once

#include <QList>
#include <QMap>
#include <QSqlDatabase>
#include <QString>
#include <QStringList>
#include <QVariantMap>

namespace gamestock {
/** Encapsula todo o SQL de backup; o serviço controla transação e arquivos. */
class PortabilityDao final {
public:
    explicit PortabilityDao(QSqlDatabase& database);

    // ── Exportação ─────────────────────────────────────────────────────────
    bool listGameMetadata(QList<QVariantMap>* result, QString* error) const;
    bool listMediaReferences(QList<QVariantMap>* result, QString* error) const;
    bool listPlatforms(QList<QVariantMap>* result, QString* error) const;
    bool listPlatformAliases(QList<QVariantMap>* result, QString* error) const;
    bool listRomExtensions(QList<QVariantMap>* result, QString* error) const;
    bool listEmulators(QList<QVariantMap>* result, QString* error) const;
    bool listPlatformEmulators(QList<QVariantMap>* result, QString* error) const;
    bool listRomLocations(QList<QVariantMap>* result, QString* error) const;
    bool listInventoryData(QVariantMap* result, QString* error) const;

    // ── Pré-visualização ───────────────────────────────────────────────────
    bool countGameConflicts(const QList<QVariantMap>& records, QVariantMap* result, QString* error) const;
    bool countPlatformConflicts(const QList<QVariantMap>& records, QVariantMap* result, QString* error) const;
    bool countEmulatorConflicts(const QList<QVariantMap>& records, QVariantMap* result, QString* error) const;
    bool findGameId(const QVariantMap& entry, qint64* id, QString* error) const;

    // ── Importação (dentro da transação do chamador) ───────────────────────
    bool importPlatformBundle(const QVariantMap& bundle, QVariantMap* summary, QString* error);
    bool importGameMetadata(const QList<QVariantMap>& records, QVariantMap* summary, QString* error);
    bool importRomLocations(const QList<QVariantMap>& records, QVariantMap* summary, QString* error);
    bool importInventoryData(const QVariantMap& bundle, const QMap<QString, QStringList>& photoPaths,
        QVariantMap* summary, QString* error);
    bool updateGameMedia(qint64 gameId, const QString& field, const QString& filePath, QString* error);
    bool resolveRomFolderEntries(const QList<QVariantMap>& entries, QList<QVariantMap>* result, QString* error) const;

    /** Normaliza nomes como o renderer (minúsculas, sem acentos, espaços simples). */
    static QString normalizeName(const QString& value);
    /** Extensão sempre com ponto e minúsculas. */
    static QString normalizeExtension(const QString& value);
    /** Identidade da variante: nome de arquivo em minúsculas. */
    static QString normalizeRomFileName(const QString& value);
    /** Marcador Multiplataforma, aceitando flag nova e rótulo legado. */
    static bool isInventoryMultiplatform(const QVariantMap& entry);
    /** Chave estável usada para casar fotos e itens do inventário. */
    static QString inventoryItemKey(const QString& itemName, const QString& platformName, bool multiplatform);

private:
    bool ensurePlatform(const QString& name, const QString& category, qint64* id, bool* created, bool* updated,
        QString* error);
    bool platformIdByName(const QString& name, qint64* id) const;
    bool emulatorIdByName(const QString& name, qint64* id) const;
    bool findGameIdByIdentity(const QVariantMap& entry, qint64 platformId, qint64* id) const;
    bool findGameIdByRomFileName(qint64 platformId, const QString& title, const QString& romFileName,
        qint64* id) const;
    bool findUnresolvedTitleMatch(qint64 platformId, const QString& title, qint64* id) const;
    bool findSafeTitleMatch(qint64 platformId, const QString& title, qint64* id) const;
    bool upsertEmulator(const QVariantMap& emulator, QString* error);

    QSqlDatabase& database_;
};
} // namespace gamestock
