/** Estados de conservação do inventário: defaults do seed e valores do usuário. */
#pragma once

#include <QList>
#include <QSqlDatabase>
#include <QString>
#include <QVariantMap>

namespace gamestock {
/** Encapsula `conservation_states`. */
class HardwareConservationStateDao final {
public:
    explicit HardwareConservationStateDao(QSqlDatabase& database);

    bool list(QList<QVariantMap>* result, QString* error) const;
    /** Inclui estados sem itens, com contagem agregada. */
    bool listWithCounts(QList<QVariantMap>* result, QString* error) const;
    /** Cria com `is_default = 0`; nome duplicado vira mensagem acionável. */
    bool create(const QString& name, qint64* newId, QString* error) const;
    bool remove(qint64 id, QString* error) const;

private:
    QSqlDatabase& database_;
};
} // namespace gamestock
