/** Modelo de plataformas para QML, alimentado apenas pelo PlatformService. */
#pragma once

#include <QAbstractListModel>
#include <QList>
#include <QVariantMap>

namespace gamestock {
/** Expõe nome, categoria, contagem de jogos e o bloqueio de exclusão de cada plataforma. */
class PlatformListModel final : public QAbstractListModel {
    Q_OBJECT
public:
    enum Role {
        PlatformIdRole = Qt::UserRole + 1,
        NameRole,
        CategoryRole,
        GameCountRole,
        IsDefaultRole,
    };

    explicit PlatformListModel(QObject* parent = nullptr);
    int rowCount(const QModelIndex& parent = {}) const override;
    QVariant data(const QModelIndex& index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;
    /** Substitui a lista inteira após criar, editar ou excluir uma plataforma. */
    void setPlatforms(const QList<QVariantMap>& platforms);

private:
    QList<QVariantMap> platforms_;
};
} // namespace gamestock
