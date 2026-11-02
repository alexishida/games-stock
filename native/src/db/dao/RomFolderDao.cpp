/** Porta das operações de pasta de gameDao.ts, filtrando em memória. */
#include "RomFolderDao.h"

#include <QDir>
#include <QFileInfo>
#include <QSqlError>
#include <QSqlQuery>

namespace gamestock {
RomFolderDao::RomFolderDao(QSqlDatabase& database) : database_(database) {}

QString RomFolderDao::normalizePath(const QString& value) {
    if (value.trimmed().isEmpty()) return {};
    QString normalized = QDir::cleanPath(QFileInfo(value).absoluteFilePath());
#ifdef Q_OS_WIN
    normalized = normalized.toLower();
    // Raiz de drive "C:/" não deve virar "C:".
    if (normalized.size() > 3 && normalized.endsWith(QLatin1Char('/'))) normalized.chop(1);
#else
    if (normalized.size() > 1 && normalized.endsWith(QLatin1Char('/'))) normalized.chop(1);
#endif
    return normalized;
}

bool RomFolderDao::isInside(const QString& normalizedTarget, const QString& normalizedFolder) {
    if (normalizedFolder.isEmpty() || normalizedTarget.isEmpty()) return false;
    if (normalizedTarget == normalizedFolder) return true;
    const QString prefix = normalizedFolder.endsWith(QLatin1Char('/'))
        ? normalizedFolder : normalizedFolder + QLatin1Char('/');
    return normalizedTarget.startsWith(prefix);
}

bool RomFolderDao::countInFolder(const QString& folderPath, qint64 platformId, qint64* count, QString* error) const {
    if (!count) {
        if (error) *error = QStringLiteral("Destino da contagem ausente.");
        return false;
    }
    const QString folder = normalizePath(folderPath);
    QSqlQuery query(database_);
    const QString sql = platformId > 0
        ? QStringLiteral("SELECT rom_path FROM games WHERE platform_id = ? AND rom_path IS NOT NULL AND rom_path != ''")
        : QStringLiteral("SELECT rom_path FROM games WHERE rom_path IS NOT NULL AND rom_path != ''");
    if (!query.prepare(sql)) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (platformId > 0) query.addBindValue(platformId);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    qint64 total = 0;
    while (query.next()) {
        if (isInside(normalizePath(query.value(0).toString()), folder)) ++total;
    }
    *count = total;
    if (error) error->clear();
    return true;
}

bool RomFolderDao::listPathsInFolder(const QString& folderPath, qint64 platformId, QStringList* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino da listagem ausente.");
        return false;
    }
    const QString folder = normalizePath(folderPath);
    QSqlQuery query(database_);
    const QString sql = platformId > 0
        ? QStringLiteral("SELECT rom_path FROM games WHERE platform_id = ? AND rom_path IS NOT NULL AND rom_path != ''")
        : QStringLiteral("SELECT rom_path FROM games WHERE rom_path IS NOT NULL AND rom_path != ''");
    if (!query.prepare(sql)) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (platformId > 0) query.addBindValue(platformId);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QStringList paths;
    while (query.next()) {
        const QString path = query.value(0).toString();
        if (isInside(normalizePath(path), folder)) paths.append(path);
    }
    *result = paths;
    if (error) error->clear();
    return true;
}

bool RomFolderDao::deleteInFolder(const QString& folderPath, qint64 platformId, qint64* deleted, QString* error) const {
    const QString folder = normalizePath(folderPath);
    QSqlQuery query(database_);
    const QString sql = platformId > 0
        ? QStringLiteral("SELECT id, rom_path FROM games WHERE platform_id = ? AND rom_path IS NOT NULL")
        : QStringLiteral("SELECT id, rom_path FROM games WHERE rom_path IS NOT NULL");
    if (!query.prepare(sql)) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (platformId > 0) query.addBindValue(platformId);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<qint64> ids;
    while (query.next()) {
        if (isInside(normalizePath(query.value(1).toString()), folder)) ids.append(query.value(0).toLongLong());
    }
    if (ids.isEmpty()) {
        if (deleted) *deleted = 0;
        if (error) error->clear();
        return true;
    }
    if (!database_.transaction()) {
        if (error) *error = database_.lastError().text();
        return false;
    }
    QSqlQuery remove(database_);
    if (!remove.prepare(QStringLiteral("DELETE FROM games WHERE id = ?"))) {
        if (error) *error = remove.lastError().text();
        database_.rollback();
        return false;
    }
    for (const qint64 id : ids) {
        remove.bindValue(0, id);
        if (!remove.exec()) {
            if (error) *error = remove.lastError().text();
            database_.rollback();
            return false;
        }
    }
    if (!database_.commit()) {
        if (error) *error = database_.lastError().text();
        database_.rollback();
        return false;
    }
    if (deleted) *deleted = ids.size();
    if (error) error->clear();
    return true;
}
} // namespace gamestock
