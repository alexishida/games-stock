/** Implementação do updater; o pacote só é executado depois de assinatura/hash/tamanho. */
#include "UpdateService.h"

#include "UpdateConfig.h"

#include <QCoreApplication>
#include <QCryptographicHash>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QProcess>
#include <QStandardPaths>
#include <QTimer>
#include <QUuid>
#include <QVersionNumber>

namespace gamestock {
namespace {
/** Erros de rede que liberam o modo offline em vez de falha genérica. */
bool isNetworkError(QNetworkReply::NetworkError error) {
    return error == QNetworkReply::HostNotFoundError || error == QNetworkReply::ConnectionRefusedError
        || error == QNetworkReply::RemoteHostClosedError || error == QNetworkReply::TimeoutError
        || error == QNetworkReply::TemporaryNetworkFailureError || error == QNetworkReply::NetworkSessionFailedError
        || error == QNetworkReply::UnknownNetworkError;
}
} // namespace

UpdateService::UpdateService(QObject* parent) : QObject(parent) {
    network_ = new QNetworkAccessManager(this);
    timeout_ = new QTimer(this);
    timeout_->setSingleShot(true);
    connect(timeout_, &QTimer::timeout, this, [this] {
        if (!running_) return;
        if (manifestReply_) manifestReply_->abort();
        if (packageReply_) packageReply_->abort();
        fail(QStringLiteral("no-connection"), QStringLiteral("Sem conexão para verificar atualizações."), true);
    });
}

UpdateService::~UpdateService() { cleanupDownload(); }

bool UpdateService::configure(const QString& channel, const QString& appVersion, const QString& buildNumber,
    const QString& manifestUrl, const QByteArray& publicKeyX, const QByteArray& publicKeyY, QString* error) {
    if (publicKeyX.size() != 32 || publicKeyY.size() != 32) {
        if (error) *error = QStringLiteral("Chave pública de atualização inválida.");
        return false;
    }
    channel_ = channel;
    appVersion_ = appVersion;
    localBuildNumber_ = buildNumber;
    manifestUrl_ = manifestUrl.isEmpty() ? updateManifestUrl() : manifestUrl;
    publicKeyX_ = publicKeyX;
    publicKeyY_ = publicKeyY;
    if (error) error->clear();
    emit changed();
    return true;
}

void UpdateService::setApplyCommandForTest(const QString& program, const QStringList& arguments) {
    applyProgram_ = program;
    applyArguments_ = arguments;
}

void UpdateService::setPhase(const QString& phase, const QString& message) {
    phase_ = phase;
    message_ = message;
    emit changed();
}

void UpdateService::startupCheck() { check(true); }

void UpdateService::showStartupPreview() {
    automatic_ = true;
    running_ = true;
    startupVisible_ = true;
    requiresAction_ = false;
    percent_ = 35;
    version_ = QStringLiteral("1.1.6");
    message_ = QStringLiteral("Baixando atualização v1.1.6...");
    phase_ = QStringLiteral("downloading");
    emit changed();
}
void UpdateService::checkNow() { check(false); }

void UpdateService::check(bool automatic) {
    if (running_) return;
    if (manifestUrl_.isEmpty()) {
        fail(QStringLiteral("error"), QStringLiteral("Feed de atualização não configurado."), false);
        return;
    }
    automatic_ = automatic;
    startupVisible_ = automatic;
    running_ = true;
    verified_ = false;
    packagePath_.clear();
    version_.clear();
    buildNumber_.clear();
    releaseDate_.clear();
    notes_.clear();
    error_.clear();
    percent_ = 0;
    requiresAction_ = false;
    setPhase(QStringLiteral("checking"), QStringLiteral("Verificando atualizações..."));
    if (automatic_) timeout_->start(startupTimeoutMs_);

    QNetworkRequest request{QUrl(manifestUrl_)};
    request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);
    request.setHeader(QNetworkRequest::UserAgentHeader, QStringLiteral("GameStock-Qt/") + appVersion_);
    manifestReply_ = network_->get(request);
    connect(manifestReply_, &QNetworkReply::finished, this, [this] {
        QNetworkReply* reply = manifestReply_;
        manifestReply_ = nullptr;
        timeout_->stop();
        if (!reply) return;
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            fail(isNetworkError(reply->error()) ? QStringLiteral("no-connection") : QStringLiteral("error"),
                reply->errorString(), isNetworkError(reply->error()));
            return;
        }
        const QByteArray body = reply->readAll();
        QString parseError;
        UpdateManifest manifest;
        if (!parseSignedUpdateManifest(body, publicKeyX_, publicKeyY_, &manifest, &parseError)) {
            fail(QStringLiteral("error"), parseError, false);
            return;
        }
        manifest_ = manifest;
        version_ = manifest.version;
        buildNumber_ = manifest.buildNumber;
        releaseDate_ = manifest.releaseDate;
        notes_ = manifest.notes;
        const QVersionNumber remote = QVersionNumber::fromString(manifest.version);
        const QVersionNumber local = QVersionNumber::fromString(appVersion_);
        if (!remote.isNull() && !local.isNull() && remote <= local) {
            running_ = false;
            startupVisible_ = false;
            setPhase(QStringLiteral("up-to-date"), QStringLiteral("GameStock já está atualizado."));
            return;
        }
        if (channel_ != QLatin1String("installed")) {
            running_ = false;
            startupVisible_ = false;
            setPhase(QStringLiteral("external-update"),
                QStringLiteral("Atualização disponível. Baixe o pacote portátil publicado no GitHub."));
            return;
        }
        startPackageDownload();
    });
}

void UpdateService::startPackageDownload() {
    const QString directory = QDir(QStandardPaths::writableLocation(QStandardPaths::TempLocation))
        .filePath(QStringLiteral("gamestock-update/") + QUuid::createUuid().toString(QUuid::WithoutBraces));
    if (!QDir().mkpath(directory)) {
        fail(QStringLiteral("error"), QStringLiteral("Não foi possível preparar o download."), false);
        return;
    }
    packagePath_ = QDir(directory).filePath(QFileInfo(manifest_.fileName).fileName());
    packageFile_ = new QFile(packagePath_);
    if (!packageFile_->open(QIODevice::WriteOnly)) {
        fail(QStringLiteral("error"), QStringLiteral("Não foi possível gravar o pacote de atualização."), false);
        return;
    }
    setPhase(QStringLiteral("downloading"), QStringLiteral("Baixando atualização v%1...").arg(manifest_.version));
    QNetworkRequest request{QUrl(manifest_.packageUrl)};
    request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);
    request.setHeader(QNetworkRequest::UserAgentHeader, QStringLiteral("GameStock-Qt/") + appVersion_);
    packageReply_ = network_->get(request);
    connect(packageReply_, &QNetworkReply::readyRead, this, [this] {
        if (!packageReply_ || !packageFile_) return;
        packageFile_->write(packageReply_->readAll());
    });
    connect(packageReply_, &QNetworkReply::downloadProgress, this, [this](qint64 received, qint64 total) {
        const qint64 expected = total > 0 ? total : manifest_.packageSize;
        if (expected > 0) percent_ = static_cast<int>(qMin<qint64>(100, received * 100 / expected));
        emit changed();
    });
    connect(packageReply_, &QNetworkReply::finished, this, &UpdateService::finishPackageDownload);
}

void UpdateService::finishPackageDownload() {
    QNetworkReply* reply = packageReply_;
    packageReply_ = nullptr;
    if (!reply) return;
    reply->deleteLater();
    if (packageFile_) {
        if (reply->bytesAvailable() > 0) packageFile_->write(reply->readAll());
        packageFile_->close();
    }
    if (reply->error() != QNetworkReply::NoError) {
        fail(isNetworkError(reply->error()) ? QStringLiteral("no-connection") : QStringLiteral("error"),
            reply->errorString(), false);
        return;
    }
    QString verifyError;
    if (!verifyDownloadedPackage(&verifyError)) {
        fail(QStringLiteral("error"), verifyError, false);
        return;
    }
    verified_ = true;
    running_ = false;
    startupVisible_ = false;
    percent_ = 100;
    setPhase(QStringLiteral("applying"), QStringLiteral("Instalando atualização e reiniciando..."));
    if (autoApply_) applyReadyUpdate();
}

bool UpdateService::verifyDownloadedPackage(QString* error) const {
    if (packagePath_.isEmpty() || !QFileInfo::exists(packagePath_)) {
        if (error) *error = QStringLiteral("Pacote de atualização não foi baixado.");
        return false;
    }
    const QFileInfo info(packagePath_);
    if (info.size() != manifest_.packageSize) {
        if (error) *error = QStringLiteral("Tamanho do pacote de atualização não confere.");
        return false;
    }
    QFile file(packagePath_);
    if (!file.open(QIODevice::ReadOnly)) {
        if (error) *error = QStringLiteral("Não foi possível validar o pacote de atualização.");
        return false;
    }
    QCryptographicHash hash(QCryptographicHash::Sha256);
    if (!hash.addData(&file)) {
        if (error) *error = QStringLiteral("Falha ao ler o pacote de atualização.");
        return false;
    }
    if (hash.result() != manifest_.sha256) {
        if (error) *error = QStringLiteral("Hash do pacote de atualização não confere.");
        return false;
    }
    if (error) error->clear();
    return true;
}

bool UpdateService::applyReadyUpdate() {
    if (!verified_ || packagePath_.isEmpty()) return false;
    if (channel_ != QLatin1String("installed") && applyProgram_.isEmpty()) {
        fail(QStringLiteral("external-update"), QStringLiteral("Esta instalação usa atualização externa."), false);
        return false;
    }
    const QString program = applyProgram_.isEmpty() ? packagePath_ : applyProgram_;
    const QStringList arguments = applyProgram_.isEmpty() ? QStringList{QStringLiteral("/S")} : applyArguments_;
    if (!QProcess::startDetached(program, arguments)) {
        fail(QStringLiteral("error"), QStringLiteral("Não foi possível iniciar o instalador da atualização."), false);
        return false;
    }
    emit updateLaunched(packagePath_);
    if (quitOnApply_) QCoreApplication::quit();
    return true;
}

void UpdateService::fail(const QString& phase, const QString& message, bool requiresAction) {
    cleanupDownload();
    running_ = false;
    requiresAction_ = requiresAction;
    startupVisible_ = automatic_ && (phase == QLatin1String("no-connection"));
    error_ = message;
    setPhase(phase, message);
}

void UpdateService::cleanupDownload() {
    timeout_->stop();
    if (manifestReply_) {
        manifestReply_->abort();
        manifestReply_->deleteLater();
        manifestReply_ = nullptr;
    }
    if (packageReply_) {
        packageReply_->abort();
        packageReply_->deleteLater();
        packageReply_ = nullptr;
    }
    if (packageFile_) {
        packageFile_->close();
        delete packageFile_;
        packageFile_ = nullptr;
    }
    if (!packagePath_.isEmpty() && QFileInfo::exists(packagePath_)) {
        QFile::remove(packagePath_);
        QDir(QFileInfo(packagePath_).absolutePath()).removeRecursively();
    }
    packagePath_.clear();
    verified_ = false;
}

void UpdateService::skip() {
    startupVisible_ = false;
    if (running_ && phase_ == QLatin1String("checking")) {
        cleanupDownload();
        running_ = false;
        phase_ = QStringLiteral("no-connection");
        message_ = QStringLiteral("Continuando sem verificar atualizações.");
    }
    emit changed();
}
} // namespace gamestock
