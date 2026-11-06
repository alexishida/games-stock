/** Porta do handler games.launch do Electron com separação de argumentos. */
#include "LaunchService.h"

#include "app/ExecutableResolver.h"
#include "app/RetroArchCores.h"
#include "app/RomLaunchExtraction.h"
#include "db/PlatformCatalogData.h"
#include "db/dao/EmulatorDao.h"
#include "db/dao/GameReadDao.h"
#include "db/dao/GameWriteDao.h"
#include "db/dao/PlatformEmulatorDao.h"

#include <QFileInfo>
#include <QFutureWatcher>
#include <QtConcurrentRun>
#include <QProcess>
#include <QRegularExpression>
#ifdef Q_OS_WIN
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif

namespace gamestock {
namespace {
/** Tokeniza argumentos respeitando aspas simples e duplas. */
QStringList parseQuotedArgs(const QString& input) {
    QStringList tokens;
    const QString text = input.trimmed();
    if (text.isEmpty()) return tokens;
    const QRegularExpression pattern(QStringLiteral("\"([^\"]*)\"|'([^']*)'|([^\\s]+)"));
    auto iterator = pattern.globalMatch(text);
    while (iterator.hasNext()) {
        const QRegularExpressionMatch match = iterator.next();
        tokens.append(match.captured(1).isEmpty() ? (match.captured(2).isEmpty() ? match.captured(3) : match.captured(2))
                                                  : match.captured(1));
    }
    return tokens;
}

/** Substitui marcadores ou anexa a ROM ao final, como o renderer Electron. */
QStringList buildGenericLaunchArgs(const QString& configuredArgs, const QString& romPath) {
    QStringList args = parseQuotedArgs(configuredArgs);
    const QString fileName = QFileInfo(romPath).fileName();
    bool usesMarker = false;
    for (QString& argument : args) {
        if (argument.contains(QStringLiteral("{romPath}")) || argument.contains(QStringLiteral("{romFileName}"))) {
            usesMarker = true;
        }
        argument.replace(QStringLiteral("{romPath}"), romPath).replace(QStringLiteral("{romFileName}"), fileName);
    }
    if (!usesMarker) args.append(romPath);
    return args;
}

/** Plataforma Arcade mantém o pacote ZIP para MAME/Supermodel. */
bool isArcadePlatform(const QString& platformName) {
    for (const auto& platform : catalog::platforms()) {
        if (platform.category == QLatin1String("Arcade") && platform.name == platformName) return true;
    }
    return false;
}
} // namespace

LaunchService::LaunchService(QObject* parent) : QObject(parent) {}

bool LaunchService::open(const QString& databasePath, QString* error) {
    QString localError;
    if (!connection_.open(databasePath, &localError)) {
        error_ = localError;
        if (error) *error = localError;
        emit changed();
        return false;
    }
    databasePath_ = databasePath;
    open_ = true;
    error_.clear();
    if (error) error->clear();
    return true;
}

bool LaunchService::isOpen() const { return open_; }

bool LaunchService::beginLaunch(qint64 gameId) {
    if (!open_ || launching_) return false;
    launching_ = true;
    error_.clear();
    emit changed();
    const QString path = databasePath_;
    auto* watcher = new QFutureWatcher<QVariantMap>(this);
    connect(watcher, &QFutureWatcher<QVariantMap>::finished, this, [this, watcher, gameId] {
        const QVariantMap result = watcher->result();
        watcher->deleteLater();
        error_ = result.value(QStringLiteral("error")).toString();
        launching_ = false;
        emit changed();
        emit launchFinished(gameId, result);
    });
    // SQLite e extração usam uma instância criada e destruída na thread de trabalho.
    watcher->setFuture(QtConcurrent::run([path, gameId] {
        LaunchService worker;
        QString error;
        if (!worker.open(path, &error)) return QVariantMap{{QStringLiteral("error"), error}};
        worker.launching_ = true;
        QVariantMap result = worker.launch(gameId);
        if (!result.value(QStringLiteral("success")).toBool()) result.insert(QStringLiteral("error"), worker.error());
        return result;
    }));
    return true;
}

QVariantMap LaunchService::launch(qint64 gameId) {
    if (!open_) {
        error_ = QStringLiteral("Banco da biblioteca indisponível.");
        emit changed();
        return {};
    }
    GameReadDao games(connection_.database());
    QVariantMap game;
    QString error;
    if (!games.get(gameId, &game, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    const QString romPath = game.value(QStringLiteral("rom_path")).toString().trimmed();
    if (romPath.isEmpty()) {
        error_ = QStringLiteral("Jogo não possui caminho de ROM configurado");
        emit changed();
        return {};
    }

    PlatformEmulatorDao links(connection_.database());
    QVariantMap link;
    bool found = false;
    if (!links.getDefault(game.value(QStringLiteral("platform_id")).toLongLong(), &link, &found, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    if (!found) {
        error_ = QStringLiteral("Nenhum emulador padrão configurado para esta plataforma");
        emit changed();
        return {};
    }
    const QVariantMap emulator = link.value(QStringLiteral("emulator")).toMap();
    const QString executable = emulator.value(QStringLiteral("executable")).toString().trimmed();
    if (executable.isEmpty()) {
        error_ = QStringLiteral("Executável do emulador não configurado");
        emit changed();
        return {};
    }
    const ExecutableResolution resolved = resolveConfiguredExecutable(executable);
    if (!resolved.error.isEmpty()) {
        error_ = resolved.error;
        emit changed();
        return {};
    }

    const bool retroArch = emulator.value(QStringLiteral("is_retroarch")).toInt() != 0;
    const QString platformName = game.value(QStringLiteral("platform_name")).toString();
    QString extractionWarning;
    const QString launchRomPath = (!retroArch && isArcadePlatform(platformName))
        ? romPath
        : prepareRomPathForLaunch(romPath, &extractionWarning);

    QStringList arguments;
    if (retroArch) {
        const QString corePath = resolveRetroArchCorePath(link.value(QStringLiteral("core_path")).toString(),
            resolved.resolvedPath, platformName);
        if (corePath.isEmpty()) {
            error_ = QStringLiteral("Core do RetroArch não configurado para esta plataforma");
            emit changed();
            return {};
        }
        arguments = {QStringLiteral("-L"), corePath, launchRomPath};
    } else {
        arguments = buildGenericLaunchArgs(emulator.value(QStringLiteral("args")).toString(), launchRomPath);
    }

    // O spawn precisa ser confirmado antes de registrar a partida.
    qint64 processId = 0;
    if (!QProcess::startDetached(resolved.resolvedPath, arguments, QString(), &processId)) {
        error_ = QStringLiteral("Não foi possível iniciar o emulador.");
        emit changed();
        return {};
    }
#ifdef Q_OS_WIN
    // Na thread de lançamento, aguarda a inicialização da interface do emulador com limite finito.
    // Processos console ou launchers sem fila gráfica retornam sem impedir o jogo.
    if (launching_) {
        const HANDLE process = OpenProcess(SYNCHRONIZE | PROCESS_QUERY_INFORMATION, FALSE, static_cast<DWORD>(processId));
        if (process) { WaitForInputIdle(process, 10000); CloseHandle(process); }
    }
#endif
    GameWriteDao writer(connection_.database());
    QString countError;
    QVariantMap result{{QStringLiteral("success"), true}};
    if (!writer.incrementLaunchCount(gameId, &countError)) {
        // O jogo já abriu; a falha de contagem não invalida o lançamento.
        result.insert(QStringLiteral("warning"), countError);
    }
    if (!extractionWarning.isEmpty()) result.insert(QStringLiteral("warning"), extractionWarning);
    error_.clear();
    emit changed();
    return result;
}

QVariantMap LaunchService::clearExtractedRomCache() {
    int removed = 0;
    QString error;
    if (!gamestock::clearExtractedRomCache(&removed, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    error_.clear();
    emit changed();
    return QVariantMap{{QStringLiteral("success"), true}, {QStringLiteral("removedEntries"), removed}};
}
} // namespace gamestock
