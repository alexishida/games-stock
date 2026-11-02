/** Lê e grava as preferências legadas da biblioteca no estado SQLite. */
#pragma once
#include <QSqlDatabase>
#include <QString>

namespace gamestock {
/** Preferências válidas para hidratação da biblioteca. */
struct LibraryFilterState {
    QString selectedCategory;
    QString collectionFilter = QStringLiteral("all");
    bool showGamesWithoutCover = true;
    QString sortBy = QStringLiteral("title");
    QString viewMode = QStringLiteral("grid");
};

/** Camada de compatibilidade sem acesso direto a perfis nem criação de schema. */
class LibraryFilterStore final {
public:
    /** Usa conexão pertencente à thread chamadora e protegida pelo lock de perfil. */
    explicit LibraryFilterStore(QSqlDatabase& database);
    /** Sinaliza ausência ou formato incompatível sem sobrescrever preferências existentes. */
    bool load(LibraryFilterState* result, bool* present, QString* error) const;
    /** Grava o formato consumido pelo renderer legado. */
    bool save(const LibraryFilterState& value, QString* error) const;
private:
    QSqlDatabase& database_;
};
}
