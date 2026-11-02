/** Porta de openvgdb.ts com download validado e consultas somente leitura. */
#include "OpenVgdb.h"

#include "app/RomLaunchExtraction.h"

#include <QDateTime>
#include <QDir>
#include <QDirIterator>
#include <QEventLoop>
#include <QFile>
#include <QFileInfo>
#include <QHash>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QRegularExpression>
#include <QSqlDatabase>
#include <QSqlError>
#include <QSqlQuery>
#include <QTimer>
#include <QUrl>
#include <QUuid>

#include <algorithm>

namespace gamestock {
namespace {
const QString githubPrefix = QStringLiteral("https://github.com/OpenVGDB/OpenVGDB/releases/download/");
constexpr qint64 maxArchiveBytes = 50LL * 1024 * 1024;
constexpr qint64 maxDatabaseBytes = 100LL * 1024 * 1024;

/** Resultado de um GET síncrono com limite de tamanho. */
struct HttpResult {
    QByteArray body;
    int status = 0;
    QString error;
};

HttpResult httpGet(const QUrl& url, int timeoutMs, qint64 maxBytes) {
    HttpResult result;
    if (!url.isValid()) {
        result.error = QStringLiteral("URL inválida.");
        return result;
    }
    QNetworkAccessManager manager;
    QNetworkRequest request{url};
    request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);
    request.setHeader(QNetworkRequest::UserAgentHeader, QStringLiteral("GameStock/1.0"));
    QNetworkReply* reply = manager.get(request);
    QEventLoop loop;
    QTimer timeout;
    timeout.setSingleShot(true);
    QObject::connect(&timeout, &QTimer::timeout, reply, &QNetworkReply::abort);
    QObject::connect(reply, &QNetworkReply::finished, &loop, &QEventLoop::quit);
    QObject::connect(reply, &QNetworkReply::readyRead, &loop, [&] {
        result.body += reply->readAll();
        if (result.body.size() > maxBytes) reply->abort();
    });
    timeout.start(timeoutMs);
    loop.exec();
    const QNetworkReply::NetworkError networkError = reply->error();
    result.status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
    if (networkError != QNetworkReply::NoError || result.status != 200) {
        result.error = networkError == QNetworkReply::OperationCanceledError
            ? QStringLiteral("Tempo esgotado ao baixar OpenVGDB.")
            : (result.status > 0 ? QStringLiteral("OpenVGDB HTTP %1").arg(result.status) : reply->errorString());
    } else if (result.body.size() > maxBytes) {
        result.error = QStringLiteral("Pacote OpenVGDB excede o limite permitido.");
    }
    reply->deleteLater();
    return result;
}

/** Conexão somente leitura com nome único, removida ao sair de escopo. */
class ReadOnlyDatabase final {
public:
    ReadOnlyDatabase(const QString& path, QString* error) {
        name_ = QStringLiteral("openvgdb_") + QUuid::createUuid().toString(QUuid::WithoutBraces);
        database_ = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), name_);
        database_.setDatabaseName(path);
        database_.setConnectOptions(QStringLiteral("QSQLITE_OPEN_READONLY;QSQLITE_BUSY_TIMEOUT=10000"));
        if (!database_.open() && error) *error = database_.lastError().text();
    }
    ~ReadOnlyDatabase() {
        database_.close();
        database_ = QSqlDatabase();
        QSqlDatabase::removeDatabase(name_);
    }
    bool isOpen() const { return database_.isOpen(); }
    QSqlDatabase& handle() { return database_; }
private:
    QString name_;
    QSqlDatabase database_;
};

/** Valida que o arquivo tem cabeçalho SQLite e a tabela RELEASES. */
bool validDatabase(const QString& path, QString* error) {
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        if (error) *error = file.errorString();
        return false;
    }
    const QByteArray header = file.read(16);
    file.close();
    if (header != QByteArray("SQLite format 3\0", 16)) {
        if (error) *error = QStringLiteral("SQLite OpenVGDB inválido.");
        return false;
    }
    ReadOnlyDatabase database(path, error);
    if (!database.isOpen()) return false;
    QSqlQuery query(database.handle());
    if (!query.exec(QStringLiteral("SELECT releaseID FROM RELEASES LIMIT 1"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    return true;
}

/** Preenche a ficha mais completa entre releases repetidas. */
int richness(const QVariantMap& row) {
    int count = 0;
    for (const QString& key : {QStringLiteral("releaseDescription"), QStringLiteral("releaseDeveloper"),
             QStringLiteral("releasePublisher"), QStringLiteral("releaseGenre"), QStringLiteral("releaseDate")}) {
        if (!row.value(key).toString().isEmpty()) ++count;
    }
    return count;
}
} // namespace

OpenVgdb::OpenVgdb(Config config) : config_(std::move(config)) {}

QString OpenVgdb::databaseFile() const {
    return QDir(config_.cacheDir).filePath(QStringLiteral("openvgdb.sqlite"));
}

bool OpenVgdb::ensureDatabase(QString* error) {
    QMutexLocker locker(&mutex_);
    const QFileInfo info(databaseFile());
    if (info.exists() && info.size() > 0) {
        QString validationError;
        if (validDatabase(databaseFile(), &validationError)) return true;
    }
    return downloadDatabase(error);
}

bool OpenVgdb::downloadDatabase(QString* error) {
    if (!QDir().mkpath(config_.cacheDir)) {
        if (error) *error = QStringLiteral("Não foi possível criar o cache do OpenVGDB.");
        return false;
    }
    const HttpResult release = httpGet(QUrl(config_.apiUrl), 15000, 2 * 1024 * 1024);
    if (!release.error.isEmpty()) {
        if (error) *error = release.error;
        return false;
    }
    const QJsonDocument document = QJsonDocument::fromJson(release.body);
    if (!document.isObject()) {
        if (error) *error = QStringLiteral("Resposta OpenVGDB inválida.");
        return false;
    }
    QString assetUrl;
    for (const QJsonValue& value : document.object().value(QStringLiteral("assets")).toArray()) {
        const QJsonObject asset = value.toObject();
        if (asset.value(QStringLiteral("name")).toString() != QStringLiteral("openvgdb.zip")) continue;
        if (asset.value(QStringLiteral("size")).toDouble() > maxArchiveBytes) continue;
        assetUrl = asset.value(QStringLiteral("browser_download_url")).toString();
        break;
    }
    if (assetUrl.isEmpty() || (!config_.allowCustomAssetUrl && !assetUrl.startsWith(githubPrefix))) {
        if (error) *error = QStringLiteral("Pacote OpenVGDB não encontrado.");
        return false;
    }
    const HttpResult archive = httpGet(QUrl(assetUrl), 30000, maxArchiveBytes);
    if (!archive.error.isEmpty()) {
        if (error) *error = archive.error;
        return false;
    }
    const QString zipPath = QDir(config_.cacheDir).filePath(QStringLiteral("openvgdb.zip.part"));
    QFile zip(zipPath);
    if (!zip.open(QIODevice::WriteOnly | QIODevice::Truncate) || zip.write(archive.body) != archive.body.size()) {
        if (error) *error = zip.errorString();
        return false;
    }
    zip.close();

    const QString workDir = QDir(config_.cacheDir).filePath(QStringLiteral("extract-") +
        QUuid::createUuid().toString(QUuid::WithoutBraces));
    const QString binary = sevenZipBinaryPath(config_.sevenZipPath);
    QString extractionError;
    if (binary.isEmpty()) {
        QFile::remove(zipPath);
        if (error) *error = QStringLiteral("Extrator 7-Zip não encontrado.");
        return false;
    }
    if (!extractArchiveWithSevenZip(zipPath, workDir, binary, &extractionError)) {
        QFile::remove(zipPath);
        QDir(workDir).removeRecursively();
        if (error) *error = extractionError;
        return false;
    }
    QString sqlitePath;
    QDirIterator iterator(workDir, QDir::Files, QDirIterator::Subdirectories);
    while (iterator.hasNext()) {
        const QString candidate = iterator.next();
        const QString suffix = QFileInfo(candidate).suffix().toLower();
        if ((suffix == QLatin1String("sqlite") || suffix == QLatin1String("db"))
            && QFileInfo(candidate).size() <= maxDatabaseBytes) {
            sqlitePath = candidate;
            break;
        }
    }
    if (sqlitePath.isEmpty()) {
        QFile::remove(zipPath);
        QDir(workDir).removeRecursively();
        if (error) *error = QStringLiteral("SQLite OpenVGDB não encontrado no pacote.");
        return false;
    }
    const QString target = databaseFile();
    QFile::remove(target);
    if (!QFile::rename(sqlitePath, target)) {
        QFile::remove(zipPath);
        QDir(workDir).removeRecursively();
        if (error) *error = QStringLiteral("Não foi possível publicar o SQLite OpenVGDB.");
        return false;
    }
    QDir(workDir).removeRecursively();
    QFile::remove(zipPath);
    if (!validDatabase(target, error)) {
        QFile::remove(target);
        return false;
    }
    return true;
}

QString OpenVgdb::normalize(const QString& value) {
    const QString decomposed = value.normalized(QString::NormalizationForm_D);
    QString withoutMarks;
    withoutMarks.reserve(decomposed.size());
    for (const QChar character : decomposed) {
        const auto category = character.category();
        if (category == QChar::Mark_NonSpacing || category == QChar::Mark_SpacingCombining
            || category == QChar::Mark_Enclosing) continue;
        withoutMarks += character;
    }
    QString normalized = withoutMarks.toLower();
    normalized.replace(QRegularExpression(QStringLiteral("[^a-z0-9]+")), QStringLiteral(" "));
    return normalized.trimmed().replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral(" "));
}

QString OpenVgdb::systemName(const QString& platformName) {
    static const QHash<QString, QString> names{
        {QStringLiteral("arcade"), QStringLiteral("Arcade")},
        {QStringLiteral("atari 2600"), QStringLiteral("Atari 2600")},
        {QStringLiteral("atari 7800"), QStringLiteral("Atari 7800")},
        {QStringLiteral("commodore 64"), QStringLiteral("Commodore 64")},
        {QStringLiteral("game boy"), QStringLiteral("Nintendo Game Boy")},
        {QStringLiteral("nintendo game boy"), QStringLiteral("Nintendo Game Boy")},
        {QStringLiteral("game boy advance"), QStringLiteral("Nintendo Game Boy Advance")},
        {QStringLiteral("nintendo game boy advance"), QStringLiteral("Nintendo Game Boy Advance")},
        {QStringLiteral("game boy color"), QStringLiteral("Nintendo Game Boy Color")},
        {QStringLiteral("nintendo game boy color"), QStringLiteral("Nintendo Game Boy Color")},
        {QStringLiteral("nintendo 64"), QStringLiteral("Nintendo 64")},
        {QStringLiteral("nintendo ds"), QStringLiteral("Nintendo DS")},
        {QStringLiteral("nintendo nes"), QStringLiteral("Nintendo Entertainment System")},
        {QStringLiteral("nintendo entertainment system"), QStringLiteral("Nintendo Entertainment System")},
        {QStringLiteral("nintendo gamecube"), QStringLiteral("Nintendo GameCube")},
        {QStringLiteral("nintendo wii"), QStringLiteral("Nintendo Wii")},
        {QStringLiteral("sony playstation"), QStringLiteral("Sony PlayStation")},
        {QStringLiteral("playstation"), QStringLiteral("Sony PlayStation")},
        {QStringLiteral("sega cd"), QStringLiteral("Sega CD/Mega-CD")},
        {QStringLiteral("sega game gear"), QStringLiteral("Sega Game Gear")},
        {QStringLiteral("sega master system"), QStringLiteral("Sega Master System")},
        {QStringLiteral("sega mega drive"), QStringLiteral("Sega Genesis/Mega Drive")},
        {QStringLiteral("sega genesis"), QStringLiteral("Sega Genesis/Mega Drive")},
        {QStringLiteral("sega mega drive genesis"), QStringLiteral("Sega Genesis/Mega Drive")},
        {QStringLiteral("sega saturn"), QStringLiteral("Sega Saturn")},
        {QStringLiteral("super nintendo"), QStringLiteral("Nintendo Super Nintendo Entertainment System")},
        {QStringLiteral("super nintendo entertainment system"), QStringLiteral("Nintendo Super Nintendo Entertainment System")}
    };
    return names.value(normalize(platformName));
}

QString OpenVgdb::localName(const QString& system) {
    static const QHash<QString, QString> names{
        {QStringLiteral("Sega Genesis/Mega Drive"), QStringLiteral("Sega Mega Drive")},
        {QStringLiteral("Nintendo Super Nintendo Entertainment System"), QStringLiteral("Super Nintendo")},
        {QStringLiteral("Nintendo Entertainment System"), QStringLiteral("Nintendo NES")},
        {QStringLiteral("Nintendo Game Boy"), QStringLiteral("Game Boy")},
        {QStringLiteral("Nintendo Game Boy Color"), QStringLiteral("Game Boy Color")},
        {QStringLiteral("Nintendo Game Boy Advance"), QStringLiteral("Game Boy Advance")},
        {QStringLiteral("Sega CD/Mega-CD"), QStringLiteral("Sega CD")}
    };
    return names.value(system, system);
}

QVariantMap OpenVgdb::toMap(const QVariantMap& row) const {
    const QString date = row.value(QStringLiteral("releaseDate")).toString();
    const QRegularExpression yearPattern(QStringLiteral("\\b(?:19|20)\\d{2}\\b"));
    const QRegularExpressionMatch match = yearPattern.match(date);
    return QVariantMap{
        {QStringLiteral("id"), QStringLiteral("openvgdb:") + row.value(QStringLiteral("releaseID")).toString()},
        {QStringLiteral("source"), QStringLiteral("openvgdb")},
        {QStringLiteral("name"), row.value(QStringLiteral("releaseTitleName"))},
        {QStringLiteral("platform"), localName(row.value(QStringLiteral("TEMPsystemName")).toString())},
        {QStringLiteral("release"), match.hasMatch() ? match.captured(0) : QString()},
        {QStringLiteral("developer"), row.value(QStringLiteral("releaseDeveloper")).toString()},
        {QStringLiteral("publisher"), row.value(QStringLiteral("releasePublisher")).toString()},
        {QStringLiteral("genres"), row.value(QStringLiteral("releaseGenre")).toString()},
        {QStringLiteral("overview"), row.value(QStringLiteral("releaseDescription")).toString()},
        {QStringLiteral("players"), QString()},
        {QStringLiteral("rating"), QString()},
        {QStringLiteral("cooperative"), QString()},
        {QStringLiteral("images"), QVariantList{}},
    };
}

QList<QVariantMap> OpenVgdb::search(const QString& query, const QString& platformName, QString* error) {
    QMutexLocker locker(&mutex_);
    const QString system = platformName.trimmed().isEmpty() ? QString() : systemName(platformName);
    if (!platformName.trimmed().isEmpty() && system.isEmpty()) return {};
    const QString normalizedQuery = normalize(query);
    QStringList tokens = normalizedQuery.split(QLatin1Char(' '), Qt::SkipEmptyParts);
    if (tokens.isEmpty()) return {};
    std::stable_sort(tokens.begin(), tokens.end(), [](const QString& left, const QString& right) {
        return left.size() > right.size();
    });
    const QString token = tokens.first();
    if (token.size() < 2) return {};
    if (!ensureDatabase(error)) return {};

    ReadOnlyDatabase database(databaseFile(), error);
    if (!database.isOpen()) return {};
    QSqlQuery rows(database.handle());
    if (!rows.prepare(QStringLiteral(
            "SELECT releaseID, releaseTitleName, TEMPsystemName, releaseDescription, releaseDeveloper, "
            "releasePublisher, releaseGenre, releaseDate FROM RELEASES "
            "WHERE instr(lower(releaseTitleName), lower(?)) > 0 AND (? IS NULL OR TEMPsystemName = ?) LIMIT 1000"))) {
        if (error) *error = rows.lastError().text();
        return {};
    }
    rows.addBindValue(token);
    if (system.isEmpty()) {
        rows.addBindValue(QVariant(QMetaType(QMetaType::QString)));
        rows.addBindValue(QVariant(QMetaType(QMetaType::QString)));
    } else {
        rows.addBindValue(system);
        rows.addBindValue(system);
    }
    if (!rows.exec()) {
        if (error) *error = rows.lastError().text();
        return {};
    }
    QHash<QString, QVariantMap> unique;
    while (rows.next()) {
        QVariantMap row;
        row.insert(QStringLiteral("releaseID"), rows.value(0));
        row.insert(QStringLiteral("releaseTitleName"), rows.value(1));
        row.insert(QStringLiteral("TEMPsystemName"), rows.value(2));
        row.insert(QStringLiteral("releaseDescription"), rows.value(3));
        row.insert(QStringLiteral("releaseDeveloper"), rows.value(4));
        row.insert(QStringLiteral("releasePublisher"), rows.value(5));
        row.insert(QStringLiteral("releaseGenre"), rows.value(6));
        row.insert(QStringLiteral("releaseDate"), rows.value(7));
        const QString name = normalize(row.value(QStringLiteral("releaseTitleName")).toString());
        if (!name.contains(normalizedQuery)) continue;
        const QString key = row.value(QStringLiteral("TEMPsystemName")).toString() + QLatin1Char(':') + name;
        const auto previous = unique.constFind(key);
        if (previous == unique.cend() || richness(row) > richness(previous.value())) unique.insert(key, row);
    }
    QList<QVariantMap> result;
    for (const QVariantMap& row : unique) result.append(toMap(row));
    std::stable_sort(result.begin(), result.end(), [&normalizedQuery](const QVariantMap& left, const QVariantMap& right) {
        const bool leftExact = normalize(left.value(QStringLiteral("name")).toString()) == normalizedQuery;
        const bool rightExact = normalize(right.value(QStringLiteral("name")).toString()) == normalizedQuery;
        if (leftExact != rightExact) return leftExact;
        return QString::localeAwareCompare(left.value(QStringLiteral("name")).toString(),
            right.value(QStringLiteral("name")).toString()) < 0;
    });
    if (result.size() > 30) result = result.mid(0, 30);
    if (error) error->clear();
    return result;
}

QVariantMap OpenVgdb::get(const QString& id, QString* error) {
    QMutexLocker locker(&mutex_);
    bool ok = false;
    const qint64 releaseId = id.startsWith(QStringLiteral("openvgdb:"))
        ? id.mid(QStringLiteral("openvgdb:").size()).toLongLong(&ok) : 0;
    if (!ok || releaseId <= 0) {
        if (error) *error = QStringLiteral("Identificador OpenVGDB inválido.");
        return {};
    }
    if (!ensureDatabase(error)) return {};
    ReadOnlyDatabase database(databaseFile(), error);
    if (!database.isOpen()) return {};
    QSqlQuery query(database.handle());
    if (!query.prepare(QStringLiteral(
            "SELECT releaseID, releaseTitleName, TEMPsystemName, releaseDescription, releaseDeveloper, "
            "releasePublisher, releaseGenre, releaseDate FROM RELEASES WHERE releaseID = ?"))) {
        if (error) *error = query.lastError().text();
        return {};
    }
    query.addBindValue(releaseId);
    if (!query.exec() || !query.next()) {
        if (error) *error = QStringLiteral("Release OpenVGDB não encontrada.");
        return {};
    }
    QVariantMap row;
    row.insert(QStringLiteral("releaseID"), query.value(0));
    row.insert(QStringLiteral("releaseTitleName"), query.value(1));
    row.insert(QStringLiteral("TEMPsystemName"), query.value(2));
    row.insert(QStringLiteral("releaseDescription"), query.value(3));
    row.insert(QStringLiteral("releaseDeveloper"), query.value(4));
    row.insert(QStringLiteral("releasePublisher"), query.value(5));
    row.insert(QStringLiteral("releaseGenre"), query.value(6));
    row.insert(QStringLiteral("releaseDate"), query.value(7));
    if (error) error->clear();
    return toMap(row);
}
} // namespace gamestock
