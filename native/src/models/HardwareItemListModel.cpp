/** Modelo somente leitura; a conversão de caminho fica na fronteira de mídia. */
#include "HardwareItemListModel.h"

#include <QByteArray>

namespace gamestock {
HardwareItemListModel::HardwareItemListModel(QObject* parent) : QAbstractListModel(parent) {}

int HardwareItemListModel::rowCount(const QModelIndex& parent) const {
    return parent.isValid() ? 0 : static_cast<int>(items_.size());
}

QVariant HardwareItemListModel::data(const QModelIndex& index, int role) const {
    if (!index.isValid() || index.row() < 0 || index.row() >= items_.size()) return {};
    const QVariantMap& item = items_.at(index.row());
    switch (role) {
    case ItemIdRole: return item.value(QStringLiteral("id"));
    case NameRole: return item.value(QStringLiteral("name"));
    case PlatformNameRole: return item.value(QStringLiteral("platform_name"));
    case CoverUrlRole: return item.value(QStringLiteral("coverUrl"));
    case TypeNameRole: return item.value(QStringLiteral("item_type_name"));
    case ConservationNameRole: return item.value(QStringLiteral("conservation_state_name"));
    case ColorRole: return item.value(QStringLiteral("color"));
    case StorageLocationRole: return item.value(QStringLiteral("storage_location"));
    case ValueRole: return item.value(QStringLiteral("value"));
    case AcquisitionDateRole: return item.value(QStringLiteral("acquisition_date"));
    case IsMultiplatformRole: return item.value(QStringLiteral("is_multiplatform")).toInt() != 0;
    default: return {};
    }
}

QHash<int, QByteArray> HardwareItemListModel::roleNames() const {
    return {{ItemIdRole, "itemId"}, {NameRole, "name"}, {PlatformNameRole, "platformName"},
        {CoverUrlRole, "coverUrl"}, {TypeNameRole, "typeName"},
        {ConservationNameRole, "conservationName"}, {ColorRole, "color"},
        {StorageLocationRole, "storageLocation"}, {ValueRole, "value"},
        {AcquisitionDateRole, "acquisitionDate"}, {IsMultiplatformRole, "isMultiplatform"}};
}

void HardwareItemListModel::setItems(const QList<QVariantMap>& items) {
    beginResetModel();
    items_ = items;
    endResetModel();
}

QString HardwareItemListModel::mediaUrl(const QString& path) {
    if (path.isEmpty()) return {};
    const QByteArray id = path.toUtf8().toBase64(QByteArray::Base64UrlEncoding | QByteArray::OmitTrailingEquals);
    return QStringLiteral("image://profilemedia/") + QString::fromLatin1(id);
}
} // namespace gamestock
