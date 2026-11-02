/** Tipos de item do inventário: defaults do seed e valores criados pelo usuário. */
#pragma once

#include <QList>
#include <QSqlDatabase>
#include <QString>
#include <QVariantMap>

namespace gamestock {
/** Encapsula `item_types`. */
class HardwareItemTypeDao final {
public:
    explicit HardwareItemTypeDao(QSqlDatabase& database);

    bool list(QList<QVariantMap>* result, QString* error) const;
    /** Inclui tipos sem itens, com contagem agregada para a sidebar. */
    bool listWithCounts(QList<QVariantMap>* result, QString* error) const;
    /** Cria com `is_default = 0`; nome duplicado vira mensagem acionável. */
    bool create(const QString& name, qint64* newId, QString* error) const;
    bool remove(qint64 id, QString* error) const;

private:
    QSqlDatabase& database_;
};
} // namespace gamestock
