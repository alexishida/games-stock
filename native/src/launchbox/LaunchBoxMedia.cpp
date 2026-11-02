/** Porta da parte de mídia de scraper.ts usando QtGui/QImage. */
#include "LaunchBoxMedia.h"

#include <QDateTime>
#include <QDir>
#include <QEventLoop>
#include <QFile>
#include <QFileInfo>
#include <QImage>
#include <QImageReader>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QRegularExpression>
#include <QSaveFile>
#include <QTimer>
#include <QUrl>
#include <QUuid>

#include <algorithm>

namespace gamestock {
namespace {
const QString defaultImagesBase = QStringLiteral("https://images.launchbox-app.com/");
constexpr qint64 maxImageBytes = 20LL * 1024 * 1024;
const QStringList regionPriority{QStringLiteral("brazil"), QStringLiteral("north-america"),
    QStringLiteral("europe"), QStringLiteral("world"), QStringLiteral("united-states"),
    QStringLiteral("no_region")};

/** Sanitiza nomes como o renderer: minúsculas, alfanuméricos e hífens. */
QString sanitize(const QString& value) {
    QString result = value.toLower();
    result.replace(QRegularExpression(QStringLiteral("[^a-z0-9\\s]")), QString());
    result = result.trimmed();
    result.replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral("-"));
    return result.left(120);
}

/** Separa palavras por hífen, preservando apenas [a-z0-9]. */
QString slug(const QString& value) {
    QString result = value.toLower();
    result.replace(QRegularExpression(QStringLiteral("[^a-z0-9]+")), QStringLiteral(" "));
    result = result.trimmed();
    result.replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral("-"));
    return result.left(120);
}

/** Nome determinístico de cada arquivo de mídia. */
QString imageFilename(const QVariantMap& image, int index) {
    const QString source = image.value(QStringLiteral("filename")).toString();
    QString extension = QFileInfo(source).suffix();
    extension = extension.isEmpty() ? QStringLiteral(".jpg") : QLatin1Char('.') + extension;
    const QString region = image.value(QStringLiteral("region")).toString();
    return slug(image.value(QStringLiteral("type")).toString()) + QLatin1Char('-')
        + slug(region.isEmpty() ? QStringLiteral("no_region") : region) + QLatin1Char('-')
        + QStringLiteral("%1").arg(index + 1, 2, 10, QLatin1Char('0')) + extension;
}

/** GET síncrono com limite de tamanho, timeout e publicação atômica. */
bool downloadToFile(const QUrl& url, const QString& destination, QString* error) {
    QNetworkAccessManager manager;
    QNetworkRequest request{url};
    request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);
    request.setHeader(QNetworkRequest::UserAgentHeader, QStringLiteral("GameStock/1.0"));
    QNetworkReply* reply = manager.get(request);
    const QString temporary = destination + QLatin1Char('.')
        + QUuid::createUuid().toString(QUuid::WithoutBraces) + QStringLiteral(".tmp");
    QFile file(temporary);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        if (error) *error = file.errorString();
        reply->abort();
        reply->deleteLater();
        return false;
    }
    QEventLoop loop;
    QTimer timeout;
    timeout.setSingleShot(true);
    QObject::connect(&timeout, &QTimer::timeout, reply, &QNetworkReply::abort);
    QObject::connect(reply, &QNetworkReply::finished, &loop, &QEventLoop::quit);
    QObject::connect(reply, &QNetworkReply::readyRead, &loop, [&] {
        const QByteArray chunk = reply->readAll();
        if (file.size() + chunk.size() > maxImageBytes) {
            reply->abort();
            return;
        }
        file.write(chunk);
    });
    timeout.start(30000);
    loop.exec();
    file.close();
    const bool ok = reply->error() == QNetworkReply::NoError
        && reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt() == 200
        && file.size() > 0 && file.size() <= maxImageBytes;
    if (!ok && error) {
        *error = reply->error() == QNetworkReply::OperationCanceledError
            ? QStringLiteral("Tempo esgotado ao baixar imagem.")
            : QStringLiteral("Falha ao baixar imagem: ") + reply->errorString();
    }
    reply->deleteLater();
    if (!ok) {
        QFile::remove(temporary);
        return false;
    }
    // Publica com QSaveFile para não perder uma imagem anterior se a cópia falhar.
    QFile input(temporary);
    if (!input.open(QIODevice::ReadOnly)) {
        if (error) *error = input.errorString();
        QFile::remove(temporary);
        return false;
    }
    QSaveFile output(destination);
    if (!output.open(QIODevice::WriteOnly)) {
        if (error) *error = output.errorString();
        QFile::remove(temporary);
        return false;
    }
    bool copied = true;
    while (!input.atEnd()) {
        const QByteArray chunk = input.read(1024 * 1024);
        if (output.write(chunk) != chunk.size()) { copied = false; break; }
    }
    if (!copied || !output.commit()) {
        if (error) *error = output.errorString();
        QFile::remove(temporary);
        return false;
    }
    QFile::remove(temporary);
    return true;
}
} // namespace

LaunchBoxMedia::LaunchBoxMedia(QString imagesBaseUrl)
    : imagesBaseUrl_(imagesBaseUrl.isEmpty() ? defaultImagesBase : std::move(imagesBaseUrl)) {}

QString LaunchBoxMedia::gameImageDir(const QString& outputDir, const QVariantMap& game) {
    const QString platform = sanitize(game.value(QStringLiteral("platform")).toString());
    QString name = sanitize(game.value(QStringLiteral("name")).toString());
    if (name.isEmpty()) name = QStringLiteral("unknown");
    const QString id = game.value(QStringLiteral("id")).toString();
    return QDir(outputDir).filePath((platform.isEmpty() ? QStringLiteral("unknown-platform") : platform)
        + QLatin1Char('/') + name + (id.isEmpty() ? QString() : QLatin1Char('-') + id));
}

QString LaunchBoxMedia::preferredBoxArt(const QStringList& files) {
    QStringList boxArt;
    for (const QString& file : files) {
        const QString name = QFileInfo(file).fileName().toLower();
        if (name.startsWith(QStringLiteral("box-front-")) || name.startsWith(QStringLiteral("box-front-reconstructed-"))) {
            boxArt.append(file);
        }
    }
    if (boxArt.isEmpty()) return {};
    for (const QString& region : regionPriority) {
        for (const QString& file : boxArt) {
            if (QFileInfo(file).fileName().toLower().contains(QStringLiteral("box-front-") + region + QLatin1Char('-'))) {
                return file;
            }
        }
    }
    return boxArt.first();
}

QString LaunchBoxMedia::ensureCoverPreview(const QString& gameDir, const QStringList& files) {
    const QString selected = preferredBoxArt(files);
    if (selected.isEmpty()) return {};
    QImageReader reader(selected);
    reader.setAutoTransform(true);
    QImage image = reader.read();
    if (image.isNull()) return {};
    const bool landscape = image.width() > image.height();
    const QSize target = landscape ? QSize(280, 195) : QSize(195, 280);
    // Nunca amplia: imagens menores mantêm as dimensões originais.
    if (image.width() > target.width() || image.height() > target.height()) {
        const QSize scaled = image.size().scaled(target, Qt::KeepAspectRatio);
        image = image.scaled(scaled, Qt::KeepAspectRatio, Qt::SmoothTransformation);
    }
    const QString cover = QDir(gameDir).filePath(QStringLiteral("cover.jpg"));
    return image.save(cover, "JPG", 85) ? cover : QString();
}

LaunchBoxMediaResult LaunchBoxMedia::downloadImages(const QVariantMap& game, const QString& outputDir,
    const QStringList& types, const std::function<void(const LaunchBoxProgress&)>& progress, bool force) {
    LaunchBoxMediaResult result;
    const QString gameDir = gameImageDir(outputDir, game);
    if (!QDir().mkpath(gameDir)) return result;
    QList<QVariantMap> images;
    for (const QVariant& value : game.value(QStringLiteral("images")).toList()) {
        const QVariantMap image = value.toMap();
        if (!types.isEmpty() && !types.contains(image.value(QStringLiteral("type")).toString())) continue;
        images.append(image);
    }
    for (int index = 0; index < images.size(); ++index) {
        const QVariantMap image = images.at(index);
        const QString filename = imageFilename(image, index);
        const QString destination = QDir(gameDir).filePath(filename);
        const qint64 current = index + 1;
        if (!force && QFileInfo::exists(destination) && QFileInfo(destination).size() > 0) {
            ++result.skipped;
            result.files.append(destination);
            if (progress) progress({current, images.size(), filename, QStringLiteral("skipped")});
            continue;
        }
        if (progress) progress({current, images.size(), filename, QStringLiteral("downloading")});
        const QString source = image.value(QStringLiteral("filename")).toString();
        if (source.isEmpty() || !downloadToFile(QUrl(imagesBaseUrl_ + source), destination, nullptr)) {
            ++result.failed;
            if (progress) progress({current, images.size(), filename, QStringLiteral("error")});
            continue;
        }
        ++result.success;
        result.files.append(destination);
        if (progress) progress({current, images.size(), filename, QStringLiteral("done")});
    }

    const QString cover = ensureCoverPreview(gameDir, result.files);
    if (!cover.isEmpty() && !result.files.contains(cover)) result.files.prepend(cover);

    QSaveFile metadata(QDir(gameDir).filePath(QStringLiteral("metadata.json")));
    if (metadata.open(QIODevice::WriteOnly)) {
        const QByteArray json = QJsonDocument(QJsonObject::fromVariantMap(game)).toJson(QJsonDocument::Indented);
        if (metadata.write(json) == json.size()) metadata.commit();
    }
    return result;
}
} // namespace gamestock
