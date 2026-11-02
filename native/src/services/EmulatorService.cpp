/** Implementação da fachada de emuladores; SQL e processo ficam fora do QML. */
#include "EmulatorService.h"

#include "app/ExecutableResolver.h"
#include "app/RetroArchCores.h"
#include "db/dao/EmulatorDao.h"
#include "db/dao/PlatformEmulatorDao.h"

#include <QDir>
#include <QFileInfo>

#include <algorithm>

namespace gamestock {
namespace {
/** Converte uma lista de mapas do DAO em QVariantList para o QML. */
QVariantList toVariantList(const QList<QVariantMap>& rows) {
    QVariantList result;
    for (const QVariantMap& row : rows) result.append(row);
    return result;
}
} // namespace

EmulatorService::EmulatorService(QObject* parent) : QObject(parent) {}

bool EmulatorService::open(const QString& databasePath, QString* error) {
    QString localError;
    if (!connection_.open(databasePath, &localError)) {
        error_ = localError;
        if (error) *error = localError;
        emit changed();
        return false;
    }
    open_ = true;
    refresh();
    if (!error_.isEmpty()) {
        if (error) *error = error_;
        return false;
    }
    if (error) error->clear();
    return true;
}

bool EmulatorService::isOpen() const { return open_; }
QAbstractItemModel* EmulatorService::model() { return &model_; }

void EmulatorService::refresh() {
    if (!open_) return;
    EmulatorDao dao(connection_.database());
    QList<QVariantMap> emulators;
    QString error;
    if (!dao.list(&emulators, &error)) {
        error_ = error;
        emit changed();
        return;
    }
    items_.clear();
    for (const QVariantMap& emulator : emulators) items_.append(emulator);
    model_.setEmulators(emulators);
    error_.clear();
    emit changed();
}

QVariantMap EmulatorService::get(qint64 id) {
    if (!open_) {
        error_ = QStringLiteral("Banco de emuladores indisponível.");
        emit changed();
        return {};
    }
    EmulatorDao dao(connection_.database());
    QVariantMap emulator;
    QString error;
    if (!dao.get(id, &emulator, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    error_.clear();
    return emulator;
}

QVariantMap EmulatorService::create(const QVariantMap& input) {
    if (!open_) {
        error_ = QStringLiteral("Banco de emuladores indisponível.");
        emit changed();
        return {};
    }
    EmulatorDao dao(connection_.database());
    qint64 id = 0;
    QString error;
    if (!dao.create(input, &id, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    refresh();
    if (!error_.isEmpty()) return {};
    return get(id);
}

bool EmulatorService::update(qint64 id, const QVariantMap& changes) {
    if (!open_) {
        error_ = QStringLiteral("Banco de emuladores indisponível.");
        emit changed();
        return false;
    }
    EmulatorDao dao(connection_.database());
    QString error;
    if (!dao.update(id, changes, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    refresh();
    return error_.isEmpty();
}

bool EmulatorService::remove(qint64 id) {
    if (!open_) {
        error_ = QStringLiteral("Banco de emuladores indisponível.");
        emit changed();
        return false;
    }
    EmulatorDao dao(connection_.database());
    QString error;
    if (!dao.remove(id, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    refresh();
    return error_.isEmpty();
}

QVariantList EmulatorService::listByPlatform(qint64 platformId) {
    if (!open_) {
        error_ = QStringLiteral("Banco de emuladores indisponível.");
        emit changed();
        return {};
    }
    PlatformEmulatorDao dao(connection_.database());
    QList<QVariantMap> links;
    QString error;
    if (!dao.listByPlatform(platformId, &links, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    error_.clear();
    return toVariantList(links);
}

QVariantMap EmulatorService::listByPlatforms(const QVariantList& platformIds) {
    QList<qint64> ids;
    for (const QVariant& entry : platformIds) ids.append(entry.toLongLong());
    if (!open_) {
        error_ = QStringLiteral("Banco de emuladores indisponível.");
        emit changed();
        return {};
    }
    PlatformEmulatorDao dao(connection_.database());
    QVariantMap grouped;
    QString error;
    if (!dao.listByPlatforms(ids, &grouped, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    error_.clear();
    return grouped;
}

QVariantMap EmulatorService::getDefault(qint64 platformId) {
    if (!open_) {
        error_ = QStringLiteral("Banco de emuladores indisponível.");
        emit changed();
        return {};
    }
    PlatformEmulatorDao dao(connection_.database());
    QVariantMap link;
    bool found = false;
    QString error;
    if (!dao.getDefault(platformId, &link, &found, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    error_.clear();
    return found ? link : QVariantMap{};
}

QVariantMap EmulatorService::link(qint64 emulatorId, qint64 platformId, bool isDefault, const QString& corePath) {
    if (!open_) {
        error_ = QStringLiteral("Banco de emuladores indisponível.");
        emit changed();
        return {};
    }
    PlatformEmulatorDao dao(connection_.database());
    QVariantMap link;
    QString error;
    if (!dao.link(emulatorId, platformId, isDefault, corePath, &link, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    error_.clear();
    emit linksChanged();
    return link;
}

bool EmulatorService::unlink(qint64 emulatorId, qint64 platformId) {
    if (!open_) {
        error_ = QStringLiteral("Banco de emuladores indisponível.");
        emit changed();
        return false;
    }
    PlatformEmulatorDao dao(connection_.database());
    QString error;
    if (!dao.unlink(emulatorId, platformId, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    error_.clear();
    emit linksChanged();
    return true;
}

bool EmulatorService::savePlatformLinks(const QVariantList& changes) {
    if (!open_) {
        error_ = QStringLiteral("Banco de emuladores indisponível.");
        emit changed();
        return false;
    }
    PlatformEmulatorDao dao(connection_.database());
    QString error;
    if (!dao.linkMany(changes, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    error_.clear();
    emit linksChanged();
    return true;
}

QVariantMap EmulatorService::listRetroArchCores(qint64 emulatorId) {    if (!open_) {
        error_ = QStringLiteral("Banco de emuladores indisponível.");
        emit changed();
        return {};
    }
    EmulatorDao dao(connection_.database());
    QVariantMap emulator;
    QString error;
    if (!dao.get(emulatorId, &emulator, &error) || emulator.value(QStringLiteral("is_retroarch")).toInt() == 0) {
        error_ = QStringLiteral("RetroArch não encontrado");
        emit changed();
        return {};
    }
    const QString executable = emulator.value(QStringLiteral("executable")).toString().trimmed();
    if (executable.isEmpty()) {
        error_.clear();
        return QVariantMap{{QStringLiteral("coresDir"), QVariant(QMetaType(QMetaType::QString))},
            {QStringLiteral("coresDirExists"), false}, {QStringLiteral("executableConfigured"), false},
            {QStringLiteral("installedCores"), QVariantList{}}};
    }
    const ExecutableResolution resolved = resolveConfiguredExecutable(executable);
    if (!resolved.error.isEmpty()) {
        error_ = resolved.error;
        emit changed();
        return {};
    }
    const QString coresDir = QDir(QFileInfo(resolved.resolvedPath).absolutePath()).filePath(QStringLiteral("cores"));
    if (!QFileInfo::exists(coresDir)) {
        error_.clear();
        return QVariantMap{{QStringLiteral("coresDir"), coresDir}, {QStringLiteral("coresDirExists"), false},
            {QStringLiteral("executableConfigured"), true}, {QStringLiteral("installedCores"), QVariantList{}}};
    }
    QStringList installed;
    const QFileInfoList entries = QDir(coresDir).entryInfoList(QDir::AllEntries | QDir::NoDotAndDotDot);
    for (const QFileInfo& entry : entries) {
        const QString suffix = entry.suffix().toLower();
        if (suffix != QLatin1String("dll") && suffix != QLatin1String("so") && suffix != QLatin1String("dylib")) continue;
        const QString name = entry.completeBaseName();
        if (!installed.contains(name)) installed.append(name);
    }
    std::stable_sort(installed.begin(), installed.end(), [](const QString& left, const QString& right) {
        return QString::localeAwareCompare(left, right) < 0;
    });
    error_.clear();
    QVariantList names;
    for (const QString& name : installed) names.append(name);
    return QVariantMap{{QStringLiteral("coresDir"), coresDir}, {QStringLiteral("coresDirExists"), true},
        {QStringLiteral("executableConfigured"), true}, {QStringLiteral("installedCores"), names}};
}

QStringList EmulatorService::retroArchCoreCandidates(const QString& platformName) {
    return retroArchCoreCandidatesForPlatform(platformName);
}

QStringList EmulatorService::compatibleRetroArchCores(const QString& platformName, const QStringList& installedCores) {
    return compatibleInstalledCores(platformName, installedCores);
}
} // namespace gamestock
