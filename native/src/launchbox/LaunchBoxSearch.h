/** Busca determinística no índice LaunchBox e normalização compartilhada. */
#pragma once

#include <QHash>
#include <QJsonObject>
#include <QList>
#include <QStringList>
#include <QVariantMap>

namespace gamestock {
/** Filtros da busca LaunchBox. */
struct LaunchBoxSearchOptions {
    QString query;
    /** Nomes/aliases aceitos; vazio com `restrictPlatforms` recusa tudo. */
    QStringList allowedPlatforms;
    bool restrictPlatforms = false;
    int limit = 100;
};

/** Normaliza título/plataforma sem aproximar jogos diferentes. */
QString normalizeLaunchBoxSearchText(const QString& value);

/** Retorna jogos exatos primeiro e depois parciais, ordenados por nome. */
QList<QVariantMap> searchLaunchBoxIndex(const QJsonObject& index, const LaunchBoxSearchOptions& options);

/**
 * Visão preparada do índice para buscas repetidas.
 * Normaliza título, aliases e plataforma uma única vez e mantém os candidatos
 * agrupados por plataforma; a ordenação/tie-break continuam idênticos à busca direta.
 */
class LaunchBoxSearchIndex final {
public:
    /** Constrói a visão a partir do índice bruto; não guarda referência ao objeto de origem. */
    explicit LaunchBoxSearchIndex(const QJsonObject& index);

    /** Mesmo contrato de `searchLaunchBoxIndex`, sem recalcular textos normalizados. */
    QList<QVariantMap> search(const LaunchBoxSearchOptions& options) const;

    /** Quantidade de jogos indexados (usada por testes e medições). */
    qsizetype size() const { return entries_.size(); }

private:
    /** Textos normalizados e posição original, suficientes para reproduzir a ordem anterior. */
    struct Entry {
        QJsonObject game;
        QString title;
        QString name;
        QList<QString> aliases;
        qsizetype sequence = 0;
    };
    QList<Entry> entries_;
    /** Índices de `entries_` por plataforma normalizada, para evitar varrer o catálogo filtrado. */
    QHash<QString, QList<qsizetype>> byPlatform_;
};
} // namespace gamestock
