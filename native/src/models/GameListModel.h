/** Modelo paginado da biblioteca para QML, sem SQL na camada de interface. */
#pragma once

#include <QAbstractListModel>
#include <QList>
#include <QVariantMap>

namespace gamestock {
/** Expõe os representantes da página atual com papéis usados pelos delegates. */
class GameListModel final : public QAbstractListModel {
    Q_OBJECT
public:
    enum Role {
        GameIdRole = Qt::UserRole + 1,
        TitleRole,
        PlatformNameRole,
        CoverUrlRole,
        FavoriteRole,
        PlayStatusRole,
        LaunchCountRole,
        YearRole,
        GenreRole,
    };

    explicit GameListModel(QObject* parent = nullptr);
    int rowCount(const QModelIndex& parent = {}) const override;
    QVariant data(const QModelIndex& index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;
    /** Substitui a página; a URL da capa já sai pronta para o provider de mídia. */
    void setGames(const QList<QVariantMap>& games);
    /** Converte o caminho absoluto em identificador do provider. */
    static QString coverUrl(const QString& path);

private:
    QList<QVariantMap> games_;
};
} // namespace gamestock
