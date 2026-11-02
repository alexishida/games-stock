/** Mantém compatibilidade das preferências de biblioteca entre os runtimes. */
#include "LibraryFilterState.h"
#include "dao/AppStateReadDao.h"
#include "dao/AppStateWriteDao.h"
#include <QJsonObject>
#include <QStringList>

namespace gamestock {
namespace {
const QString filterKey = QStringLiteral("gamestock.ui.libraryFilters");
const QStringList collections{QStringLiteral("all"), QStringLiteral("favorites"), QStringLiteral("playing"),
    QStringLiteral("completed"), QStringLiteral("unplayed"), QStringLiteral("mostPlayed")};
const QStringList sorts{QStringLiteral("title"), QStringLiteral("year"), QStringLiteral("recent"), QStringLiteral("mostPlayed")};
const QStringList views{QStringLiteral("grid"), QStringLiteral("list")};

/** Mantém o fallback legado para valores ausentes ou desconhecidos. */
QString allowed(const QJsonValue& value, const QStringList& choices, const QString& fallback) {
    const QString text = value.toString();
    return choices.contains(text) ? text : fallback;
}
}

LibraryFilterStore::LibraryFilterStore(QSqlDatabase& database) : database_(database) {}

bool LibraryFilterStore::load(LibraryFilterState* result, bool* present, QString* error) const {
    if (!result || !present) { if (error) *error = QStringLiteral("Destino das preferências ausente."); return false; }
    AppStateReadDao dao(database_);
    QJsonValue value;
    if (!dao.get(filterKey, &value, error)) return false;
    *present = false;
    if (!value.isObject() || !value.toObject().value("showGamesWithoutCover").isBool()) {
        if (error) error->clear();
        return true;
    }
    const QJsonObject raw = value.toObject();
    LibraryFilterState state;
    state.selectedCategory = raw.value("selectedCategory").toString();
    state.collectionFilter = allowed(raw.value("collectionFilter"), collections, QStringLiteral("all"));
    state.showGamesWithoutCover = raw.value("showGamesWithoutCover").toBool();
    state.sortBy = allowed(raw.value("sortBy"), sorts, QStringLiteral("title"));
    state.viewMode = allowed(raw.value("viewMode"), views, QStringLiteral("grid"));
    *result = state;
    *present = true;
    if (error) error->clear();
    return true;
}

bool LibraryFilterStore::save(const LibraryFilterState& value, QString* error) const {
    if (!collections.contains(value.collectionFilter) || !sorts.contains(value.sortBy) || !views.contains(value.viewMode)) {
        if (error) *error = QStringLiteral("Preferências de biblioteca inválidas.");
        return false;
    }
    AppStateWriteDao dao(database_);
    return dao.set(filterKey, QJsonObject{{"selectedCategory", value.selectedCategory}, {"collectionFilter", value.collectionFilter},
        {"showGamesWithoutCover", value.showGamesWithoutCover}, {"sortBy", value.sortBy}, {"viewMode", value.viewMode}}, error);
}
}
