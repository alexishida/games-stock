/** Verificação ECDSA P-256 do manifesto de atualização (CNG no Windows). */
#pragma once

#include <QByteArray>
#include <QString>

namespace gamestock {
/** Valida assinatura SHA-256 no formato P1363 (r||s) contra a chave pública embutida. */
bool verifyUpdateSignature(const QByteArray& payload, const QByteArray& signature,
    const QByteArray& publicKeyX, const QByteArray& publicKeyY, QString* error);
} // namespace gamestock
