/** Modelo somente leitura; o QML não executa SQL. */
#include "EmulatorListModel.h"

namespace gamestock {
EmulatorListModel::EmulatorListModel(QObject* parent) : QAbstractListModel(parent) {}

int EmulatorListModel::rowCount(const QModelIndex& parent) const {
    return parent.isValid() ? 0 : static_cast<int>(emulators_.size());
}

QVariant EmulatorListModel::data(const QModelIndex& index, int role) const {
    if (!index.isValid() || index.row() < 0 || index.row() >= emulators_.size()) return {};
    const QVariantMap& emulator = emulators_.at(index.row());
    switch (role) {
    case EmulatorIdRole: return emulator.value(QStringLiteral("id"));
    case NameRole: return emulator.value(QStringLiteral("name"));
    case ExecutableRole: return emulator.value(QStringLiteral("executable"));
    case ArgsRole: return emulator.value(QStringLiteral("args"));
    case IsRetroArchRole: return emulator.value(QStringLiteral("is_retroarch")).toInt() != 0;
    default: return {};
    }
}

QHash<int, QByteArray> EmulatorListModel::roleNames() const {
    return {{EmulatorIdRole, "emulatorId"}, {NameRole, "name"}, {ExecutableRole, "executable"},
        {ArgsRole, "args"}, {IsRetroArchRole, "isRetroArch"}};
}

void EmulatorListModel::setEmulators(const QList<QVariantMap>& emulators) {
    beginResetModel();
    emulators_ = emulators;
    endResetModel();
}
} // namespace gamestock
