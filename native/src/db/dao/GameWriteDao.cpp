/** Porta de create/update/delete/incrementLaunchCount de src/main/db/dao/gameDao.ts. */
#include "GameWriteDao.h"

#include "../LibraryGrouping.h"

#include <QSqlError>
#include <QSqlQuery>
#include <QStringList>
#include <limits>

namespace gamestock {
namespace {
/** Colunas graváveis na mesma ordem do DAO do Electron. */
const QStringList& writeColumns() {
    static const QStringList columns = {
        QStringLiteral("title"), QStringLiteral("platform_id"), QStringLiteral("publisher"),
        QStringLiteral("year"), QStringLiteral("genre"), QStringLiteral("rating"),
        QStringLiteral("box_art_path"), QStringLiteral("background_path"), QStringLiteral("screenshot_path"),
        QStringLiteral("rom_path"), QStringLiteral("favorite"), QStringLiteral("play_status"),
        QStringLiteral("notes"), QStringLiteral("launchbox_id"), QStringLiteral("launch_count"),
    };
    return columns;
}

/** Normaliza o valor recebido para o tipo persistido em cada coluna. */
QVariant columnValue(const QString& column, const QVariant& value) {
    if (column == QLatin1String("title")) return value.toString().trimmed();
    // Vínculo ausente é NULL, nunca texto vazio: o índice único parcial ignora os dois,
    // mas a leitura e a sincronização dependem de um único estado canônico.
    if (column == QLatin1String("launchbox_id")) {
        const QString launchBoxId = value.toString().trimmed();
        return launchBoxId.isEmpty() ? QVariant(QMetaType(QMetaType::QString)) : QVariant(launchBoxId);
    }
    if (column == QLatin1String("favorite")) return value.toBool() ? 1 : 0;
    if (column == QLatin1String("launch_count")) return QVariant(qMax(0, value.toInt()));
    if (column == QLatin1String("play_status")) {
        const QString status = value.toString();
        return status.isEmpty() ? QVariant(QStringLiteral("unplayed")) : QVariant(status);
    }
    return value;
}

/** Retorna erro de banco com o comando que falhou, sem expor valores do usuário. */
bool fail(QSqlQuery& query, const QString& context, QString* error) {
    if (error) *error = context + QStringLiteral(": ") + query.lastError().text();
    return false;
}

/** Traduz o conflito do índice de vínculo em uma mensagem acionável para a interface. */
QString linkConstraintMessage(const QString& detail) {
    if (detail.contains(QStringLiteral("games.platform_id, games.launchbox_id")))
        return QStringLiteral("Este LaunchBox ID já está vinculado a outro jogo desta plataforma.");
    return {};
}
} // namespace

GameWriteDao::GameWriteDao(QSqlDatabase& database) : database_(database) {}

bool GameWriteDao::create(const QVariantMap& input, qint64* newId, QString* error) const {
    const QString title = input.value(QStringLiteral("title")).toString().trimmed();
    if (title.isEmpty()) {
        if (error) *error = QStringLiteral("Título é obrigatório.");
        return false;
    }
    const int platformId = input.value(QStringLiteral("platform_id")).toInt();
    if (platformId <= 0) {
        if (error) *error = QStringLiteral("Plataforma é obrigatória.");
        return false;
    }
    QVariantMap values;
    values.insert(QStringLiteral("title"), title);
    values.insert(QStringLiteral("platform_id"), platformId);
    values.insert(QStringLiteral("publisher"), QVariant(QMetaType(QMetaType::QString)));
    values.insert(QStringLiteral("year"), QVariant(QMetaType(QMetaType::Int)));
    values.insert(QStringLiteral("genre"), QVariant(QMetaType(QMetaType::QString)));
    values.insert(QStringLiteral("rating"), QVariant(QMetaType(QMetaType::QString)));
    values.insert(QStringLiteral("box_art_path"), QVariant(QMetaType(QMetaType::QString)));
    values.insert(QStringLiteral("background_path"), QVariant(QMetaType(QMetaType::QString)));
    values.insert(QStringLiteral("screenshot_path"), QVariant(QMetaType(QMetaType::QString)));
    values.insert(QStringLiteral("rom_path"), QVariant(QMetaType(QMetaType::QString)));
    values.insert(QStringLiteral("favorite"), 0);
    values.insert(QStringLiteral("play_status"), QStringLiteral("unplayed"));
    values.insert(QStringLiteral("notes"), QVariant(QMetaType(QMetaType::QString)));
    values.insert(QStringLiteral("launchbox_id"), QVariant(QMetaType(QMetaType::QString)));
    values.insert(QStringLiteral("launch_count"), 0);
    for (auto it = input.cbegin(); it != input.cend(); ++it) {
        if (writeColumns().contains(it.key())) values.insert(it.key(), it.value());
    }

    QStringList columns = writeColumns();
    columns.append(QStringLiteral("library_group_key"));
    // Coluna derivada do título, mantida na mesma escrita para a busca usar índice.
    columns.append(QStringLiteral("title_normalized"));
    QStringList placeholders;
    for (qsizetype index = 0; index < columns.size(); ++index) placeholders.append(QStringLiteral("?"));
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("INSERT INTO games (%1) VALUES (%2)")
            .arg(columns.join(QStringLiteral(", ")), placeholders.join(QStringLiteral(", "))))) {
        return fail(query, QStringLiteral("Preparação do INSERT"), error);
    }
    for (const QString& column : writeColumns()) query.addBindValue(columnValue(column, values.value(column)));
    const QString romPath = values.value(QStringLiteral("rom_path")).toString();
    const QString groupKey = buildStoredLibraryGroupKey(title, romPath);
    // Jogos manuais guardam NULL, como no Electron; a chave só existe quando há ROM.
    query.addBindValue(groupKey.isEmpty() ? QVariant(QMetaType(QMetaType::QString)) : QVariant(groupKey));
    query.addBindValue(title.toCaseFolded());
    if (!query.exec()) {
        const QString friendly = linkConstraintMessage(query.lastError().text());
        if (!friendly.isEmpty()) {
            if (error) *error = friendly;
            return false;
        }
        return fail(query, QStringLiteral("Criação do jogo"), error);
    }
    if (newId) *newId = query.lastInsertId().toLongLong();
    if (error) error->clear();
    return true;
}

bool GameWriteDao::update(qint64 id, const QVariantMap& changes, QString* error) const {
    if (id <= 0) {
        if (error) *error = QStringLiteral("Jogo não encontrado.");
        return false;
    }
    QStringList columns;
    QVariantList values;
    for (auto it = changes.cbegin(); it != changes.cend(); ++it) {
        if (!writeColumns().contains(it.key())) {
            if (error) *error = QStringLiteral("Campo não editável: ") + it.key();
            return false;
        }
        columns.append(it.key());
        values.append(columnValue(it.key(), it.value()));
    }
    if (columns.isEmpty()) {
        QSqlQuery exists(database_);
        exists.prepare(QStringLiteral("SELECT 1 FROM games WHERE id = ?"));
        exists.addBindValue(id);
        if (!exists.exec()) return fail(exists, QStringLiteral("Consulta do jogo"), error);
        if (!exists.next()) {
            if (error) *error = QStringLiteral("Jogo não encontrado.");
            return false;
        }
        if (error) error->clear();
        return true;
    }

    // Título ou ROM alteram o agrupamento visual; a chave persistida acompanha.
    if (changes.contains(QStringLiteral("title")) || changes.contains(QStringLiteral("rom_path"))) {
        QSqlQuery current(database_);
        current.prepare(QStringLiteral("SELECT title, rom_path FROM games WHERE id = ?"));
        current.addBindValue(id);
        if (!current.exec()) return fail(current, QStringLiteral("Consulta do jogo"), error);
        if (!current.next()) {
            if (error) *error = QStringLiteral("Jogo não encontrado.");
            return false;
        }
        const QString nextTitle = changes.contains(QStringLiteral("title")) ? columnValue(QStringLiteral("title"), changes.value(QStringLiteral("title"))).toString() : current.value(0).toString();
        const QString nextRom = changes.contains(QStringLiteral("rom_path")) ? columnValue(QStringLiteral("rom_path"), changes.value(QStringLiteral("rom_path"))).toString() : current.value(1).toString();
        columns.append(QStringLiteral("library_group_key"));
        values.append(buildStoredLibraryGroupKey(nextTitle, nextRom));
        // A busca depende da coluna derivada; ela acompanha toda alteração de título.
        if (changes.contains(QStringLiteral("title"))) {
            columns.append(QStringLiteral("title_normalized"));
            values.append(nextTitle.toCaseFolded());
        }
    }

    QStringList assignments;
    for (const QString& column : columns) assignments.append(column + QStringLiteral(" = ?"));

    // Um LaunchBox ID pertence a um único jogo por plataforma. Ao salvar um cadastro com vínculo,
    // a variante anterior perde o vínculo e as duas continuam existindo, como na deduplicação.
    const int launchBoxIndex = columns.indexOf(QStringLiteral("launchbox_id"));
    const QString launchBoxId = launchBoxIndex >= 0 ? values.at(launchBoxIndex).toString() : QString();
    qint64 targetPlatform = 0;
    if (!launchBoxId.isEmpty()) {
        targetPlatform = changes.value(QStringLiteral("platform_id")).toLongLong();
        if (targetPlatform <= 0) {
            QSqlQuery current(database_);
            if (!current.prepare(QStringLiteral("SELECT platform_id FROM games WHERE id = ?"))) {
                return fail(current, QStringLiteral("Consulta do jogo"), error);
            }
            current.addBindValue(id);
            if (!current.exec()) return fail(current, QStringLiteral("Consulta do jogo"), error);
            if (!current.next()) {
                if (error) *error = QStringLiteral("Jogo não encontrado.");
                return false;
            }
            targetPlatform = current.value(0).toLongLong();
        }
    }
    // Desvinculação e UPDATE formam uma operação única: uma falha não deixa o vínculo órfão.
    const bool reassignLink = !launchBoxId.isEmpty() && targetPlatform > 0;
    if (reassignLink && !database_.transaction()) {
        if (error) *error = database_.lastError().text();
        return false;
    }
    if (reassignLink) {
        QSqlQuery unlink(database_);
        if (!unlink.prepare(QStringLiteral("UPDATE games SET launchbox_id = NULL, updated_at = CURRENT_TIMESTAMP "
                                           "WHERE platform_id = ? AND launchbox_id = ? AND id != ?"))) {
            database_.rollback();
            return fail(unlink, QStringLiteral("Preparação da desvinculação"), error);
        }
        unlink.addBindValue(targetPlatform);
        unlink.addBindValue(launchBoxId);
        unlink.addBindValue(id);
        if (!unlink.exec()) {
            database_.rollback();
            return fail(unlink, QStringLiteral("Desvinculação do LaunchBox"), error);
        }
    }

    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("UPDATE games SET %1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .arg(assignments.join(QStringLiteral(", "))))) {
        if (reassignLink) database_.rollback();
        return fail(query, QStringLiteral("Preparação do UPDATE"), error);
    }
    for (const QVariant& value : values) query.addBindValue(value);
    query.addBindValue(id);
    if (!query.exec()) {
        if (reassignLink) database_.rollback();
        // A mensagem crua do SQLite não orienta o usuário; o conflito real é de vínculo.
        const QString friendly = linkConstraintMessage(query.lastError().text());
        if (!friendly.isEmpty()) {
            if (error) *error = friendly;
            return false;
        }
        return fail(query, QStringLiteral("Atualização do jogo"), error);
    }
    if (query.numRowsAffected() == 0) {
        if (reassignLink) database_.rollback();
        if (error) *error = QStringLiteral("Jogo não encontrado.");
        return false;
    }
    if (reassignLink && !database_.commit()) {
        if (error) *error = database_.lastError().text();
        database_.rollback();
        return false;
    }
    if (error) error->clear();
    return true;
}

bool GameWriteDao::remove(qint64 id, QString* error) const {
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("DELETE FROM games WHERE id = ?"))) return fail(query, QStringLiteral("Preparação do DELETE"), error);
    query.addBindValue(id);
    if (!query.exec()) return fail(query, QStringLiteral("Exclusão do jogo"), error);
    if (error) error->clear();
    return true;
}

bool GameWriteDao::findIdByRomPath(const QString& romPath, qint64 platformId, qint64* id, bool* found, QString* error) const {
    if (!id || !found) {
        if (error) *error = QStringLiteral("Destino da consulta ausente.");
        return false;
    }
    *found = false;
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("SELECT id FROM games WHERE rom_path = ? AND platform_id = ? LIMIT 1"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(romPath);
    query.addBindValue(platformId);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (query.next()) {
        *id = query.value(0).toLongLong();
        *found = true;
    }
    if (error) error->clear();
    return true;
}

bool GameWriteDao::findIdByLaunchBoxId(const QString& launchBoxId, qint64 platformId, qint64* id,
    bool* found, QString* error) const {
    if (!id || !found || launchBoxId.trimmed().isEmpty()) {
        if (error) *error = QStringLiteral("Destino da consulta ausente.");
        return false;
    }
    *found = false;
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral(
            "SELECT id FROM games WHERE launchbox_id = ? AND platform_id = ? LIMIT 1"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(launchBoxId);
    query.addBindValue(platformId);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    if (query.next()) {
        *id = query.value(0).toLongLong();
        *found = true;
    }
    if (error) error->clear();
    return true;
}

bool GameWriteDao::incrementLaunchCount(qint64 id, QString* error) const {
    QSqlQuery query(database_);
    if (!query.prepare(QStringLiteral("UPDATE games SET launch_count = launch_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"))) {
        return fail(query, QStringLiteral("Preparação do lançamento"), error);
    }
    query.addBindValue(id);
    if (!query.exec()) return fail(query, QStringLiteral("Contagem de partidas"), error);
    if (query.numRowsAffected() == 0) {
        if (error) *error = QStringLiteral("Jogo não encontrado.");
        return false;
    }
    if (error) error->clear();
    return true;
}

bool GameWriteDao::resetLaunchCounts(qint64* updated, QString* error) const {
    QSqlQuery query(database_);
    if (!query.exec(QStringLiteral("UPDATE games SET launch_count = 0, updated_at = CURRENT_TIMESTAMP WHERE launch_count != 0"))) {
        return fail(query, QStringLiteral("Reset do histórico de partidas"), error);
    }
    // changes() reflete apenas linhas realmente alteradas, como no DAO legado.
    if (updated) *updated = query.numRowsAffected();
    if (error) error->clear();
    return true;
}
} // namespace gamestock
