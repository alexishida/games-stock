/** Vínculos plataforma ↔ emulador, com padrão único garantido por trigger. */
#pragma once

#include <QSqlDatabase>
#include <QList>
#include <QString>
#include <QVariantList>
#include <QVariantMap>

namespace gamestock {
/** Encapsula `platform_emulators` e o JOIN com `emulators`. */
class PlatformEmulatorDao final {
public:
    explicit PlatformEmulatorDao(QSqlDatabase& database);

    /** Lista vínculos da plataforma, com o padrão primeiro. */
    bool listByPlatform(qint64 platformId, QList<QVariantMap>* result, QString* error) const;
    /** Lista várias plataformas em uma consulta, incluindo IDs sem vínculo. */
    bool listByPlatforms(const QList<qint64>& platformIds, QVariantMap* result, QString* error) const;
    /** Retorna o vínculo padrão ou `found = false` quando não configurado. */
    bool getDefault(qint64 platformId, QVariantMap* result, bool* found, QString* error) const;
    /** Upsert idempotente do vínculo; retorna o registro relido. */
    bool link(qint64 emulatorId, qint64 platformId, bool isDefault, const QString& corePath,
        QVariantMap* result, QString* error) const;
    /** Remove o vínculo sem falhar quando ele não existe. */
    bool unlink(qint64 emulatorId, qint64 platformId, QString* error) const;
    /** Aplica vários vínculos em uma transação; qualquer falha desfaz o lote. */
    bool linkMany(const QVariantList& changes, QString* error) const;

private:
    QSqlDatabase& database_;
};
} // namespace gamestock
