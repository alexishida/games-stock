/** Adapta páginas SQLite sintéticas à interface de demonstração. */
#include "FixtureLibrary.h"
#include "db/dao/GameReadDao.h"

namespace gamestock {
FixtureLibrary::FixtureLibrary(QObject* parent) : QObject(parent) {}

bool FixtureLibrary::open(const QString& path) {
    if (!connection_.open(path, &error_)) { emit changed(); return false; }
    GameReadDao dao(connection_.database());
    if (!dao.listGenres(&genres_, &error_)) { emit changed(); return false; }
    enabled_ = true;
    reload(1);
    return error_.isEmpty();
}
bool FixtureLibrary::enabled() const { return enabled_; }
QVariantList FixtureLibrary::games() const { return games_; }
qint64 FixtureLibrary::total() const { return total_; }
qint64 FixtureLibrary::filtered() const { return filtered_; }
int FixtureLibrary::page() const { return page_; }
QString FixtureLibrary::error() const { return error_; }
QString FixtureLibrary::sortBy() const { return sortBy_; }
QStringList FixtureLibrary::genres() const { return genres_; }
QString FixtureLibrary::genre() const { return genre_; }
QString FixtureLibrary::collection() const { return collection_; }
QVariantMap FixtureLibrary::counts() const { return counts_; }
bool FixtureLibrary::includeMissingCovers() const { return includeMissingCovers_; }

void FixtureLibrary::goToPage(int page) {
    if (!enabled_ || page < 1 || (page > 1 && static_cast<qint64>(page - 1) * 36 >= filtered_)) return;
    reload(page);
}
void FixtureLibrary::setSearch(const QString& value) {
    if (!enabled_ || value == search_) return;
    search_ = value;
    reload(1);
}
void FixtureLibrary::setSortBy(const QString& value) {
    if (!enabled_ || value == sortBy_) return;
    if (value != QLatin1String("title") && value != QLatin1String("year") && value != QLatin1String("recent") && value != QLatin1String("mostPlayed")) return;
    sortBy_ = value;
    reload(1);
}
void FixtureLibrary::setGenre(const QString& value) {
    if (!enabled_ || value == genre_ || (!value.isEmpty() && !genres_.contains(value))) return;
    genre_ = value;
    reload(1);
}
void FixtureLibrary::setCollection(const QString& value) {
    if (!enabled_ || value == collection_) return;
    if (value != QLatin1String("all") && value != QLatin1String("favorites") && value != QLatin1String("playing")
        && value != QLatin1String("completed") && value != QLatin1String("mostPlayed")) return;
    collection_ = value;
    reload(1);
}
void FixtureLibrary::setIncludeMissingCovers(bool value) {
    if (!enabled_ || value == includeMissingCovers_) return;
    includeMissingCovers_ = value;
    reload(1);
}
void FixtureLibrary::reload(int page) {
    GameListFilters filters;
    filters.search = search_;
    filters.sortBy = sortBy_;
    filters.genre = genre_;
    filters.collection = collection_;
    filters.includeMissingCovers = includeMissingCovers_;
    GamePage result;
    GameReadDao dao(connection_.database());
    if (!dao.list(page, 36, &result, &error_, filters)) { emit changed(); return; }
    QVariantMap counts;
    // Contagens ignoram a coleção ativa, mas mantêm busca e gênero, como a sidebar Electron.
    for (const QString& collection : {QStringLiteral("all"), QStringLiteral("favorites"), QStringLiteral("playing"), QStringLiteral("completed"), QStringLiteral("mostPlayed")}) {
        filters.collection = collection;
        GamePage count;
        if (!dao.list(1, 1, &count, &error_, filters)) { emit changed(); return; }
        counts.insert(collection, count.filtered);
    }
    QVariantList rows;
    for (auto row : result.items) {
        const QString path = row.value("box_art_path").toString();
        const QByteArray encoded = path.toUtf8().toBase64(QByteArray::Base64UrlEncoding | QByteArray::OmitTrailingEquals);
        // O QML recebe somente o identificador do provider, nunca um URL file arbitrário.
        row.insert("coverUrl", path.isEmpty() ? QString() : QStringLiteral("image://profilemedia/") + QString::fromLatin1(encoded));
        rows.append(row);
    }
    games_ = rows;
    counts_ = counts;
    total_ = result.total;
    filtered_ = result.filtered;
    page_ = page;
    error_.clear();
    emit changed();
}
}
