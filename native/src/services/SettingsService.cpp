/** Implementação das seções Logs/Sobre; nenhum caminho do QML chega ao filesystem. */
#include "SettingsService.h"

#include "app/RomLaunchExtraction.h"
#include "db/ReadOnlyConnection.h"

#include <QDesktopServices>
#include <QDir>
#include <QDirIterator>
#include <QFile>
#include <QFileInfo>
#include <QRegularExpression>
#include <QSqlError>
#include <QSqlQuery>
#include <QUrl>

namespace gamestock {
namespace {
/** Limite exibido na aba de logs, igual ao renderer. */
constexpr int kMaxLogEntries = 500;

/** Traduz o código numérico do handler de mensagens do Qt. */
QString levelName(int level) {
    switch (level) {
    case 0: return QStringLiteral("debug");
    case 1: return QStringLiteral("warning");
    case 2: return QStringLiteral("critical");
    case 3: return QStringLiteral("fatal");
    default: return QStringLiteral("info");
    }
}
} // namespace

SettingsService::SettingsService(QObject* parent) : QObject(parent) {}

SettingsService::~SettingsService() = default;

void SettingsService::configure(const QString& profileRoot, const QString& logFile, const QString& databasePath) {
    profileRoot_ = profileRoot;
    logFile_ = logFile;
    databasePath_ = databasePath;
    // Um novo perfil/diagnóstico invalida o cache de estatísticas anterior.
    statsTimer_.invalidate();
    emit statsChanged();
    emit logsChanged();
}

void SettingsService::setBuildLabel(const QString& value) {
    if (buildLabel_ == value) return;
    buildLabel_ = value;
    emit buildChanged();
}

void SettingsService::setChannel(const QString& value) {
    if (channel_ == value) return;
    channel_ = value;
    emit buildChanged();
}

void SettingsService::setExecutableDir(const QString& value) {
    if (executableDir_ == value) return;
    executableDir_ = value;
    emit buildChanged();
}

void SettingsService::refreshLogs() {
    entries_.clear();
    error_.clear();
    QFile file(logFile_);
    if (logFile_.isEmpty() || !file.exists()) {
        emit logsChanged();
        return;
    }
    if (!file.open(QIODevice::ReadOnly)) {
        error_ = file.errorString();
        emit logsChanged();
        return;
    }
    const QStringList lines = QString::fromUtf8(file.readAll()).split(QLatin1Char('\n'), Qt::SkipEmptyParts);
    const QRegularExpression pattern(QStringLiteral("^(\\S+)\\s+(\\d+)\\s+(.*)$"));
    int id = 0;
    for (const QString& line : lines) {
        const QRegularExpressionMatch match = pattern.match(line);
        if (!match.hasMatch()) continue;
        QVariantMap entry;
        entry.insert(QStringLiteral("id"), ++id);
        entry.insert(QStringLiteral("timestamp"), match.captured(1));
        entry.insert(QStringLiteral("level"), levelName(match.captured(2).toInt()));
        entry.insert(QStringLiteral("source"), QStringLiteral("GameStock"));
        entry.insert(QStringLiteral("message"), match.captured(3));
        entries_.append(entry);
    }
    // Mantém apenas as entradas mais recentes para não carregar o arquivo inteiro na UI.
    while (entries_.size() > kMaxLogEntries) entries_.removeFirst();
    emit logsChanged();
}

bool SettingsService::clearLogs() {
    QFile file(logFile_);
    if (logFile_.isEmpty() || !file.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        error_ = logFile_.isEmpty() ? QStringLiteral("Arquivo de log indisponível.") : file.errorString();
        emit logsChanged();
        return false;
    }
    file.close();
    entries_.clear();
    error_.clear();
    emit logsChanged();
    return true;
}

bool SettingsService::openLogsFolder() {
    if (logFile_.isEmpty()) return false;
    const QString folder = QFileInfo(logFile_).absolutePath();
    return !folder.isEmpty() && QDesktopServices::openUrl(QUrl::fromLocalFile(folder));
}

bool SettingsService::openDataDir() {
    if (profileRoot_.isEmpty() || !QDir(profileRoot_).exists()) return false;
    return QDesktopServices::openUrl(QUrl::fromLocalFile(profileRoot_));
}

void SettingsService::refreshStats() {
    // A varredura de disco pode ser cara; o cache curto evita repetir ao alternar abas.
    if (statsTimer_.isValid() && statsTimer_.elapsed() < 30000) return;
    statsLoading_ = true;
    emit statsChanged();

    totalGames_ = -1;
    totalInventoryItems_ = -1;
    if (!databasePath_.isEmpty()) {
        ReadOnlyConnection connection;
        QString databaseError;
        if (connection.open(databasePath_, &databaseError)) {
            QSqlQuery games(connection.database());
            if (games.exec(QStringLiteral("SELECT COUNT(*) FROM games")) && games.next()) totalGames_ = games.value(0).toLongLong();
            QSqlQuery items(connection.database());
            if (items.exec(QStringLiteral("SELECT COUNT(*) FROM hardware_items")) && items.next()) {
                totalInventoryItems_ = items.value(0).toLongLong();
            }
        } else {
            error_ = databaseError;
        }
    }

    qint64 bytes = 0;
    if (!profileRoot_.isEmpty() && QDir(profileRoot_).exists()) {
        QDirIterator iterator(profileRoot_, QDir::Files | QDir::Hidden | QDir::System | QDir::NoDotAndDotDot,
            QDirIterator::Subdirectories);
        while (iterator.hasNext()) {
            iterator.next();
            bytes += iterator.fileInfo().size();
        }
        // Duas casas decimais evitam diferenças de formatação entre leituras.
        dataDirSizeMb_ = qRound(static_cast<double>(bytes) / (1024.0 * 1024.0) * 100.0) / 100.0;
    } else {
        dataDirSizeMb_ = -1;
    }

    statsLoading_ = false;
    statsTimer_.restart();
    emit statsChanged();
}

bool SettingsService::clearRomCache() {
    int removed = 0;
    QString error;
    const bool success = clearExtractedRomCache(&removed, &error);
    cacheFeedback_ = success
        ? (removed > 0 ? QStringLiteral("Cache limpo. %1 pasta(s) temporária(s) removida(s).").arg(removed)
                       : QStringLiteral("Cache já estava vazio."))
        : (error.isEmpty() ? QStringLiteral("Não foi possível limpar o cache temporário.") : error);
    emit cacheFeedbackChanged();
    return success;
}
} // namespace gamestock
