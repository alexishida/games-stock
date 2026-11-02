/** Estado leve do inventário; valores inválidos preservam a preferência anterior. */
#include "InventoryPreferences.h"

#include <QStringList>

namespace gamestock {
InventoryPreferences::InventoryPreferences(QObject* parent) : QObject(parent) {}

void InventoryPreferences::setViewMode(const QString& value) {
    if (value != QLatin1String("grid") && value != QLatin1String("list")) return;
    if (viewMode_ == value) return;
    viewMode_ = value;
    emit changed();
}

void InventoryPreferences::setSearch(const QString& value) {
    if (search_ == value) return;
    search_ = value;
    emit changed();
}

void InventoryPreferences::setSortBy(const QString& value) {
    if (!QStringList{QStringLiteral("name"), QStringLiteral("type"), QStringLiteral("recent")}.contains(value)) return;
    if (sortBy_ == value) return;
    sortBy_ = value;
    emit changed();
}
} // namespace gamestock
