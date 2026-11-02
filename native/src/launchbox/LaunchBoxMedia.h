/** Download de imagens LaunchBox e geração de cover.jpg sem ampliar. */
#pragma once

#include "launchbox/LaunchBoxCache.h"

#include <QString>
#include <QStringList>
#include <QVariantMap>

#include <functional>

namespace gamestock {
/** Resultado do download de mídia de um jogo. */
struct LaunchBoxMediaResult {
    int success = 0;
    int skipped = 0;
    int failed = 0;
    QStringList files;
};

/** Baixa mídias já indexadas e reaproveita arquivos existentes. */
class LaunchBoxMedia final {
public:
    explicit LaunchBoxMedia(QString imagesBaseUrl = QString());

    LaunchBoxMediaResult downloadImages(const QVariantMap& game, const QString& outputDir,
        const QStringList& types = {}, const std::function<void(const LaunchBoxProgress&)>& progress = {},
        bool force = false);

    /** `outputDir/<plataforma>/<título>-<id>`, sanitizado para Windows/Linux. */
    static QString gameImageDir(const QString& outputDir, const QVariantMap& game);
    /** Gera cover.jpg a partir do box-front de região prioritária; vazio se ausente. */
    static QString ensureCoverPreview(const QString& gameDir, const QStringList& files);
    /** Arquivo escolhido pela prioridade de região (exposto para diagnóstico). */
    static QString preferredBoxArt(const QStringList& files);

private:
    QString imagesBaseUrl_;
};
} // namespace gamestock
