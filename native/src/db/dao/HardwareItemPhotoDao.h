/** Fotos do inventário com ordem persistida e exclusão em cascata do item. */
#pragma once

#include <QList>
#include <QSqlDatabase>
#include <QString>
#include <QVariantMap>

namespace gamestock {
/** Encapsula `hardware_item_photos`. */
class HardwareItemPhotoDao final {
public:
    explicit HardwareItemPhotoDao(QSqlDatabase& database);

    /** Lista por `sort_order` e ID, como a galeria do renderer. */
    bool listByItem(qint64 itemId, QList<QVariantMap>* result, QString* error) const;
    /** Busca uma foto para validar vínculo antes de remover e apagar o arquivo. */
    bool get(qint64 id, QVariantMap* result, QString* error) const;
    /** Cria ao final da galeria (`MAX(sort_order) + 1`). */
    bool create(qint64 itemId, const QString& filePath, qint64* newId, QString* error) const;
    /** Remove o registro; o arquivo é apagado pelo serviço. */
    bool remove(qint64 id, QString* error) const;
    /** Troca o `sort_order` de duas fotos do mesmo item em uma transação. */
    bool reorder(qint64 idA, qint64 idB, QString* error) const;
    /** Remove todos os registros de um item e devolve os caminhos para limpeza. */
    bool takeByItem(qint64 itemId, QList<QVariantMap>* removed, QString* error) const;

private:
    QSqlDatabase& database_;
};
} // namespace gamestock
