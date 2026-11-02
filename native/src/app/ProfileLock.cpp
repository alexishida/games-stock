/** Implementa o contrato de lock comum descrito em docs/native-migration/profile.md. */
#include "ProfileLock.h"

#include <QCoreApplication>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonDocument>
#include <QSaveFile>
#include <QUuid>
#include <cerrno>
#ifdef Q_OS_WIN
#include <qt_windows.h>
#elif defined(Q_OS_LINUX) || defined(Q_OS_MACOS)
#include <csignal>
#endif

namespace gamestock {
namespace {
/** Lê o conteúdo do lock sem alterar o arquivo. */
QJsonObject readHolder(const QString& path) {
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) return {};
    const QJsonObject holder = QJsonDocument::fromJson(file.readAll()).object();
    if (holder.value("runtime").toString().isEmpty() || !holder.value("pid").isDouble()) return {};
    return holder;
}
} // namespace

ProfileLock::~ProfileLock() {
    release();
}

bool ProfileLock::processAlive(qint64 pid) {
    if (pid <= 0) return false;
#ifdef Q_OS_WIN
    const HANDLE handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, static_cast<DWORD>(pid));
    if (handle == nullptr) return false;
    DWORD code = 0;
    const bool alive = GetExitCodeProcess(handle, &code) != 0 && code == STILL_ACTIVE;
    CloseHandle(handle);
    return alive;
#elif defined(Q_OS_LINUX) || defined(Q_OS_MACOS)
    // PID reutilizado é aceitável neste contrato: o detentor teria o mesmo lock em disco.
    return ::kill(static_cast<pid_t>(pid), 0) == 0 || errno == EPERM;
#else
    Q_UNUSED(pid);
    return true;
#endif
}

bool ProfileLock::acquire(const QString& profileDirectory, const QString& runtime, QString* error) {
    if (!QDir().mkpath(profileDirectory)) {
        if (error) *error = QStringLiteral("Não foi possível criar o diretório do perfil.");
        return false;
    }
    path_ = QDir(profileDirectory).filePath(QStringLiteral("gamestock.lock"));
    for (int attempt = 0; attempt < 3; ++attempt) {
        QFile file(path_);
        // O_EXCL é atômico no sistema de arquivos e impede dois runtimes criarem o lock.
        if (file.open(QIODevice::WriteOnly | QIODevice::NewOnly)) {
            token_ = QUuid::createUuid().toString(QUuid::WithoutBraces);
            const QJsonObject content{
                {"runtime", runtime},
                {"pid", static_cast<double>(QCoreApplication::applicationPid())},
                {"startedAt", QDateTime::currentDateTimeUtc().toString(Qt::ISODate)},
                {"token", token_},
            };
            const QByteArray bytes = QJsonDocument(content).toJson(QJsonDocument::Compact);
            if (file.write(bytes) == bytes.size() && file.flush()) {
                file.close();
                if (error) error->clear();
                return true;
            }
            file.close();
            file.remove();
            if (error) *error = QStringLiteral("Falha ao escrever o lock do perfil.");
            return false;
        }
        const QJsonObject current = readHolder(path_);
        if (current.isEmpty()) {
            // Lock ilegível ou parcialmente gravado por um processo que caiu no meio.
            QFile::remove(path_);
            continue;
        }
        const qint64 pid = static_cast<qint64>(current.value("pid").toDouble());
        if (processAlive(pid)) {
            if (error) {
                *error = QStringLiteral("Perfil em uso pelo runtime '%1' (PID %2). Feche-o antes de abrir.")
                    .arg(current.value("runtime").toString()).arg(pid);
            }
            return false;
        }
        // Processo morto: o lock é obsoleto e pode ser retomado.
        QFile::remove(path_);
    }
    if (error) *error = QStringLiteral("Não foi possível obter o lock do perfil.");
    return false;
}

bool ProfileLock::refresh(QString* error) {
    if (token_.isEmpty() || !QFileInfo::exists(path_)) {
        if (error) *error = QStringLiteral("Lock não está ativo.");
        return false;
    }
    QJsonObject current = readHolder(path_);
    if (current.value("token").toString() != token_) {
        if (error) *error = QStringLiteral("O lock pertence a outro processo.");
        return false;
    }
    current.insert("refreshedAt", QDateTime::currentDateTimeUtc().toString(Qt::ISODate));
    // QSaveFile grava em arquivo temporário e substitui, evitando leitura parcial do JSON.
    QSaveFile file(path_);
    if (!file.open(QIODevice::WriteOnly)) {
        if (error) *error = QStringLiteral("Não foi possível atualizar o lock.");
        return false;
    }
    const QByteArray bytes = QJsonDocument(current).toJson(QJsonDocument::Compact);
    if (file.write(bytes) != bytes.size() || !file.commit()) {
        if (error) *error = QStringLiteral("Não foi possível atualizar o lock.");
        return false;
    }
    if (error) error->clear();
    return true;
}

void ProfileLock::release() {
    if (token_.isEmpty()) return;
    const QJsonObject current = readHolder(path_);
    // Nunca remove um lock que outro processo retomou depois de um release perdido.
    if (current.value("token").toString() == token_) QFile::remove(path_);
    token_.clear();
}

bool ProfileLock::isHeld() const {
    return !token_.isEmpty() && readHolder(path_).value("token").toString() == token_;
}

QJsonObject ProfileLock::holder() const {
    return path_.isEmpty() ? QJsonObject() : readHolder(path_);
}

QString ProfileLock::path() const {
    return path_;
}

} // namespace gamestock
