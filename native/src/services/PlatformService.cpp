/** Implementação da fachada de plataformas; toda a SQL fica no DAO. */
#include "PlatformService.h"

#include "db/dao/PlatformDao.h"

#include <QRegularExpression>
#include <QStringList>

#include <algorithm>

namespace gamestock {
namespace {
/** Aceita aliases como string ou mapa `{alias}` vindo do QML. */
QStringList aliasValues(const QVariantList& aliases) {
    QStringList values;
    for (const QVariant& entry : aliases) {
        const QString value = entry.metaType() == QMetaType::fromType<QVariantMap>()
            ? entry.toMap().value(QStringLiteral("alias")).toString() : entry.toString();
        if (!value.trimmed().isEmpty()) values.append(value);
    }
    return values;
}

/** Converte a lista de extensões do QML em mapas validados pelo DAO. */
QList<QVariantMap> extensionValues(const QVariantList& extensions) {
    QList<QVariantMap> values;
    for (const QVariant& entry : extensions) {
        if (entry.metaType() == QMetaType::fromType<QVariantMap>()) values.append(entry.toMap());
    }
    return values;
}
} // namespace

PlatformService::PlatformService(QObject* parent) : QObject(parent) {}

bool PlatformService::open(const QString& databasePath, QString* error) {
    QString localError;
    if (!connection_.open(databasePath, &localError)) {
        error_ = localError;
        if (error) *error = localError;
        emit changed();
        return false;
    }
    open_ = true;
    refresh();
    if (!error_.isEmpty()) {
        if (error) *error = error_;
        return false;
    }
    if (error) error->clear();
    return true;
}

bool PlatformService::isOpen() const { return open_; }
QAbstractItemModel* PlatformService::model() { return &model_; }

void PlatformService::refresh() {
    if (!open_) return;
    PlatformDao dao(connection_.database());
    QList<QVariantMap> platforms;
    QString error;
    if (!dao.list(&platforms, &error)) {
        error_ = error;
        emit changed();
        return;
    }
    items_.clear();
    for (const QVariantMap& platform : platforms) items_.append(platform);
    model_.setPlatforms(platforms);
    error_.clear();
    emit changed();
}

QVariantMap PlatformService::get(qint64 id) {
    if (!open_) {
        error_ = QStringLiteral("Banco de plataformas indisponível.");
        emit changed();
        return {};
    }
    PlatformDao dao(connection_.database());
    QVariantMap platform;
    QString error;
    if (!dao.get(id, &platform, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    error_.clear();
    emit changed();
    return platform;
}

qint64 PlatformService::create(const QString& name, const QString& category) {
    if (!open_) {
        error_ = QStringLiteral("Banco de plataformas indisponível.");
        emit changed();
        return -1;
    }
    PlatformDao dao(connection_.database());
    qint64 id = 0;
    QString error;
    if (!dao.create(name, category, &id, &error)) {
        error_ = error;
        emit changed();
        return -1;
    }
    refresh();
    return id;
}

bool PlatformService::update(qint64 id, const QString& name, const QString& category) {
    if (!open_) {
        error_ = QStringLiteral("Banco de plataformas indisponível.");
        emit changed();
        return false;
    }
    PlatformDao dao(connection_.database());
    QString error;
    if (!dao.update(id, name, category, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    refresh();
    return true;
}

bool PlatformService::remove(qint64 id) {
    if (!open_) {
        error_ = QStringLiteral("Banco de plataformas indisponível.");
        emit changed();
        return false;
    }
    PlatformDao dao(connection_.database());
    QString error;
    if (!dao.remove(id, &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    refresh();
    return true;
}

QVariantMap PlatformService::getMappings(qint64 id) {
    if (!open_) {
        error_ = QStringLiteral("Banco de plataformas indisponível.");
        emit changed();
        return {};
    }
    PlatformDao dao(connection_.database());
    QVariantMap mappings;
    QString error;
    if (!dao.mappings(id, &mappings, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    error_.clear();
    return mappings;
}

bool PlatformService::saveMappings(qint64 id, const QVariantList& aliases, const QVariantList& romExtensions) {
    if (!open_) {
        error_ = QStringLiteral("Banco de plataformas indisponível.");
        emit changed();
        return false;
    }
    PlatformDao dao(connection_.database());
    QString error;
    if (!dao.saveMappings(id, aliasValues(aliases), extensionValues(romExtensions), &error)) {
        error_ = error;
        emit changed();
        return false;
    }
    error_.clear();
    emit changed();
    return true;
}
namespace {
/** Normaliza nome de plataforma como `normalizePlatformName` do renderer. */
QString normalizePlatformName(const QString& value) {
    const QString decomposed = value.normalized(QString::NormalizationForm_D);
    QString withoutMarks;
    withoutMarks.reserve(decomposed.size());
    for (const QChar character : decomposed) {
        const auto category = character.category();
        if (category == QChar::Mark_NonSpacing || category == QChar::Mark_SpacingCombining
            || category == QChar::Mark_Enclosing) continue;
        withoutMarks += character;
    }
    QString normalized = withoutMarks.toLower();
    normalized.replace(QRegularExpression(QStringLiteral("[^a-z0-9]+")), QStringLiteral(" "));
    return normalized.trimmed().replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral(" "));
}
} // namespace

QStringList PlatformService::launchBoxAliases(qint64 platformId) {
    if (!open_) {
        error_ = QStringLiteral("Banco de plataformas indisponível.");
        emit changed();
        return {};
    }
    PlatformDao dao(connection_.database());
    QVariantMap mappings;
    QString error;
    if (!dao.mappings(platformId, &mappings, &error)) {
        error_ = error;
        emit changed();
        return {};
    }
    QStringList aliases;
    for (const QVariant& entry : mappings.value(QStringLiteral("aliases")).toList()) {
        const QString alias = entry.toMap().value(QStringLiteral("alias")).toString();
        if (!alias.isEmpty() && !aliases.contains(alias)) aliases.append(alias);
    }
    QVariantMap platform;
    if (dao.get(platformId, &platform, &error)) {
        const QString name = platform.value(QStringLiteral("name")).toString();
        const QString normalized = normalizePlatformName(name);
        bool hasCanonical = false;
        for (const QString& alias : aliases) {
            if (normalizePlatformName(alias) == normalized) { hasCanonical = true; break; }
        }
        if (!name.isEmpty() && !hasCanonical) aliases.prepend(name);
    }
    error_.clear();
    return aliases;
}

qint64 PlatformService::resolvePlatformByLaunchBoxName(const QString& name) {
    if (!open_) {
        error_ = QStringLiteral("Banco de plataformas indisponível.");
        emit changed();
        return 0;
    }
    const QString normalized = normalizePlatformName(name);
    if (normalized.isEmpty()) return 0;
    PlatformDao dao(connection_.database());
    QList<QVariantMap> platforms;
    QString error;
    if (!dao.list(&platforms, &error)) {
        error_ = error;
        emit changed();
        return 0;
    }
    struct Candidate { QString alias; qint64 platformId; };
    QList<Candidate> candidates;
    for (const QVariantMap& platform : platforms) {
        const QString platformName = platform.value(QStringLiteral("name")).toString();
        candidates.append({platformName, platform.value(QStringLiteral("id")).toLongLong()});
        QVariantMap mappings;
        if (!dao.mappings(platform.value(QStringLiteral("id")).toLongLong(), &mappings, &error)) continue;
        for (const QVariant& entry : mappings.value(QStringLiteral("aliases")).toList()) {
            const QString alias = entry.toMap().value(QStringLiteral("alias")).toString();
            if (!alias.isEmpty()) candidates.append({alias, platform.value(QStringLiteral("id")).toLongLong()});
        }
    }
    std::stable_sort(candidates.begin(), candidates.end(), [](const Candidate& left, const Candidate& right) {
        return left.alias.size() > right.alias.size();
    });
    for (const Candidate& candidate : candidates) {
        const QString alias = normalizePlatformName(candidate.alias);
        if (alias.isEmpty()) continue;
        if (alias == normalized) return candidate.platformId;
        if (alias.size() > 4 && normalized.contains(alias)) return candidate.platformId;
    }
    error_.clear();
    return 0;
}
} // namespace gamestock
