/** Implementa o fallback de mídia da Libretro sem depender de Node.js. */
#include "launchbox/LibretroMedia.h"

#include <QDir>
#include <QEventLoop>
#include <QFile>
#include <QFileInfo>
#include <QHash>
#include <QImage>
#include <QMutex>
#include <QMutexLocker>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QRegularExpression>
#include <QTimer>
#include <QUrl>

#include <algorithm>

namespace gamestock {
namespace {
constexpr const char* defaultBase = "https://thumbnails.libretro.com/";

/** Remove acentos, caixa e pontuação para comparar títulos como o renderer. */
QString normalize(const QString& value) {
    const QString decomposed = value.normalized(QString::NormalizationForm_KD);
    QString out;
    out.reserve(decomposed.size());
    for (const QChar ch : decomposed) {
        if (ch.category() == QChar::Mark_NonSpacing || ch.category() == QChar::Mark_SpacingCombining) continue;
        out.append(ch.toLower());
    }
    out.replace(QRegularExpression(QStringLiteral("[^a-z0-9]+")), QStringLiteral(" "));
    return out.trimmed();
}

/** Mapa de nomes locais para diretórios do catálogo Libretro. */
const QHash<QString, QString>& platformNames() {
    static const QHash<QString, QString> map{
        {QStringLiteral("arcade"), QStringLiteral("MAME")},
        {QStringLiteral("atari 2600"), QStringLiteral("Atari - 2600")},
        {QStringLiteral("atari 7800"), QStringLiteral("Atari - 7800")},
        {QStringLiteral("commodore 64"), QStringLiteral("Commodore - 64")},
        {QStringLiteral("commodore amiga"), QStringLiteral("Commodore - Amiga")},
        {QStringLiteral("game boy"), QStringLiteral("Nintendo - Game Boy")},
        {QStringLiteral("nintendo game boy"), QStringLiteral("Nintendo - Game Boy")},
        {QStringLiteral("game boy advance"), QStringLiteral("Nintendo - Game Boy Advance")},
        {QStringLiteral("nintendo game boy advance"), QStringLiteral("Nintendo - Game Boy Advance")},
        {QStringLiteral("game boy color"), QStringLiteral("Nintendo - Game Boy Color")},
        {QStringLiteral("nintendo game boy color"), QStringLiteral("Nintendo - Game Boy Color")},
        {QStringLiteral("nintendo 64"), QStringLiteral("Nintendo - Nintendo 64")},
        {QStringLiteral("nintendo ds"), QStringLiteral("Nintendo - Nintendo DS")},
        {QStringLiteral("nintendo nes"), QStringLiteral("Nintendo - Nintendo Entertainment System")},
        {QStringLiteral("nintendo entertainment system"), QStringLiteral("Nintendo - Nintendo Entertainment System")},
        {QStringLiteral("nintendo gamecube"), QStringLiteral("Nintendo - GameCube")},
        {QStringLiteral("nintendo wii"), QStringLiteral("Nintendo - Wii")},
        {QStringLiteral("sony playstation"), QStringLiteral("Sony - PlayStation")},
        {QStringLiteral("playstation"), QStringLiteral("Sony - PlayStation")},
        {QStringLiteral("sony playstation 2"), QStringLiteral("Sony - PlayStation 2")},
        {QStringLiteral("playstation 2"), QStringLiteral("Sony - PlayStation 2")},
        {QStringLiteral("sega cd"), QStringLiteral("Sega - Mega-CD - Sega CD")},
        {QStringLiteral("sega dreamcast"), QStringLiteral("Sega - Dreamcast")},
        {QStringLiteral("sega game gear"), QStringLiteral("Sega - Game Gear")},
        {QStringLiteral("sega master system"), QStringLiteral("Sega - Master System - Mark III")},
        {QStringLiteral("sega mega drive"), QStringLiteral("Sega - Mega Drive - Genesis")},
        {QStringLiteral("sega genesis"), QStringLiteral("Sega - Mega Drive - Genesis")},
        {QStringLiteral("sega mega drive genesis"), QStringLiteral("Sega - Mega Drive - Genesis")},
        {QStringLiteral("sega saturn"), QStringLiteral("Sega - Saturn")},
        {QStringLiteral("super nintendo"), QStringLiteral("Nintendo - Super Nintendo Entertainment System")},
        {QStringLiteral("super nintendo entertainment system"), QStringLiteral("Nintendo - Super Nintendo Entertainment System")},
        {QStringLiteral("sammy atomiswave"), QStringLiteral("Atomiswave")},
        {QStringLiteral("sega naomi"), QStringLiteral("Sega - Naomi")},
        {QStringLiteral("sega naomi 2"), QStringLiteral("Sega - Naomi 2")},
        {QStringLiteral("snk neo geo mvs"), QStringLiteral("SNK - Neo Geo")},
    };
    return map;
}

/** Cache do índice de cada pasta durante um lote. */
QHash<QString, QStringList>& directoryCache() {
    static QHash<QString, QStringList> cache;
    return cache;
}

QMutex& cacheMutex() {
    static QMutex mutex;
    return mutex;
}

/** Baixa uma URL e devolve os bytes; vazio em erro ou timeout. */
QByteArray fetch(const QUrl& url) {
    QNetworkAccessManager manager;
    QNetworkRequest request{url};
    request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);
    request.setHeader(QNetworkRequest::UserAgentHeader, QStringLiteral("GameStock/1.0"));
    QNetworkReply* reply = manager.get(request);
    QEventLoop loop;
    QTimer timeout;
    timeout.setSingleShot(true);
    timeout.setInterval(20000);
    QObject::connect(&timeout, &QTimer::timeout, reply, &QNetworkReply::abort);
    QObject::connect(reply, &QNetworkReply::finished, &loop, &QEventLoop::quit);
    timeout.start();
    loop.exec();
    const bool ok = reply->error() == QNetworkReply::NoError
        && reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt() == 200;
    const QByteArray data = ok ? reply->readAll() : QByteArray();
    reply->deleteLater();
    return data;
}

/** Lista os PNGs de um diretório HTML do catálogo, com cache por pasta. */
QStringList listImages(const QString& directoryUrl) {
    {
        QMutexLocker locker(&cacheMutex());
        const auto found = directoryCache().constFind(directoryUrl);
        if (found != directoryCache().constEnd()) return found.value();
    }
    const QByteArray html = fetch(QUrl(directoryUrl));
    QStringList files;
    if (!html.isEmpty()) {
        const QString text = QString::fromUtf8(html);
        QRegularExpression expression(QStringLiteral("href=[\"']([^\"']+\\.png)[\"']"),
            QRegularExpression::CaseInsensitiveOption);
        auto iterator = expression.globalMatch(text);
        while (iterator.hasNext()) {
            QString name = iterator.next().captured(1);
            name.replace(QStringLiteral("&amp;"), QStringLiteral("&"));
            name = QUrl::fromPercentEncoding(name.toUtf8());
            name = name.section(QLatin1Char('/'), -1);
            if (!name.isEmpty() && !files.contains(name)) files.append(name);
        }
    }
    QMutexLocker locker(&cacheMutex());
    directoryCache().insert(directoryUrl, files);
    return files;
}

/** Remove sufixos de região/revisão para comparar títulos. */
QString baseTitle(const QString& fileName) {
    QString title = QFileInfo(fileName).completeBaseName();
    title.remove(QRegularExpression(QStringLiteral("(?:\\s*\\([^)]*\\))+$")));
    return normalize(title);
}

/** Prioriza arte brasileira, depois EUA, mundo, Europa e Japão. */
int regionPriority(const QString& file) {
    static const QStringList regions{QStringLiteral("brazil"), QStringLiteral("usa"), QStringLiteral("world"),
        QStringLiteral("europe"), QStringLiteral("japan")};
    const QString lower = file.toLower();
    for (int index = 0; index < regions.size(); ++index)
        if (lower.contains(QStringLiteral("(%1)").arg(regions.at(index)))) return index;
    return regions.size();
}

/** Localiza a primeira imagem cujo título normalizado coincide exatamente. */
QString findImage(const QString& baseUrl, const QString& platform, const QString& category,
    const QStringList& titles) {
    const QString directory = baseUrl + QUrl::toPercentEncoding(platform).replace("%20", "%20")
        + QLatin1Char('/') + category + QLatin1Char('/');
    const QStringList files = listImages(directory);
    if (files.isEmpty()) return {};
    for (const QString& title : titles) {
        const QString expected = normalize(title);
        QStringList matches;
        for (const QString& file : files)
            if (baseTitle(file) == expected) matches.append(file);
        if (matches.isEmpty()) continue;
        std::sort(matches.begin(), matches.end(), [](const QString& left, const QString& right) {
            return regionPriority(left) < regionPriority(right)
                || (regionPriority(left) == regionPriority(right) && left.localeAwareCompare(right) < 0);
        });
        return directory + QString::fromUtf8(QUrl::toPercentEncoding(matches.first()));
    }
    return {};
}

/** Salva bytes como PNG e gera cover.jpg sem ampliar, preservando arquivos existentes. */
QString saveCover(const QString& gameDir, const QByteArray& bytes) {
    QDir().mkpath(gameDir);
    const QString source = QDir(gameDir).filePath(QStringLiteral("libretro-box-front.png"));
    const QString cover = QDir(gameDir).filePath(QStringLiteral("libretro-cover.jpg"));
    QImage image;
    if (!image.loadFromData(bytes)) return {};
    if (!image.save(source, "PNG")) return {};
    if (QFileInfo::exists(cover)) return cover;
    const QImage resized = image.width() > 280 || image.height() > 280
        ? image.scaled(280, 280, Qt::KeepAspectRatio, Qt::SmoothTransformation) : image;
    const QString temporary = cover + QStringLiteral(".tmp");
    if (!resized.save(temporary, "JPG", 85)) return {};
    QFile::remove(cover);
    if (!QFile::rename(temporary, cover)) { QFile::remove(temporary); return {}; }
    return cover;
}

/** Salva a screenshot PNG sem transformar o arquivo. */
QString saveScreenshot(const QString& gameDir, const QByteArray& bytes) {
    QDir().mkpath(gameDir);
    const QString path = QDir(gameDir).filePath(QStringLiteral("libretro-screenshot-gameplay.png"));
    QImage image;
    if (!image.loadFromData(bytes)) return {};
    return image.save(path, "PNG") ? path : QString();
}
} // namespace

LibretroMedia::LibretroMedia(QString baseUrl)
    : baseUrl_(baseUrl.isEmpty() ? QString::fromLatin1(defaultBase) : std::move(baseUrl)) {
    if (!baseUrl_.endsWith(QLatin1Char('/'))) baseUrl_.append(QLatin1Char('/'));
}

QString LibretroMedia::platformDirectory(const QString& platformName) {
    return platformNames().value(normalize(platformName));
}

LibretroMediaResult LibretroMedia::downloadMedia(const QStringList& titles, const QString& platformName,
    const QString& gameDir, bool cover, bool screenshot) const {
    LibretroMediaResult result;
    const QString platform = platformDirectory(platformName);
    if (platform.isEmpty() || gameDir.isEmpty()) return result;
    if (cover) {
        const QString source = findImage(baseUrl_, platform, QStringLiteral("Named_Boxarts"), titles);
        if (!source.isEmpty()) result.coverPath = saveCover(gameDir, fetch(QUrl(source)));
        if (result.coverPath.isEmpty() && QFileInfo::exists(QDir(gameDir).filePath(QStringLiteral("libretro-cover.jpg"))))
            result.coverPath = QDir(gameDir).filePath(QStringLiteral("libretro-cover.jpg"));
    }
    if (screenshot) {
        const QString source = findImage(baseUrl_, platform, QStringLiteral("Named_Snaps"), titles);
        if (!source.isEmpty()) result.screenshotPath = saveScreenshot(gameDir, fetch(QUrl(source)));
        if (result.screenshotPath.isEmpty()
            && QFileInfo::exists(QDir(gameDir).filePath(QStringLiteral("libretro-screenshot-gameplay.png"))))
            result.screenshotPath = QDir(gameDir).filePath(QStringLiteral("libretro-screenshot-gameplay.png"));
    }
    return result;
}
} // namespace gamestock
