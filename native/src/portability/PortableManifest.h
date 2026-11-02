/** Manifesto `.gamestock-backup` schemaVersion 1 compartilhado pelos dois runtimes. */
#pragma once

#include <QByteArray>
#include <QString>
#include <QStringList>
#include <QVariantMap>

namespace gamestock {
/** Conteúdo de `manifest.json`; campos desconhecidos são ignorados na leitura. */
struct PortableManifest {
    int schemaVersion = 0;
    QString appVersion;
    QString createdAt;
    QStringList categories;
    QVariantMap counts;
};

/** Versão de pacote aceita por esta implementação. */
constexpr int kPortableSchemaVersion = 1;

/** Categorias válidas, na mesma ordem do renderer. */
QStringList portableCategories();

/** Normaliza a lista sem duplicatas e recusa lista vazia. */
bool normalizePortableCategories(const QStringList& input, QStringList* output, QString* error);

/** Serializa em JSON compacto; falha se a lista de categorias for inválida. */
bool writePortableManifest(const PortableManifest& manifest, QByteArray* json, QString* error);

/**
 * Lê e valida o manifesto. Schema diferente de 1 é recusado explicitamente,
 * sem tentar interpretar o restante do pacote.
 */
bool readPortableManifest(const QByteArray& json, PortableManifest* manifest, QString* error);
} // namespace gamestock
