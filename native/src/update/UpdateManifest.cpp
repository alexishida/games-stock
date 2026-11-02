/** Envelope {schemaVersion,payload,signature} protegido contra troca de campos. */
#include "UpdateManifest.h"

#include "UpdateSignature.h"

#include <QJsonDocument>
#include <QJsonObject>
#include <QUrl>

namespace gamestock {
bool parseSignedUpdateManifest(const QByteArray& envelopeJson, const QByteArray& publicKeyX,
    const QByteArray& publicKeyY, UpdateManifest* manifest, QString* error) {
    if (!manifest) {
        if (error) *error = QStringLiteral("Destino do manifesto ausente.");
        return false;
    }
    if (envelopeJson.isEmpty() || envelopeJson.size() > 1024 * 1024) {
        if (error) *error = QStringLiteral("Manifesto de atualização inválido.");
        return false;
    }
    QJsonParseError parseError;
    const QJsonDocument envelope = QJsonDocument::fromJson(envelopeJson, &parseError);
    if (parseError.error != QJsonParseError::NoError || !envelope.isObject()) {
        if (error) *error = QStringLiteral("Manifesto de atualização não é JSON válido.");
        return false;
    }
    const QJsonObject root = envelope.object();
    if (root.value(QStringLiteral("schemaVersion")).toInt() != 1) {
        if (error) *error = QStringLiteral("Versão de manifesto de atualização não suportada.");
        return false;
    }
    const QByteArray payload = QByteArray::fromBase64(root.value(QStringLiteral("payload")).toString().toLatin1());
    const QByteArray signature = QByteArray::fromBase64(root.value(QStringLiteral("signature")).toString().toLatin1());
    if (payload.isEmpty() || signature.isEmpty()) {
        if (error) *error = QStringLiteral("Manifesto sem payload/assinatura.");
        return false;
    }
    if (!verifyUpdateSignature(payload, signature, publicKeyX, publicKeyY, error)) return false;

    const QJsonDocument document = QJsonDocument::fromJson(payload, &parseError);
    if (parseError.error != QJsonParseError::NoError || !document.isObject()) {
        if (error) *error = QStringLiteral("Payload assinado não é JSON válido.");
        return false;
    }
    const QJsonObject data = document.object();
    UpdateManifest parsed;
    parsed.schemaVersion = data.value(QStringLiteral("schemaVersion")).toInt();
    parsed.version = data.value(QStringLiteral("version")).toString();
    parsed.buildNumber = data.value(QStringLiteral("buildNumber")).toString();
    parsed.releaseDate = data.value(QStringLiteral("releaseDate")).toString();
    parsed.notes = data.value(QStringLiteral("notes")).toString();
    parsed.packageUrl = data.value(QStringLiteral("packageUrl")).toString();
    parsed.fileName = data.value(QStringLiteral("fileName")).toString();
    parsed.packageSize = static_cast<qint64>(data.value(QStringLiteral("size")).toDouble());
    parsed.sha256 = QByteArray::fromHex(data.value(QStringLiteral("sha256")).toString().toLatin1());
    if (parsed.schemaVersion != 1 || parsed.version.isEmpty() || parsed.packageUrl.isEmpty()
        || parsed.fileName.isEmpty() || parsed.packageSize <= 0 || parsed.sha256.size() != 32) {
        if (error) *error = QStringLiteral("Manifesto assinado incompleto.");
        return false;
    }
    const QUrl url(parsed.packageUrl);
    if (!url.isValid() || (url.scheme() != QLatin1String("https") && url.host() != QLatin1String("127.0.0.1")
            && url.host() != QLatin1String("localhost"))) {
        if (error) *error = QStringLiteral("URL do pacote de atualização deve usar HTTPS.");
        return false;
    }
    *manifest = parsed;
    if (error) error->clear();
    return true;
}
} // namespace gamestock
