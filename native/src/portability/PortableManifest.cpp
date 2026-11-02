/** Leitura estrita do manifesto; categorias desconhecidas não são aceitas silenciosamente. */
#include "PortableManifest.h"

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonValue>
#include <QSet>

namespace gamestock {
QStringList portableCategories() {
    return {QStringLiteral("metadata"), QStringLiteral("images"), QStringLiteral("platforms"),
        QStringLiteral("romLocations"), QStringLiteral("inventoryImages")};
}

bool normalizePortableCategories(const QStringList& input, QStringList* output, QString* error) {
    if (!output) {
        if (error) *error = QStringLiteral("Destino das categorias ausente.");
        return false;
    }
    const QStringList allowed = portableCategories();
    QStringList normalized;
    for (const QString& value : input) {
        const QString category = value.trimmed();
        if (!allowed.contains(category)) continue;
        if (!normalized.contains(category)) normalized.append(category);
    }
    if (normalized.isEmpty()) {
        if (error) *error = QStringLiteral("Selecione ao menos uma categoria.");
        return false;
    }
    *output = normalized;
    if (error) error->clear();
    return true;
}

bool writePortableManifest(const PortableManifest& manifest, QByteArray* json, QString* error) {
    if (!json) {
        if (error) *error = QStringLiteral("Destino do manifesto ausente.");
        return false;
    }
    if (manifest.schemaVersion != kPortableSchemaVersion) {
        if (error) *error = QStringLiteral("Versão de manifesto inválida.");
        return false;
    }
    QStringList categories;
    if (!normalizePortableCategories(manifest.categories, &categories, error)) return false;
    QJsonObject root;
    root.insert(QStringLiteral("schemaVersion"), manifest.schemaVersion);
    root.insert(QStringLiteral("appVersion"), manifest.appVersion);
    root.insert(QStringLiteral("createdAt"), manifest.createdAt);
    root.insert(QStringLiteral("categories"), QJsonArray::fromStringList(categories));
    root.insert(QStringLiteral("counts"), QJsonObject::fromVariantMap(manifest.counts));
    *json = QJsonDocument(root).toJson(QJsonDocument::Compact);
    if (error) error->clear();
    return true;
}

bool readPortableManifest(const QByteArray& json, PortableManifest* manifest, QString* error) {
    if (!manifest) {
        if (error) *error = QStringLiteral("Destino do manifesto ausente.");
        return false;
    }
    QJsonParseError parseError;
    const QJsonDocument document = QJsonDocument::fromJson(json, &parseError);
    if (parseError.error != QJsonParseError::NoError || !document.isObject()) {
        if (error) *error = QStringLiteral("Manifesto do pacote é inválido.");
        return false;
    }
    const QJsonObject root = document.object();
    const QJsonValue version = root.value(QStringLiteral("schemaVersion"));
    if (!version.isDouble()) {
        if (error) *error = QStringLiteral("Manifesto sem schemaVersion.");
        return false;
    }
    const int schemaVersion = version.toInt(-1);
    if (schemaVersion != kPortableSchemaVersion) {
        if (error) *error = QStringLiteral("Versão de backup não suportada: %1").arg(schemaVersion);
        return false;
    }
    const QJsonValue categoriesValue = root.value(QStringLiteral("categories"));
    if (!categoriesValue.isArray()) {
        if (error) *error = QStringLiteral("Manifesto sem categorias.");
        return false;
    }
    QStringList rawCategories;
    for (const QJsonValue& value : categoriesValue.toArray()) {
        if (value.isString()) rawCategories.append(value.toString());
    }
    QStringList categories;
    if (!normalizePortableCategories(rawCategories, &categories, error)) return false;

    PortableManifest parsed;
    parsed.schemaVersion = schemaVersion;
    parsed.appVersion = root.value(QStringLiteral("appVersion")).toString();
    parsed.createdAt = root.value(QStringLiteral("createdAt")).toString();
    parsed.categories = categories;
    parsed.counts = root.value(QStringLiteral("counts")).toObject().toVariantMap();
    *manifest = parsed;
    if (error) error->clear();
    return true;
}
} // namespace gamestock
