/** Persiste e mescla pastas legadas sem alterar o schema nem seus campos extras. */
#include "FolderStateStore.h"
#include "dao/AppStateReadDao.h"
#include "dao/AppStateWriteDao.h"
#include <QHash>
#include <QJsonObject>
#include <QSqlError>

namespace gamestock {
namespace {
const QString folderKey = QStringLiteral("gamestock.romImport.folderEntries");

/** Aceita as mesmas entradas mínimas reconhecidas pelo renderer legado. */
bool validFolder(const QJsonValue& value) {
    if (!value.isObject()) return false;
    const QJsonObject folder = value.toObject();
    return folder.value("folderPath").isString() && folder.contains("platformId");
}

/** Reproduz a chave de deduplicação usada pelo renderer no mesmo perfil. */
QString identity(const QJsonObject& folder) {
    const QJsonValue id = folder.value("platformId");
    const QString platform = id.isNull() ? QStringLiteral("null") : id.toVariant().toString();
    return platform + QLatin1Char(':') + folder.value("folderPath").toString();
}
}

FolderStateStore::FolderStateStore(QSqlDatabase& database) : database_(database) {}

bool FolderStateStore::save(const QJsonArray& folders, QString* error) const {
    AppStateWriteDao dao(database_);
    return dao.set(folderKey, folders, error);
}

bool FolderStateStore::merge(const QJsonArray& folders, QString* error) const {
    if (folders.isEmpty()) { if (error) error->clear(); return true; }
    // Leitura e escrita formam uma operação; uma falha não publica mescla parcial.
    if (!database_.transaction()) { if (error) *error = database_.lastError().text(); return false; }
    AppStateReadDao reader(database_);
    QJsonValue current;
    if (!reader.get(folderKey, &current, error)) { database_.rollback(); return false; }
    QJsonArray merged;
    QHash<QString, qsizetype> positions;
    const auto append = [&](const QJsonArray& entries) {
        for (const auto& value : entries) {
            if (!validFolder(value)) continue;
            const QString key = identity(value.toObject());
            const auto it = positions.constFind(key);
            if (it == positions.cend()) { positions.insert(key, merged.size()); merged.append(value); }
            else merged[*it] = value;
        }
    };
    append(current.toArray());
    append(folders);
    if (!save(merged, error)) { database_.rollback(); return false; }
    if (!database_.commit()) {
        if (error) *error = database_.lastError().text();
        database_.rollback();
        return false;
    }
    if (error) error->clear();
    return true;
}

bool FolderStateStore::load(QJsonArray* folders, QString* error) const {
    if (!folders) {
        if (error) *error = QStringLiteral("Destino das pastas ausente.");
        return false;
    }
    AppStateReadDao reader(database_);
    QJsonValue current;
    if (!reader.get(folderKey, &current, error)) return false;
    QJsonArray result;
    for (const auto& value : current.toArray()) {
        if (validFolder(value)) result.append(value);
    }
    *folders = result;
    if (error) error->clear();
    return true;
}

bool FolderStateStore::remove(const QString& folderPath, qint64 platformId, QString* error) const {
    if (!database_.transaction()) {
        if (error) *error = database_.lastError().text();
        return false;
    }
    AppStateReadDao reader(database_);
    QJsonValue current;
    if (!reader.get(folderKey, &current, error)) { database_.rollback(); return false; }
    QJsonArray kept;
    const QJsonObject targetFolder{{QStringLiteral("folderPath"), folderPath},
        {QStringLiteral("platformId"), platformId}};
    const QString target = identity(targetFolder);
    for (const auto& value : current.toArray()) {
        if (!validFolder(value) || identity(value.toObject()) == target) continue;
        kept.append(value);
    }
    if (!save(kept, error)) { database_.rollback(); return false; }
    if (!database_.commit()) {
        if (error) *error = database_.lastError().text();
        database_.rollback();
        return false;
    }
    if (error) error->clear();
    return true;
}
}
