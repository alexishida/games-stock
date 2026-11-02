/** CRUD de plataformas, aliases LaunchBox e extensões de ROM, como o DAO Electron. */
#pragma once

#include <QSqlDatabase>
#include <QList>
#include <QString>
#include <QStringList>
#include <QVariantMap>

namespace gamestock {
/** Encapsula a SQL de `platforms`, `platform_launchbox_aliases` e `platform_rom_extensions`. */
class PlatformDao final {
public:
    /** Usa uma conexão viva da mesma thread e não assume posse dela. */
    explicit PlatformDao(QSqlDatabase& database);

    /** Lista por nome com `gameCount`, mantendo plataformas sem jogos. */
    bool list(QList<QVariantMap>* result, QString* error) const;
    /** Retorna a plataforma com `gameCount = 0`, ou erro quando não existe. */
    bool get(qint64 id, QVariantMap* result, QString* error) const;
    /** Cria com categoria padrão "Outros"; nome vazio ou duplicado é recusado. */
    bool create(const QString& name, const QString& category, qint64* newId, QString* error) const;
    /** Atualiza mantendo os valores atuais para campos vazios. */
    bool update(qint64 id, const QString& name, const QString& category, QString* error) const;
    /** Recusa plataforma padrão, com jogos ou com itens de inventário associados. */
    bool remove(qint64 id, QString* error) const;

    /** Retorna `{aliases, romExtensions}` da plataforma informada. */
    bool mappings(qint64 id, QVariantMap* result, QString* error) const;
    /**
     * Substitui aliases e extensões em uma transação. Exige ao menos um alias,
     * uma extensão e uma extensão principal, como as validações do Electron.
     */
    bool saveMappings(qint64 id, const QStringList& aliases, const QList<QVariantMap>& extensions, QString* error) const;

struct ExtensionMapping {
    qint64 platformId = 0;
    QString platformName;
    QString extension;
    bool primary = true;
};

/** Lista todas as extensões primárias com plataforma, para detecção automática. */
bool listPrimaryExtensions(QList<ExtensionMapping>* result, QString* error) const;

private:
    QSqlDatabase& database_;
};
} // namespace gamestock
