/** Detecção e persistência do canal sem depender do SO para escolher o pacote. */
#include "ChannelIdentity.h"

#include "db/dao/AppStateReadDao.h"
#include "db/dao/AppStateWriteDao.h"

#include <QDateTime>
#include <QDir>
#include <QFileInfo>
#include <QJsonObject>

namespace gamestock {
namespace {
constexpr auto kChannelKey = "gamestock.build.channel";

/** Marcador criado pelo deploy portátil ao lado do executável. */
QString portableMarker(const QString& directory) {
    return QDir(directory).filePath(QStringLiteral("portable.marker"));
}

/** Marcador criado pelo instalador NSIS na pasta de instalação. */
QString installMarker(const QString& directory) {
    return QDir(directory).filePath(QStringLiteral("install.marker"));
}
} // namespace

ChannelInfo detectChannel(const QString& executablePath, const QProcessEnvironment& environment,
    const QString& overrideChannel) {
    ChannelInfo info;
    const QFileInfo executable(executablePath);
    info.executableDir = executable.absolutePath();
    const QString override = overrideChannel.trimmed().toLower();
    if (override == QLatin1String("portable") || override == QLatin1String("installed")
        || override == QLatin1String("development")) {
        info.channel = override;
        info.markerPath = override == QLatin1String("portable") ? portableMarker(info.executableDir)
            : (override == QLatin1String("installed") ? installMarker(info.executableDir) : QString());
        return info;
    }
    if (!environment.value(QStringLiteral("PORTABLE_EXECUTABLE_DIR")).isEmpty()) {
        info.channel = QStringLiteral("portable");
        info.markerPath = portableMarker(info.executableDir);
        return info;
    }
    if (QFileInfo::exists(portableMarker(info.executableDir))) {
        info.channel = QStringLiteral("portable");
        info.markerPath = portableMarker(info.executableDir);
        return info;
    }
    if (QFileInfo::exists(installMarker(info.executableDir))) {
        info.channel = QStringLiteral("installed");
        info.markerPath = installMarker(info.executableDir);
        return info;
    }
    const QDir directory(info.executableDir);
    const QStringList uninstallers = directory.entryList({QStringLiteral("uninstall*.exe")}, QDir::Files);
    if (!uninstallers.isEmpty()) {
        info.channel = QStringLiteral("installed");
        info.markerPath = directory.filePath(uninstallers.first());
        return info;
    }
    info.channel = QStringLiteral("development");
    return info;
}

bool saveChannelIdentity(QSqlDatabase& database, const ChannelInfo& info, QString* error) {
    QJsonObject value{{QStringLiteral("channel"), info.channel},
        {QStringLiteral("executableDir"), info.executableDir},
        {QStringLiteral("markerPath"), info.markerPath},
        {QStringLiteral("recordedAt"), QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs)}};
    AppStateWriteDao dao(database);
    return dao.set(QString::fromLatin1(kChannelKey), value, error);
}

QString persistedChannel(QSqlDatabase& database, QString* error) {
    AppStateReadDao dao(database);
    QJsonValue value;
    QString localError;
    if (!dao.get(QString::fromLatin1(kChannelKey), &value, &localError)) {
        if (error) *error = localError;
        return {};
    }
    if (error) error->clear();
    return value.toObject().value(QStringLiteral("channel")).toString();
}
} // namespace gamestock
