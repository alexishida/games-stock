/** Porta de src/main/lib/launchbox/db.ts com Qt Network e parser incremental. */
#include "LaunchBoxCache.h"

#include "app/RomLaunchExtraction.h"

#include <QDateTime>
#include <QDir>
#include <QDirIterator>
#include <QEventLoop>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QSaveFile>
#include <QTimer>
#include <QUuid>
#include <QXmlStreamReader>

#include <algorithm>

namespace gamestock {
namespace {
const QString defaultUrl = QStringLiteral("https://gamesdb.launchbox-app.com/Metadata.zip");
constexpr qint64 cacheAgeMs = 24LL * 60 * 60 * 1000;

/** Copia o XML extraído para o destino com QSaveFile, sem carregar tudo na memória. */
bool copyAtomically(const QString& source, const QString& target, QString* error) {
    QFile input(source);
    if (!input.open(QIODevice::ReadOnly)) {
        if (error) *error = input.errorString();
        return false;
    }
    QSaveFile output(target);
    if (!output.open(QIODevice::WriteOnly)) {
        if (error) *error = output.errorString();
        return false;
    }
    while (!input.atEnd()) {
        const QByteArray chunk = input.read(1024 * 1024);
        if (chunk.isEmpty() && input.error() != QFileDevice::NoError) {
            if (error) *error = input.errorString();
            output.cancelWriting();
            return false;
        }
        if (output.write(chunk) != chunk.size()) {
            if (error) *error = output.errorString();
            output.cancelWriting();
            return false;
        }
    }
    if (!output.commit()) {
        if (error) *error = output.errorString();
        return false;
    }
    return true;
}

/** Aplica um campo textual do XML ao objeto do jogo. */
void assignGameField(QJsonObject& game, const QString& field, const QString& text) {
    if (field == QLatin1String("DatabaseID")) game.insert(QStringLiteral("id"), text);
    else if (field == QLatin1String("Name")) game.insert(QStringLiteral("name"), text);
    else if (field == QLatin1String("Platform")) game.insert(QStringLiteral("platform"), text);
    else if (field == QLatin1String("ReleaseDate")) game.insert(QStringLiteral("release"), text.left(10));
    else if (field == QLatin1String("Developer")) game.insert(QStringLiteral("developer"), text);
    else if (field == QLatin1String("Publisher")) game.insert(QStringLiteral("publisher"), text);
    else if (field == QLatin1String("Genres")) game.insert(QStringLiteral("genres"), text);
    else if (field == QLatin1String("Overview")) game.insert(QStringLiteral("overview"), text);
    else if (field == QLatin1String("MaxPlayers")) game.insert(QStringLiteral("players"), text);
    else if (field == QLatin1String("ESRB")) game.insert(QStringLiteral("rating"), text);
    else if (field == QLatin1String("Cooperative")) game.insert(QStringLiteral("cooperative"), text);
}
} // namespace

LaunchBoxCache::LaunchBoxCache(QString cacheDir, QString metadataUrl, QString sevenZipPath)
    : cacheDir_(std::move(cacheDir)), metadataUrl_(metadataUrl.isEmpty() ? defaultUrl : std::move(metadataUrl)),
      sevenZipPath_(std::move(sevenZipPath)) {}

QString LaunchBoxCache::metadataFile() const { return QDir(cacheDir_).filePath(QStringLiteral("Metadata.xml")); }
QString LaunchBoxCache::indexFile() const { return QDir(cacheDir_).filePath(QStringLiteral("index.json")); }
bool LaunchBoxCache::metadataExists() const {
    QMutexLocker locker(&mutex_);
    return QFileInfo::exists(metadataFile());
}

QString LaunchBoxCache::metadataDownloadedAt() const {
    QMutexLocker locker(&mutex_);
    const QFileInfo info(metadataFile());
    return info.exists() ? info.lastModified().toUTC().toString(Qt::ISODateWithMs) : QString();
}

QJsonObject LaunchBoxCache::cachedIndex() const {
    QMutexLocker locker(&mutex_);
    return memoryIndex_;
}

void LaunchBoxCache::invalidateIndex() {
    QFile::remove(indexFile());
    memoryIndex_ = QJsonObject{};
}

LaunchBoxCache::Result LaunchBoxCache::ensureMetadata(bool force,
    const std::function<void(const LaunchBoxProgress&)>& progress) {
    QMutexLocker lock(&mutex_);
    const QFileInfo info(metadataFile());
    if (!force && info.exists() && info.lastModified().msecsTo(QDateTime::currentDateTime()) <= cacheAgeMs) {
        return {QStringLiteral("cached"), {}};
    }
    if (!QDir().mkpath(cacheDir_)) return {QStringLiteral("error"), QStringLiteral("Não foi possível criar o cache do LaunchBox.")};

    const QString zipPath = QDir(cacheDir_).filePath(QStringLiteral("Metadata.zip.part"));
    QString error;
    if (!downloadMetadata(zipPath, &error, progress)) {
        QFile::remove(zipPath);
        return {QStringLiteral("error"), error};
    }
    if (progress) progress({0, 0, QStringLiteral("Extraindo Metadata.zip"), QStringLiteral("extracting")});
    if (!extractMetadata(zipPath, &error, progress)) {
        QFile::remove(zipPath);
        return {QStringLiteral("error"), error};
    }
    return {QStringLiteral("downloaded"), {}};
}

bool LaunchBoxCache::downloadMetadata(const QString& target, QString* error,
    const std::function<void(const LaunchBoxProgress&)>& progress) {
    QFile file(target);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        if (error) *error = file.errorString();
        return false;
    }
    QNetworkAccessManager manager;
    QNetworkRequest request{QUrl(metadataUrl_)};
    request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);
    request.setHeader(QNetworkRequest::UserAgentHeader, QStringLiteral("GameStock/1.0"));
    QNetworkReply* reply = manager.get(request);
    QEventLoop loop;
    QTimer timeout;
    timeout.setSingleShot(true);
    QObject::connect(&timeout, &QTimer::timeout, reply, &QNetworkReply::abort);
    QObject::connect(reply, &QNetworkReply::finished, &loop, &QEventLoop::quit);
    qint64 total = 0;
    QObject::connect(reply, &QNetworkReply::downloadProgress, &loop,
        [&total](qint64, qint64 totalBytes) { if (totalBytes > 0) total = totalBytes; });
    QObject::connect(reply, &QNetworkReply::readyRead, &loop, [&] {
        const QByteArray chunk = reply->readAll();
        if (!chunk.isEmpty()) file.write(chunk);
        if (progress) {
            progress({file.size(), total, QStringLiteral("Metadata.zip"), QStringLiteral("downloading")});
        }
    });
    timeout.start(60000);
    loop.exec();
    file.close();
    const QNetworkReply::NetworkError networkError = reply->error();
    const QString networkMessage = reply->errorString();
    const int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
    reply->deleteLater();
    if (networkError != QNetworkReply::NoError || status != 200) {
        if (error) {
            *error = networkError == QNetworkReply::OperationCanceledError
                ? QStringLiteral("Tempo esgotado ao baixar Metadata.zip.")
                : (status > 0 ? QStringLiteral("HTTP %1 ao baixar Metadata.zip: %2").arg(status).arg(networkMessage)
                              : networkMessage);
        }
        return false;
    }
    if (progress) progress({file.size(), total, QStringLiteral("Metadata.zip"), QStringLiteral("downloaded")});
    return true;
}

bool LaunchBoxCache::extractMetadata(const QString& zipPath, QString* error,
    const std::function<void(const LaunchBoxProgress&)>& progress) {
    const QString binary = sevenZipBinaryPath(sevenZipPath_);
    if (binary.isEmpty()) {
        if (error) *error = QStringLiteral("Extrator 7-Zip não encontrado.");
        return false;
    }
    const QString workDir = QDir(cacheDir_).filePath(QStringLiteral("extract-") +
        QUuid::createUuid().toString(QUuid::WithoutBraces));
    QString extractionError;
    if (!extractArchiveWithSevenZip(zipPath, workDir, binary, &extractionError)) {
        QDir(workDir).removeRecursively();
        if (error) *error = extractionError;
        return false;
    }
    QString xmlPath;
    QDirIterator iterator(workDir, QDir::Files, QDirIterator::Subdirectories);
    while (iterator.hasNext()) {
        const QString candidate = iterator.next();
        if (QFileInfo(candidate).suffix().compare(QStringLiteral("xml"), Qt::CaseInsensitive) == 0) {
            xmlPath = candidate;
            break;
        }
    }
    if (xmlPath.isEmpty()) {
        QDir(workDir).removeRecursively();
        if (error) *error = QStringLiteral("Metadata.xml não encontrado no ZIP.");
        return false;
    }
    if (!copyAtomically(xmlPath, metadataFile(), error)) {
        QDir(workDir).removeRecursively();
        return false;
    }
    QDir(workDir).removeRecursively();
    QFile::remove(zipPath);
    invalidateIndex();
    if (progress) progress({1, 1, QStringLiteral("Metadata.xml"), QStringLiteral("done")});
    return true;
}

bool LaunchBoxCache::loadIndex(const QString& path, QJsonObject* index, QString* error) const {
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        if (error) *error = file.errorString();
        return false;
    }
    QJsonParseError parseError;
    const QJsonDocument document = QJsonDocument::fromJson(file.readAll(), &parseError);
    if (parseError.error != QJsonParseError::NoError || !document.isObject()) {
        if (error) *error = QStringLiteral("Cache de índice inválido.");
        return false;
    }
    const QJsonObject object = document.object();
    if (object.isEmpty()) {
        if (error) *error = QStringLiteral("Cache de índice vazio.");
        return false;
    }
    const QJsonObject first = object.constBegin().value().toObject();
    if (!first.value(QStringLiteral("alternateNames")).isArray()) {
        if (error) *error = QStringLiteral("Cache de índice antigo.");
        return false;
    }
    *index = object;
    return true;
}

bool LaunchBoxCache::buildIndex(QJsonObject* index, QString* error,
    const std::function<void(const LaunchBoxProgress&)>& progress) {
    if (!index) {
        if (error) *error = QStringLiteral("Destino do índice ausente.");
        return false;
    }
    QMutexLocker lock(&mutex_);
    if (!memoryIndex_.isEmpty()) {
        *index = memoryIndex_;
        return true;
    }
    const Result metadata = ensureMetadata(false, progress);
    if (!metadata.ok()) {
        if (error) *error = metadata.error;
        return false;
    }
    const QFileInfo metadataInfo(metadataFile());
    if (!metadataInfo.exists()) {
        if (error) *error = QStringLiteral("Metadata.xml não está disponível.");
        return false;
    }
    const QFileInfo indexInfo(indexFile());
    if (indexInfo.exists() && indexInfo.lastModified() >= metadataInfo.lastModified()) {
        QJsonObject cached;
        QString ignored;
        if (loadIndex(indexFile(), &cached, &ignored)) {
            memoryIndex_ = cached;
            *index = cached;
            if (error) error->clear();
            return true;
        }
    }
    QJsonObject built;
    QString parseError;
    if (!parseXml(metadataFile(), &built, &parseError, progress)) {
        if (error) *error = parseError;
        return false;
    }
    QString saveError;
    if (!saveIndex(built, &saveError)) {
        if (error) *error = saveError;
        return false;
    }
    memoryIndex_ = built;
    *index = built;
    if (error) error->clear();
    return true;
}

bool LaunchBoxCache::parseXml(const QString& path, QJsonObject* index, QString* error,
    const std::function<void(const LaunchBoxProgress&)>& progress) const {
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) {
        if (error) *error = file.errorString();
        return false;
    }
    enum class Section { None, Game, Alternate, Image };
    QXmlStreamReader reader(&file);
    QJsonObject indexValue;
    QHash<QString, QStringList> alternateNames;
    QHash<QString, QList<QJsonObject>> images;
    Section section = Section::None;
    QString field;
    QString text;
    QJsonObject current;
    int games = 0;

    while (!reader.atEnd()) {
        reader.readNext();
        if (reader.isStartElement()) {
            const QString name = reader.name().toString();
            if (name == QLatin1String("Game")) {
                section = Section::Game;
                current = QJsonObject{{QStringLiteral("alternateNames"), QJsonArray{}}, {QStringLiteral("images"), QJsonArray{}}};
                field.clear();
                text.clear();
            } else if (name == QLatin1String("GameAlternateName")) {
                section = Section::Alternate;
                current = QJsonObject{};
                field.clear();
                text.clear();
            } else if (name == QLatin1String("GameImage")) {
                section = Section::Image;
                current = QJsonObject{};
                field.clear();
                text.clear();
            } else if (section != Section::None) {
                field = name;
                text.clear();
            }
        } else if (reader.isCharacters() && section != Section::None) {
            text += reader.text();
        } else if (reader.isEndElement()) {
            const QString name = reader.name().toString();
            if (section == Section::Game && name != QLatin1String("Game")) {
                assignGameField(current, field, text.trimmed());
                field.clear();
                text.clear();
            } else if (section == Section::Game && name == QLatin1String("Game")) {
                const QString id = current.value(QStringLiteral("id")).toString();
                if (!id.isEmpty()) {
                    indexValue.insert(id, current);
                    ++games;
                    if (progress && games % 1000 == 0) {
                        progress({games, 0, QStringLiteral("Construindo índice"), QStringLiteral("indexing")});
                    }
                }
                section = Section::None;
            } else if (section == Section::Alternate && name != QLatin1String("GameAlternateName")) {
                if (field == QLatin1String("DatabaseID")) current.insert(QStringLiteral("id"), text.trimmed());
                else if (field == QLatin1String("AlternateName")) current.insert(QStringLiteral("alias"), text.trimmed());
                field.clear();
                text.clear();
            } else if (section == Section::Alternate && name == QLatin1String("GameAlternateName")) {
                const QString id = current.value(QStringLiteral("id")).toString();
                const QString alias = current.value(QStringLiteral("alias")).toString();
                if (!id.isEmpty() && !alias.isEmpty()) alternateNames[id].append(alias);
                section = Section::None;
            } else if (section == Section::Image && name != QLatin1String("GameImage")) {
                if (field == QLatin1String("DatabaseID")) current.insert(QStringLiteral("id"), text.trimmed());
                else if (field == QLatin1String("FileName")) current.insert(QStringLiteral("filename"), text.trimmed());
                else if (field == QLatin1String("Type")) current.insert(QStringLiteral("type"), text.trimmed());
                else if (field == QLatin1String("Region")) current.insert(QStringLiteral("region"), text.trimmed());
                field.clear();
                text.clear();
            } else if (section == Section::Image && name == QLatin1String("GameImage")) {
                const QString id = current.value(QStringLiteral("id")).toString();
                if (!id.isEmpty()) {
                    QJsonObject image{{QStringLiteral("filename"), current.value(QStringLiteral("filename")).toString()},
                        {QStringLiteral("type"), current.value(QStringLiteral("type")).toString()}};
                    const QString region = current.value(QStringLiteral("region")).toString();
                    image.insert(QStringLiteral("region"), region.isEmpty() ? QJsonValue(QJsonValue::Null) : QJsonValue(region));
                    images[id].append(image);
                }
                section = Section::None;
            }
        }
    }
    if (reader.hasError()) {
        if (error) *error = QStringLiteral("Falha ao ler Metadata.xml (linha %1): %2")
            .arg(reader.lineNumber()).arg(reader.errorString());
        return false;
    }
    for (auto iterator = alternateNames.cbegin(); iterator != alternateNames.cend(); ++iterator) {
        if (!indexValue.contains(iterator.key())) continue;
        QJsonObject game = indexValue.value(iterator.key()).toObject();
        QJsonArray aliases = game.value(QStringLiteral("alternateNames")).toArray();
        for (const QString& alias : iterator.value()) {
            bool exists = false;
            for (const QJsonValue& value : aliases) if (value.toString() == alias) { exists = true; break; }
            if (!exists) aliases.append(alias);
        }
        game.insert(QStringLiteral("alternateNames"), aliases);
        indexValue.insert(iterator.key(), game);
    }
    for (auto iterator = images.cbegin(); iterator != images.cend(); ++iterator) {
        if (!indexValue.contains(iterator.key())) continue;
        QJsonObject game = indexValue.value(iterator.key()).toObject();
        QJsonArray list = game.value(QStringLiteral("images")).toArray();
        for (const QJsonObject& image : iterator.value()) list.append(image);
        game.insert(QStringLiteral("images"), list);
        indexValue.insert(iterator.key(), game);
    }
    if (progress) progress({games, games, QStringLiteral("Construindo índice"), QStringLiteral("done")});
    *index = indexValue;
    if (error) error->clear();
    return true;
}

bool LaunchBoxCache::saveIndex(const QJsonObject& index, QString* error) const {
    QSaveFile file(indexFile());
    if (!file.open(QIODevice::WriteOnly)) {
        if (error) *error = file.errorString();
        return false;
    }
    const QByteArray json = QJsonDocument(index).toJson(QJsonDocument::Compact);
    if (file.write(json) != json.size() || !file.commit()) {
        if (error) *error = file.errorString();
        return false;
    }
    return true;
}
} // namespace gamestock
