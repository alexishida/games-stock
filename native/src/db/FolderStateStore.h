/** Mantém as entradas legadas de pastas de ROM no estado SQLite. */
#pragma once
#include <QJsonArray>
#include <QSqlDatabase>
#include <QString>

namespace gamestock {
/** Gerencia a chave de pastas com a conexão já protegida pelo chamador. */
class FolderStateStore final {
public:
    /** A conexão pertence à thread chamadora e deve ter passado pelo lock de perfil. */
    explicit FolderStateStore(QSqlDatabase& database);
    /** Substitui o retrato sem descartar campos desconhecidos dos registros. */
    bool save(const QJsonArray& folders, QString* error) const;
    /** Mescla por plataforma e caminho na mesma transação, sem duplicar entradas. */
    bool merge(const QJsonArray& folders, QString* error) const;
    /** Lê as entradas persistidas; ausência resulta em lista vazia. */
    bool load(QJsonArray* folders, QString* error) const;
    /** Remove apenas a entrada da pasta/plataforma informada. */
    bool remove(const QString& folderPath, qint64 platformId, QString* error) const;
private:
    QSqlDatabase& database_;
};
}
