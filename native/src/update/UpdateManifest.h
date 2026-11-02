/** Contrato do `latest.json` assinado, com payload canônico em base64. */
#pragma once

#include <QByteArray>
#include <QString>

namespace gamestock {
/** Dados do pacote remoto após validação da assinatura. */
struct UpdateManifest {
    int schemaVersion = 0;
    QString version;
    QString buildNumber;
    QString releaseDate;
    QString notes;
    QString packageUrl;
    QString fileName;
    qint64 packageSize = 0;
    QByteArray sha256;
};

/** Faz parse do envelope, verifica ECDSA e então interpreta o payload. */
bool parseSignedUpdateManifest(const QByteArray& envelopeJson, const QByteArray& publicKeyX,
    const QByteArray& publicKeyY, UpdateManifest* manifest, QString* error);
} // namespace gamestock
