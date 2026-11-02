/** Implementação da portabilidade; SQL fica no DAO e o ZIP na camada de arquivo. */
#include "BackupService.h"

#include "db/dao/PortabilityDao.h"
#include "portability/PortableManifest.h"

#include <QDateTime>
#include <QDir>
#include <QDirIterator>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSet>
#include <QSqlError>
#include <QStorageInfo>
#include <QUuid>

namespace gamestock {
namespace {
/** Extensões de imagem aceitas no pacote, iguais ao exporter Electron. */
const QSet<QString>& imageExtensions() {
    static const QSet<QString> extensions{
        QStringLiteral("avif"), QStringLiteral("bmp"), QStringLiteral("gif"), QStringLiteral("heic"),
        QStringLiteral("heif"), QStringLiteral("ico"), QStringLiteral("jpeg"), QStringLiteral("jpg"),
        QStringLiteral("png"), QStringLiteral("svg"), QStringLiteral("tif"), QStringLiteral("tiff"),
        QStringLiteral("webp")};
    return extensions;
}

/** Limites de leitura de dados JSON e extração de mídia. */
constexpr qint64 kJsonLimit = 64 * 1024 * 1024;
constexpr qint64 kMediaEntryLimit = 2LL * 1024 * 1024 * 1024;
constexpr qint64 kMediaTotalLimit = 16LL * 1024 * 1024 * 1024;

/** Backup canônico; extensão é acrescentada quando ausente. */
QString ensureBackupExtension(QString path) {
    path = path.trimmed();
    return path.toLower().endsWith(QStringLiteral(".gamestock-backup"))
        ? path : path + QStringLiteral(".gamestock-backup");
}

/** Arquivo parcial no mesmo volume, evitando destino truncado em falha. */
QString partialPath(const QString& finalPath) {
    const QFileInfo info(finalPath);
    return info.absolutePath() + QLatin1Char('/') + QLatin1Char('.') + info.fileName()
        + QStringLiteral(".partial-") + QUuid::createUuid().toString(QUuid::WithoutBraces);
}

/** Lista imagens recursivamente, com caminho relativo estável para o pacote. */
QList<QVariantMap> listImageFiles(const QString& root) {
    QList<QVariantMap> files;
    if (root.isEmpty() || !QDir(root).exists()) return files;
    QDirIterator iterator(root, QDir::Files | QDir::NoDotAndDotDot, QDirIterator::Subdirectories);
    while (iterator.hasNext()) {
        const QString path = iterator.next();
        const QFileInfo info(path);
        if (!imageExtensions().contains(info.suffix().toLower())) continue;
        QString relative = QDir(root).relativeFilePath(path);
        relative.replace(QLatin1Char('\\'), QLatin1Char('/'));
        if (relative.isEmpty() || relative.startsWith(QStringLiteral("../"))) continue;
        files.append(QVariantMap{{QStringLiteral("relativePath"), relative},
            {QStringLiteral("sourcePath"), info.absoluteFilePath()},
            {QStringLiteral("size"), info.size()}});
    }
    std::sort(files.begin(), files.end(), [](const QVariantMap& left, const QVariantMap& right) {
        return QString::compare(left.value(QStringLiteral("relativePath")).toString(),
            right.value(QStringLiteral("relativePath")).toString(), Qt::CaseInsensitive) < 0;
    });
    return files;
}

/** Categorias com rótulo humano para avisos. */
QString categoryLabel(const QString& category) {
    if (category == QLatin1String("metadata")) return QStringLiteral("metadados");
    if (category == QLatin1String("images")) return QStringLiteral("imagens");
    if (category == QLatin1String("platforms")) return QStringLiteral("plataformas");
    if (category == QLatin1String("romLocations")) return QStringLiteral("localizações de ROM");
    if (category == QLatin1String("inventoryImages")) return QStringLiteral("inventário");
    return category;
}
} // namespace

struct BackupService::Loaded {
    QString packagePath;
    ZipReader zip;
    PortableManifest manifest;
    QList<QVariantMap> games;
    QList<QVariantMap> mediaMap;
    QList<QVariantMap> platforms;
    QList<QVariantMap> aliases;
    QList<QVariantMap> romExtensions;
    QList<QVariantMap> emulators;
    QList<QVariantMap> platformEmulators;
    QList<QVariantMap> romLocations;
    QList<QVariantMap> romFolderEntries;
    QVariantMap inventory;
};

BackupService::BackupService(QObject* parent) : QObject(parent) {}

bool BackupService::open(const QString& databasePath, const QString& profileRoot, const QString& appVersion,
    QString* error) {
    QString localError;
    if (!connection_.open(databasePath, &localError)) {
        error_ = localError;
        if (error) *error = localError;
        emit changed();
        return false;
    }
    profileRoot_ = profileRoot;
    appVersion_ = appVersion;
    open_ = true;
    error_.clear();
    emit changed();
    if (error) error->clear();
    return true;
}

QStringList BackupService::categories() const { return portableCategories(); }

QString BackupService::imagesDir() const { return QDir(profileRoot_).filePath(QStringLiteral("images")); }
QString BackupService::inventoryImagesDir() const {
    return QDir(profileRoot_).filePath(QStringLiteral("inventario/images"));
}

QString BackupService::normalizedLookupPath(const QString& path) {
    QString clean = QDir::cleanPath(QFileInfo(path).absoluteFilePath());
#ifdef Q_OS_WIN
    clean = clean.toLower();
#endif
    return clean;
}

QString BackupService::relativeInside(const QString& root, const QString& path) {
    const QString cleanRoot = QDir::cleanPath(QFileInfo(root).absoluteFilePath());
    const QString cleanPath = QDir::cleanPath(QFileInfo(path).absoluteFilePath());
#ifdef Q_OS_WIN
    constexpr auto comparison = Qt::CaseInsensitive;
#else
    constexpr auto comparison = Qt::CaseSensitive;
#endif
    if (cleanPath == cleanRoot) return {};
    const QString prefix = cleanRoot.endsWith(QLatin1Char('/')) ? cleanRoot : cleanRoot + QLatin1Char('/');
    if (!cleanPath.startsWith(prefix, comparison)) return {};
    return cleanPath.mid(prefix.size());
}

QString BackupService::resolveInside(const QString& root, const QString& relative, bool* ok) const {
    QString normalized = relative;
    normalized.replace(QLatin1Char('\\'), QLatin1Char('/'));
    const QStringList parts = normalized.split(QLatin1Char('/'));
    for (const QString& part : parts) {
        if (part == QLatin1String("..") || part.contains(QLatin1Char(':'))) {
            if (ok) *ok = false;
            return {};
        }
    }
    const QString target = QDir(root).filePath(normalized);
    const bool inside = !relativeInside(root, target).isEmpty();
    if (ok) *ok = inside;
    return inside ? QDir::cleanPath(target) : QString();
}

QVariantMap BackupService::warningEntry(const QString& code, const QString& message, const QString& path) {
    QVariantMap entry{{QStringLiteral("code"), code}, {QStringLiteral("message"), message},
        {QStringLiteral("severity"), QStringLiteral("warning")}};
    if (!path.isEmpty()) entry.insert(QStringLiteral("path"), path);
    return entry;
}

QVariantMap BackupService::errorMap(const QString& message, const QVariantList& errors) {
    return QVariantMap{{QStringLiteral("success"), false}, {QStringLiteral("error"), message},
        {QStringLiteral("errors"), errors}};
}

void BackupService::report(int current, int total, const QString& stage, const QString& message) {
    emit progress(QVariantMap{{QStringLiteral("current"), current}, {QStringLiteral("total"), qMax(1, total)},
        {QStringLiteral("stage"), stage}, {QStringLiteral("message"), message}});
}

bool BackupService::writeJson(CompatibleZipWriter& writer, const QString& entryName, const QVariant& value,
    QString* error) const {
    const QJsonDocument document = QJsonDocument::fromVariant(value);
    if (document.isNull()) {
        if (error) *error = QStringLiteral("Não foi possível serializar %1.").arg(entryName);
        return false;
    }
    QByteArray json = document.toJson(QJsonDocument::Indented);
    json.append('\n');
    return writer.addData(entryName, json, error);
}

bool BackupService::readJson(Loaded& loaded, const QString& entryName, bool required, QVariant* value,
    QString* error, QVariantList* warnings) const {
    if (!loaded.zip.contains(entryName)) {
        if (required) {
            if (error) *error = QStringLiteral("Pacote inválido: %1 ausente").arg(entryName);
            return false;
        }
        if (value) *value = QVariant();
        if (warnings) warnings->append(warningEntry(QStringLiteral("missing-optional-entry"),
            QStringLiteral("Pacote sem %1").arg(entryName)));
        return true;
    }
    QByteArray bytes;
    QString localError;
    if (!loaded.zip.readEntry(entryName, kJsonLimit, &bytes, &localError)) {
        if (error) *error = localError.isEmpty()
            ? QStringLiteral("Falha ao ler %1.").arg(entryName) : localError;
        return false;
    }
    QJsonParseError parseError;
    const QJsonDocument document = QJsonDocument::fromJson(bytes, &parseError);
    if (parseError.error != QJsonParseError::NoError) {
        if (error) *error = QStringLiteral("%1 não é JSON válido.").arg(entryName);
        return false;
    }
    if (value) *value = document.toVariant();
    if (error) error->clear();
    return true;
}

bool BackupService::load(const QString& packagePath, Loaded* loaded, QString* error) {
    if (!loaded) {
        if (error) *error = QStringLiteral("Destino do pacote ausente.");
        return false;
    }
    const QString path = packagePath.trimmed();
    if (path.isEmpty()) {
        if (error) *error = QStringLiteral("Informe o caminho do pacote.");
        return false;
    }
    if (!QFileInfo(path).isFile()) {
        if (error) *error = QStringLiteral("Pacote não encontrado.");
        return false;
    }
    if (!loaded->zip.open(path, error)) {
        if (error && error->isEmpty()) *error = QStringLiteral("Pacote inválido ou corrompido.");
        return false;
    }
    loaded->packagePath = path;

    QVariant manifestValue;
    if (!readJson(*loaded, QStringLiteral("manifest.json"), true, &manifestValue, error, nullptr)) return false;
    const QByteArray manifestJson = QJsonDocument::fromVariant(manifestValue).toJson(QJsonDocument::Compact);
    if (!readPortableManifest(manifestJson, &loaded->manifest, error)) return false;

    QVariant value;
    loaded->games.clear();
    if (!readJson(*loaded, QStringLiteral("data/games.json"), false, &value, error, nullptr)) return false;
    for (const QVariant& entry : value.toList()) loaded->games.append(entry.toMap());

    loaded->mediaMap.clear();
    if (!readJson(*loaded, QStringLiteral("data/mediaMap.json"), false, &value, error, nullptr)) return false;
    for (const QVariant& entry : value.toList()) loaded->mediaMap.append(entry.toMap());

    loaded->platforms.clear();
    if (!readJson(*loaded, QStringLiteral("data/platforms.json"), false, &value, error, nullptr)) return false;
    for (const QVariant& entry : value.toList()) loaded->platforms.append(entry.toMap());

    QVariant mappings;
    loaded->aliases.clear();
    loaded->romExtensions.clear();
    if (!readJson(*loaded, QStringLiteral("data/platformMappings.json"), false, &mappings, error, nullptr)) return false;
    for (const QVariant& entry : mappings.toMap().value(QStringLiteral("aliases")).toList()) {
        loaded->aliases.append(entry.toMap());
    }
    for (const QVariant& entry : mappings.toMap().value(QStringLiteral("romExtensions")).toList()) {
        loaded->romExtensions.append(entry.toMap());
    }

    QVariant emulators;
    loaded->emulators.clear();
    loaded->platformEmulators.clear();
    if (!readJson(*loaded, QStringLiteral("data/emulators.json"), false, &emulators, error, nullptr)) return false;
    for (const QVariant& entry : emulators.toMap().value(QStringLiteral("emulators")).toList()) {
        loaded->emulators.append(entry.toMap());
    }
    for (const QVariant& entry : emulators.toMap().value(QStringLiteral("platformEmulators")).toList()) {
        loaded->platformEmulators.append(entry.toMap());
    }

    QVariant romLocations;
    loaded->romLocations.clear();
    loaded->romFolderEntries.clear();
    if (!readJson(*loaded, QStringLiteral("data/romLocations.json"), false, &romLocations, error, nullptr)) return false;
    for (const QVariant& entry : romLocations.toMap().value(QStringLiteral("games")).toList()) {
        loaded->romLocations.append(entry.toMap());
    }
    for (const QVariant& entry : romLocations.toMap().value(QStringLiteral("romFolderEntries")).toList()) {
        const QVariantMap folder = entry.toMap();
        if (folder.value(QStringLiteral("folderPath")).toString().trimmed().isEmpty()) continue;
        QVariantMap normalized = folder;
        normalized.insert(QStringLiteral("platformId"), folder.value(QStringLiteral("platformId")).toLongLong());
        normalized.insert(QStringLiteral("platformName"),
            folder.value(QStringLiteral("platformName")).toString().isEmpty()
                ? QStringLiteral("Plataforma") : folder.value(QStringLiteral("platformName")));
        normalized.insert(QStringLiteral("indexedCount"), folder.value(QStringLiteral("indexedCount")).toInt());
        normalized.insert(QStringLiteral("includeSubfolders"), folder.value(QStringLiteral("includeSubfolders")).toBool());
        loaded->romFolderEntries.append(normalized);
    }

    QVariant inventory;
    loaded->inventory = QVariantMap{{QStringLiteral("itemTypes"), QVariantList{}},
        {QStringLiteral("conservationStates"), QVariantList{}}, {QStringLiteral("items"), QVariantList{}},
        {QStringLiteral("photos"), QVariantList{}}};
    if (!readJson(*loaded, QStringLiteral("data/inventory.json"), false, &inventory, error, nullptr)) return false;
    if (inventory.isValid() && inventory.canConvert<QVariantMap>()) loaded->inventory = inventory.toMap();
    if (error) error->clear();
    return true;
}

QStringList BackupService::detectCategories(const Loaded& loaded) const {
    QStringList detected;
    if (loaded.zip.contains(QStringLiteral("data/games.json"))) detected.append(QStringLiteral("metadata"));
    if (loaded.zip.contains(QStringLiteral("data/mediaMap.json"))) detected.append(QStringLiteral("images"));
    else {
        for (const QString& path : loaded.zip.paths()) {
            if (path.startsWith(QStringLiteral("media/"))) {
                detected.append(QStringLiteral("images"));
                break;
            }
        }
    }
    if (loaded.zip.contains(QStringLiteral("data/platforms.json"))
        || loaded.zip.contains(QStringLiteral("data/platformMappings.json"))
        || loaded.zip.contains(QStringLiteral("data/emulators.json"))) {
        detected.append(QStringLiteral("platforms"));
    }
    if (loaded.zip.contains(QStringLiteral("data/romLocations.json"))) detected.append(QStringLiteral("romLocations"));
    if (loaded.zip.contains(QStringLiteral("data/inventory.json"))) detected.append(QStringLiteral("inventoryImages"));
    else {
        for (const QString& path : loaded.zip.paths()) {
            if (path.startsWith(QStringLiteral("inventory-media/"))) {
                detected.append(QStringLiteral("inventoryImages"));
                break;
            }
        }
    }
    return detected;
}

bool BackupService::validate(const Loaded& loaded, QVariantList* warnings, QVariantList* errors,
    QString* error) const {
    QVariantList localWarnings;
    QVariantList localErrors;
    const QStringList detected = detectCategories(loaded);
    const QStringList categories = loaded.manifest.categories;

    if (categories.contains(QStringLiteral("metadata"))
        && !loaded.zip.contains(QStringLiteral("data/games.json"))) {
        localErrors.append(warningEntry(QStringLiteral("missing-games-data"),
            QStringLiteral("Pacote sem data/games.json")));
    }
    if (categories.contains(QStringLiteral("platforms"))) {
        if (!loaded.zip.contains(QStringLiteral("data/platforms.json"))) {
            localErrors.append(warningEntry(QStringLiteral("missing-platforms-data"),
                QStringLiteral("Pacote sem data/platforms.json")));
        }
        if (!loaded.zip.contains(QStringLiteral("data/platformMappings.json"))) {
            localWarnings.append(warningEntry(QStringLiteral("missing-platform-mappings"),
                QStringLiteral("Pacote sem mapeamentos de plataformas")));
        }
        if (!loaded.zip.contains(QStringLiteral("data/emulators.json"))) {
            localWarnings.append(warningEntry(QStringLiteral("missing-emulators"),
                QStringLiteral("Pacote sem dados de emuladores")));
        }
    }
    if (categories.contains(QStringLiteral("images"))) {
        if (!loaded.zip.contains(QStringLiteral("data/mediaMap.json"))) {
            localErrors.append(warningEntry(QStringLiteral("missing-media-map"),
                QStringLiteral("Pacote sem data/mediaMap.json")));
        }
        for (const QVariantMap& media : loaded.mediaMap) {
            const QString packagePath = media.value(QStringLiteral("packagePath")).toString();
            if (!packagePath.isEmpty() && !loaded.zip.contains(packagePath)) {
                localErrors.append(warningEntry(QStringLiteral("missing-media-entry"),
                    QStringLiteral("Mídia ausente no pacote: %1").arg(packagePath), packagePath));
            }
        }
    }
    if (categories.contains(QStringLiteral("romLocations"))) {
        if (!loaded.zip.contains(QStringLiteral("data/romLocations.json"))) {
            localErrors.append(warningEntry(QStringLiteral("missing-rom-locations-data"),
                QStringLiteral("Pacote sem data/romLocations.json")));
        }
        for (const QVariantMap& rom : loaded.romLocations) {
            const QString path = rom.value(QStringLiteral("rom_path")).toString();
            if (!path.isEmpty() && !QFileInfo::exists(path)) {
                localWarnings.append(warningEntry(QStringLiteral("missing-rom-path"),
                    QStringLiteral("ROM não encontrada no disco atual: %1").arg(QFileInfo(path).fileName()), path));
            }
        }
        for (const QVariantMap& folder : loaded.romFolderEntries) {
            const QString path = folder.value(QStringLiteral("folderPath")).toString();
            if (!path.isEmpty() && !QDir(path).exists()) {
                localWarnings.append(warningEntry(QStringLiteral("missing-rom-folder"),
                    QStringLiteral("Pasta de ROMs não encontrada: %1").arg(path), path));
            }
        }
    }
    if (categories.contains(QStringLiteral("inventoryImages"))
        && !loaded.zip.contains(QStringLiteral("data/inventory.json"))) {
        localErrors.append(warningEntry(QStringLiteral("missing-inventory-data"),
            QStringLiteral("Pacote sem data/inventory.json")));
    }
    for (const QString& category : detected) {
        if (!categories.contains(category)) {
            localWarnings.append(warningEntry(QStringLiteral("manifest-category-missing"),
                QStringLiteral("Pacote contém dados de %1, mas a categoria não está no manifesto.")
                    .arg(categoryLabel(category))));
        }
    }
    for (const QString& category : categories) {
        if (!detected.contains(category)) {
            localWarnings.append(warningEntry(QStringLiteral("manifest-category-without-data"),
                QStringLiteral("Manifesto lista %1, mas os dados não foram encontrados no pacote.")
                    .arg(categoryLabel(category))));
        }
    }
    if (warnings) *warnings = localWarnings;
    if (errors) *errors = localErrors;
    if (error) error->clear();
    return true;
}

QVariantMap BackupService::previewCounts(const Loaded& loaded, const QStringList& categories) const {
    QVariantMap counts = loaded.manifest.counts;
    if (categories.contains(QStringLiteral("metadata"))) counts.insert(QStringLiteral("games"), loaded.games.size());
    if (categories.contains(QStringLiteral("platforms"))) {
        counts.insert(QStringLiteral("platforms"), loaded.platforms.size());
        counts.insert(QStringLiteral("emulators"), loaded.emulators.size());
    }
    if (categories.contains(QStringLiteral("images"))) {
        int mediaFiles = 0;
        for (const QString& path : loaded.zip.paths()) {
            if (path.startsWith(QStringLiteral("media/"))) mediaFiles += 1;
        }
        counts.insert(QStringLiteral("images"), mediaFiles);
    }
    if (categories.contains(QStringLiteral("romLocations"))) {
        counts.insert(QStringLiteral("romLocations"), loaded.romLocations.size());
        counts.insert(QStringLiteral("romFolderEntries"), loaded.romFolderEntries.size());
    }
    if (categories.contains(QStringLiteral("inventoryImages"))) {
        counts.insert(QStringLiteral("inventoryItems"), loaded.inventory.value(QStringLiteral("items")).toList().size());
        counts.insert(QStringLiteral("inventoryPhotos"), loaded.inventory.value(QStringLiteral("photos")).toList().size());
    }
    return counts;
}

QVariantMap BackupService::preview(const QString& packagePath) {
    if (!open_) return errorMap(QStringLiteral("Banco de backup indisponível."));
    Loaded loaded;
    QString error;
    if (!load(packagePath, &loaded, &error)) return errorMap(error);
    QVariantList warnings;
    QVariantList errors;
    if (!validate(loaded, &warnings, &errors, &error)) return errorMap(error);
    PortabilityDao dao(connection_.database());
    QVariantMap conflicts;
    QVariantMap value;
    dao.countGameConflicts(loaded.games, &value, &error);
    conflicts.insert(QStringLiteral("games"), value);
    value = {};
    dao.countPlatformConflicts(loaded.platforms, &value, &error);
    conflicts.insert(QStringLiteral("platforms"), value);
    value = {};
    dao.countEmulatorConflicts(loaded.emulators, &value, &error);
    conflicts.insert(QStringLiteral("emulators"), value);

    const QStringList available = detectCategories(loaded);
    error_.clear();
    return QVariantMap{{QStringLiteral("success"), true},
        {QStringLiteral("packagePath"), loaded.packagePath},
        {QStringLiteral("manifest"), QVariantMap{{QStringLiteral("schemaVersion"), loaded.manifest.schemaVersion},
            {QStringLiteral("appVersion"), loaded.manifest.appVersion},
            {QStringLiteral("createdAt"), loaded.manifest.createdAt},
            {QStringLiteral("categories"), loaded.manifest.categories},
            {QStringLiteral("counts"), loaded.manifest.counts}}},
        {QStringLiteral("availableCategories"), available},
        {QStringLiteral("counts"), previewCounts(loaded, available)},
        {QStringLiteral("warnings"), warnings}, {QStringLiteral("errors"), errors},
        {QStringLiteral("conflicts"), conflicts}};
}

bool BackupService::exportImages(CompatibleZipWriter& writer, QVariantList* mediaMap, QVariantList* warnings,
    QString* error) {
    const QList<QVariantMap> files = listImageFiles(imagesDir());
    QHash<QString, QVariantMap> bySource;
    for (const QVariantMap& file : files) {
        const QString relative = file.value(QStringLiteral("relativePath")).toString();
        const QString packagePath = QStringLiteral("media/") + relative;
        if (!writer.addFile(packagePath, file.value(QStringLiteral("sourcePath")).toString(), error)) {
            return false;
        }
        bySource.insert(normalizedLookupPath(file.value(QStringLiteral("sourcePath")).toString()), file);
    }
    PortabilityDao dao(connection_.database());
    QList<QVariantMap> refs;
    if (!dao.listMediaReferences(&refs, error)) return false;
    for (const QVariantMap& ref : refs) {
        const QString source = ref.value(QStringLiteral("sourcePath")).toString();
        const auto found = bySource.constFind(normalizedLookupPath(source));
        if (found == bySource.constEnd()) {
            if (warnings) {
                warnings->append(warningEntry(QStringLiteral("missing-image"),
                    QStringLiteral("Imagem não encontrada: %1").arg(QFileInfo(source).fileName()), source));
            }
            continue;
        }
        QVariantMap entry = ref;
        const QVariantMap file = found.value();
        entry.insert(QStringLiteral("packagePath"),
            QStringLiteral("media/") + file.value(QStringLiteral("relativePath")).toString());
        entry.insert(QStringLiteral("relativePath"), file.value(QStringLiteral("relativePath")));
        entry.insert(QStringLiteral("originalPath"), source);
        entry.insert(QStringLiteral("size"), file.value(QStringLiteral("size")));
        mediaMap->append(entry);
    }
    return true;
}

QVariantMap BackupService::exportPackage(const QVariantMap& request) {
    if (!open_) return errorMap(QStringLiteral("Banco de backup indisponível."));
    QStringList requested;
    for (const QVariant& value : request.value(QStringLiteral("categories")).toList()) {
        requested.append(value.toString());
    }
    QStringList selected;
    QString error;
    if (!normalizePortableCategories(requested, &selected, &error)) return errorMap(error);

    const QString requestedTarget = request.value(QStringLiteral("targetPath")).toString().trimmed();
    if (requestedTarget.isEmpty()) return errorMap(QStringLiteral("Informe o destino do backup."));
    const QString targetPath = ensureBackupExtension(requestedTarget);
    if (!QDir().mkpath(QFileInfo(targetPath).absolutePath())) {
        return errorMap(QStringLiteral("Não foi possível criar o diretório de destino."));
    }

    PortabilityDao dao(connection_.database());
    QVariantList games;
    QVariantList platforms;
    QVariantList aliases;
    QVariantList extensions;
    QVariantList emulators;
    QVariantList platformEmulators;
    QVariantList romLocations;
    QVariantList inventoryItems;
    QVariantList inventoryPhotos;
    QVariantMap inventoryBundle;
    QVariantMap counts;
    QVariantList warnings;

    if (selected.contains(QStringLiteral("metadata"))) {
        QList<QVariantMap> rows;
        if (!dao.listGameMetadata(&rows, &error)) return errorMap(error);
        for (const QVariantMap& row : rows) games.append(row);
        counts.insert(QStringLiteral("games"), rows.size());
    }
    if (selected.contains(QStringLiteral("platforms"))) {
        QList<QVariantMap> rows;
        if (!dao.listPlatforms(&rows, &error)) return errorMap(error);
        for (const QVariantMap& row : rows) platforms.append(row);
        if (!dao.listPlatformAliases(&rows, &error)) return errorMap(error);
        for (const QVariantMap& row : rows) aliases.append(row);
        if (!dao.listRomExtensions(&rows, &error)) return errorMap(error);
        for (const QVariantMap& row : rows) extensions.append(row);
        if (!dao.listEmulators(&rows, &error)) return errorMap(error);
        for (const QVariantMap& row : rows) emulators.append(row);
        if (!dao.listPlatformEmulators(&rows, &error)) return errorMap(error);
        for (const QVariantMap& row : rows) platformEmulators.append(row);
        counts.insert(QStringLiteral("platforms"), platforms.size());
        counts.insert(QStringLiteral("emulators"), emulators.size());
    }
    if (selected.contains(QStringLiteral("romLocations"))) {
        QList<QVariantMap> rows;
        if (!dao.listRomLocations(&rows, &error)) return errorMap(error);
        for (const QVariantMap& row : rows) romLocations.append(row);
        QVariantList folders = request.value(QStringLiteral("romFolderEntries")).toList();
        counts.insert(QStringLiteral("romLocations"), romLocations.size());
        counts.insert(QStringLiteral("romFolderEntries"), folders.size());
        // O bucket de pastas acompanha o JSON, como no pacote Electron.
        QVariantMap romData{{QStringLiteral("games"), romLocations}, {QStringLiteral("romFolderEntries"), folders}};
        romLocations = QVariantList{romData};
    }
    if (selected.contains(QStringLiteral("inventoryImages"))) {
        if (!dao.listInventoryData(&inventoryBundle, &error)) return errorMap(error);
        inventoryItems = inventoryBundle.value(QStringLiteral("items")).toList();
        inventoryPhotos = inventoryBundle.value(QStringLiteral("photos")).toList();
        counts.insert(QStringLiteral("inventoryItems"), inventoryItems.size());
        counts.insert(QStringLiteral("inventoryPhotos"), inventoryPhotos.size());
    }

    const QList<QVariantMap> mediaFiles = selected.contains(QStringLiteral("images")) ? listImageFiles(imagesDir()) : QList<QVariantMap>{};
    const QList<QVariantMap> inventoryFiles = selected.contains(QStringLiteral("inventoryImages"))
        ? listImageFiles(inventoryImagesDir()) : QList<QVariantMap>{};
    const int total = qMax(1, selected.size() + mediaFiles.size() + inventoryFiles.size() + 2);
    int current = 0;
    report(0, total, QStringLiteral("preparing"), QStringLiteral("Preparando exportação"));

    const QString partial = partialPath(targetPath);
    // Espaço mínimo: soma dos arquivos + folga para cabeçalhos e manifesto.
    qint64 required = 1024 * 1024;
    for (const QVariantMap& file : mediaFiles) required += file.value(QStringLiteral("size")).toLongLong();
    for (const QVariantMap& file : inventoryFiles) required += file.value(QStringLiteral("size")).toLongLong();
    const QStorageInfo storage(QFileInfo(targetPath).absolutePath());
    if (storage.isValid() && storage.bytesAvailable() > 0 && storage.bytesAvailable() < required) {
        return errorMap(QStringLiteral("Espaço insuficiente no destino para o backup."));
    }
    CompatibleZipWriter writer;
    if (!writer.open(partial, false, &error)) return errorMap(error);

    const auto fail = [&](const QString& message) {
        writer.finish(nullptr);
        QFile::remove(partial);
        return errorMap(message);
    };

    if (selected.contains(QStringLiteral("metadata"))) {
        if (!writeJson(writer, QStringLiteral("data/games.json"), games, &error)) return fail(error);
        report(++current, total, QStringLiteral("metadata"),
            QStringLiteral("%1 jogo(s) adicionados ao pacote").arg(games.size()));
    }
    if (selected.contains(QStringLiteral("platforms"))) {
        if (!writeJson(writer, QStringLiteral("data/platforms.json"), platforms, &error)) return fail(error);
        if (!writeJson(writer, QStringLiteral("data/platformMappings.json"),
                QVariantMap{{QStringLiteral("aliases"), aliases}, {QStringLiteral("romExtensions"), extensions}},
                &error)) return fail(error);
        if (!writeJson(writer, QStringLiteral("data/emulators.json"),
                QVariantMap{{QStringLiteral("emulators"), emulators},
                    {QStringLiteral("platformEmulators"), platformEmulators}}, &error)) return fail(error);
        report(++current, total, QStringLiteral("platforms"),
            QStringLiteral("%1 plataforma(s) adicionadas ao pacote").arg(platforms.size()));
    }
    if (selected.contains(QStringLiteral("images"))) {
        QVariantList mediaMap;
        if (!exportImages(writer, &mediaMap, &warnings, &error)) return fail(error);
        if (!writeJson(writer, QStringLiteral("data/mediaMap.json"), mediaMap, &error)) return fail(error);
        counts.insert(QStringLiteral("images"), mediaFiles.size());
        current += mediaFiles.size();
        report(current, total, QStringLiteral("images"),
            QStringLiteral("%1 imagem(ns) adicionada(s)").arg(mediaFiles.size()));
    }
    if (selected.contains(QStringLiteral("romLocations"))) {
        if (!writeJson(writer, QStringLiteral("data/romLocations.json"), romLocations.first(), &error)) return fail(error);
        report(++current, total, QStringLiteral("rom_locations"),
            QStringLiteral("Localizações de ROM adicionadas"));
    }
    if (selected.contains(QStringLiteral("inventoryImages"))) {
        for (const QVariantMap& file : inventoryFiles) {
            const QString entry = QStringLiteral("inventory-media/") + file.value(QStringLiteral("relativePath")).toString();
            if (!writer.addFile(entry, file.value(QStringLiteral("sourcePath")).toString(), &error)) return fail(error);
            report(++current, total, QStringLiteral("inventoryImages"),
                QStringLiteral("Foto de inventário: %1").arg(file.value(QStringLiteral("relativePath")).toString()));
        }
        if (!writeJson(writer, QStringLiteral("data/inventory.json"), inventoryBundle, &error)) return fail(error);
    }
    PortableManifest manifest;
    manifest.schemaVersion = kPortableSchemaVersion;
    manifest.appVersion = appVersion_;
    manifest.createdAt = QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs);
    manifest.categories = selected;
    manifest.counts = counts;
    if (!writeJson(writer, QStringLiteral("manifest.json"),
            QVariantMap{{QStringLiteral("schemaVersion"), manifest.schemaVersion},
                {QStringLiteral("appVersion"), manifest.appVersion},
                {QStringLiteral("createdAt"), manifest.createdAt},
                {QStringLiteral("categories"), manifest.categories},
                {QStringLiteral("counts"), manifest.counts}}, &error)) return fail(error);
    report(++current, total, QStringLiteral("writing"), QStringLiteral("Gravando pacote"));

    if (!writer.finish(&error)) return fail(error);
    // Valida o pacote antes de substituir o destino final.
    ZipReader verify;
    QString verifyError;
    QByteArray manifestBytes;
    if (!verify.open(partial, &verifyError)) {
        QFile::remove(partial);
        return errorMap(verifyError);
    }
    PortableManifest verifiedManifest;
    if (!verify.readEntry(QStringLiteral("manifest.json"), kJsonLimit, &manifestBytes, &verifyError)
        || !readPortableManifest(manifestBytes, &verifiedManifest, &verifyError)) {
        QFile::remove(partial);
        return errorMap(verifyError);
    }
    QFile::remove(targetPath);
    if (!QFile::rename(partial, targetPath)) {
        QFile::remove(partial);
        return errorMap(QStringLiteral("Não foi possível concluir o arquivo de backup."));
    }
    lastPackagePath_ = targetPath;
    error_.clear();
    emit changed();
    report(total, total, QStringLiteral("done"), QStringLiteral("Exportação concluída"));
    return QVariantMap{{QStringLiteral("success"), true}, {QStringLiteral("filePath"), targetPath},
        {QStringLiteral("manifest"), QVariantMap{{QStringLiteral("schemaVersion"), manifest.schemaVersion},
            {QStringLiteral("appVersion"), manifest.appVersion},
            {QStringLiteral("createdAt"), manifest.createdAt},
            {QStringLiteral("categories"), manifest.categories},
            {QStringLiteral("counts"), manifest.counts}}},
        {QStringLiteral("warnings"), warnings}};
}

namespace {
/** Move arquivos preparados no staging para o destino final, criando diretórios. */
bool moveStagedFile(const QString& staged, const QString& finalPath, QString* error) {
    if (!QDir().mkpath(QFileInfo(finalPath).absolutePath())) {
        if (error) *error = QStringLiteral("Não foi possível preparar o diretório de mídia.");
        return false;
    }
    if (QFile::rename(staged, finalPath)) return true;
    if (QFile::copy(staged, finalPath)) {
        QFile::remove(staged);
        return true;
    }
    if (error) *error = QStringLiteral("Falha ao mover mídia para o perfil.");
    return false;
}

/** Aplica os arquivos do staging, guardando originais para rollback. */
bool applyStaged(const QList<QPair<QString, QString>>& moves, const QString& backupRoot,
    QList<QString>* applied, QList<QPair<QString, QString>>* backups, QString* error) {
    QSet<QString> seen;
    int backupIndex = 0;
    for (const auto& move : moves) {
        const QString finalPath = QDir::cleanPath(move.second);
        if (seen.contains(finalPath)) continue;
        seen.insert(finalPath);
        if (!QFileInfo::exists(move.first)) {
            if (error) *error = QStringLiteral("Mídia preparada ausente no staging.");
            return false;
        }
        if (QFileInfo::exists(finalPath)) {
            const QString backupPath = QDir(backupRoot).filePath(
                QString::number(backupIndex++) + QLatin1Char('-') + QFileInfo(finalPath).fileName());
            if (!QDir().mkpath(QFileInfo(backupPath).absolutePath()) || !QFile::rename(finalPath, backupPath)) {
                if (error) *error = QStringLiteral("Não foi possível preservar a mídia existente.");
                return false;
            }
            backups->append({backupPath, finalPath});
        }
        if (!moveStagedFile(move.first, finalPath, error)) return false;
        applied->append(finalPath);
    }
    return true;
}

/** Desfaz arquivos movidos e restaura os originais guardados no staging. */
void undoStaged(const QList<QString>& applied, const QList<QPair<QString, QString>>& backups) {
    for (auto it = applied.crbegin(); it != applied.crend(); ++it) QFile::remove(*it);
    for (auto it = backups.crbegin(); it != backups.crend(); ++it) {
        QDir().mkpath(QFileInfo(it->second).absolutePath());
        QFile::rename(it->first, it->second);
    }
}
} // namespace

bool BackupService::importMedia(Loaded& loaded, const QString& stagingRoot, QVariantMap* summary,
    QList<QPair<QString, QString>>* moves, QString* error) {
    QVariantMap images{{QStringLiteral("imported"), 0}, {QStringLiteral("skipped"), 0},
        {QStringLiteral("missing"), 0}};
    const QString staging = QDir(stagingRoot).filePath(QStringLiteral("media"));
    QList<QPair<QString, QString>> extracted;
    if (!loaded.zip.extractPrefix(QStringLiteral("media/"), staging, kMediaEntryLimit, kMediaTotalLimit,
            &extracted, error)) return false;
    QHash<QString, QString> stagedByEntry;
    QSet<QString> finalPaths;
    for (const auto& pair : extracted) {
        const QString relative = pair.first.mid(QStringLiteral("media/").size());
        bool ok = false;
        const QString finalPath = resolveInside(imagesDir(), relative, &ok);
        if (!ok) {
            if (error) *error = QStringLiteral("Caminho de mídia inválido no pacote.");
            return false;
        }
        stagedByEntry.insert(pair.first, pair.second);
        moves->append({pair.second, finalPath});
        finalPaths.insert(QDir::cleanPath(finalPath));
    }
    PortabilityDao dao(connection_.database());
    for (const QVariantMap& media : loaded.mediaMap) {
        qint64 gameId = 0;
        if (!dao.findGameId(media, &gameId, error)) {
            images[QStringLiteral("skipped")] = images.value(QStringLiteral("skipped")).toInt() + 1;
            continue;
        }
        const QString packagePath = media.value(QStringLiteral("packagePath")).toString();
        if (!stagedByEntry.contains(packagePath)) {
            images[QStringLiteral("missing")] = images.value(QStringLiteral("missing")).toInt() + 1;
            continue;
        }
        QString relative = media.value(QStringLiteral("relativePath")).toString();
        if (relative.isEmpty()) relative = packagePath.mid(QStringLiteral("media/").size());
        bool ok = false;
        const QString target = resolveInside(imagesDir(), relative, &ok);
        if (!ok || !finalPaths.contains(QDir::cleanPath(target))) {
            images[QStringLiteral("missing")] = images.value(QStringLiteral("missing")).toInt() + 1;
            continue;
        }
        if (!dao.updateGameMedia(gameId, media.value(QStringLiteral("field")).toString(), target, error)) return false;
        images[QStringLiteral("imported")] = images.value(QStringLiteral("imported")).toInt() + 1;
    }
    if (summary) summary->insert(QStringLiteral("images"), images);
    return true;
}

bool BackupService::importInventoryMedia(Loaded& loaded, const QString& stagingRoot, QVariantMap* summary,
    QList<QPair<QString, QString>>* moves, QString* error) {
    const QString staging = QDir(stagingRoot).filePath(QStringLiteral("inventory-media"));
    QList<QPair<QString, QString>> extracted;
    if (!loaded.zip.extractPrefix(QStringLiteral("inventory-media/"), staging, kMediaEntryLimit,
            kMediaTotalLimit, &extracted, error)) return false;
    QHash<QString, QString> byBasename;
    QHash<QString, QString> finalByBasename;
    for (const auto& pair : extracted) {
        const QString relative = pair.first.mid(QStringLiteral("inventory-media/").size());
        bool ok = false;
        const QString finalPath = resolveInside(inventoryImagesDir(), relative, &ok);
        if (!ok) {
            if (error) *error = QStringLiteral("Caminho de foto inválido no pacote.");
            return false;
        }
        byBasename.insert(QFileInfo(pair.second).fileName(), pair.second);
        finalByBasename.insert(QFileInfo(pair.second).fileName(), finalPath);
        moves->append({pair.second, finalPath});
    }
    QMap<QString, QStringList> photoPaths;
    for (const QVariant& value : loaded.inventory.value(QStringLiteral("photos")).toList()) {
        const QVariantMap photo = value.toMap();
        const QString basename = QFileInfo(photo.value(QStringLiteral("file_path")).toString()).fileName();
        const auto found = finalByBasename.constFind(basename);
        if (found == finalByBasename.constEnd()) continue;
        const bool multiplatform = PortabilityDao::isInventoryMultiplatform(photo);
        const QString key = PortabilityDao::inventoryItemKey(photo.value(QStringLiteral("itemName")).toString(),
            photo.value(QStringLiteral("platformName")).toString(), multiplatform);
        photoPaths[key].append(found.value());
    }
    PortabilityDao dao(connection_.database());
    QVariantMap inventorySummary;
    if (!dao.importInventoryData(loaded.inventory, photoPaths, &inventorySummary, error)) return false;
    if (summary) {
        summary->insert(QStringLiteral("inventoryImages"),
            QVariantMap{{QStringLiteral("itemsCreated"), inventorySummary.value(QStringLiteral("itemsCreated"))},
                {QStringLiteral("itemsUpdated"), inventorySummary.value(QStringLiteral("itemsUpdated"))},
                {QStringLiteral("photosImported"), inventorySummary.value(QStringLiteral("photosImported"))}});
    }
    return true;
}

QVariantMap BackupService::importPackage(const QVariantMap& request) {
    if (!open_) return errorMap(QStringLiteral("Banco de backup indisponível."));
    QStringList requested;
    for (const QVariant& value : request.value(QStringLiteral("categories")).toList()) {
        requested.append(value.toString());
    }
    QStringList selected;
    QString error;
    if (!normalizePortableCategories(requested, &selected, &error)) return errorMap(error);
    const QString packagePath = request.value(QStringLiteral("packagePath")).toString();
    Loaded loaded;
    if (!load(packagePath, &loaded, &error)) return errorMap(error);
    const QStringList available = detectCategories(loaded);
    for (const QString& category : selected) {
        if (!available.contains(category)) {
            return errorMap(QStringLiteral("Pacote não contém categoria: %1").arg(categoryLabel(category)));
        }
    }
    QVariantList warnings;
    QVariantList errors;
    if (!validate(loaded, &warnings, &errors, &error)) return errorMap(error);
    if (!errors.isEmpty()) {
        return errorMap(QStringLiteral("Importação bloqueada por erros no pacote."), errors);
    }

    QVariantMap summary;
    summary.insert(QStringLiteral("metadata"), QVariantMap{{QStringLiteral("created"), 0},
        {QStringLiteral("updated"), 0}, {QStringLiteral("skipped"), 0}});
    summary.insert(QStringLiteral("platforms"), QVariantMap{{QStringLiteral("created"), 0},
        {QStringLiteral("updated"), 0}, {QStringLiteral("mappings"), 0},
        {QStringLiteral("emulators"), 0}, {QStringLiteral("links"), 0}});
    summary.insert(QStringLiteral("images"), QVariantMap{{QStringLiteral("imported"), 0},
        {QStringLiteral("skipped"), 0}, {QStringLiteral("missing"), 0}});
    summary.insert(QStringLiteral("romLocations"), QVariantMap{{QStringLiteral("updated"), 0},
        {QStringLiteral("skipped"), 0}, {QStringLiteral("romFolderEntries"), 0}});
    summary.insert(QStringLiteral("inventoryImages"), QVariantMap{{QStringLiteral("itemsCreated"), 0},
        {QStringLiteral("itemsUpdated"), 0}, {QStringLiteral("photosImported"), 0}});
    summary.insert(QStringLiteral("warnings"), warnings);
    summary.insert(QStringLiteral("romFolderEntries"), QVariantList{});

    const QString stagingRoot = QDir(profileRoot_).filePath(
        QStringLiteral(".backup-staging/") + QUuid::createUuid().toString(QUuid::WithoutBraces));
    if (!QDir().mkpath(stagingRoot)) return errorMap(QStringLiteral("Não foi possível preparar o staging do backup."));
    QList<QPair<QString, QString>> moves;
    QList<QString> appliedFiles;
    QList<QPair<QString, QString>> backupFiles;
    int total = qMax(1, selected.size() + loaded.mediaMap.size() + 2);
    int current = 0;
    report(0, total, QStringLiteral("validating"), QStringLiteral("Validando pacote"));

    QSqlDatabase& database = connection_.database();
    if (!database.transaction()) {
        QDir(stagingRoot).removeRecursively();
        return errorMap(database.lastError().text());
    }
    const auto rollback = [&](const QString& message) {
        database.rollback();
        undoStaged(appliedFiles, backupFiles);
        QDir(stagingRoot).removeRecursively();
        return errorMap(message);
    };

    PortabilityDao dao(database);
    if (selected.contains(QStringLiteral("platforms"))) {
        QVariantList platformList;
        QVariantList aliasList;
        QVariantList extensionList;
        QVariantList emulatorList;
        QVariantList linkList;
        for (const QVariantMap& entry : loaded.platforms) platformList.append(entry);
        for (const QVariantMap& entry : loaded.aliases) aliasList.append(entry);
        for (const QVariantMap& entry : loaded.romExtensions) extensionList.append(entry);
        for (const QVariantMap& entry : loaded.emulators) emulatorList.append(entry);
        for (const QVariantMap& entry : loaded.platformEmulators) linkList.append(entry);
        QVariantMap bundle{{QStringLiteral("platforms"), platformList},
            {QStringLiteral("aliases"), aliasList},
            {QStringLiteral("romExtensions"), extensionList},
            {QStringLiteral("emulators"), emulatorList},
            {QStringLiteral("platformEmulators"), linkList}};
        QVariantMap platformSummary;
        if (!dao.importPlatformBundle(bundle, &platformSummary, &error)) return rollback(error);
        summary.insert(QStringLiteral("platforms"), platformSummary);
        report(++current, total, QStringLiteral("platforms"), QStringLiteral("Plataformas importadas"));
    }
    if (selected.contains(QStringLiteral("metadata"))) {
        QVariantMap metadataSummary;
        if (!dao.importGameMetadata(loaded.games, &metadataSummary, &error)) return rollback(error);
        summary.insert(QStringLiteral("metadata"), metadataSummary);
        report(++current, total, QStringLiteral("metadata"), QStringLiteral("Metadados importados"));
    }
    if (selected.contains(QStringLiteral("romLocations"))) {
        QVariantMap locationSummary;
        if (!dao.importRomLocations(loaded.romLocations, &locationSummary, &error)) return rollback(error);
        QList<QVariantMap> resolvedFolders;
        if (!dao.resolveRomFolderEntries(loaded.romFolderEntries, &resolvedFolders, &error)) return rollback(error);
        QVariantList folders;
        for (const QVariantMap& folder : resolvedFolders) folders.append(folder);
        locationSummary.insert(QStringLiteral("romFolderEntries"), folders.size());
        summary.insert(QStringLiteral("romLocations"), locationSummary);
        summary.insert(QStringLiteral("romFolderEntries"), folders);
        report(++current, total, QStringLiteral("rom_locations"), QStringLiteral("Localizações de ROM importadas"));
    }
    if (selected.contains(QStringLiteral("images"))) {
        if (!importMedia(loaded, stagingRoot, &summary, &moves, &error)) return rollback(error);
        report(++current, total, QStringLiteral("images"), QStringLiteral("Imagens importadas"));
    }
    if (selected.contains(QStringLiteral("inventoryImages"))) {
        if (!importInventoryMedia(loaded, stagingRoot, &summary, &moves, &error)) return rollback(error);
        report(++current, total, QStringLiteral("inventoryImages"), QStringLiteral("Inventário importado"));
    }
    // As mídias só entram no perfil depois de todos os dados validados.
    if (!applyStaged(moves, QDir(stagingRoot).filePath(QStringLiteral("backup")), &appliedFiles,
            &backupFiles, &error)) {
        return rollback(error);
    }
    if (qEnvironmentVariableIsSet("GAMESTOCK_BACKUP_TEST_FAIL_AFTER_STAGE")) {
        return rollback(QStringLiteral("Falha simulada após o staging para validar rollback."));
    }
    if (!database.commit()) return rollback(database.lastError().text());
    QDir(stagingRoot).removeRecursively();

    lastPackagePath_ = loaded.packagePath;
    error_.clear();
    emit changed();
    report(total, total, QStringLiteral("done"), QStringLiteral("Importação concluída"));
    return QVariantMap{{QStringLiteral("success"), true}, {QStringLiteral("summary"), summary}};
}
} // namespace gamestock
