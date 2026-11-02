/** Abre cópias SQLite somente para leitura durante a migração do backend. */
#pragma once
#include <QSqlDatabase>
#include <QString>

namespace gamestock {
/** Possui uma conexão Qt SQL restrita à thread que a criou. */
class ReadOnlyConnection final {
public:
    /** Reserva um nome único de conexão; não abre ou cria arquivos. */
    ReadOnlyConnection();
    /** Fecha a conexão e remove seu registro global ao encerrar a vida do objeto. */
    ~ReadOnlyConnection();
    ReadOnlyConnection(const ReadOnlyConnection&) = delete;
    ReadOnlyConnection& operator=(const ReadOnlyConnection&) = delete;
    /** Abre arquivo existente sem escrita; retorna diagnóstico quando a abertura falha. */
    bool open(const QString& path, QString* error);
    /** A referência só é válida na thread e durante a vida desta conexão. */
    QSqlDatabase& database();
private:
    QString name_;
    QSqlDatabase database_;
};
}
