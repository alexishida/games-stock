/** CRUD de itens físicos com os mesmos filtros e ordenação do DAO Electron. */
#pragma once

#include <QList>
#include <QSqlDatabase>
#include <QString>
#include <QVariantMap>

namespace gamestock {
/** Filtros combinados da listagem; `0` significa "sem filtro" para os IDs. */
struct HardwareItemFilters {
    qint64 platformId = 0;
    qint64 itemTypeId = 0;
    qint64 conservationStateId = 0;
    QString search;
    /** `name`, `type` ou `recent`; qualquer outro valor cai em `name`. */
    QString sortBy = QStringLiteral("name");
    int page = 1;
    int pageSize = 36;
};

/** Encapsula `hardware_items` com JOINs para plataforma, tipo e conservação. */
class HardwareItemDao final {
public:
    explicit HardwareItemDao(QSqlDatabase& database);

    /** Lista a página filtrada e devolve o total geral e o total filtrado. */
    bool list(const HardwareItemFilters& filters, QList<QVariantMap>* items, qint64* total,
        qint64* filtered, QString* error) const;
    /** Retorna o item completo (com caminho da capa) ou erro quando o ID não existe. */
    bool get(qint64 id, QVariantMap* result, QString* error) const;
    /** Valida nome/descrição e normaliza o marcador Multiplataforma. */
    bool create(const QVariantMap& input, qint64* newId, QString* error) const;
    /** Atualiza apenas as chaves presentes, preservando plataforma quando omitida. */
    bool update(qint64 id, const QVariantMap& changes, QString* error) const;
    /** Remove o item; as fotos saem por CASCADE. */
    bool remove(qint64 id, QString* error) const;
    /** Plataformas com ao menos um item, contadas para os filtros da sidebar. */
    bool listPlatformsWithItems(QList<QVariantMap>* result, QString* error) const;

private:
    QSqlDatabase& database_;
};
} // namespace gamestock
