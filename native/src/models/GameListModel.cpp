/** Modelo de lista somente leitura; a conversão de caminho fica na fronteira de mídia. */
#include "GameListModel.h"

#include <QByteArray>

namespace gamestock {
GameListModel::GameListModel(QObject* parent) : QAbstractListModel(parent) {}

int GameListModel::rowCount(const QModelIndex& parent) const {
    return parent.isValid() ? 0 : static_cast<int>(games_.size());
}

QVariant GameListModel::data(const QModelIndex& index, int role) const {
    if (!index.isValid() || index.row() < 0 || index.row() >= games_.size()) return {};
    const QVariantMap& game = games_.at(index.row());
    switch (role) {
    case GameIdRole: return game.value(QStringLiteral("id"));
    case TitleRole: return game.value(QStringLiteral("title"));
    case PlatformNameRole: return game.value(QStringLiteral("platform_name"));
    case CoverUrlRole: return coverUrl(game.value(QStringLiteral("box_art_path")).toString());
    case FavoriteRole: return game.value(QStringLiteral("favorite")).toBool();
    case PlayStatusRole: return game.value(QStringLiteral("play_status"));
    case LaunchCountRole: return game.value(QStringLiteral("launch_count"));
    case YearRole: return game.value(QStringLiteral("year"));
    case GenreRole: return game.value(QStringLiteral("genre"));
    default: return {};
    }
}

QHash<int, QByteArray> GameListModel::roleNames() const {
    return {{GameIdRole, "gameId"}, {TitleRole, "title"}, {PlatformNameRole, "platformName"},
        {CoverUrlRole, "coverUrl"}, {FavoriteRole, "favorite"}, {PlayStatusRole, "playStatus"},
        {LaunchCountRole, "launchCount"}, {YearRole, "year"}, {GenreRole, "genre"}};
}

void GameListModel::setGames(const QList<QVariantMap>& games) {
    beginResetModel();
    games_ = games;
    endResetModel();
}

QString GameListModel::coverUrl(const QString& path) {
    if (path.isEmpty()) return {};
    const QByteArray id = path.toUtf8().toBase64(QByteArray::Base64UrlEncoding | QByteArray::OmitTrailingEquals);
    return QStringLiteral("image://profilemedia/") + QString::fromLatin1(id);
}
} // namespace gamestock
