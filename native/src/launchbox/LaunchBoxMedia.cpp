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
#include <memory>
#include <vector>

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

/** Publica o arquivo temporário no destino com QSaveFile, sem perder uma imagem anterior. */
bool publishDownload(const QString& temporary, const QString& destination, QString* error) {
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

/** Transferência ativa da fila paralela; cada item escreve seu próprio temporário. */
struct ActiveDownload {
    QNetworkReply* reply = nullptr;
    QFile file;
    QTimer timeout;
    QString temporary;
    QString destination;
    QString filename;
    int index = 0;
};
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
    const QStringList& types, const std::function<void(const LaunchBoxProgress&)>& progress, bool force,
    int maxParallel) {
    LaunchBoxMediaResult result;
    const QString gameDir = gameImageDir(outputDir, game);
    if (!QDir().mkpath(gameDir)) return result;
    QList<QVariantMap> images;
    for (const QVariant& value : game.value(QStringLiteral("images")).toList()) {
        const QVariantMap image = value.toMap();
        if (!types.isEmpty() && !types.contains(image.value(QStringLiteral("type")).toString())) continue;
        images.append(image);
    }
    // A lista final é remontada na ordem do índice, independente da ordem de conclusão.
    QList<QString> filesByIndex(images.size());
    QList<bool> available(images.size(), false);
    qint64 completed = 0;
    const qint64 total = images.size();

    /** Registra o fim de uma imagem e mantém o contador de progresso crescente. */
    const auto report = [&](const QString& filename, const QString& status) {
        ++completed;
        if (progress) progress({completed, total, filename, status});
    };

    struct Pending {
        int index = 0;
        QUrl url;
        QString destination;
        QString filename;
    };
    QList<Pending> queue;
    for (int index = 0; index < images.size(); ++index) {
        const QVariantMap image = images.at(index);
        const QString filename = imageFilename(image, index);
        const QString destination = QDir(gameDir).filePath(filename);
        if (!force && QFileInfo::exists(destination) && QFileInfo(destination).size() > 0) {
            ++result.skipped;
            filesByIndex[index] = destination;
            available[index] = true;
            report(filename, QStringLiteral("skipped"));
            continue;
        }
        const QString source = image.value(QStringLiteral("filename")).toString();
        if (source.isEmpty()) {
            ++result.failed;
            report(filename, QStringLiteral("error"));
            continue;
        }
        // Mais de uma conexão reduz o tempo total sem sobrecarregar o serviço de imagens.
        queue.append(Pending{index, QUrl(imagesBaseUrl_ + source), destination, filename});
    }

    QNetworkAccessManager manager;
    // O limite é fechado no código: nem zero (sem fila) nem muitos sockets contra o serviço.
    const int parallel = std::clamp(maxParallel, 1, 4);
    std::vector<std::unique_ptr<ActiveDownload>> active;
    active.reserve(parallel);
    qsizetype next = 0;
    qsizetype remaining = queue.size();
    QEventLoop loop;

    // A fila só recarrega quando uma vaga abre; cada imagem mantém timeout por inatividade.
    std::function<void()> startNext;
    startNext = [&] {
        while (static_cast<int>(active.size()) < parallel && next < queue.size()) {
            const Pending pending = queue.at(next++);
            auto transfer = std::make_unique<ActiveDownload>();
            transfer->index = pending.index;
            transfer->destination = pending.destination;
            transfer->filename = pending.filename;
            transfer->temporary = pending.destination + QLatin1Char('.')
                + QUuid::createUuid().toString(QUuid::WithoutBraces) + QStringLiteral(".tmp");
            transfer->file.setFileName(transfer->temporary);
            if (!transfer->file.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
                ++result.failed;
                report(pending.filename, QStringLiteral("error"));
                --remaining;
                QFile::remove(transfer->temporary);
                continue;
            }
            QNetworkRequest request{pending.url};
            request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);
            request.setHeader(QNetworkRequest::UserAgentHeader, QStringLiteral("GameStock/1.0"));
            transfer->reply = manager.get(request);
            ActiveDownload* current = transfer.get();
            // O abort é enfileirado para não destruir a transferência dentro do próprio sinal.
            QObject::connect(&transfer->timeout, &QTimer::timeout, transfer->reply, &QNetworkReply::abort,
                Qt::QueuedConnection);
            QObject::connect(transfer->reply, &QNetworkReply::readyRead, &loop, [current] {
                const QByteArray chunk = current->reply->readAll();
                if (current->file.size() + chunk.size() > maxImageBytes) {
                    QMetaObject::invokeMethod(current->reply, &QNetworkReply::abort, Qt::QueuedConnection);
                    return;
                }
                current->file.write(chunk);
                current->timeout.start(30000);
            });
            QObject::connect(transfer->reply, &QNetworkReply::finished, &loop, [&, current] {
                // O restante do buffer chega junto do `finished`; validar tamanho antes de publicar.
                const QByteArray tail = current->reply->readAll();
                if (!tail.isEmpty() && current->file.size() + tail.size() <= maxImageBytes) current->file.write(tail);
                current->file.close();
                const bool ok = current->reply->error() == QNetworkReply::NoError
                    && current->reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt() == 200
                    && current->file.size() > 0 && current->file.size() <= maxImageBytes;
                bool published = false;
                if (ok) published = publishDownload(current->temporary, current->destination, nullptr);
                if (published) {
                    ++result.success;
                    filesByIndex[current->index] = current->destination;
                    available[current->index] = true;
                    report(current->filename, QStringLiteral("done"));
                } else {
                    ++result.failed;
                    QFile::remove(current->temporary);
                    report(current->filename, QStringLiteral("error"));
                }
                current->reply->deleteLater();
                for (auto iterator = active.begin(); iterator != active.end(); ++iterator) {
                    if (iterator->get() == current) { active.erase(iterator); break; }
                }
                --remaining;
                if (remaining == 0) {
                    loop.quit();
                    return;
                }
                startNext();
            });
            transfer->timeout.start(30000);
            active.push_back(std::move(transfer));
            if (progress) progress({completed, total, pending.filename, QStringLiteral("downloading")});
        }
        // Fila já consumida e nenhuma transferência ativa: não há sinal de `finished` para encerrar.
        if (active.empty() && next >= queue.size() && remaining == 0) loop.quit();
    };

    startNext();
    if (remaining > 0) loop.exec();

    for (int index = 0; index < available.size(); ++index) {
        if (available.at(index)) result.files.append(filesByIndex.at(index));
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
