/** Implementa a busca de títulos Libretro sem baixar imagens. */
#include "LibretroClient.h"

#include <QEventLoop>
#include <QFileInfo>
#include <QHash>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QRegularExpression>
#include <QTimer>
#include <QUrl>

#include <algorithm>

namespace gamestock {
namespace {
const QString defaultBase = QStringLiteral("https://thumbnails.libretro.com/");

/** Normaliza título/plataforma como o renderer. */
QString normalize(const QString& value) {
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

/** Remove sufixos de região/revisão ao final do título. */
QString titleWithoutRegions(const QString& fileName) {
    QString title = QFileInfo(fileName).completeBaseName();
    title.remove(QRegularExpression(QStringLiteral("(?:\\s*\\([^)]*\\))+$")));
    return title.trimmed();
}
} // namespace

LibretroClient::LibretroClient(QString baseUrl) : baseUrl_(baseUrl.isEmpty() ? defaultBase : std::move(baseUrl)) {}

QString LibretroClient::platformDirectory(const QString& platformName) {
    static const QHash<QString, QString> names{
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
        {QStringLiteral("snk neo geo mvs"), QStringLiteral("SNK - Neo Geo")}
    };
    return names.value(normalize(platformName));
}

QStringList LibretroClient::listImages(const QString& directory) {
    QUrl url(directory);
    if (!url.isValid()) return {};
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
    timeout.start(15000);
    loop.exec();
    const bool ok = reply->error() == QNetworkReply::NoError
        && reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt() == 200;
    const QString html = ok ? QString::fromUtf8(reply->readAll()) : QString();
    reply->deleteLater();
    if (!ok) return {};

    QStringList files;
    const QRegularExpression pattern(QStringLiteral("<a href=\"([^\"?#]+\\.png)\">"),
        QRegularExpression::CaseInsensitiveOption);
    auto iterator = pattern.globalMatch(html);
    while (iterator.hasNext()) {
        QString name = iterator.next().captured(1);
        name.replace(QStringLiteral("&amp;"), QStringLiteral("&"));
        name = QUrl::fromPercentEncoding(name.toUtf8());
        if (name.contains(QLatin1Char('/')) || name.contains(QLatin1Char('\\'))) continue;
        if (!files.contains(name)) files.append(name);
    }
    return files;
}

QStringList LibretroClient::searchTitles(const QString& query, const QString& platformName) {
    const QString platform = platformDirectory(platformName);
    const QString expected = normalize(query);
    if (platform.isEmpty() || expected.isEmpty()) return {};
    const QString directory = baseUrl_ + QString::fromLatin1(QUrl::toPercentEncoding(platform)) +
        QStringLiteral("/Named_Boxarts/");
    const QStringList files = listImages(directory);
    QStringList names;
    for (const QString& file : files) {
        const QString title = titleWithoutRegions(file);
        const QString key = normalize(title);
        if (key.contains(expected) && !names.contains(title)) names.append(title);
        if (names.size() >= 30) break;
    }
    std::stable_sort(names.begin(), names.end(), [&expected](const QString& left, const QString& right) {
        const bool leftExact = normalize(left) == expected;
        const bool rightExact = normalize(right) == expected;
        if (leftExact != rightExact) return leftExact;
        return QString::localeAwareCompare(left, right) < 0;
    });
    return names;
}
} // namespace gamestock
