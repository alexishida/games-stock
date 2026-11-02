/** Metadados textuais alternativos do OpenVGDB em SQLite somente leitura. */
#pragma once

#include <QList>
#include <QRecursiveMutex>
#include <QString>
#include <QVariantMap>

namespace gamestock {
/** Baixa uma vez o SQLite público e consulta por título/plataforma. */
class OpenVgdb final {
public:
    /** Configuração explícita para produção e testes determinísticos. */
    struct Config {
        QString cacheDir;
        QString apiUrl = QStringLiteral("https://api.github.com/repos/OpenVGDB/OpenVGDB/releases/latest");
        QString sevenZipPath;
        /** Testes apontam para um servidor local; produção exige github.com. */
        bool allowCustomAssetUrl = false;
    };

    explicit OpenVgdb(Config config);

    /** Baixa/valida o SQLite na primeira chamada; idempotente depois. */
    bool ensureDatabase(QString* error = nullptr);
    /** Busca releases na plataforma mapeada, deduplicando regiões pela ficha mais rica. */
    QList<QVariantMap> search(const QString& query, const QString& platformName, QString* error = nullptr);
    /** Recupera uma release `openvgdb:<id>` sem baixar novamente. */
    QVariantMap get(const QString& id, QString* error = nullptr);
    QString databaseFile() const;

private:
    bool downloadDatabase(QString* error);
    /** Nome do sistema OpenVGDB para a plataforma local, ou vazio. */
    static QString systemName(const QString& platformName);
    /** Nome local exibido a partir do sistema OpenVGDB. */
    static QString localName(const QString& system);
    static QString normalize(const QString& value);
    QVariantMap toMap(const QVariantMap& row) const;
    mutable QRecursiveMutex mutex_;
    Config config_;
};
} // namespace gamestock
