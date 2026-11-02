/** Conexão de escrita com schema/migrations aplicados, isolada por instância. */
#pragma once

#include <QSqlDatabase>
#include <QString>

namespace gamestock {
/**
 * Abre o banco para escrita, ativa foreign keys/timeout e aplica a inicialização
 * compatível com o Electron. O lock e o snapshot são responsabilidade do chamador.
 */
class Database {
public:
    Database();
    ~Database();
    Database(const Database&) = delete;
    Database& operator=(const Database&) = delete;

    bool open(const QString& path, const QString& imagesDir, QString* error = nullptr);
    bool isOpen() const;
    QSqlDatabase& handle();
    QString path() const;
    /** Snapshot criado antes das migrations nesta abertura; vazio quando não foi preciso. */
    QString lastSnapshot() const;
    void close();

private:
    QString name_;
    QString path_;
    QString lastSnapshot_;
    QSqlDatabase database_;
};
} // namespace gamestock
