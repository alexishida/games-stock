/** Fachada tipada de plataformas: lista observável, CRUD e mapeamentos. */
#pragma once

#include "db/WriteConnection.h"
#include "models/PlatformListModel.h"

#include <QObject>
#include <QVariantList>
#include <QVariantMap>

namespace gamestock {
/** Uma conexão por instância; o QML nunca executa SQL nem acessa o banco. */
class PlatformService final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QAbstractItemModel* model READ model CONSTANT)
    Q_PROPERTY(QVariantList items READ items NOTIFY changed)
    Q_PROPERTY(bool available READ available NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
public:
    explicit PlatformService(QObject* parent = nullptr);
    /** Abre o banco já inicializado e carrega a lista com contagens. */
    bool open(const QString& databasePath, QString* error = nullptr);
    bool isOpen() const;

    QAbstractItemModel* model();
    QVariantList items() const { return items_; }
    bool available() const { return open_; }
    QString error() const { return error_; }

public slots:
    /** Recarrega plataformas e `gameCount` a partir do banco. */
    void refresh();
    /** Retorna a plataforma completa, ou mapa vazio em erro. */
    QVariantMap get(qint64 id);
    /** Cria e retorna o novo ID, ou -1 em validação/duplicidade. */
    qint64 create(const QString& name, const QString& category);
    /** Atualiza preservando campos vazios; retorna falso em erro. */
    bool update(qint64 id, const QString& name, const QString& category);
    /** Exclui respeitando padrão, jogos e inventário; retorna falso em bloqueio. */
    bool remove(qint64 id);
    /** Retorna `{aliases, romExtensions}` da plataforma. */
    QVariantMap getMappings(qint64 id);
    /** Substitui aliases e extensões em uma transação. */
    bool saveMappings(qint64 id, const QVariantList& aliases, const QVariantList& romExtensions);
    /** Aliases LaunchBox da plataforma, incluindo o nome canônico. */
    QStringList launchBoxAliases(qint64 platformId);
    /** Resolve uma plataforma por alias/nome LaunchBox; 0 quando ambíguo/ausente. */
    qint64 resolvePlatformByLaunchBoxName(const QString& name);

signals:
    void changed();

private:
    WriteConnection connection_;
    PlatformListModel model_;
    QVariantList items_;
    QString error_;
    bool open_ = false;
};
} // namespace gamestock
