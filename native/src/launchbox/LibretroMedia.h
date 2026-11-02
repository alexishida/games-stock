/** Fallback de capas e screenshots no catálogo público Libretro. */
#pragma once

#include <QString>
#include <QStringList>

namespace gamestock {
/** Caminhos locais produzidos pelo fallback Libretro. */
struct LibretroMediaResult {
    QString coverPath;
    QString screenshotPath;
};

/** Consulta Named_Boxarts/Named_Snaps e baixa somente as mídias solicitadas. */
class LibretroMedia final {
public:
    explicit LibretroMedia(QString baseUrl = QString());

    /** Preenche capa e screenshot ausentes, preservando arquivos anteriores. */
    LibretroMediaResult downloadMedia(const QStringList& titles, const QString& platformName,
        const QString& gameDir, bool cover, bool screenshot) const;

    /** Diretório Libretro da plataforma, ou vazio quando não mapeada. */
    static QString platformDirectory(const QString& platformName);

private:
    QString baseUrl_;
};
} // namespace gamestock
