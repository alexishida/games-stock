/** Modelo somente leitura; nenhuma SQL ou regra de negócio vive na interface. */
#include "PlatformListModel.h"

namespace gamestock {
PlatformListModel::PlatformListModel(QObject* parent) : QAbstractListModel(parent) {}

int PlatformListModel::rowCount(const QModelIndex& parent) const {
    return parent.isValid() ? 0 : static_cast<int>(platforms_.size());
}

QVariant PlatformListModel::data(const QModelIndex& index, int role) const {
    if (!index.isValid() || index.row() < 0 || index.row() >= platforms_.size()) return {};
    const QVariantMap& platform = platforms_.at(index.row());
    switch (role) {
    case PlatformIdRole: return platform.value(QStringLiteral("id"));
    case NameRole: return platform.value(QStringLiteral("name"));
    case CategoryRole: return platform.value(QStringLiteral("category"));
    case GameCountRole: return platform.value(QStringLiteral("gameCount"));
    case IsDefaultRole: return platform.value(QStringLiteral("isDefault"));
    default: return {};
    }
}

QHash<int, QByteArray> PlatformListModel::roleNames() const {
    return {{PlatformIdRole, "platformId"}, {NameRole, "name"}, {CategoryRole, "category"},
        {GameCountRole, "gameCount"}, {IsDefaultRole, "isDefault"}};
}

void PlatformListModel::setPlatforms(const QList<QVariantMap>& platforms) {
    beginResetModel();
    platforms_ = platforms;
    endResetModel();
}
} // namespace gamestock
