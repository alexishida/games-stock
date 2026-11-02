/** Abre o SQLite já inicializado para leitura e escrita, uma conexão por serviço. */
#pragma once
#include <QSqlDatabase>
#include <QString>

namespace gamestock {
/**
 * Conexão de serviço restrita à thread que a criou. O bootstrap deve aplicar
 * schema/migrations/snapshot antes de abrir; esta classe nunca altera o schema.
 */
class WriteConnection final {
public:
    /** Reserva um nome único de conexão; não abre ou cria arquivos. */
    WriteConnection();
    /** Fecha a conexão e remove seu registro global ao encerrar a vida do objeto. */
    ~WriteConnection();
    WriteConnection(const WriteConnection&) = delete;
    WriteConnection& operator=(const WriteConnection&) = delete;
    /** Abre arquivo existente com foreign keys e timeout, sem rodar migrations. */
    bool open(const QString& path, QString* error);
    /** A referência só é válida na thread e durante a vida desta conexão. */
    QSqlDatabase& database();

private:
    QString name_;
    QSqlDatabase database_;
};
} // namespace gamestock
