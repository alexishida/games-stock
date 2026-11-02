/** Implementação Windows via BCrypt; Linux fica explicitamente indisponível nesta etapa. */
#include "UpdateSignature.h"

#include <QCryptographicHash>

#ifdef Q_OS_WIN
#include <windows.h>
#include <bcrypt.h>
#endif

namespace gamestock {
bool verifyUpdateSignature(const QByteArray& payload, const QByteArray& signature,
    const QByteArray& publicKeyX, const QByteArray& publicKeyY, QString* error) {
#ifdef Q_OS_WIN
    if (publicKeyX.size() != 32 || publicKeyY.size() != 32 || signature.size() != 64) {
        if (error) *error = QStringLiteral("Chave ou assinatura com tamanho inválido.");
        return false;
    }
    BCRYPT_ALG_HANDLE algorithm = nullptr;
    BCRYPT_KEY_HANDLE key = nullptr;
    NTSTATUS status = BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_ECDSA_P256_ALGORITHM, nullptr, 0);
    if (status < 0) {
        if (error) *error = QStringLiteral("Algoritmo ECDSA indisponível (0x%1).").arg(status, 0, 16);
        return false;
    }
    QByteArray blob;
    const ULONG header[2] = {BCRYPT_ECDSA_PUBLIC_P256_MAGIC, 32};
    blob.append(reinterpret_cast<const char*>(header), sizeof(header));
    blob.append(publicKeyX);
    blob.append(publicKeyY);
    status = BCryptImportKeyPair(algorithm, nullptr, BCRYPT_ECCPUBLIC_BLOB, &key,
        reinterpret_cast<PUCHAR>(blob.data()), static_cast<ULONG>(blob.size()), 0);
    if (status < 0) {
        BCryptCloseAlgorithmProvider(algorithm, 0);
        if (error) *error = QStringLiteral("Chave pública de atualização inválida (0x%1).").arg(status, 0, 16);
        return false;
    }
    const QByteArray hash = QCryptographicHash::hash(payload, QCryptographicHash::Sha256);
    status = BCryptVerifySignature(key, nullptr, reinterpret_cast<PUCHAR>(const_cast<char*>(hash.constData())),
        static_cast<ULONG>(hash.size()), reinterpret_cast<PUCHAR>(const_cast<char*>(signature.constData())),
        static_cast<ULONG>(signature.size()), 0);
    BCryptDestroyKey(key);
    BCryptCloseAlgorithmProvider(algorithm, 0);
    if (status < 0) {
        if (error) *error = QStringLiteral("Assinatura de atualização inválida.");
        return false;
    }
    if (error) error->clear();
    return true;
#else
    Q_UNUSED(payload);
    Q_UNUSED(signature);
    Q_UNUSED(publicKeyX);
    Q_UNUSED(publicKeyY);
    if (error) *error = QStringLiteral("Atualização assinada ainda não é suportada no Linux.");
    return false;
#endif
}
} // namespace gamestock
