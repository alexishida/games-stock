/** Escrita de jogos com as mesmas validações e chave de agrupamento do Electron. */
#pragma once

#include <QSqlDatabase>
#include <QString>
#include <QVariantMap>

namespace gamestock {
/** CRUD de jogos sobre uma conexão já inicializada; erros são acionáveis. */
class GameWriteDao {
public:
    explicit GameWriteDao(QSqlDatabase& database);

    /** Cria um jogo com defaults do Electron; exige título e plataforma. */
    bool create(const QVariantMap& input, qint64* newId, QString* error = nullptr) const;
    /** Atualiza somente as chaves presentes; recalcula a chave ao mudar título/ROM. */
    bool update(qint64 id, const QVariantMap& changes, QString* error = nullptr) const;
    /** Remove pelo ID; ausência não é erro, como no DAO legado. */
    bool remove(qint64 id, QString* error = nullptr) const;
    /** Incrementa a contagem de partidas após um launch bem-sucedido. */
    bool incrementLaunchCount(qint64 id, QString* error = nullptr) const;
    /** Localiza um jogo pela ROM exata dentro da plataforma, usado no importador. */
    bool findIdByRomPath(const QString& romPath, qint64 platformId, qint64* id, bool* found, QString* error = nullptr) const;
    /** Localiza um jogo pelo vínculo LaunchBox dentro da plataforma. */
    bool findIdByLaunchBoxId(const QString& launchBoxId, qint64 platformId, qint64* id, bool* found,
        QString* error = nullptr) const;
    /** Zera o histórico de partidas, reportando quantos jogos mudaram. */
    bool resetLaunchCounts(qint64* updated, QString* error = nullptr) const;

private:
    QSqlDatabase& database_;
};
} // namespace gamestock
