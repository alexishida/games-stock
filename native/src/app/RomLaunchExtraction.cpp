/** Porta de src/main/romLaunchExtraction.ts usando 7-Zip para ZIP e 7z. */
#include "RomLaunchExtraction.h"

#include "db/PlatformCatalogData.h"

#include <QCryptographicHash>
#include <QCoreApplication>
#include <QDateTime>
#include <QDir>
#include <QDirIterator>
#include <QFile>
#include <QFileInfo>
#include <QJsonDocument>
#include <QJsonObject>
#include <QProcess>
#include <QRegularExpression>
#include <QStandardPaths>
#include <QStringList>

#include <algorithm>

namespace gamestock {
namespace {
const QString markerFile = QStringLiteral(".gamestock-launch.json");
const qint64 staleTtlMs = 7LL * 24 * 60 * 60 * 1000;
const QStringList discExtensions{QStringLiteral(".m3u"), QStringLiteral(".cue"), QStringLiteral(".gdi"),
    QStringLiteral(".ccd"), QStringLiteral(".toc")};
const QStringList compressedExtensions{QStringLiteral(".zip"), QStringLiteral(".7z")};
const QStringList junkExtensions{QStringLiteral(".txt"), QStringLiteral(".md"), QStringLiteral(".nfo"),
    QStringLiteral(".dat"), QStringLiteral(".html"), QStringLiteral(".htm"), QStringLiteral(".log"),
    QStringLiteral(".ini"), QStringLiteral(".xml"), QStringLiteral(".json"), QStringLiteral(".sfv"),
    QStringLiteral(".diz"), QStringLiteral(".url")};

/** Raiz padrão do cache; aceita override para testes e builds portáteis. */
QString extractionRoot(const QString& overridePath) {
    if (!overridePath.isEmpty()) return overridePath;
    const QString environment = qEnvironmentVariable("GAMESTOCK_EXTRACTION_DIR");
    if (!environment.isEmpty()) return environment;
    return QDir(QDir::tempPath()).filePath(QStringLiteral("gamestock/extracted-roms"));
}

/** Localiza 7za/7z/7zz sem baixar nada. */
QString sevenZipBinary(const QString& overridePath) {
    if (!overridePath.isEmpty() && QFileInfo(overridePath).isFile()) return overridePath;
    const QString environment = qEnvironmentVariable("GAMESTOCK_7Z_PATH");
    if (!environment.isEmpty() && QFileInfo(environment).isFile()) return environment;
    const QString appDir = QCoreApplication::applicationDirPath();
#ifdef Q_OS_WIN
    const QStringList names{QStringLiteral("7za.exe"), QStringLiteral("7z.exe"), QStringLiteral("7zz.exe")};
#else
    const QStringList names{QStringLiteral("7za"), QStringLiteral("7z"), QStringLiteral("7zz")};
#endif
    for (const QString& name : names) {
        for (const QString& directory : {appDir, QDir(appDir).filePath(QStringLiteral("tools"))}) {
            const QString candidate = QDir(directory).filePath(name);
            if (QFileInfo(candidate).isFile()) return candidate;
        }
    }
    for (const QString& name : {QStringLiteral("7za"), QStringLiteral("7z"), QStringLiteral("7zz")}) {
        const QString candidate = QStandardPaths::findExecutable(name);
        if (!candidate.isEmpty()) return candidate;
    }
    return {};
}

/** Nome estável por caminho, tamanho e mtime do pacote. */
QString extractionKey(const QString& archivePath, qint64 size, qint64 modified) {
    const QByteArray digest = QCryptographicHash::hash(
        QStringLiteral("%1|%2|%3").arg(archivePath).arg(size).arg(modified).toUtf8(),
        QCryptographicHash::Sha1).toHex().left(12);
    QString base = QFileInfo(archivePath).completeBaseName();
    base.replace(QRegularExpression(QStringLiteral("[^a-zA-Z0-9_-]+")), QStringLiteral("_"));
    return base.left(60) + QLatin1Char('-') + QString::fromLatin1(digest);
}

/** Lê o marcador e confirma que o arquivo escolhido continua acessível. */
QString reusableLaunchPath(const QString& extractionDir) {
    const QString markerPath = QDir(extractionDir).filePath(markerFile);
    QFile marker(markerPath);
    if (!marker.open(QIODevice::ReadOnly)) return {};
    const QJsonDocument document = QJsonDocument::fromJson(marker.readAll());
    marker.close();
    if (!document.isObject()) return {};
    const QString launchFile = document.object().value(QStringLiteral("launchFile")).toString();
    if (launchFile.isEmpty()) return {};
    const QString launchPath = QDir(extractionDir).filePath(launchFile);
    if (!QFileInfo(launchPath).isReadable()) return {};
    // O mtime do marcador é o critério de uso recente na limpeza.
    const QDateTime now = QDateTime::currentDateTime();
    QFile markerHandle(markerPath);
    if (markerHandle.open(QIODevice::ReadWrite)) {
        markerHandle.setFileTime(now, QFileDevice::FileModificationTime);
        markerHandle.close();
    }
    return QDir::cleanPath(launchPath);
}

/** Grava o marcador com o arquivo escolhido. */
bool writeLaunchMarker(const QString& extractionDir, const QString& launchFile, QString* error) {
    QFile marker(QDir(extractionDir).filePath(markerFile));
    if (!marker.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        if (error) *error = marker.errorString();
        return false;
    }
    const QByteArray json = QJsonDocument(QJsonObject{{QStringLiteral("launchFile"), launchFile}})
        .toJson(QJsonDocument::Compact);
    if (marker.write(json) != json.size()) {
        if (error) *error = QStringLiteral("Não foi possível gravar o marcador de extração.");
        return false;
    }
    return true;
}

/** Extrai ZIP ou 7z em diretório limpo usando 7-Zip. */
bool extractWithSevenZip(const QString& archivePath, const QString& targetDir, const QString& binary,
    QString* error) {
    QDir(targetDir).removeRecursively();
    if (!QDir().mkpath(targetDir)) {
        if (error) *error = QStringLiteral("Não foi possível criar o diretório de extração.");
        return false;
    }
    QProcess process;
    process.setProgram(binary);
    process.setArguments({QStringLiteral("x"), archivePath, QStringLiteral("-o") + QDir::toNativeSeparators(targetDir),
        QStringLiteral("-y"), QStringLiteral("-bso0"), QStringLiteral("-bsp0")});
    process.start();
    if (!process.waitForStarted(10000)) {
        if (error) *error = QStringLiteral("Não foi possível iniciar o extrator 7-Zip.");
        return false;
    }
    process.waitForFinished(-1);
    // Código 1 é aviso não fatal, como no Electron.
    if (process.exitStatus() != QProcess::NormalExit || (process.exitCode() != 0 && process.exitCode() != 1)) {
        const QString detail = QString::fromLocal8Bit(process.readAllStandardError()).trimmed();
        if (error) *error = detail.isEmpty() ? QStringLiteral("Falha ao extrair o pacote de ROM.") : detail;
        return false;
    }
    return true;
}

/** Lista arquivos recursivamente, ignorando o marcador. */
QList<QPair<QString, qint64>> extractedFiles(const QString& extractionDir) {
    QList<QPair<QString, qint64>> files;
    QDirIterator iterator(extractionDir, QDir::Files | QDir::NoDotAndDotDot, QDirIterator::Subdirectories);
    while (iterator.hasNext()) {
        const QString absolute = iterator.next();
        if (iterator.fileName() == markerFile) continue;
        const QString relative = QDir(extractionDir).relativeFilePath(absolute);
        files.append({QDir::fromNativeSeparators(relative), iterator.fileInfo().size()});
    }
    return files;
}

/** Escolhe índice de disco, ROM conhecida ou maior arquivo útil. */
QString pickLaunchFile(const QString& extractionDir) {
    const QList<QPair<QString, qint64>> files = extractedFiles(extractionDir);
    if (files.isEmpty()) return {};
    for (const QString& discExtension : discExtensions) {
        QStringList candidates;
        for (const auto& file : files) {
            if ((QStringLiteral(".") + QFileInfo(file.first).suffix()).toLower() == discExtension) candidates.append(file.first);
        }
        if (!candidates.isEmpty()) {
            std::stable_sort(candidates.begin(), candidates.end(), [](const QString& left, const QString& right) {
                return QString::localeAwareCompare(left, right) < 0;
            });
            return candidates.first();
        }
    }
    QStringList known;
    for (const QString& extension : supportedRomExtensions()) {
        if (!compressedExtensions.contains(extension.toLower())) known.append(extension.toLower());
    }
    QStringList romCandidates;
    for (const auto& file : files) {
        if (known.contains(QStringLiteral(".") + QFileInfo(file.first).suffix().toLower())) romCandidates.append(file.first);
    }
    if (!romCandidates.isEmpty()) {
        return *std::max_element(romCandidates.cbegin(), romCandidates.cend(),
            [&files](const QString& left, const QString& right) {
                const auto sizeOf = [&files](const QString& name) {
                    for (const auto& file : files) if (file.first == name) return file.second;
                    return qint64(0);
                };
                return sizeOf(left) < sizeOf(right);
            });
    }
    QStringList fallback;
    for (const auto& file : files) {
        const QString extension = (QStringLiteral(".") + QFileInfo(file.first).suffix()).toLower();
        if (compressedExtensions.contains(extension) || junkExtensions.contains(extension)) continue;
        fallback.append(file.first);
    }
    if (fallback.isEmpty()) return {};
    return *std::max_element(fallback.cbegin(), fallback.cend(), [&files](const QString& left, const QString& right) {
        const auto sizeOf = [&files](const QString& name) {
            for (const auto& file : files) if (file.first == name) return file.second;
            return qint64(0);
        };
        return sizeOf(left) < sizeOf(right);
    });
}

/** Remove extrações sem uso recente; falhas individuais são ignoradas. */
void pruneStaleExtractions(const QString& root) {
    const QFileInfoList entries = QDir(root).entryInfoList(QDir::Dirs | QDir::NoDotAndDotDot);
    const qint64 now = QDateTime::currentMSecsSinceEpoch();
    for (const QFileInfo& entry : entries) {
        const QFileInfo marker(QDir(entry.absoluteFilePath()).filePath(markerFile));
        const qint64 reference = marker.exists() ? marker.lastModified().toMSecsSinceEpoch()
            : entry.lastModified().toMSecsSinceEpoch();
        if (now - reference > staleTtlMs) QDir(entry.absoluteFilePath()).removeRecursively();
    }
}
} // namespace

QStringList supportedRomExtensions() {
    QStringList extensions;
    for (const auto& platform : catalog::platforms()) {
        for (const auto& extension : platform.romExtensions) {
            if (extension.primary && !extensions.contains(extension.extension)) extensions.append(extension.extension);
        }
    }
    extensions.sort(Qt::CaseInsensitive);
    return extensions;
}

QString sevenZipBinaryPath(const QString& overridePath) {
    return sevenZipBinary(overridePath);
}

bool extractArchiveWithSevenZip(const QString& archivePath, const QString& targetDir,
    const QString& binary, QString* error) {
    return extractWithSevenZip(archivePath, targetDir, binary, error);
}

QString prepareRomPathForLaunch(const QString& romPath, QString* warning,
    const QString& extractionRootOverride, const QString& sevenZipPathOverride) {
    if (warning) warning->clear();
    const QString extension = QLatin1Char('.') + QFileInfo(romPath).suffix().toLower();
    if (!compressedExtensions.contains(extension)) return romPath;

    const QString root = extractionRoot(extractionRootOverride);
    QString failure;
    QString result = romPath;
    const QFileInfo archiveInfo(romPath);
    if (!archiveInfo.isFile()) {
        failure = QStringLiteral("Pacote de ROM não encontrado.");
    } else {
        const QString key = extractionKey(archiveInfo.absoluteFilePath(), archiveInfo.size(),
            archiveInfo.lastModified().toMSecsSinceEpoch());
        const QString extractionDir = QDir(root).filePath(key);
        const QString cached = reusableLaunchPath(extractionDir);
        if (!cached.isEmpty()) {
            result = cached;
        } else {
            const QString binary = sevenZipBinary(sevenZipPathOverride);
            if (binary.isEmpty()) {
                failure = QStringLiteral("Extrator 7-Zip não encontrado.");
            } else if (!extractWithSevenZip(archiveInfo.absoluteFilePath(), extractionDir, binary, &failure)) {
                result = romPath;
            } else {
                const QString launchFile = pickLaunchFile(extractionDir);
                if (launchFile.isEmpty()) {
                    failure = QStringLiteral("Nenhum arquivo de ROM encontrado dentro do pacote.");
                } else if (!writeLaunchMarker(extractionDir, launchFile, &failure)) {
                    result = romPath;
                } else {
                    result = QDir::cleanPath(QDir(extractionDir).filePath(launchFile));
                }
            }
        }
    }
    pruneStaleExtractions(root);
    if (!failure.isEmpty() && warning) *warning = failure;
    return result;
}

bool clearExtractedRomCache(int* removedEntries, QString* error, const QString& extractionRootOverride) {
    const QString root = extractionRoot(extractionRootOverride);
    int removed = QDir(root).entryList(QDir::AllEntries | QDir::NoDotAndDotDot).size();
    if (!QDir(root).removeRecursively() && QFileInfo::exists(root)) {
        if (error) *error = QStringLiteral("Não foi possível remover o cache de ROMs extraídas.");
        return false;
    }
    if (!QDir().mkpath(root)) {
        if (error) *error = QStringLiteral("Não foi possível recriar o cache de ROMs extraídas.");
        return false;
    }
    if (removedEntries) *removedEntries = removed;
    if (error) error->clear();
    return true;
}
} // namespace gamestock
