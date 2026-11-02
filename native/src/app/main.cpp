/** Bootstrap do protótipo Qt: exige perfil explícito e não abre o banco real do usuário. */
#include "ChannelIdentity.h"
#include "WindowState.h"
#include "MediaReader.h"
#include "DataPaths.h"
#include "FixtureLibrary.h"
#include "services/GameService.h"
#include "services/PlatformService.h"
#include "services/EmulatorService.h"
#include "services/LaunchService.h"
#include "services/InventoryPreferences.h"
#include "services/InventoryService.h"
#include "services/BackupCoordinator.h"
#include "services/SettingsService.h"
#include "update/UpdateConfig.h"
#include "update/UpdateService.h"
#include "services/RomFolderService.h"
#include "services/MediaSyncService.h"
#include "services/MetadataService.h"
#include "db/JobStateStore.h"
#include "db/WriteConnection.h"
#include "db/Database.h"
#include "db/dao/AppStateReadDao.h"
#include "jobs/JobManager.h"
#include "jobs/JobRegistry.h"
#include "ProfileLock.h"

#include <QCommandLineParser>
#include <QCommandLineOption>
#include <QDateTime>
#include <QElapsedTimer>
#include <QDebug>
#include <QDir>
#include <QFile>
#include <QFontDatabase>
#include <QGuiApplication>
#include <QIcon>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJSValue>
#include <QMutex>
#include <QMutexLocker>
#include <QProcessEnvironment>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>
#include <QQuickWindow>
#include <QQuickItem>
#include <QSGRendererInterface>
#include <QQuickImageProvider>
#include <QScreen>
#include <QTimer>
#include <cstdio>
#include <memory>
#ifdef Q_OS_WIN
#include <qt_windows.h>
#include <psapi.h>
#endif

namespace {
/** Memória residente do processo, usada pelo relatório de inicialização. */
quint64 workingSetBytes() {
#ifdef Q_OS_WIN
    PROCESS_MEMORY_COUNTERS counters{};
    if (GetProcessMemoryInfo(GetCurrentProcess(), &counters, sizeof(counters))) return counters.WorkingSetSize;
#endif
    return 0;
}

/** Destino e mutex são inicializados antes de instalar o handler e vivem até o encerramento. */
QString logFilePath;
QMutex logMutex;

/** Medidas de moldura usadas pelo Qt e pelo getBounds do Electron, em pixels lógicos. */
struct FrameMetrics {
    QMargins qt;
    QMargins legacy;
};

/** Tempo de CPU do processo em milissegundos; valor negativo indica indisponibilidade. */
qint64 processCpuTimeMs() {
#ifdef Q_OS_WIN
    FILETIME created{}, exited{}, kernel{}, user{};
    if (!GetProcessTimes(GetCurrentProcess(), &created, &exited, &kernel, &user)) return -1;
    ULARGE_INTEGER kernelValue{}, userValue{};
    kernelValue.LowPart = kernel.dwLowDateTime; kernelValue.HighPart = kernel.dwHighDateTime;
    userValue.LowPart = user.dwLowDateTime; userValue.HighPart = user.dwHighDateTime;
    return static_cast<qint64>((kernelValue.QuadPart + userValue.QuadPart) / 10000);
#else
    return -1;
#endif
}

/** Inclui bordas invisíveis do Windows, que frameGeometry do Qt não contabiliza. */
FrameMetrics frameMetrics(QQuickWindow* window) {
    const QMargins qt = window->frameMargins();
#ifdef Q_OS_WIN
    RECT outer{}, client{};
    POINT origin{0, 0};
    const HWND handle = reinterpret_cast<HWND>(window->winId());
    if (GetWindowRect(handle, &outer) && GetClientRect(handle, &client) && ClientToScreen(handle, &origin)) {
        const qreal scale = window->devicePixelRatio();
        if (scale > 0) {
            const QMargins legacy(qRound((origin.x - outer.left) / scale), qRound((origin.y - outer.top) / scale),
                qRound((outer.right - origin.x - client.right) / scale), qRound((outer.bottom - origin.y - client.bottom) / scale));
            return {qt, legacy};
        }
    }
#endif
    return {qt, qt};
}

/** Converte a moldura visível Qt para o retângulo externo persistido pelo Electron. */
QRect legacyWindowBounds(QQuickWindow* window) {
    const FrameMetrics metrics = frameMetrics(window);
    const QRect frame = window->frameGeometry();
    const int hiddenLeft = metrics.legacy.left() - metrics.qt.left();
    const int hiddenTop = metrics.legacy.top() - metrics.qt.top();
    const QSize size(window->width() + metrics.legacy.left() + metrics.legacy.right(),
                     window->height() + metrics.legacy.top() + metrics.legacy.bottom());
    return {frame.x() - hiddenLeft, frame.y() - hiddenTop, size.width(), size.height()};
}

/** Mantém diagnósticos em disco sem depender de objetos gráficos nem perder mensagens no stderr. */
void writeLog(QtMsgType type, const QMessageLogContext&, const QString& message) {
    QMutexLocker locker(&logMutex);
    const QByteArray line = (QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs) + " " + QString::number(type) + " " + message + "\n").toUtf8();
    QFile file(logFilePath);
    if (file.open(QIODevice::WriteOnly | QIODevice::Append)) file.write(line);
    std::fwrite(line.constData(), 1, static_cast<size_t>(line.size()), stderr);
}

/** Carrega somente catálogo de fixture JSON; a porta SQLite será validada em etapa própria. */
QVariantList loadCatalog(const QString& filePath) {
    if (filePath.isEmpty()) return {};
    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly)) qFatal("Não foi possível ler o catálogo de fixture.");
    QJsonParseError error;
    const auto document = QJsonDocument::fromJson(file.readAll(), &error);
    if (error.error != QJsonParseError::NoError || !document.isArray()) qFatal("Catálogo de fixture inválido.");
    QVariantList catalog = document.array().toVariantList();
    // Dados externos não podem injetar URLs file/http diretamente no componente Image.
    for (QVariant& entry : catalog) {
        QVariantMap game = entry.toMap();
        const QString path = game.value("box_art_path").toString();
        const QByteArray id = path.toUtf8().toBase64(QByteArray::Base64UrlEncoding | QByteArray::OmitTrailingEquals);
        game.insert("coverUrl", path.isEmpty() ? QString() : QStringLiteral("image://profilemedia/") + QString::fromLatin1(id));
        entry = game;
    }
    return catalog;
}

/** Decodifica identificadores de mídia e delega a leitura à fronteira do perfil. */
class ProfileMediaProvider final : public QQuickImageProvider {
public:
    explicit ProfileMediaProvider(QString profile) : QQuickImageProvider(QQuickImageProvider::Image), profile_(std::move(profile)) {}
    QImage requestImage(const QString& id, QSize* size, const QSize& requestedSize) override {
        const QString path = QString::fromUtf8(QByteArray::fromBase64(id.toLatin1(), QByteArray::Base64UrlEncoding));
        QImage image = gamestock::readProfileImage(profile_, path);
        if (image.isNull()) qWarning("Provider não carregou a capa sintética.");
        if (size) *size = image.size();
        // Uma textura de um pixel pode ser filtrada pelo atlas; preserve a cor ao apresentá-la.
        if (!image.isNull() && image.width() == 1 && image.height() == 1) image = image.scaled(2, 2);
        if (!image.isNull() && requestedSize.isValid()) image = image.scaled(requestedSize, Qt::KeepAspectRatio, Qt::SmoothTransformation);
        return image;
    }
private:
    QString profile_;
};
} // namespace

/** Abre o protótipo com geometria legada e opção de captura reproduzível. */
int main(int argc, char* argv[]) {
    QElapsedTimer startupTimer;
    startupTimer.start();
    QGuiApplication app(argc, argv);
    QCoreApplication::setApplicationName("GameStock");
    QCoreApplication::setApplicationVersion(GAMESTOCK_VERSION);
    QQuickStyle::setStyle("Basic");
    QGuiApplication::setWindowIcon(QIcon("qrc:/qt/qml/GameStock/assets/logo.png"));
#ifdef Q_OS_WIN
    QGuiApplication::setFont(QFont("Segoe UI"));
#else
    QGuiApplication::setFont(QFontDatabase::systemFont(QFontDatabase::GeneralFont));
#endif

    QCommandLineParser parser;
    parser.setApplicationDescription("Protótipo nativo GameStock — use somente um perfil sintético.");
    parser.addHelpOption();
    parser.addVersionOption();
    // Construtores explícitos evitam ambiguidade entre QString e QStringList no MSVC.
    parser.addOption(QCommandLineOption("profile-dir", "Perfil explícito; padrão é o diretório de dados do usuário.", "directory"));
    parser.addOption(QCommandLineOption("catalog", "Catálogo JSON gerado pelas fixtures de migração.", "file"));
    parser.addOption(QCommandLineOption("fixture-db", "Banco sintético somente de leitura dentro do perfil explícito.", "file"));
    parser.addOption(QCommandLineOption("media-dir", "Diretório de mídia sintética permitido; padrão é o perfil explícito.", "directory"));
    parser.addOption(QCommandLineOption("capture", "Salva captura PNG e encerra; destinado a verificação visual.", "file"));
    parser.addOption(QCommandLineOption("geometry-report", "Salva geometria lógica dos elementos da captura em JSON.", "file"));
    parser.addOption(QCommandLineOption("content-size", "Área útil exata para a matriz de resoluções, no formato LARGURAxALTURA.", "size"));
    parser.addOption(QCommandLineOption("effect-benchmark", "Mede quadros e CPU com configurações abertas em perfil sintético.", "file"));
    parser.addOption(QCommandLineOption("view-list", "Inicia o protótipo na visualização em lista para comparação."));
    // Permite reproduzir estados de busca sem depender de entradas no perfil real.
    parser.addOption(QCommandLineOption("search", "Inicia a captura com uma busca sintética.", "text"));
    parser.addOption(QCommandLineOption("open-settings", "Abre configurações no início para captura visual."));
    parser.addOption(QCommandLineOption("open-stacked", "Abre um segundo modal sobre configurações para comparar o backdrop empilhado."));
    parser.addOption(QCommandLineOption("open-detail", "Abre o detalhe do primeiro jogo para captura visual."));
    parser.addOption(QCommandLineOption("open-detail-edit", "Abre o detalhe e o formulário de edição do primeiro jogo."));
    parser.addOption(QCommandLineOption("open-detail-versions", "Abre o detalhe e o seletor de versões do primeiro jogo."));
    parser.addOption(QCommandLineOption("open-platforms", "Abre Configurações na seção de plataformas."));
    parser.addOption(QCommandLineOption("open-platform-new", "Abre o formulário de nova plataforma."));
    parser.addOption(QCommandLineOption("open-platform-edit", "Abre a edição da primeira plataforma."));
    parser.addOption(QCommandLineOption("open-platform-mappings", "Abre aliases/extensões da primeira plataforma."));
    parser.addOption(QCommandLineOption("open-emulators", "Abre Configurações na seção de emuladores."));
    parser.addOption(QCommandLineOption("open-emulator-new", "Abre o formulário de novo emulador."));
    parser.addOption(QCommandLineOption("open-emulator-edit", "Abre a edição do primeiro emulador."));
    parser.addOption(QCommandLineOption("open-emulator-links", "Expande as associações do primeiro emulador."));
    parser.addOption(QCommandLineOption("open-emulator-link", "Abre o vínculo de plataforma do primeiro emulador."));
    parser.addOption(QCommandLineOption("open-emulator-cores", "Abre o inventário de cores do RetroArch."));
    parser.addOption(QCommandLineOption("open-play-history", "Abre Configurações na seção de partidas jogadas."));
    parser.addOption(QCommandLineOption("open-rom-importer", "Abre Configurações na seção do importador de ROMs."));
    parser.addOption(QCommandLineOption("open-covers", "Abre Configurações na seção de mídia da biblioteca."));
    parser.addOption(QCommandLineOption("open-inventory", "Abre o inventário de hardware na inicialização."));
    parser.addOption(QCommandLineOption("open-inventory-form", "Abre o formulário de novo item do inventário."));
    parser.addOption(QCommandLineOption("open-inventory-new-type", "Abre a criação inline de tipo no formulário de inventário."));
    parser.addOption(QCommandLineOption("open-inventory-detail", "Abre o primeiro item do inventário para captura."));
    parser.addOption(QCommandLineOption("open-inventory-edit", "Abre a edição do primeiro item do inventário."));
    parser.addOption(QCommandLineOption("open-inventory-delete", "Abre a confirmação de exclusão do primeiro item."));
    parser.addOption(QCommandLineOption("inventory-list", "Inicia o inventário na visualização em lista."));
    parser.addOption(QCommandLineOption("open-logs", "Abre Configurações na seção de logs."));
    parser.addOption(QCommandLineOption("open-backup", "Abre Configurações na seção de backup."));
    parser.addOption(QCommandLineOption("update-splash-preview", "Mostra a splash de atualização para captura."));
    parser.addOption(QCommandLineOption("no-backdrop-blur", "Desativa o blur somente para comparação de diagnóstico."));
    parser.addOption(QCommandLineOption("backdrop-blur", "Sobrescreve o raio do desfoque para medição reproduzível.", "radius"));
    parser.addOption(QCommandLineOption("shadow-blur", "Sobrescreve o raio da sombra dos cards para medição reproduzível.", "radius"));
    parser.addOption(QCommandLineOption("modal-shadow-blur", "Sobrescreve o raio da sombra dos modais para medição reproduzível.", "radius"));
    parser.addOption(QCommandLineOption("startup-report", "Grava tempo até o primeiro quadro e memória residente, depois encerra.", "file"));
    parser.process(app);
    if (parser.isSet("effect-benchmark") && (parser.value("effect-benchmark").isEmpty() || !parser.isSet("open-settings") || parser.isSet("capture"))) {
        std::fputs("--effect-benchmark exige --open-settings e não aceita --capture.\n", stderr);
        return 2;
    }
    QString profile = parser.value("profile-dir");
    const bool explicitProfile = !profile.isEmpty();
    const QString fixtureDb = parser.value("fixture-db");
    if (!fixtureDb.isEmpty() && !explicitProfile) {
        std::fputs("--fixture-db exige --profile-dir para não abrir o perfil real.\n", stderr);
        return 2;
    }
    if (profile.isEmpty()) {
        // Distribuição normal: reutiliza APPDATA/XDG ou GAMESTOCK_USER_DATA_DIR.
        profile = gamestock::userDataPath(QProcessEnvironment::systemEnvironment(), QDir::homePath(),
#ifdef Q_OS_WIN
            true
#else
            false
#endif
        );
    }
    if (profile.isEmpty()) {
        std::fputs("Não foi possível resolver o diretório de dados do usuário.\n", stderr);
        return 2;
    }
    if (!QDir().mkpath(profile)) return 3;
    // O lock impede que Electron e Qt abram o mesmo perfil ao mesmo tempo.
    gamestock::ProfileLock profileLock;
    {
        QString lockError;
        if (!profileLock.acquire(profile, QStringLiteral("qt"), &lockError)) {
            qCritical("%s", qPrintable(lockError));
            return 8;
        }
    }
    logFilePath = QDir(profile).filePath("native-prototype.log");
    const auto previousHandler = qInstallMessageHandler(writeLog);
    qInfo("Iniciando GameStock Qt em perfil %s.", qPrintable(profile));
    const gamestock::ChannelInfo channelInfo = gamestock::detectChannel(QCoreApplication::applicationFilePath(),
        QProcessEnvironment::systemEnvironment(), qEnvironmentVariable("GAMESTOCK_CHANNEL"));
    qInfo("Canal detectado: %s (%s)", qPrintable(channelInfo.channel), qPrintable(channelInfo.executableDir));
    QList<QRect> screens;
    for (const auto* screen : QGuiApplication::screens()) screens.append(screen->availableGeometry());
    const QString boundsFile = QDir(profile).filePath("window-bounds.json");
    const QRect bounds = gamestock::loadWindowGeometry(boundsFile, screens);
    gamestock::FixtureLibrary fixtureLibrary;
    // O serviço deve sobreviver ao engine que guarda sua referência de contexto.
    QQmlApplicationEngine engine;
    // O serviço de biblioteca lê o mesmo banco sintético e alimenta a grade no modo banco.
    gamestock::GameService gameService;
    gamestock::PlatformService platformService;
    gamestock::EmulatorService emulatorService;
    gamestock::LaunchService launchService;
    gamestock::InventoryPreferences inventoryPreferences;
    gamestock::InventoryService inventoryService;
    gamestock::SettingsService settingsService;
    gamestock::BackupCoordinator backupCoordinator;
    gamestock::UpdateService updateService;
    gamestock::RomFolderService romFolderService;
    gamestock::MediaSyncService mediaSyncService;
    gamestock::MetadataService metadataService;
    std::unique_ptr<gamestock::WriteConnection> jobConnection;
    std::unique_ptr<gamestock::JobStateStore> jobStateStore;
    std::unique_ptr<gamestock::JobStateStore> mediaJobStateStore;
    std::unique_ptr<gamestock::JobStateStore> backupJobStateStore;
    std::unique_ptr<gamestock::JobRegistry> jobRegistry;
    std::unique_ptr<gamestock::JobManager> jobManager;
    QObject* gameServiceObject = nullptr;
    QObject* platformServiceObject = nullptr;
    QObject* emulatorServiceObject = nullptr;
    QObject* launchServiceObject = nullptr;
    QObject* romFolderServiceObject = nullptr;
    QObject* mediaSyncServiceObject = nullptr;
    QObject* metadataServiceObject = nullptr;
    QObject* inventoryServiceObject = nullptr;
    QObject* jobManagerObject = nullptr;
    std::unique_ptr<gamestock::Database> profileDatabase;
    QString servicePath;
    if (!fixtureDb.isEmpty()) {
        // O caminho deve resolver dentro do perfil explícito antes da abertura experimental.
        const QString validated = gamestock::validatedMediaPath(profile, fixtureDb);
        if (validated.isEmpty() || !fixtureLibrary.open(validated)) {
            qCritical("Não foi possível abrir o banco sintético no perfil explícito.");
            return 6;
        }
        servicePath = validated;
    } else {
        servicePath = QDir(profile).filePath(QStringLiteral("gamestock.db"));
        profileDatabase = std::make_unique<gamestock::Database>();
        QString databaseError;
        if (!profileDatabase->open(servicePath, QDir(profile).filePath(QStringLiteral("images")), &databaseError)) {
            qCritical("Não foi possível abrir o perfil: %s", qPrintable(databaseError));
            return 6;
        }
        QString channelError;
        if (!gamestock::saveChannelIdentity(profileDatabase->handle(), channelInfo, &channelError)) {
            qWarning("Não foi possível registrar o canal: %s", qPrintable(channelError));
        }
    }
    settingsService.setChannel(channelInfo.channel);
    settingsService.setExecutableDir(channelInfo.executableDir);
    if (!servicePath.isEmpty()) {
        QString serviceError;
        if (!servicePath.isEmpty() && gameService.open(servicePath, &serviceError)) gameServiceObject = &gameService;
        else qWarning("Serviço de biblioteca indisponível: %s", qPrintable(serviceError));
        QString platformError;
        if (!servicePath.isEmpty() && platformService.open(servicePath, &platformError)) platformServiceObject = &platformService;
        else qWarning("Serviço de plataformas indisponível: %s", qPrintable(platformError));
        QString emulatorError;
        if (!servicePath.isEmpty() && emulatorService.open(servicePath, &emulatorError)) emulatorServiceObject = &emulatorService;
        else qWarning("Serviço de emuladores indisponível: %s", qPrintable(emulatorError));
        QString launchError;
        if (!servicePath.isEmpty() && launchService.open(servicePath, &launchError)) launchServiceObject = &launchService;
        else qWarning("Serviço de lançamento indisponível: %s", qPrintable(launchError));
        QString romFolderError;
        if (!servicePath.isEmpty() && romFolderService.open(servicePath, &romFolderError)) romFolderServiceObject = &romFolderService;
        else qWarning("Serviço de importação de ROMs indisponível: %s", qPrintable(romFolderError));
        QString mediaSyncError;
        if (!servicePath.isEmpty() && mediaSyncService.open(servicePath, profile,
                QDir(profile).filePath(QStringLiteral("images")), &mediaSyncError)) {
            mediaSyncServiceObject = &mediaSyncService;
        } else {
            qWarning("Serviço de mídia indisponível: %s", qPrintable(mediaSyncError));
        }
        QString metadataServiceError;
        if (!servicePath.isEmpty() && metadataService.open(servicePath, profile,
                QDir(profile).filePath(QStringLiteral("images")), &metadataServiceError)) {
            metadataServiceObject = &metadataService;
        } else {
            qWarning("Importador de metadados indisponível: %s", qPrintable(metadataServiceError));
        }
        QString inventoryServiceError;
        if (!servicePath.isEmpty() && inventoryService.open(servicePath, profile, &inventoryServiceError)) {
            inventoryServiceObject = &inventoryService;
        } else {
            qWarning("Inventário indisponível: %s", qPrintable(inventoryServiceError));
        }
        // Jobs de ROM continuam no estado legado e são restaurados antes da janela.
        if (!servicePath.isEmpty()) {
            jobConnection = std::make_unique<gamestock::WriteConnection>();
            QString jobDatabaseError;
            if (jobConnection->open(servicePath, &jobDatabaseError)) {
                auto romStore = std::make_unique<gamestock::JobStateStore>(
                    jobConnection->database(), QStringLiteral("gamestock.media.lastRomImportJob"));
                auto mediaStore = std::make_unique<gamestock::JobStateStore>(
                    jobConnection->database(), QStringLiteral("gamestock.media.lastMediaSyncJobs"));
                auto backupStore = std::make_unique<gamestock::JobStateStore>(
                    jobConnection->database(), QStringLiteral("gamestock.dataPortability.jobs"));
                gamestock::JobStateStore* romStorePtr = romStore.get();
                gamestock::JobStateStore* mediaStorePtr = mediaStore.get();
                gamestock::JobStateStore* backupStorePtr = backupStore.get();
                jobStateStore = std::move(romStore);
                mediaJobStateStore = std::move(mediaStore);
                backupJobStateStore = std::move(backupStore);
                jobRegistry = std::make_unique<gamestock::JobRegistry>(
                    [romStorePtr, mediaStorePtr, backupStorePtr](const QJsonArray& jobs, QString* persistError) {
                        QJsonArray romJobs;
                        QJsonArray mediaJobs;
                        QJsonArray backupJobs;
                        for (const QJsonValue& value : jobs) {
                            const QString kind = value.toObject().value(QStringLiteral("kind")).toString();
                            if (kind == QLatin1String("media-sync")) mediaJobs.append(value);
                            else if (kind == QLatin1String("rom-folder-import")) romJobs.append(value);
                            else if (kind.startsWith(QLatin1String("data-portability"))) backupJobs.append(value);
                            // Metadados são efêmeros e não ocupam as chaves legadas.
                        }
                        QJsonArray lastRom;
                        if (!romJobs.isEmpty()) lastRom.append(romJobs.first());
                        if (!romStorePtr->persist(lastRom, persistError)) return false;
                        // A lista de mídia mantém o histórico curto aceito pelo formato legado.
                        if (!mediaStorePtr->persist(mediaJobs, persistError)) return false;
                        return backupStorePtr->persist(backupJobs, persistError);
                    });
                gamestock::AppStateReadDao reader(jobConnection->database());
                QJsonArray restoredJobs;
                QJsonValue persisted;
                QString readError;
                if (reader.get(QStringLiteral("gamestock.media.lastRomImportJob"), &persisted, &readError)) {
                    if (persisted.isObject()) restoredJobs.append(persisted);
                    else if (persisted.isArray()) {
                        for (const QJsonValue& value : persisted.toArray()) restoredJobs.append(value);
                    }
                }
                if (reader.get(QStringLiteral("gamestock.media.lastMediaSyncJobs"), &persisted, &readError)) {
                    if (persisted.isArray()) {
                        for (const QJsonValue& value : persisted.toArray()) restoredJobs.append(value);
                    } else if (persisted.isObject()) {
                        restoredJobs.append(persisted);
                    }
                }
                if (reader.get(QStringLiteral("gamestock.dataPortability.jobs"), &persisted, &readError)) {
                    if (persisted.isArray()) {
                        for (const QJsonValue& value : persisted.toArray()) restoredJobs.append(value);
                    } else if (persisted.isObject()) {
                        restoredJobs.append(persisted);
                    }
                }
                // Normaliza jobs legados do Electron que não traziam título/erro vazios.
                for (qsizetype index = 0; index < restoredJobs.size(); ++index) {
                    QJsonObject job = restoredJobs.at(index).toObject();
                    const QString kind = job.value(QStringLiteral("kind")).toString();
                    if (!job.contains(QStringLiteral("title"))) {
                        job.insert(QStringLiteral("title"), kind == QLatin1String("import")
                            ? QStringLiteral("Importação de backup") : QStringLiteral("Exportação de backup"));
                    }
                    if (!job.contains(QStringLiteral("subtitle"))) job.insert(QStringLiteral("subtitle"), QString());
                    if (!job.contains(QStringLiteral("error"))) job.insert(QStringLiteral("error"), QString());
                    QJsonObject progress = job.value(QStringLiteral("progress")).toObject();
                    if (!progress.contains(QStringLiteral("message"))) progress.insert(QStringLiteral("message"), QStringLiteral("Interrompido"));
                    if (!progress.contains(QStringLiteral("stage"))) progress.insert(QStringLiteral("stage"), QStringLiteral("error"));
                    job.insert(QStringLiteral("progress"), progress);
                    restoredJobs[index] = job;
                }
                jobRegistry->restore(restoredJobs);
                jobManager = std::make_unique<gamestock::JobManager>(jobRegistry.get());
                jobManagerObject = jobManager.get();
                romFolderService.setJobManager(jobManager.get());
                mediaSyncService.setJobManager(jobManager.get());
                metadataService.setJobManager(jobManager.get());
            } else {
                qWarning("Persistência de jobs indisponível: %s", qPrintable(jobDatabaseError));
            }
        }
    }
    // O provider mantém o acesso às mídias restrito à raiz autorizada do protótipo.
    const QString mediaRoot = parser.value("media-dir").isEmpty() ? profile : parser.value("media-dir");
    gameService.setMediaRoot(mediaRoot);
    engine.addImageProvider("profilemedia", new ProfileMediaProvider(mediaRoot));
    // Builds de arquivos exportados sem Git continuam identificadas pela versão.
    const QString commit = QStringLiteral(GAMESTOCK_BUILD_COMMIT);
    const QString buildLabel = QCoreApplication::applicationVersion()
        + (commit.isEmpty() ? QString() : QStringLiteral(" (build ") + commit + QStringLiteral(")"));
    settingsService.configure(profile, logFilePath, servicePath);
    settingsService.setBuildLabel(buildLabel);
    {
        QString updateError;
        const QByteArray publicKeyX = QByteArray::fromBase64(gamestock::updatePublicKeyX().toLatin1());
        const QByteArray publicKeyY = QByteArray::fromBase64(gamestock::updatePublicKeyY().toLatin1());
        if (!updateService.configure(channelInfo.channel, QCoreApplication::applicationVersion(),
                commit.isEmpty() ? QStringLiteral("local") : commit, gamestock::updateManifestUrl(),
                publicKeyX, publicKeyY, &updateError)) {
            qWarning("Updater indisponível: %s", qPrintable(updateError));
        }
    }
    if (!servicePath.isEmpty()) {
        const QString backupDatabase = servicePath;
        QString backupError;
        if (!backupCoordinator.configure(jobManager.get(), backupDatabase, profile,
                buildLabel, &backupError)) {
            qWarning("Backup indisponível: %s", qPrintable(backupError));
        }
    }
    // Propriedades explícitas permitem ao compilador QML identificar as dependências da janela.
    engine.setInitialProperties({{"fixtureLibrary", QVariant::fromValue(static_cast<QObject*>(&fixtureLibrary))},
        {"prototypeListView", parser.isSet("view-list")}, {"prototypeCatalog", loadCatalog(parser.value("catalog"))},
        {"gameService", QVariant::fromValue(gameServiceObject)},
        {"platformService", QVariant::fromValue(platformServiceObject)},
        {"emulatorService", QVariant::fromValue(emulatorServiceObject)},
        {"launchService", QVariant::fromValue(launchServiceObject)},
        {"inventoryPreferences", QVariant::fromValue(static_cast<QObject*>(&inventoryPreferences))},
        {"inventoryService", QVariant::fromValue(inventoryServiceObject)},
        {"settingsService", QVariant::fromValue(static_cast<QObject*>(&settingsService))},
        {"backupCoordinator", QVariant::fromValue(static_cast<QObject*>(&backupCoordinator))},
        {"updateService", QVariant::fromValue(static_cast<QObject*>(&updateService))},
        {"jobManager", QVariant::fromValue(jobManagerObject)},
        {"romFolderService", QVariant::fromValue(romFolderServiceObject)},
        {"mediaSyncService", QVariant::fromValue(mediaSyncServiceObject)},
        {"metadataService", QVariant::fromValue(metadataServiceObject)},
        {"prototypeSearch", parser.value("search")},
        {"prototypeBenchmark", parser.isSet("effect-benchmark")},
        {"prototypeSettingsOpen", parser.isSet("open-settings")},
        {"prototypeStackedOpen", parser.isSet("open-stacked")},
        {"prototypeDetailOpen", parser.isSet("open-detail")},
        {"prototypeDetailEdit", parser.isSet("open-detail-edit")},
        {"prototypeDetailVersions", parser.isSet("open-detail-versions")},
        {"prototypePlatformsOpen", parser.isSet("open-platforms")},
        {"prototypePlatformNew", parser.isSet("open-platform-new")},
        {"prototypePlatformEdit", parser.isSet("open-platform-edit")},
        {"prototypePlatformMappings", parser.isSet("open-platform-mappings")},
        {"prototypeEmulatorsOpen", parser.isSet("open-emulators")},
        {"prototypeEmulatorNew", parser.isSet("open-emulator-new")},
        {"prototypeEmulatorEdit", parser.isSet("open-emulator-edit")},
        {"prototypeEmulatorLinks", parser.isSet("open-emulator-links")},
        {"prototypeEmulatorLink", parser.isSet("open-emulator-link")},
        {"prototypeEmulatorCores", parser.isSet("open-emulator-cores")},
        {"prototypePlayHistoryOpen", parser.isSet("open-play-history")},
        {"prototypeRomImporterOpen", parser.isSet("open-rom-importer")},
        {"prototypeCoversOpen", parser.isSet("open-covers")},
        {"prototypeInventoryOpen", parser.isSet("open-inventory") || parser.isSet("open-inventory-form")
            || parser.isSet("open-inventory-new-type") || parser.isSet("open-inventory-detail")
            || parser.isSet("open-inventory-edit") || parser.isSet("open-inventory-delete")
            || parser.isSet("inventory-list")},
        {"prototypeInventoryForm", parser.isSet("open-inventory-form")},
        {"prototypeInventoryNewType", parser.isSet("open-inventory-new-type")},
        {"prototypeInventoryDetail", parser.isSet("open-inventory-detail")},
        {"prototypeInventoryEdit", parser.isSet("open-inventory-edit")},
        {"prototypeInventoryDelete", parser.isSet("open-inventory-delete")},
        {"prototypeInventoryList", parser.isSet("inventory-list")},
        {"prototypeLogsOpen", parser.isSet("open-logs")},
        {"prototypeBackupOpen", parser.isSet("open-backup")},
        {"prototypeUpdateSplash", parser.isSet("update-splash-preview")},
        {"prototypeDisableBlur", parser.isSet("no-backdrop-blur")},
        {"prototypeBlurRadius", parser.value("backdrop-blur").toInt()},
        {"prototypeShadowBlur", parser.value("shadow-blur").toInt()},
        {"prototypeModalShadowBlur", parser.value("modal-shadow-blur").toInt()},
        {"buildLabel", buildLabel}});
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreationFailed, &app, [] { QCoreApplication::exit(4); }, Qt::QueuedConnection);
    engine.loadFromModule("GameStock", "Main");
    if (engine.rootObjects().isEmpty()) return 4;
    auto* window = qobject_cast<QQuickWindow*>(engine.rootObjects().first());
    if (!window) return 4;
    // O retângulo Electron inclui bordas invisíveis, além da moldura visível do Qt.
    const FrameMetrics metrics = frameMetrics(window);
    window->setMinimumSize(gamestock::contentSizeForFrame(QSize(1024, 768), metrics.legacy));
    window->resize(gamestock::contentSizeForFrame(bounds.size(), metrics.legacy));
    // A matriz de resoluções precisa da área útil exata medida no Electron.
    const QString contentSize = parser.value("content-size");
    if (!contentSize.isEmpty()) {
        const QStringList parts = contentSize.split('x');
        bool widthOk = false;
        bool heightOk = false;
        const int width = parts.size() == 2 ? parts.at(0).toInt(&widthOk) : 0;
        const int height = parts.size() == 2 ? parts.at(1).toInt(&heightOk) : 0;
        if (!widthOk || !heightOk || width < 1 || height < 1 || width > 32768 || height > 32768) {
            qCritical("--content-size exige LARGURAxALTURA válidos.");
            return 7;
        }
        window->resize(width, height);
    }
    window->setFramePosition(bounds.topLeft() + QPoint(metrics.legacy.left() - metrics.qt.left(), metrics.legacy.top() - metrics.qt.top()));
    QObject::connect(&app, &QCoreApplication::aboutToQuit, window, [window, boundsFile] {
        if (!gamestock::saveWindowGeometry(boundsFile, legacyWindowBounds(window))) qWarning("Falha ao salvar geometria da janela.");
    });
    const QString capture = parser.value("capture");
    const QString geometryReport = parser.value("geometry-report");
    const QString effectBenchmark = parser.value("effect-benchmark");
    const QString startupReport = parser.value("startup-report");
    if (!startupReport.isEmpty() && !capture.isEmpty()) {
        qCritical("--startup-report não pode ser combinado com --capture.");
        return 7;
    }
    if (!startupReport.isEmpty()) {
        // Mede o primeiro quadro apresentado e encerra, sem alterar o perfil.
        QObject::connect(window, &QQuickWindow::frameSwapped, &app,
            [&startupTimer, startupReport] {
                const QJsonObject output{{QStringLiteral("startupMs"), static_cast<double>(startupTimer.nsecsElapsed()) / 1'000'000.0},
                    {QStringLiteral("workingSetBytes"), static_cast<double>(workingSetBytes())}};
                QFile file(startupReport);
                if (file.open(QIODevice::WriteOnly | QIODevice::Truncate))
                    file.write(QJsonDocument(output).toJson(QJsonDocument::Compact));
                QCoreApplication::quit();
            }, Qt::SingleShotConnection);
    }
    // A verificação automática pertence à instalação Windows; capturas não acessam a rede.
    if (capture.isEmpty() && channelInfo.channel == QLatin1String("installed")) {
        QTimer::singleShot(300, &updateService, &gamestock::UpdateService::startupCheck);
    }
    if (!geometryReport.isEmpty() && capture.isEmpty()) {
        qCritical("--geometry-report exige --capture.");
        return 7;
    }
    if (!capture.isEmpty()) {
        QTimer::singleShot(1200, window, [window, capture, geometryReport] {
            // O diagnóstico distingue área útil e moldura para comparação com BrowserWindow.getBounds().
            qInfo() << "Geometria interna:" << window->geometry() << "Moldura:" << window->frameGeometry();
#ifdef Q_OS_WIN
            RECT outer{}, client{};
            const HWND handle = reinterpret_cast<HWND>(window->winId());
            if (GetWindowRect(handle, &outer) && GetClientRect(handle, &client))
                qInfo() << "Win32 externa:" << outer.left << outer.top << (outer.right - outer.left) << (outer.bottom - outer.top)
                        << "conteúdo:" << (client.right - client.left) << (client.bottom - client.top);
#endif
            const auto image = window->grabWindow();
            // O relatório usa os mesmos elementos e coordenadas lógicas da captura salva.
            if (!geometryReport.isEmpty()) {
                QVariant snapshot;
                if (!QMetaObject::invokeMethod(window, "geometrySnapshot", Q_RETURN_ARG(QVariant, snapshot))) {
                    qCritical("Não foi possível obter a geometria do protótipo.");
                    QCoreApplication::exit(7);
                    return;
                }
                QFile report(geometryReport);
                // Métodos QML retornam QJSValue; convertemos antes de serializar para JSON.
                const QVariant value = snapshot.metaType() == QMetaType::fromType<QJSValue>() ? snapshot.value<QJSValue>().toVariant() : snapshot;
                const QJsonDocument document = QJsonDocument::fromVariant(value);
                const QByteArray json = document.toJson();
                if (document.isNull() || !report.open(QIODevice::WriteOnly | QIODevice::Truncate) || report.write(json) != json.size()) {
                    qCritical("Não foi possível salvar a geometria do protótipo.");
                    QCoreApplication::exit(7);
                    return;
                }
            }
            QCoreApplication::exit(!image.isNull() && image.save(capture) ? 0 : 5);
        });
    }
    if (!effectBenchmark.isEmpty()) {
        // Uma fase de aquecimento separa inicialização da medição da superfície animada.
        struct Measurement { QElapsedTimer timer; qint64 cpuStart = -1; int frames = 0; bool active = false; };
        const auto measurement = std::make_shared<Measurement>();
        QObject::connect(window, &QQuickWindow::frameSwapped, window, [measurement] {
            if (measurement->active) ++measurement->frames;
        });
        QTimer::singleShot(1000, window, [window, effectBenchmark, measurement, blurEnabled = !parser.isSet("no-backdrop-blur")] {
            measurement->cpuStart = processCpuTimeMs();
            measurement->timer.start();
            measurement->active = true;
            QTimer::singleShot(5000, window, [window, effectBenchmark, measurement, blurEnabled] {
                measurement->active = false;
                const qint64 elapsed = measurement->timer.elapsed();
                const qint64 cpuEnd = processCpuTimeMs();
                const qint64 cpu = measurement->cpuStart >= 0 && cpuEnd >= 0 ? cpuEnd - measurement->cpuStart : -1;
                const QJsonObject result{{"elapsedMs", static_cast<double>(elapsed)}, {"frames", measurement->frames},
                    {"cpuMs", static_cast<double>(cpu)}, {"blurEnabled", blurEnabled},
                    {"graphicsApi", static_cast<int>(window->rendererInterface()->graphicsApi())},
                    {"devicePixelRatio", window->devicePixelRatio()}, {"width", window->width()}, {"height", window->height()}};
                const QByteArray json = QJsonDocument(result).toJson();
                QFile file(effectBenchmark);
                if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate) || file.write(json) != json.size()) {
                    qCritical("Falha ao salvar benchmark gráfico.");
                    QCoreApplication::exit(7);
                    return;
                }
                QCoreApplication::exit(0);
            });
        });
    }
    const int result = app.exec();
    qInstallMessageHandler(previousHandler);
    return result;
}
