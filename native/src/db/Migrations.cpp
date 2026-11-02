/** Porta das migrations/seeds de src/main/db/database.ts preservando IDs e vínculos. */
#include "Migrations.h"

#include "LibraryGrouping.h"
#include "PlatformCatalogData.h"
#include "Schema.h"
#include "Seeds.h"

#include <QDir>
#include <QFileInfo>
#include <QRegularExpression>
#include <QSqlError>
#include <QSqlQuery>
#include <QVariant>
#include <functional>

namespace gamestock {
namespace {
/** Executa SQL sem parâmetros e propaga o erro do SQLite. */
bool exec(QSqlDatabase& database, const QString& sql, QString* error) {
    QSqlQuery query(database);
    if (query.exec(sql)) return true;
    if (error) *error = query.lastError().text();
    return false;
}

/** Executa migration de dados uma única vez e registra o nome na mesma transação. */
bool runOnce(QSqlDatabase& database, const QString& name, const std::function<bool(QString*)>& migration, QString* error) {
    if (!exec(database, QStringLiteral("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"), error)) return false;
    QSqlQuery applied(database);
    applied.prepare(QStringLiteral("SELECT 1 FROM schema_migrations WHERE name = ?"));
    applied.bindValue(0, name);
    if (!applied.exec()) { if (error) *error = applied.lastError().text(); return false; }
    if (applied.next()) return true;
    if (!database.transaction()) { if (error) *error = database.lastError().text(); return false; }
    if (!migration(error)) { database.rollback(); return false; }
    QSqlQuery insert(database);
    insert.prepare(QStringLiteral("INSERT INTO schema_migrations (name) VALUES (?)"));
    insert.bindValue(0, name);
    if (!insert.exec()) { if (error) *error = insert.lastError().text(); database.rollback(); return false; }
    if (!database.commit()) { if (error) *error = database.lastError().text(); return false; }
    return true;
}

/** Normaliza rom_path como path.resolve do Node: absoluto, separador / e minúsculas. */
QString normalizeOptionalRomPath(const QVariant& value) {
    const QString trimmed = value.toString().trimmed();
    if (trimmed.isEmpty()) return {};
    QString path = QDir::cleanPath(QFileInfo(trimmed).absoluteFilePath());
    path.replace(QLatin1Char('\\'), QLatin1Char('/'));
    return path.toLower();
}

/** Retorna o texto principal quando não é vazio, senão o fallback. */
QVariant pickPreferredString(const QVariant& primary, const QVariant& fallback) {
    if (primary.isValid() && !primary.toString().trimmed().isEmpty()) return primary;
    if (fallback.isValid() && !fallback.toString().trimmed().isEmpty()) return fallback;
    return QVariant(QMetaType(QMetaType::QString));
}

/** Linha de games usada na deduplicação por launchbox_id. */
struct GameRecord {
    qint64 id = 0;
    QString title;
    QVariant publisher;
    QVariant year;
    QVariant genre;
    QVariant rating;
    QVariant boxArtPath;
    QVariant backgroundPath;
    QVariant screenshotPath;
    QVariant romPath;
    QVariant notes;
    int favorite = 0;
    QString playStatus;
    int launchCount = 0;
    QString createdAt;
    QString updatedAt;
};

/** Mescla duplicatas priorizando o registro mais recente. */
GameRecord mergeGameRecord(const GameRecord& preferred, const GameRecord& candidate) {
    GameRecord merged = preferred;
    const QVariant title = pickPreferredString(QVariant(preferred.title), QVariant(candidate.title));
    merged.title = title.isValid() ? title.toString() : preferred.title;
    merged.publisher = pickPreferredString(preferred.publisher, candidate.publisher);
    merged.year = preferred.year.isValid() ? preferred.year : candidate.year;
    merged.genre = pickPreferredString(preferred.genre, candidate.genre);
    merged.rating = pickPreferredString(preferred.rating, candidate.rating);
    merged.boxArtPath = pickPreferredString(preferred.boxArtPath, candidate.boxArtPath);
    merged.backgroundPath = pickPreferredString(preferred.backgroundPath, candidate.backgroundPath);
    merged.screenshotPath = pickPreferredString(preferred.screenshotPath, candidate.screenshotPath);
    merged.romPath = pickPreferredString(preferred.romPath, candidate.romPath);
    merged.favorite = (preferred.favorite != 0 || candidate.favorite != 0) ? 1 : 0;
    merged.playStatus = preferred.playStatus != QLatin1String("unplayed") ? preferred.playStatus : candidate.playStatus;
    merged.notes = pickPreferredString(preferred.notes, candidate.notes);
    merged.launchCount = qMax(preferred.launchCount, candidate.launchCount);
    return merged;
}

/** Variantes com ROMs diferentes continuam registros distintos. */
bool areDistinctVariantRecords(const GameRecord& primary, const GameRecord& candidate) {
    const QString primaryRom = normalizeOptionalRomPath(primary.romPath);
    const QString candidateRom = normalizeOptionalRomPath(candidate.romPath);
    return !primaryRom.isEmpty() && !candidateRom.isEmpty() && primaryRom != candidateRom;
}

/** Lê uma linha completa de games para a deduplicação. */
GameRecord readGameRecord(const QSqlQuery& query) {
    GameRecord record;
    record.id = query.value(QStringLiteral("id")).toLongLong();
    record.title = query.value(QStringLiteral("title")).toString();
    record.publisher = query.value(QStringLiteral("publisher"));
    record.year = query.value(QStringLiteral("year"));
    record.genre = query.value(QStringLiteral("genre"));
    record.rating = query.value(QStringLiteral("rating"));
    record.boxArtPath = query.value(QStringLiteral("box_art_path"));
    record.backgroundPath = query.value(QStringLiteral("background_path"));
    record.screenshotPath = query.value(QStringLiteral("screenshot_path"));
    record.romPath = query.value(QStringLiteral("rom_path"));
    record.notes = query.value(QStringLiteral("notes"));
    record.favorite = query.value(QStringLiteral("favorite")).toInt();
    record.playStatus = query.value(QStringLiteral("play_status")).toString();
    record.launchCount = query.value(QStringLiteral("launch_count")).toInt();
    record.createdAt = query.value(QStringLiteral("created_at")).toString();
    record.updatedAt = query.value(QStringLiteral("updated_at")).toString();
    return record;
}

/** Move jogos, inventário, aliases, extensões e emuladores da plataforma antiga. */
bool mergePlatformRecords(QSqlDatabase& database, qint64 oldId, qint64 canonicalId, QString* error) {
    struct Step { const char* sql; int bindings; };
    static const Step steps[] = {
        {"UPDATE games SET platform_id = ? WHERE platform_id = ?", 2},
        {"UPDATE hardware_items SET platform_id = ? WHERE platform_id = ?", 2},
        {"INSERT OR IGNORE INTO platform_launchbox_aliases (platform_id, alias) SELECT ?, alias FROM platform_launchbox_aliases WHERE platform_id = ?", 2},
        {"INSERT OR IGNORE INTO platform_rom_extensions (platform_id, extension, kind, is_primary) SELECT ?, extension, kind, is_primary FROM platform_rom_extensions WHERE platform_id = ?", 2},
    };
    for (const auto& step : steps) {
        QSqlQuery query(database);
        if (!query.prepare(QString::fromLatin1(step.sql))) { if (error) *error = query.lastError().text(); return false; }
        query.bindValue(0, canonicalId);
        query.bindValue(1, oldId);
        if (!query.exec()) { if (error) *error = query.lastError().text(); return false; }
    }
    QSqlQuery emulators(database);
    if (!emulators.prepare(QStringLiteral(R"SQL(
        INSERT INTO platform_emulators (platform_id, emulator_id, is_default, core_path)
        SELECT ?, emulator_id,
          CASE WHEN is_default = 1 AND NOT EXISTS (
            SELECT 1 FROM platform_emulators target WHERE target.platform_id = ? AND target.is_default = 1
          ) THEN 1 ELSE 0 END,
          core_path
        FROM platform_emulators WHERE platform_id = ?
        ON CONFLICT(platform_id, emulator_id) DO UPDATE SET
          core_path = COALESCE(platform_emulators.core_path, excluded.core_path),
          is_default = CASE
            WHEN platform_emulators.is_default = 1 THEN 1
            WHEN excluded.is_default = 1 THEN 1
            ELSE platform_emulators.is_default
          END
    )SQL"))) { if (error) *error = emulators.lastError().text(); return false; }
    emulators.bindValue(0, canonicalId);
    emulators.bindValue(1, canonicalId);
    emulators.bindValue(2, oldId);
    if (!emulators.exec()) { if (error) *error = emulators.lastError().text(); return false; }
    return true;
}

/** Consolida nomes antigos de plataforma nos nomes canônicos. */
bool migratePlatformAliases(QSqlDatabase& database, QString* error) {
    for (const auto& pair : catalog::legacyAliases()) {
        QSqlQuery old(database);
        old.prepare(QStringLiteral("SELECT id FROM platforms WHERE name = ?"));
        old.bindValue(0, pair.first);
        if (!old.exec()) { if (error) *error = old.lastError().text(); return false; }
        if (!old.next()) continue;
        const qint64 oldId = old.value(0).toLongLong();
        QSqlQuery canonical(database);
        canonical.prepare(QStringLiteral("SELECT id FROM platforms WHERE name = ?"));
        canonical.bindValue(0, pair.second);
        if (!canonical.exec()) { if (error) *error = canonical.lastError().text(); return false; }
        if (canonical.next()) {
            const qint64 canonicalId = canonical.value(0).toLongLong();
            if (!mergePlatformRecords(database, oldId, canonicalId, error)) return false;
            QSqlQuery remove(database);
            remove.prepare(QStringLiteral("DELETE FROM platforms WHERE id = ?"));
            remove.bindValue(0, oldId);
            if (!remove.exec()) { if (error) *error = remove.lastError().text(); return false; }
        } else {
            QSqlQuery rename(database);
            rename.prepare(QStringLiteral("UPDATE platforms SET name = ?, is_default = 1 WHERE id = ?"));
            rename.bindValue(0, pair.second);
            rename.bindValue(1, oldId);
            if (!rename.exec()) { if (error) *error = rename.lastError().text(); return false; }
        }
    }
    return true;
}

/** Remove duplicatas reais de launchbox_id sem perder variantes com ROMs distintas. */
bool dedupeGamesByLaunchBoxId(QSqlDatabase& database, QString* error) {
    QSqlQuery groups(database);
    if (!groups.exec(QStringLiteral(
            "SELECT platform_id, launchbox_id FROM games "
            "WHERE launchbox_id IS NOT NULL AND TRIM(launchbox_id) != '' "
            "GROUP BY platform_id, launchbox_id HAVING COUNT(*) > 1"))) {
        if (error) *error = groups.lastError().text();
        return false;
    }
    QList<QPair<qint64, QString>> pending;
    while (groups.next()) pending.append({groups.value(0).toLongLong(), groups.value(1).toString()});
    if (pending.isEmpty()) return true;

    QSqlQuery select(database);
    if (!select.prepare(QStringLiteral(
            "SELECT * FROM games WHERE platform_id = ? AND launchbox_id = ? "
            "ORDER BY updated_at DESC, created_at DESC, id DESC"))) {
        if (error) *error = select.lastError().text();
        return false;
    }
    QSqlQuery update(database);
    if (!update.prepare(QStringLiteral(
            "UPDATE games SET title = ?, publisher = ?, year = ?, genre = ?, rating = ?, box_art_path = ?, "
            "background_path = ?, screenshot_path = ?, rom_path = ?, favorite = ?, play_status = ?, notes = ?, "
            "launch_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"))) {
        if (error) *error = update.lastError().text();
        return false;
    }
    QSqlQuery unlink(database);
    if (!unlink.prepare(QStringLiteral("UPDATE games SET launchbox_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"))) {
        if (error) *error = unlink.lastError().text();
        return false;
    }
    QSqlQuery remove(database);
    if (!remove.prepare(QStringLiteral("DELETE FROM games WHERE id = ?"))) {
        if (error) *error = remove.lastError().text();
        return false;
    }

    for (const auto& group : pending) {
        select.bindValue(0, group.first);
        select.bindValue(1, group.second);
        if (!select.exec()) { if (error) *error = select.lastError().text(); return false; }
        QList<GameRecord> rows;
        while (select.next()) rows.append(readGameRecord(select));
        if (rows.size() < 2) continue;
        const GameRecord survivor = rows.first();
        QList<GameRecord> mergeCandidates{survivor};
        QList<GameRecord> variants;
        for (qsizetype index = 1; index < rows.size(); ++index) {
            if (areDistinctVariantRecords(survivor, rows.at(index))) variants.append(rows.at(index));
            else mergeCandidates.append(rows.at(index));
        }
        GameRecord merged = survivor;
        for (qsizetype index = 1; index < mergeCandidates.size(); ++index) merged = mergeGameRecord(merged, mergeCandidates.at(index));
        update.bindValue(0, merged.title);
        update.bindValue(1, merged.publisher);
        update.bindValue(2, merged.year);
        update.bindValue(3, merged.genre);
        update.bindValue(4, merged.rating);
        update.bindValue(5, merged.boxArtPath);
        update.bindValue(6, merged.backgroundPath);
        update.bindValue(7, merged.screenshotPath);
        update.bindValue(8, merged.romPath);
        update.bindValue(9, merged.favorite);
        update.bindValue(10, merged.playStatus);
        update.bindValue(11, merged.notes);
        update.bindValue(12, merged.launchCount);
        update.bindValue(13, survivor.id);
        if (!update.exec()) { if (error) *error = update.lastError().text(); return false; }
        for (qsizetype index = 1; index < mergeCandidates.size(); ++index) {
            remove.bindValue(0, mergeCandidates.at(index).id);
            if (!remove.exec()) { if (error) *error = remove.lastError().text(); return false; }
        }
        for (const auto& variant : variants) {
            unlink.bindValue(0, variant.id);
            if (!unlink.exec()) { if (error) *error = unlink.lastError().text(); return false; }
        }
    }
    return true;
}

/** Renomeia o estado legado "Necessita Reparo" para "Com Defeito". */
bool migrateLegacyHardwareConservationStates(QSqlDatabase& database, QString* error) {
    // A consulta é isolada para distinguir "não encontrado" de erro real do SQLite.
    const auto findState = [&](const QString& name, QVariant* found) {
        QSqlQuery query(database);
        query.prepare(QStringLiteral("SELECT id FROM conservation_states WHERE LOWER(name) = LOWER(?) LIMIT 1"));
        query.bindValue(0, name);
        if (!query.exec()) { if (error) *error = query.lastError().text(); return false; }
        *found = query.next() ? query.value(0) : QVariant();
        return true;
    };
    QVariant legacy;
    if (!findState(QStringLiteral("Necessita Reparo"), &legacy)) return false;
    if (!legacy.isValid()) return true;
    QVariant current;
    if (!findState(QStringLiteral("Com Defeito"), &current)) return false;
    if (current.isValid()) {
        QSqlQuery reassign(database);
        reassign.prepare(QStringLiteral("UPDATE hardware_items SET conservation_state_id = ? WHERE conservation_state_id = ?"));
        reassign.bindValue(0, current);
        reassign.bindValue(1, legacy);
        if (!reassign.exec()) { if (error) *error = reassign.lastError().text(); return false; }
        QSqlQuery remove(database);
        remove.prepare(QStringLiteral("DELETE FROM conservation_states WHERE id = ?"));
        remove.bindValue(0, legacy);
        if (!remove.exec()) { if (error) *error = remove.lastError().text(); return false; }
    } else {
        QSqlQuery rename(database);
        rename.prepare(QStringLiteral("UPDATE conservation_states SET name = 'Com Defeito', is_default = 1 WHERE id = ?"));
        rename.bindValue(0, legacy);
        if (!rename.exec()) { if (error) *error = rename.lastError().text(); return false; }
    }
    return true;
}

/** Corrige somente o argumento padrão criado pela versão inicial do TeknoParrot. */
bool migrateTeknoParrotProfileArgument(QSqlDatabase& database, QString* error) {
    QSqlQuery query(database);
    if (!query.exec(QStringLiteral(
            "UPDATE emulators SET args = '--profile={romFileName} --startMinimized' "
            "WHERE name = 'TeknoParrot' COLLATE NOCASE AND args = '--profile={romPath} --startMinimized'"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    return true;
}

/** Escapa texto para a expressão regular do subtítulo. */
QString escapeRegExpForVariantRepair(const QString& value) {
    QString result;
    result.reserve(value.size() * 2);
    for (const QChar character : value) {
        if (QStringLiteral(".*+?^${}()|[]\\").contains(character)) result += QLatin1Char('\\');
        result += character;
    }
    return result;
}

/** Remove extensão e tags técnicas do nome visível da ROM. */
QString normalizeRomTitleForDisplay(const QString& filename) {
    QString result = filename;
    result.remove(QRegularExpression(QStringLiteral("\\.[^.]+$"), QRegularExpression::CaseInsensitiveOption));
    result.replace(QRegularExpression(QStringLiteral("[_+.]+")), QStringLiteral(" "));
    result.remove(QRegularExpression(QStringLiteral("\\[[^\\]]*\\]")));
    result.remove(QRegularExpression(QStringLiteral(
        "\\([^)]*(?:USA|Europe|Japan|World|En|Fr|De|Es|It|Rev|Beta|Proto|Demo|Hack|Unl|v\\d|[0-9]{4})[^)]*\\)"),
        QRegularExpression::CaseInsensitiveOption));
    result.remove(QRegularExpression(QStringLiteral("\\([^)]*\\)")));
    result.remove(QRegularExpression(QStringLiteral("\\b(?:rev|version|v)\\s*\\d+\\b"), QRegularExpression::CaseInsensitiveOption));
    result.replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral(" "));
    return result.trimmed();
}

/** Remove marcadores técnicos e regionais sem apagar subtítulos reais. */
QString stripVariantTags(const QString& value) {
    QString result = value;
    result.remove(QRegularExpression(QStringLiteral("\\.[a-z0-9]{1,5}$"), QRegularExpression::CaseInsensitiveOption));
    result.replace(QRegularExpression(QStringLiteral("[_]+")), QStringLiteral(" "));
    result.remove(QRegularExpression(QStringLiteral("\\([^)]*\\)|\\[[^\\]]*\\]|\\{[^}]*\\}")));
    result.remove(QRegularExpression(QStringLiteral("\\b(?:rev(?:ision)?\\.?\\s*[a-z0-9.]+|v\\d[\\w.]*)\\b"),
        QRegularExpression::CaseInsensitiveOption));
    result.replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral(" "));
    return result.trimmed();
}

/** Normaliza título apenas para detectar se o salvo já cobre o conteúdo da ROM. */
QString normalizeTitleForVariantRepair(const QString& value) {
    QString result = value.trimmed();
    result.replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral(" "));
    return result.toLower();
}

/** Extrai subtítulo útil quando a ROM traz mais informação que o título atual. */
QString extractVariantDescriptorFromTitle(const QString& romTitle, const QString& currentTitle) {
    const QString romStem = stripVariantTags(romTitle);
    const QString currentStem = stripVariantTags(currentTitle);
    if (romStem.isEmpty() || currentStem.isEmpty()) return {};
    if (normalizeTitleForVariantRepair(romStem) == normalizeTitleForVariantRepair(currentStem)) return {};
    const QRegularExpression prefix(
        QStringLiteral("^%1(?:\\s*[-:]+\\s*|\\s+)").arg(escapeRegExpForVariantRepair(currentStem)),
        QRegularExpression::CaseInsensitiveOption);
    QString descriptor = romStem;
    descriptor.remove(prefix);
    descriptor = descriptor.trimmed();
    if (descriptor.isEmpty()) return {};
    return normalizeTitleForVariantRepair(descriptor) != normalizeTitleForVariantRepair(romStem) ? descriptor : QString();
}

/** Deriva um título mais específico a partir do nome da ROM. */
QString deriveVariantTitleFromRom(const QString& romPath, const QString& currentTitle) {
    const QString romTitle = normalizeRomTitleForDisplay(QFileInfo(romPath).fileName());
    if (romTitle.isEmpty()) return {};
    const QString normalizedCurrent = normalizeTitleForVariantRepair(stripVariantTags(currentTitle));
    const QString normalizedRom = normalizeTitleForVariantRepair(stripVariantTags(romTitle));
    if (normalizedCurrent.isEmpty() || normalizedCurrent == normalizedRom) return {};
    return extractVariantDescriptorFromTitle(romTitle, currentTitle).isEmpty() ? QString() : romTitle;
}

/** Corrige títulos genéricos de variantes locais sem launchbox_id. */
bool backfillRomVariantTitles(QSqlDatabase& database, QString* error) {
    QSqlQuery rows(database);
    if (!rows.exec(QStringLiteral(
            "SELECT id, title, rom_path FROM games "
            "WHERE launchbox_id IS NULL AND rom_path IS NOT NULL AND TRIM(rom_path) != ''"))) {
        if (error) *error = rows.lastError().text();
        return false;
    }
    QList<QPair<qint64, QString>> updates;
    while (rows.next()) {
        const QString title = rows.value(1).toString();
        const QString repaired = deriveVariantTitleFromRom(rows.value(2).toString(), title);
        if (!repaired.isEmpty() && repaired != title) updates.append({rows.value(0).toLongLong(), repaired});
    }
    QSqlQuery update(database);
    if (!update.prepare(QStringLiteral("UPDATE games SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"))) {
        if (error) *error = update.lastError().text();
        return false;
    }
    for (const auto& item : updates) {
        update.bindValue(0, item.second);
        update.bindValue(1, item.first);
        if (!update.exec()) { if (error) *error = update.lastError().text(); return false; }
    }
    return true;
}

/** Normaliza texto para segmento de caminho de mídia, como no renderer. */
QString sanitizeMediaPath(const QString& value) {
    QString result = value.toLower();
    result.remove(QRegularExpression(QStringLiteral("[^a-z0-9\\s]")));
    result = result.trimmed();
    result.replace(QRegularExpression(QStringLiteral("\\s+")), QStringLiteral("-"));
    return result.left(120);
}

/** Preenche box_art_path de jogos cuja capa já existe no diretório de imagens. */
bool backfillCachedCoverPaths(QSqlDatabase& database, const QString& imagesDir, QString* error) {
    QSqlQuery rows(database);
    if (!rows.exec(QStringLiteral(
            "SELECT games.id, games.title, platforms.name AS platform_name FROM games "
            "JOIN platforms ON platforms.id = games.platform_id "
            "WHERE games.box_art_path IS NULL OR games.box_art_path = ''"))) {
        if (error) *error = rows.lastError().text();
        return false;
    }
    QList<QPair<qint64, QString>> updates;
    while (rows.next()) {
        const QString cover = QDir(imagesDir).filePath(QStringLiteral("%1/%2/cover.jpg")
            .arg(sanitizeMediaPath(rows.value(2).toString()), sanitizeMediaPath(rows.value(1).toString())));
        if (QFileInfo::exists(cover)) updates.append({rows.value(0).toLongLong(), cover});
    }
    QSqlQuery update(database);
    if (!update.prepare(QStringLiteral("UPDATE games SET box_art_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"))) {
        if (error) *error = update.lastError().text();
        return false;
    }
    for (const auto& item : updates) {
        update.bindValue(0, item.second);
        update.bindValue(1, item.first);
        if (!update.exec()) { if (error) *error = update.lastError().text(); return false; }
    }
    return true;
}

/** Calcula a chave visual persistida para jogos com ROM. */
bool backfillLibraryGroupKeys(QSqlDatabase& database, QString* error) {
    QSqlQuery rows(database);
    if (!rows.exec(QStringLiteral("SELECT id, title, rom_path FROM games WHERE rom_path IS NOT NULL AND TRIM(rom_path) != ''"))) {
        if (error) *error = rows.lastError().text();
        return false;
    }
    QList<QPair<qint64, QString>> updates;
    while (rows.next()) {
        const QString key = buildStoredLibraryGroupKey(rows.value(1).toString(), rows.value(2).toString());
        if (!key.isEmpty()) updates.append({rows.value(0).toLongLong(), key});
    }
    QSqlQuery update(database);
    if (!update.prepare(QStringLiteral("UPDATE games SET library_group_key = ? WHERE id = ?"))) {
        if (error) *error = update.lastError().text();
        return false;
    }
    for (const auto& item : updates) {
        update.bindValue(0, item.second);
        update.bindValue(1, item.first);
        if (!update.exec()) { if (error) *error = update.lastError().text(); return false; }
    }
    return true;
}
} // namespace

bool initializeDatabase(QSqlDatabase& database, const QString& imagesDir, QString* error) {    if (!applySchema(database, error)) return false;
    if (!runOnce(database, QStringLiteral("platform-aliases-v1"), [&](QString* inner) { return migratePlatformAliases(database, inner); }, error)) return false;
    if (!runOnce(database, QStringLiteral("dedupe-launchbox-games-v1"), [&](QString* inner) { return dedupeGamesByLaunchBoxId(database, inner); }, error)) return false;
    if (!ensureGamesLaunchBoxUniqueIndex(database, error)) return false;
    if (!runOnce(database, QStringLiteral("hardware-conservation-states-v1"), [&](QString* inner) { return migrateLegacyHardwareConservationStates(database, inner); }, error)) return false;
    // Os seeds seguem a ordem do Electron para preservar IDs de plataformas e emuladores.
    if (!seedPlatforms(database, error)) return false;
    if (!seedPlatformMappings(database, error)) return false;
    if (!seedEmulators(database, error)) return false;
    if (!runOnce(database, QStringLiteral("teknoparrot-profile-filename-v1"), [&](QString* inner) { return migrateTeknoParrotProfileArgument(database, inner); }, error)) return false;
    if (!seedArcadeEmulatorAssociations(database, error)) return false;
    if (!seedHardwareInventoryDefaults(database, error)) return false;
    if (!runOnce(database, QStringLiteral("rom-variant-titles-v1"), [&](QString* inner) { return backfillRomVariantTitles(database, inner); }, error)) return false;
    if (!runOnce(database, QStringLiteral("cached-cover-paths-v1"), [&](QString* inner) { return backfillCachedCoverPaths(database, imagesDir, inner); }, error)) return false;
    if (!runOnce(database, QStringLiteral("library-group-key-v1"), [&](QString* inner) { return backfillLibraryGroupKeys(database, inner); }, error)) return false;
    return true;
}

QStringList knownMigrationNames() {
    // A mesma lista executada por initializeDatabase; o teste de banco limpo confere a igualdade.
    return {QStringLiteral("platform-aliases-v1"), QStringLiteral("dedupe-launchbox-games-v1"),
        QStringLiteral("hardware-conservation-states-v1"), QStringLiteral("teknoparrot-profile-filename-v1"),
        QStringLiteral("rom-variant-titles-v1"), QStringLiteral("cached-cover-paths-v1"),
        QStringLiteral("library-group-key-v1")};
}
} // namespace gamestock
