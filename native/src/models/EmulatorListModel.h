/** Modelo de emuladores para o gerenciador e seletores de vínculo. */
#pragma once

#include <QAbstractListModel>
#include <QList>
#include <QVariantMap>

namespace gamestock {
/** Expõe somente os campos usados pela interface de emuladores. */
class EmulatorListModel final : public QAbstractListModel {
    Q_OBJECT
public:
    enum Role {
        EmulatorIdRole = Qt::UserRole + 1,
        NameRole,
        ExecutableRole,
        ArgsRole,
        IsRetroArchRole,
    };

    explicit EmulatorListModel(QObject* parent = nullptr);
    int rowCount(const QModelIndex& parent = {}) const override;
    QVariant data(const QModelIndex& index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;
    /** Substitui a lista após CRUD ou reabertura. */
    void setEmulators(const QList<QVariantMap>& emulators);

private:
    QList<QVariantMap> emulators_;
};
} // namespace gamestock
