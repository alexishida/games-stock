/** Modelo paginado do inventário para QML, sem SQL na interface. */
#pragma once

#include <QAbstractListModel>
#include <QList>
#include <QVariantMap>

namespace gamestock {
/** Expõe a página atual de itens com os papéis usados pelos delegates. */
class HardwareItemListModel final : public QAbstractListModel {
    Q_OBJECT
public:
    enum Role {
        ItemIdRole = Qt::UserRole + 1,
        NameRole,
        PlatformNameRole,
        CoverUrlRole,
        TypeNameRole,
        ConservationNameRole,
        ColorRole,
        StorageLocationRole,
        ValueRole,
        AcquisitionDateRole,
        IsMultiplatformRole,
    };

    explicit HardwareItemListModel(QObject* parent = nullptr);
    int rowCount(const QModelIndex& parent = {}) const override;
    QVariant data(const QModelIndex& index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;
    /** Substitui a página por itens já decorados com `coverUrl`. */
    void setItems(const QList<QVariantMap>& items);
    /** Converte caminho absoluto no identificador do provider de mídia. */
    static QString mediaUrl(const QString& path);

private:
    QList<QVariantMap> items_;
};
} // namespace gamestock
