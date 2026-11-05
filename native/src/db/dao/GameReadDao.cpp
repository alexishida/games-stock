/** Mantém a mesma chave visual do DAO Electron em consultas SQLite paginadas. */
#include "GameReadDao.h"
#include "../LibraryGrouping.h"
#include <QSqlError>
#include <QSqlQuery>
#include <QSqlRecord>
#include <QFileInfo>
#include <QRegularExpression>
#include <QUuid>
#include <QCollator>
#include <QSet>
#include <algorithm>
#include <utility>

namespace gamestock {
namespace {
/** Registros manuais e legados sem chave permanecem separados por ID. */
const QString groupExpression = QStringLiteral(
    "CASE WHEN games.rom_path IS NULL OR TRIM(games.rom_path) = '' THEN 'manual:' || games.id "
    "WHEN games.library_group_key IS NULL OR TRIM(games.library_group_key) = '' THEN 'legacy:' || games.id "
    "ELSE 'rom:' || games.platform_id || ':' || games.library_group_key END");

/** Caracteres ignorados ao determinar o contexto de letras do sigma grego. */
bool isCaseIgnorable(char32_t codepoint) {
    const auto category = QChar::category(codepoint);
    return category == QChar::Mark_NonSpacing || category == QChar::Mark_Enclosing
        || category == QChar::Other_Format || category == QChar::Letter_Modifier
        || category == QChar::Symbol_Modifier || codepoint == U'\'' || codepoint == 0x2019;
}

/** Converte gêneros como o JavaScript pt-BR, incluindo expansões e sigma final. */
QString normalizeGenre(const QString& value) {    const auto points = value.trimmed().toUcs4();
    QString result;
    for (qsizetype index = 0; index < points.size(); ++index) {
        const char32_t point = points[index];
        if (point == 0x0130) { result += QStringLiteral("i\u0307"); continue; }
        if (point == 0x03A3) {
            bool before = false, after = false;
            for (qsizetype i = index; i > 0;) {
                const char32_t previous = points[--i];
                if (isCaseIgnorable(previous)) continue;
                before = QChar::isUpper(previous) || QChar::isLower(previous) || QChar::category(previous) == QChar::Letter_Titlecase;
                break;
            }
            for (qsizetype i = index + 1; i < points.size(); ++i) {
                const char32_t next = points[i];
                if (isCaseIgnorable(next)) continue;
                after = QChar::isUpper(next) || QChar::isLower(next) || QChar::category(next) == QChar::Letter_Titlecase;
                break;
            }
            result += QChar(before && !after ? 0x03C2 : 0x03C3);
        } else {
            result += QString::fromUcs4(&point, 1).toLower();
        }
    }
    return result;
}

/** Remove a tabela temporária mesmo quando uma consulta retorna erro. */
class TemporaryGenres final {
public:
    explicit TemporaryGenres(QSqlDatabase& database) : database_(database), name_(QStringLiteral("genre_") + QUuid::createUuid().toString(QUuid::Id128)) {}
    ~TemporaryGenres() { if (created_) { QSqlQuery cleanup(database_); cleanup.exec(QStringLiteral("DROP TABLE IF EXISTS temp.") + name_); } }
    /** Cria conjunto local à conexão sem escrever no banco principal. */
    bool create(QString* error) {
        QSqlQuery query(database_);
        if (!query.exec(QStringLiteral("CREATE TEMP TABLE ") + name_ + QStringLiteral(" (value TEXT PRIMARY KEY)"))) {
            if (error) *error = query.lastError().text();
            return false;
        }
        created_ = true;
        return true;
    }
    /** Fornece identificador gerado internamente e livre de dados externos. */
    QString name() const { return name_; }
private:
    QSqlDatabase& database_;
    QString name_;
    bool created_ = false;
};

/** Extrai tags entre parênteses, colchetes ou chaves do nome da ROM. */
QStringList extractRomTags(const QString& romFileName) {
    static const QRegularExpression pattern(QStringLiteral("\\(([^)]*)\\)|\\[([^\\]]*)\\]|\\{([^}]*)\\}"));
    QStringList tags;
    auto iterator = pattern.globalMatch(romFileName);
    while (iterator.hasNext()) {
        const auto match = iterator.next();
        QString value = match.captured(1);
        if (value.isEmpty()) value = match.captured(2);
        if (value.isEmpty()) value = match.captured(3);
        value = value.trimmed();
        if (!value.isEmpty()) tags.append(value);
    }
    return tags;
}

/** Região inferida das tags, na mesma prioridade do Electron. */
QString detectRegionLabel(const QStringList& tags) {
    const auto matches = [&tags](const char* pattern) {
        const QRegularExpression expression(QString::fromLatin1(pattern), QRegularExpression::CaseInsensitiveOption);
        for (const QString& tag : tags) if (expression.match(tag).hasMatch()) return true;
        return false;
    };
    if (matches("\\b(japan|jpn|jap|ntsc-j)\\b")) return QStringLiteral("JAP");
    if (matches("\\b(usa|north america|ntsc-u)\\b")) return QStringLiteral("USA");
    if (matches("\\b(europe|eur|pal)\\b")) return QStringLiteral("EUR");
    if (matches("\\b(brazil|br)\\b")) return QStringLiteral("BRA");
    return {};
}

/** Categoria especial da variante, na ordem do Electron. */
QString detectTypeLabel(const QStringList& tags) {
    const auto contains = [&tags](const char* pattern) {
        const QRegularExpression expression(QString::fromLatin1(pattern), QRegularExpression::CaseInsensitiveOption);
        for (const QString& tag : tags) if (tag.contains(expression)) return true;
        return false;
    };
    if (contains("hack")) return QStringLiteral("Hack");
    if (contains("translat")) return QStringLiteral("Tradução");
    if (contains("prototype|proto")) return QStringLiteral("Prototype");
    if (contains("beta")) return QStringLiteral("Beta");
    if (contains("revision|rev\\b")) return QStringLiteral("Revision");
    if (contains("demo")) return QStringLiteral("Demo");
    return {};
}
}

GameReadDao::GameReadDao(QSqlDatabase& database) : database_(database) {}

bool GameReadDao::listGenres(QStringList* result, QString* error) const {
    if (!result) { if (error) *error = QStringLiteral("Destino de gêneros ausente."); return false; }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral("SELECT DISTINCT genre FROM games WHERE genre IS NOT NULL AND TRIM(genre) != ''"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QStringList genres;
    QSet<QString> seen;
    const QRegularExpression separators(QStringLiteral("[;,/|]+"));
    while (query.next()) {
        for (const QString& token : query.value(0).toString().split(separators, Qt::SkipEmptyParts)) {
            const QString value = token.trimmed();
            const QString key = normalizeGenre(value);
            if (key.isEmpty() || seen.contains(key)) continue;
            seen.insert(key);
            genres.append(value);
        }
    }
    // A ordenação usa o locale da interface; a comparação de seleção continua exata por token.
    // O collator é estático porque construir um QCollator por chamada custa caro em listas grandes.
    static const QCollator collator = [] {
        QCollator value(QLocale(QLocale::Portuguese, QLocale::Brazil));
        value.setCaseSensitivity(Qt::CaseInsensitive);
        return value;
    }();
    std::stable_sort(genres.begin(), genres.end(), [](const QString& a, const QString& b) { return collator.compare(a, b) < 0; });
    *result = genres;
    if (error) error->clear();
    return true;
}

bool GameReadDao::get(qint64 id, QVariantMap* result, QString* error) const {
    if (!result || id <= 0) {
        if (error) *error = QStringLiteral("Jogo inválido.");
        return false;
    }
    QSqlQuery query(database_);
    // A mesma seleção base inclui o nome da plataforma usado pela UI.
    if (!query.prepare(QStringLiteral("SELECT games.*, platforms.name AS platform_name FROM games "
            "JOIN platforms ON platforms.id = games.platform_id WHERE games.id = ?"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(id);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (!query.next()) {
        if (error) *error = QStringLiteral("Jogo não encontrado.");
        return false;
    }
    QVariantMap row;
    const QSqlRecord record = query.record();
    for (int index = 0; index < record.count(); ++index) row.insert(record.fieldName(index), query.value(index));
    // O contrato exposto à UI usa booleano, não o inteiro do SQLite.
    row.insert(QStringLiteral("favorite"), row.value(QStringLiteral("favorite")).toInt() != 0);
    *result = row;
    if (error) error->clear();
    return true;
}

bool GameReadDao::collectionCounts(CollectionCounts* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino de contadores ausente.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT "
            "COALESCE(SUM(CASE WHEN favorite = 1 THEN 1 ELSE 0 END), 0), "
            "COALESCE(SUM(CASE WHEN play_status = 'playing' THEN 1 ELSE 0 END), 0), "
            "COALESCE(SUM(CASE WHEN play_status = 'completed' THEN 1 ELSE 0 END), 0), "
            "COALESCE(SUM(CASE WHEN launch_count > 0 THEN 1 ELSE 0 END), 0) "
            "FROM games")) || !query.next()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    result->favorites = query.value(0).toLongLong();
    result->playing = query.value(1).toLongLong();
    result->completed = query.value(2).toLongLong();
    result->mostPlayed = query.value(3).toLongLong();
    if (error) error->clear();
    return true;
}

bool GameReadDao::sidebarCounts(const GameListFilters& filters, SidebarCounts* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino de contadores ausente.");
        return false;
    }
    TemporaryGenres genres(database_);
    QString genreCondition;
    if (!filters.genre.trimmed().isEmpty()) {
        if (!genres.create(error)) return false;
        QSqlQuery rows(database_);
        if (!rows.exec(QStringLiteral("SELECT DISTINCT genre FROM games WHERE genre IS NOT NULL AND TRIM(genre) != ''"))) {
            if (error) *error = rows.lastError().text();
            return false;
        }
        QSqlQuery insert(database_);
        if (!insert.prepare(QStringLiteral("INSERT OR IGNORE INTO temp.") + genres.name() + QStringLiteral(" (value) VALUES (?)"))) {
            if (error) *error = insert.lastError().text();
            return false;
        }
        const QString selected = normalizeGenre(filters.genre);
        const QRegularExpression separators(QStringLiteral("[;,/|]+"));
        while (rows.next()) {
            const QString value = rows.value(0).toString();
            bool matches = false;
            for (const QString& token : value.split(separators, Qt::SkipEmptyParts)) {
                if (normalizeGenre(token) == selected) { matches = true; break; }
            }
            if (!matches) continue;
            insert.bindValue(0, value);
            if (!insert.exec()) { if (error) *error = insert.lastError().text(); return false; }
        }
        genreCondition = QStringLiteral("games.genre IN (SELECT value FROM temp.%1)").arg(genres.name());
    }

    const auto conditions = [&](bool ignorePlatform, bool forceAllCollections, QList<QVariant>* parameters) {
        QStringList parts;
        if (!ignorePlatform && filters.platformId > 0) {
            parts << QStringLiteral("games.platform_id = ?");
            parameters->append(filters.platformId);
        }
        if (!filters.search.trimmed().isEmpty()) {
            // A coluna normalizada evita LOWER() por linha e mantém a comparação Unicode correta.
            parts << QStringLiteral("games.title_normalized LIKE ?");
            parameters->append(QStringLiteral("%") + filters.search.trimmed().toCaseFolded() + QStringLiteral("%"));
        }
        if (!genreCondition.isEmpty()) parts << genreCondition;
        const QString collection = forceAllCollections ? QStringLiteral("all") : filters.collection;
        if (collection == QLatin1String("favorites")) parts << QStringLiteral("games.favorite = 1");
        else if (collection == QLatin1String("playing")) parts << QStringLiteral("games.play_status = 'playing'");
        else if (collection == QLatin1String("completed")) parts << QStringLiteral("games.play_status = 'completed'");
        else if (collection == QLatin1String("unplayed")) parts << QStringLiteral("games.play_status = 'unplayed'");
        else if (collection == QLatin1String("mostPlayed")) parts << QStringLiteral("games.launch_count > 0");
        if (!filters.includeMissingCovers) parts << QStringLiteral("games.box_art_path IS NOT NULL AND TRIM(games.box_art_path) != ''");
        return parts.isEmpty() ? QString() : QStringLiteral(" WHERE ") + parts.join(QStringLiteral(" AND "));
    };

    QList<QVariant> collectionParameters;
    const QString collectionWhere = conditions(false, true, &collectionParameters);
    QSqlQuery collections(database_);
    // MAX por grupo conta a variante que atende à coleção sem duplicar o card.
    const QString collectionSql = QStringLiteral(
        "SELECT COUNT(*), COALESCE(SUM(favorites), 0), COALESCE(SUM(playing), 0), COALESCE(SUM(completed), 0), "
        "COALESCE(SUM(mostPlayed), 0) FROM (SELECT "
        "MAX(games.favorite = 1) AS favorites, MAX(games.play_status = 'playing') AS playing, "
        "MAX(games.play_status = 'completed') AS completed, MAX(games.launch_count > 0) AS mostPlayed "
        "FROM games") + collectionWhere + QStringLiteral(" GROUP BY ") + groupExpression + QLatin1Char(')');
    if (!collections.prepare(collectionSql)) {
        if (error) *error = collections.lastError().text();
        return false;
    }
    for (const QVariant& parameter : collectionParameters) collections.addBindValue(parameter);
    if (!collections.exec() || !collections.next()) {
        if (error) *error = collections.lastError().text();
        return false;
    }
    result->all = collections.value(0).toLongLong();
    result->collections.favorites = collections.value(1).toLongLong();
    result->collections.playing = collections.value(2).toLongLong();
    result->collections.completed = collections.value(3).toLongLong();
    result->collections.mostPlayed = collections.value(4).toLongLong();

    QList<QVariant> platformParameters;
    const QString platformWhere = conditions(true, false, &platformParameters);
    QSqlQuery platforms(database_);
    const QString platformSql = QStringLiteral(
        "SELECT platform_id, COUNT(*) FROM (SELECT games.platform_id, ") + groupExpression
        + QStringLiteral(" AS group_key FROM games") + platformWhere
        + QStringLiteral(" GROUP BY games.platform_id, group_key) GROUP BY platform_id");
    if (!platforms.prepare(platformSql)) {
        if (error) *error = platforms.lastError().text();
        return false;
    }
    for (const QVariant& parameter : platformParameters) platforms.addBindValue(parameter);
    if (!platforms.exec()) {
        if (error) *error = platforms.lastError().text();
        return false;
    }
    result->platforms.clear();
    while (platforms.next()) result->platforms.insert(platforms.value(0).toLongLong(), platforms.value(1).toLongLong());
    if (error) error->clear();
    return true;
}

bool GameReadDao::listVersions(qint64 id, QList<QVariantMap>* result, QString* error) const {
    if (!result || id <= 0) {
        if (error) *error = QStringLiteral("Jogo inválido.");
        return false;
    }
    result->clear();
    QSqlQuery current(database_);
    if (!current.prepare(QStringLiteral(
            "SELECT games.id, games.title, games.platform_id, games.rom_path, games.launch_count, "
            "games.box_art_path, games.background_path, games.screenshot_path, platforms.name "
            "FROM games JOIN platforms ON platforms.id = games.platform_id WHERE games.id = ?"))) {
        if (error) *error = current.lastError().text();
        return false;
    }
    current.addBindValue(id);
    if (!current.exec()) {
        if (error) *error = current.lastError().text();
        return false;
    }
    if (!current.next()) {
        // Ausência não é erro no contrato do seletor de versões.
        if (error) error->clear();
        return true;
    }
    const QString currentTitle = current.value(1).toString();
    const QString currentRom = current.value(3).toString();
    const QString currentKey = buildVersionGroupKey(currentTitle, currentRom);

    const auto option = [](qint64 gameId, const QString& title, const QString& platformName,
                           const QString& romPath, int launchCount, const QVariant& cover,
                           const QVariant& background, const QVariant& screenshot) {
        const QString romFileName = romPath.isEmpty() ? title : QFileInfo(romPath).fileName();
        const QStringList tags = extractRomTags(romFileName);
        const QString region = detectRegionLabel(tags);
        const QString descriptor = variantDescriptor(romFileName, title);
        const QString type = detectTypeLabel(tags);
        QStringList parts;
        for (const QString& value : {region, descriptor, type}) if (!value.isEmpty()) parts.append(value);
        QString baseTitle = stripVersionTags(title);
        if (baseTitle.isEmpty()) baseTitle = title;
        return QVariantMap{
            {"id", gameId}, {"title", title}, {"platformName", platformName},
            {"launchCount", launchCount}, {"romFileName", romFileName}, {"baseTitle", baseTitle},
            {"regionLabel", region}, {"typeLabel", type},
            {"variantLabel", parts.isEmpty() ? QStringLiteral("Versão padrão") : parts.join(QStringLiteral(" · "))},
            {"boxArtPath", cover}, {"backgroundPath", background}, {"screenshotPath", screenshot},
        };
    };

    QList<QVariantMap> options;
    QSqlQuery candidates(database_);
    if (!candidates.prepare(QStringLiteral(
            "SELECT games.id, games.title, games.rom_path, games.launch_count, games.box_art_path, "
            "games.background_path, games.screenshot_path, platforms.name, games.platform_id "
            "FROM games JOIN platforms ON platforms.id = games.platform_id "
            "WHERE games.platform_id = ? AND games.title_normalized = ? "
            "AND games.rom_path IS NOT NULL AND TRIM(games.rom_path) != ''"))) {
        if (error) *error = candidates.lastError().text();
        return false;
    }
    candidates.addBindValue(current.value(2));
    candidates.addBindValue(currentTitle.toCaseFolded());
    if (!candidates.exec()) {
        if (error) *error = candidates.lastError().text();
        return false;
    }
    bool currentIncluded = false;
    while (candidates.next()) {
        const QString title = candidates.value(1).toString();
        const QString romPath = candidates.value(2).toString();
        // Só variantes do mesmo grupo visual entram no seletor.
        if (buildVersionGroupKey(title, romPath) != currentKey) continue;
        if (candidates.value(0).toLongLong() == id) currentIncluded = true;
        options.append(option(candidates.value(0).toLongLong(), title, candidates.value(7).toString(),
            romPath, candidates.value(3).toInt(), candidates.value(4), candidates.value(5), candidates.value(6)));
    }
    if (!currentIncluded) {
        options.append(option(id, currentTitle, current.value(8).toString(), currentRom,
            current.value(4).toInt(), current.value(5), current.value(6), current.value(7)));
    }
    std::stable_sort(options.begin(), options.end(), [](const QVariantMap& left, const QVariantMap& right) {
        const int leftLaunches = left.value("launchCount").toInt();
        const int rightLaunches = right.value("launchCount").toInt();
        if (leftLaunches != rightLaunches) return leftLaunches > rightLaunches;
        return QString::compare(left.value("romFileName").toString(), right.value("romFileName").toString(),
            Qt::CaseInsensitive) < 0;
    });
    *result = options;
    if (error) error->clear();
    return true;
}

bool GameReadDao::launchStats(LaunchStats* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino de estatísticas ausente.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT COALESCE(SUM(launch_count), 0), "
            "COALESCE(SUM(CASE WHEN launch_count > 0 THEN 1 ELSE 0 END), 0) FROM games")) || !query.next()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    result->totalLaunches = query.value(0).toLongLong();
    result->playedGames = query.value(1).toLongLong();
    if (error) error->clear();
    return true;
}

bool GameReadDao::coverStats(CoverStats* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino de estatísticas ausente.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT COUNT(*), "
            "COALESCE(SUM(CASE WHEN box_art_path IS NOT NULL AND box_art_path != '' THEN 1 ELSE 0 END), 0), "
            "COALESCE(SUM(CASE WHEN (box_art_path IS NULL OR box_art_path = '') "
            "  AND launchbox_id IS NOT NULL AND launchbox_id != '' THEN 1 ELSE 0 END), 0), "
            "COALESCE(SUM(CASE WHEN launchbox_id IS NOT NULL AND launchbox_id != '' THEN 1 ELSE 0 END), 0) "
            "FROM games")) || !query.next()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    result->total = query.value(0).toLongLong();
    result->downloaded = query.value(1).toLongLong();
    result->missing = qMax<qint64>(0, result->total - result->downloaded);
    result->syncable = query.value(2).toLongLong();
    result->metadataSyncable = query.value(3).toLongLong();
    if (error) error->clear();
    return true;
}

bool GameReadDao::listLinkedGames(QList<LinkedGame>* result, QString* error) const {
    if (!result) {
        if (error) *error = QStringLiteral("Destino dos jogos vinculados ausente.");
        return false;
    }
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral(
            "SELECT games.id, games.title, platforms.name, games.launchbox_id, "
            "games.box_art_path, games.screenshot_path, games.background_path "
            "FROM games JOIN platforms ON platforms.id = games.platform_id "
            "WHERE games.launchbox_id IS NOT NULL AND TRIM(games.launchbox_id) != '' "
            "ORDER BY games.id"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    QList<LinkedGame> games;
    while (query.next()) {
        LinkedGame game;
        game.id = query.value(0).toLongLong();
        game.title = query.value(1).toString();
        game.platformName = query.value(2).toString();
        game.launchboxId = query.value(3).toString();
        game.boxArtPath = query.value(4).toString();
        game.screenshotPath = query.value(5).toString();
        game.backgroundPath = query.value(6).toString();
        games.append(game);
    }
    *result = games;
    if (error) error->clear();
    return true;
}

bool GameReadDao::list(int page, int pageSize, GamePage* result, QString* error, const GameListFilters& filters) const {
    if (!result || page < 1 || pageSize < 1 || pageSize > 1000) {
        if (error) *error = QStringLiteral("Página ou tamanho inválido.");
        return false;
    }
    const qint64 offset = (static_cast<qint64>(page) - 1) * pageSize;
    GamePage output;
    QStringList conditions;
    QList<QVariant> parameters;
    TemporaryGenres matchingGenres(database_);
    if (filters.platformId > 0) { conditions << QStringLiteral("games.platform_id = ?"); parameters << filters.platformId; }
    if (!filters.search.trimmed().isEmpty()) {
        conditions << QStringLiteral("games.title_normalized LIKE ?");
        parameters << (QStringLiteral("%") + filters.search.trimmed().toCaseFolded() + QStringLiteral("%"));
    }
    if (!filters.genre.trimmed().isEmpty()) {
        // Lê somente gêneros distintos; evita carregar a biblioteca inteira e preserva comparação por token.
        if (!matchingGenres.create(error)) return false;
        QSqlQuery genres(database_);
        if (!genres.exec(QStringLiteral("SELECT DISTINCT genre FROM games WHERE genre IS NOT NULL AND TRIM(genre) != ''"))) {
            if (error) *error = genres.lastError().text(); return false;
        }
        QSqlQuery insert(database_);
        if (!insert.prepare(QStringLiteral("INSERT OR IGNORE INTO temp.") + matchingGenres.name() + QStringLiteral(" (value) VALUES (?)"))) {
            if (error) *error = insert.lastError().text(); return false;
        }
        const QString selected = normalizeGenre(filters.genre);
        const QRegularExpression separators(QStringLiteral("[;,/|]+"));
        while (genres.next()) {
            const QString value = genres.value(0).toString();
            const QStringList tokens = value.split(separators, Qt::SkipEmptyParts);
            bool matches = false;
            for (const QString& token : tokens) if (normalizeGenre(token) == selected) { matches = true; break; }
            if (matches) {
                insert.bindValue(0, value);
                if (!insert.exec()) { if (error) *error = insert.lastError().text(); return false; }
            }
        }
        conditions << QStringLiteral("games.genre IN (SELECT value FROM temp.") + matchingGenres.name() + QLatin1Char(')');
    }
    // Fragmentos SQL são escolhidos em lista fechada, nunca concatenados a partir do usuário.
    if (filters.collection == QLatin1String("favorites")) conditions << QStringLiteral("games.favorite = 1");
    else if (filters.collection == QLatin1String("playing")) conditions << QStringLiteral("games.play_status = 'playing'");
    else if (filters.collection == QLatin1String("completed")) conditions << QStringLiteral("games.play_status = 'completed'");
    else if (filters.collection == QLatin1String("unplayed")) conditions << QStringLiteral("games.play_status = 'unplayed'");
    else if (filters.collection == QLatin1String("mostPlayed")) conditions << QStringLiteral("games.launch_count > 0");
    else if (!filters.collection.isEmpty() && filters.collection != QLatin1String("all")) { if (error) *error = QStringLiteral("Filtro de coleção inválido."); return false; }
    if (!filters.includeMissingCovers) conditions << QStringLiteral("games.box_art_path IS NOT NULL AND TRIM(games.box_art_path) != ''");
    const QString where = conditions.isEmpty() ? QString() : QStringLiteral(" WHERE ") + conditions.join(QStringLiteral(" AND "));
    QString order;
    const QString sort = filters.collection == QLatin1String("mostPlayed") ? QStringLiteral("mostPlayed") : filters.sortBy;
    if (sort.isEmpty() || sort == QLatin1String("title")) order = QStringLiteral("%1.title COLLATE NOCASE, %1.id");
    else if (sort == QLatin1String("year")) order = QStringLiteral("%1.year IS NULL, %1.year DESC, %1.title COLLATE NOCASE, %1.id");
    else if (sort == QLatin1String("recent")) order = QStringLiteral("%1.created_at DESC, %1.id DESC");
    else if (sort == QLatin1String("mostPlayed")) order = QStringLiteral("%1.launch_count DESC, %1.title COLLATE NOCASE, %1.id");
    else { if (error) *error = QStringLiteral("Ordenação inválida."); return false; }
    QSqlQuery count(database_);
    if (!count.exec(QStringLiteral("SELECT COUNT(DISTINCT ") + groupExpression + QStringLiteral(") FROM games")) || !count.next()) {
        if (error) *error = count.lastError().text();
        return false;
    }
    output.total = count.value(0).toLongLong();
    output.filtered = output.total;
    if (!conditions.isEmpty()) {
        QSqlQuery filtered(database_);
        if (!filtered.prepare(QStringLiteral("SELECT COUNT(DISTINCT ") + groupExpression + QStringLiteral(") FROM games") + where)) {
            if (error) *error = filtered.lastError().text(); return false;
        }
        for (const auto& parameter : parameters) filtered.addBindValue(parameter);
        if (!filtered.exec() || !filtered.next()) { if (error) *error = filtered.lastError().text(); return false; }
        output.filtered = filtered.value(0).toLongLong();
    }
    QSqlQuery query(database_);
    const QString sql = QStringLiteral(
        "WITH ranked_games AS (SELECT games.id, games.title, games.year, games.created_at, games.launch_count, "
        "ROW_NUMBER() OVER (PARTITION BY ") + groupExpression + QStringLiteral(
        " ORDER BY ") + order.arg(QStringLiteral("games")) + QStringLiteral(
        ") AS library_rank FROM games JOIN platforms ON platforms.id = games.platform_id") + where + QStringLiteral(
        "), page_games AS (SELECT * FROM ranked_games WHERE library_rank = 1 ORDER BY ") + order.arg(QStringLiteral("ranked_games")) + QStringLiteral(
        " LIMIT ? OFFSET ?) "
        "SELECT games.*, platforms.name AS platform_name FROM page_games "
        "JOIN games ON games.id = page_games.id JOIN platforms ON platforms.id = games.platform_id "
        "ORDER BY ") + order.arg(QStringLiteral("games"));
    if (!query.prepare(sql)) { if (error) *error = query.lastError().text(); return false; }
    for (const auto& parameter : parameters) query.addBindValue(parameter);
    query.addBindValue(pageSize);
    query.addBindValue(offset);
    if (!query.exec()) { if (error) *error = query.lastError().text(); return false; }
    while (query.next()) {
        QVariantMap row;
        const QSqlRecord record = query.record();
        for (int index = 0; index < record.count(); ++index) row.insert(record.fieldName(index), query.value(index));
        output.items.append(row);
    }
    *result = std::move(output);
    if (error) error->clear();
    return true;
}
}
