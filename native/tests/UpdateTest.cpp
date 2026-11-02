/** Verifica assinatura, hash/tamanho, feed offline e execução só após validação. */
#include "update/UpdateManifest.h"
#include "update/UpdateService.h"
#include "update/UpdateSignature.h"
#include "HttpTestServer.h"

#include <QDir>
#include <QFile>
#include <QCryptographicHash>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSignalSpy>
#include <QTcpServer>
#include <QTemporaryDir>
#include <QtTest>

#ifdef Q_OS_WIN
#include <windows.h>
#include <bcrypt.h>
#endif

#ifndef GAMESTOCK_FAKE_EMULATOR
#define GAMESTOCK_FAKE_EMULATOR ""
#endif

namespace {
#ifdef Q_OS_WIN
/** Par de chaves ECDSA P-256 descartável criado pelo próprio teste. */
struct TestKey {
    BCRYPT_KEY_HANDLE handle = nullptr;
    QByteArray x;
    QByteArray y;
};

TestKey createKey() {
    TestKey key;
    BCRYPT_ALG_HANDLE algorithm = nullptr;
    if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_ECDSA_P256_ALGORITHM, nullptr, 0) < 0) return key;
    if (BCryptGenerateKeyPair(algorithm, &key.handle, 256, 0) < 0) {
        BCryptCloseAlgorithmProvider(algorithm, 0);
        return key;
    }
    BCryptFinalizeKeyPair(key.handle, 0);
    DWORD size = 0;
    BCryptExportKey(key.handle, nullptr, BCRYPT_ECCPRIVATE_BLOB, nullptr, 0, &size, 0);
    QByteArray privateBlob(static_cast<qsizetype>(size), Qt::Uninitialized);
    if (BCryptExportKey(key.handle, nullptr, BCRYPT_ECCPRIVATE_BLOB,
            reinterpret_cast<PUCHAR>(privateBlob.data()), size, &size, 0) >= 0) {
        // Blob: header (8 bytes), X (32), Y (32), D (32).
        key.x = privateBlob.mid(8, 32);
        key.y = privateBlob.mid(40, 32);
    }
    BCryptCloseAlgorithmProvider(algorithm, 0);
    return key;
}

QByteArray sign(const QByteArray& payload, BCRYPT_KEY_HANDLE key) {
    const QByteArray hash = QCryptographicHash::hash(payload, QCryptographicHash::Sha256);
    DWORD size = 0;
    if (BCryptSignHash(key, nullptr, reinterpret_cast<PUCHAR>(const_cast<char*>(hash.constData())),
            static_cast<ULONG>(hash.size()), nullptr, 0, &size, 0) < 0) return {};
    QByteArray signature(static_cast<qsizetype>(size), Qt::Uninitialized);
    if (BCryptSignHash(key, nullptr, reinterpret_cast<PUCHAR>(const_cast<char*>(hash.constData())),
            static_cast<ULONG>(hash.size()), reinterpret_cast<PUCHAR>(signature.data()), size, &size, 0) < 0) return {};
    signature.resize(static_cast<qsizetype>(size));
    return signature;
}
#endif

/** Envelope `latest.json` com payload assinado. */
QByteArray envelope(const QByteArray& payload, const QByteArray& signature) {
    return QJsonDocument(QJsonObject{{QStringLiteral("schemaVersion"), 1},
        {QStringLiteral("payload"), QString::fromLatin1(payload.toBase64())},
        {QStringLiteral("signature"), QString::fromLatin1(signature.toBase64())}}).toJson(QJsonDocument::Compact);
}

/** Payload do manifesto com hash/tamanho do pacote. */
QByteArray manifestPayload(const QString& packageUrl, const QByteArray& package, const QByteArray& hash) {
    return QJsonDocument(QJsonObject{{QStringLiteral("schemaVersion"), 1},
        {QStringLiteral("version"), QStringLiteral("9.9.9")},
        {QStringLiteral("buildNumber"), QStringLiteral("999")},
        {QStringLiteral("releaseDate"), QStringLiteral("2026-11-03T10:00:00.000Z")},
        {QStringLiteral("notes"), QStringLiteral("Teste")},
        {QStringLiteral("packageUrl"), packageUrl},
        {QStringLiteral("fileName"), QStringLiteral("GameStock-Setup-9.9.9.exe")},
        {QStringLiteral("size"), static_cast<double>(package.size())},
        {QStringLiteral("sha256"), QString::fromLatin1(hash.toHex())}}).toJson(QJsonDocument::Compact);
}
} // namespace

class UpdateTest : public QObject {
    Q_OBJECT
private slots:
#ifdef Q_OS_WIN
    void signatureRejectsTampering() {
        const TestKey key = createKey();
        QVERIFY(key.handle != nullptr && key.x.size() == 32 && key.y.size() == 32);
        const QByteArray payload = QByteArrayLiteral("{\"version\":\"1.2.3\"}");
        const QByteArray signature = sign(payload, key.handle);
        QCOMPARE(signature.size(), 64);
        QString error;
        QVERIFY2(gamestock::verifyUpdateSignature(payload, signature, key.x, key.y, &error), qPrintable(error));
        QVERIFY(!gamestock::verifyUpdateSignature(payload + "x", signature, key.x, key.y, &error));
        QVERIFY(!gamestock::verifyUpdateSignature(payload, signature, key.y, key.x, &error));
        QByteArray tampered = signature;
        tampered[0] = static_cast<char>(tampered[0] ^ 0x01);
        QVERIFY(!gamestock::verifyUpdateSignature(payload, tampered, key.x, key.y, &error));
        BCryptDestroyKey(key.handle);
    }

    void signedManifestAndServiceFlow() {
        const TestKey key = createKey();
        QVERIFY(key.handle != nullptr);
        const QByteArray package = QByteArrayLiteral("instalador falso");
        const QByteArray hash = QCryptographicHash::hash(package, QCryptographicHash::Sha256);
        HttpTestServer server;
        QVERIFY(server.listen());
        const QString packagePath = QStringLiteral("/GameStock-Setup-9.9.9.exe");
        server.add(packagePath, package);
        const QByteArray payload = manifestPayload(server.baseUrl() + packagePath, package, hash);
        const QByteArray signedManifest = envelope(payload, sign(payload, key.handle));
        server.add(QStringLiteral("/latest.json"), signedManifest);

        gamestock::UpdateManifest manifest;
        QString error;
        QVERIFY2(gamestock::parseSignedUpdateManifest(signedManifest, key.x, key.y, &manifest, &error),
            qPrintable(error));
        QCOMPARE(manifest.version, QString("9.9.9"));
        QCOMPARE(manifest.packageSize, static_cast<qint64>(package.size()));

        gamestock::UpdateService service;
        QVERIFY2(service.configure(QStringLiteral("installed"), QStringLiteral("1.0.0"), QStringLiteral("1"),
            server.baseUrl() + QStringLiteral("/latest.json"), key.x, key.y, &error), qPrintable(error));
        service.setAutoApply(false);
        service.setQuitOnApply(false);
        const QString marker = QDir::temp().filePath(QStringLiteral("gamestock-update-test-marker.txt"));
        QFile::remove(marker);
        qputenv("FAKE_EMULATOR_OUTPUT", marker.toUtf8());
        service.setApplyCommandForTest(QString::fromUtf8(GAMESTOCK_FAKE_EMULATOR), {});
        service.setAutoApply(false);
        QSignalSpy launched(&service, &gamestock::UpdateService::updateLaunched);
        service.checkNow();
        QTRY_COMPARE_WITH_TIMEOUT(service.phase(), QString("applying"), 15000);
        QVERIFY(service.packagePath().endsWith(QStringLiteral("GameStock-Setup-9.9.9.exe")));
        QVERIFY(QFile::exists(service.packagePath()));
        const QString readyPackage = service.packagePath();
        QVERIFY(service.applyReadyUpdate());
        QTRY_COMPARE_WITH_TIMEOUT(launched.count(), 1, 5000);
        QCOMPARE(launched.first().at(0).toString(), readyPackage);
        QTRY_VERIFY_WITH_TIMEOUT(QFile::exists(marker), 5000);
        qunsetenv("FAKE_EMULATOR_OUTPUT");
        BCryptDestroyKey(key.handle);
    }

    void rejectsBadSignatureHashAndSize() {
        const TestKey key = createKey();
        QVERIFY(key.handle != nullptr);
        const QByteArray package = QByteArrayLiteral("pacote");
        const QByteArray hash = QCryptographicHash::hash(package, QCryptographicHash::Sha256);
        HttpTestServer server;
        QVERIFY(server.listen());
        server.add(QStringLiteral("/pkg.exe"), package);
        const QByteArray payload = manifestPayload(server.baseUrl() + QStringLiteral("/pkg.exe"), package, hash);
        const QByteArray validEnvelope = envelope(payload, sign(payload, key.handle));
        server.add(QStringLiteral("/latest.json"), validEnvelope);

        gamestock::UpdateService badSignature;
        QString error;
        QVERIFY(badSignature.configure(QStringLiteral("installed"), QStringLiteral("1.0.0"), QStringLiteral("1"),
            server.baseUrl() + QStringLiteral("/latest.json"), key.y, key.x, &error));
        badSignature.setAutoApply(false);
        badSignature.checkNow();
        QTRY_COMPARE_WITH_TIMEOUT(badSignature.phase(), QString("error"), 10000);
        QVERIFY(badSignature.packagePath().isEmpty());

        // Hash assinado errado: download conclui, mas não vira pacote aplicável.
        QByteArray wrongPayload = manifestPayload(server.baseUrl() + QStringLiteral("/pkg.exe"), package,
            QByteArray(32, '\0'));
        server.add(QStringLiteral("/latest.json"), envelope(wrongPayload, sign(wrongPayload, key.handle)));
        gamestock::UpdateService wrongHash;
        QVERIFY(wrongHash.configure(QStringLiteral("installed"), QStringLiteral("1.0.0"), QStringLiteral("1"),
            server.baseUrl() + QStringLiteral("/latest.json"), key.x, key.y, &error));
        wrongHash.setAutoApply(false);
        wrongHash.checkNow();
        QTRY_COMPARE_WITH_TIMEOUT(wrongHash.phase(), QString("error"), 10000);
        QVERIFY(!wrongHash.applyReadyUpdate());

        // Tamanho divergente também é recusado antes de executar.
        QByteArray wrongSize = payload;
        wrongSize.replace("\"size\":" + QByteArray::number(package.size()),
            "\"size\":" + QByteArray::number(package.size() + 10));
        server.add(QStringLiteral("/latest.json"), envelope(wrongSize, sign(wrongSize, key.handle)));
        gamestock::UpdateService sizeMismatch;
        QVERIFY(sizeMismatch.configure(QStringLiteral("installed"), QStringLiteral("1.0.0"), QStringLiteral("1"),
            server.baseUrl() + QStringLiteral("/latest.json"), key.x, key.y, &error));
        sizeMismatch.setAutoApply(false);
        sizeMismatch.checkNow();
        QTRY_COMPARE_WITH_TIMEOUT(sizeMismatch.phase(), QString("error"), 10000);
        QVERIFY(!sizeMismatch.applyReadyUpdate());
        BCryptDestroyKey(key.handle);
    }

    void startupTimeoutReleasesOffline() {
        QTcpServer hanging;
        QVERIFY(hanging.listen(QHostAddress::LocalHost, 0));
        gamestock::UpdateService service;
        QString error;
        QVERIFY(service.configure(QStringLiteral("installed"), QStringLiteral("1.0.0"), QStringLiteral("1"),
            QStringLiteral("http://127.0.0.1:%1/latest.json").arg(hanging.serverPort()),
            QByteArray(32, '\0'), QByteArray(32, '\0'), &error));
        service.setStartupTimeoutForTest(150);
        service.startupCheck();
        QTRY_COMPARE_WITH_TIMEOUT(service.phase(), QString("no-connection"), 3000);
        QVERIFY(service.requiresAction());
        QVERIFY(service.startupVisible());
        service.skip();
        QVERIFY(!service.startupVisible());
    }

    void portableShowsExternalUpdate() {
        const TestKey key = createKey();
        QVERIFY(key.handle != nullptr);
        const QByteArray package = QByteArrayLiteral("pkg");
        const QByteArray hash = QCryptographicHash::hash(package, QCryptographicHash::Sha256);
        HttpTestServer server;
        QVERIFY(server.listen());
        server.add(QStringLiteral("/pkg.exe"), package);
        const QByteArray payload = manifestPayload(server.baseUrl() + QStringLiteral("/pkg.exe"), package, hash);
        server.add(QStringLiteral("/latest.json"), envelope(payload, sign(payload, key.handle)));
        gamestock::UpdateService service;
        QString error;
        QVERIFY(service.configure(QStringLiteral("portable"), QStringLiteral("1.0.0"), QStringLiteral("1"),
            server.baseUrl() + QStringLiteral("/latest.json"), key.x, key.y, &error));
        service.checkNow();
        QTRY_COMPARE_WITH_TIMEOUT(service.phase(), QString("external-update"), 10000);
        QVERIFY(!service.applyReadyUpdate());
        BCryptDestroyKey(key.handle);
    }
#endif
};

QTEST_GUILESS_MAIN(UpdateTest)
#include "UpdateTest.moc"
