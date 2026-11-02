/** Configuração fixa do feed; a chave privada correspondente fica fora do repositório. */
#pragma once

#include <QString>

namespace gamestock {
/** Asset `latest.json` publicado em GitHub Releases. */
inline const QString updateManifestUrl()
{
    return QStringLiteral("https://github.com/alexishida/games-stock/releases/latest/download/latest.json");
}

/** Chave pública ECDSA P-256 gerada localmente (X e Y em base64). */
inline QString updatePublicKeyX()
{
    return QStringLiteral("F/BMUYBe29wTBVtOMe9Brgw3fzjr8/2lyITnBGE+vGI=");
}

inline QString updatePublicKeyY()
{
    return QStringLiteral("HybDPFyKg3e7uoVFyK7oxtSXDoJ8qLC4nMCoz9JoXww=");
}

/** Tempo máximo do check automático antes de liberar o modo offline. */
constexpr int kUpdateStartupTimeoutMs = 30000;
} // namespace gamestock
