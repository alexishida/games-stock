/** CRUD de emuladores com as mesmas proteções do DAO Electron. */
#pragma once

#include <QSqlDatabase>
#include <QList>
#include <QString>
#include <QVariantMap>

namespace gamestock {
/** Encapsula `emulators`; RetroArch é protegido contra exclusão. */
class EmulatorDao final {
public:
    explicit EmulatorDao(QSqlDatabase& database);

    /** Lista por nome, sem JOIN. */
    bool list(QList<QVariantMap>* result, QString* error) const;
    /** Retorna o emulador ou erro quando o ID não existe. */
    bool get(qint64 id, QVariantMap* result, QString* error) const;
    /** Valida nome e traduz violação UNIQUE para "Emulador já existe". */
    bool create(const QVariantMap& input, qint64* newId, QString* error) const;
    /** Atualiza somente as chaves presentes, preservando as demais. */
    bool update(qint64 id, const QVariantMap& changes, QString* error) const;
    /** Remove, recusando RetroArch (`is_retroarch = 1`). */
    bool remove(qint64 id, QString* error) const;

private:
    QSqlDatabase& database_;
};
} // namespace gamestock
