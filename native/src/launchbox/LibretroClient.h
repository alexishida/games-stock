/** Busca de títulos no catálogo público de thumbnails da Libretro. */
#pragma once

#include <QString>
#include <QStringList>

namespace gamestock {
/** Consulta diretórios Named_Boxarts sem baixar mídia (tarefa 7.3). */
class LibretroClient final {
public:
    explicit LibretroClient(QString baseUrl = QString());

    /** Retorna até 30 títulos cujo nome contenha a busca, exatos primeiro. */
    QStringList searchTitles(const QString& query, const QString& platformName);

    /** Nome do diretório Libretro para a plataforma local, ou vazio. */
    static QString platformDirectory(const QString& platformName);

private:
    QStringList listImages(const QString& directory);
    QString baseUrl_;
};
} // namespace gamestock
