/** Fachada tipada de emuladores, vínculos e inventário RetroArch. */
#pragma once

#include "db/WriteConnection.h"
#include "models/EmulatorListModel.h"

#include <QObject>
#include <QVariantList>
#include <QVariantMap>

namespace gamestock {
/** Uma conexão por instância; o QML nunca acessa SQL nem processos. */
class EmulatorService final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QAbstractItemModel* model READ model CONSTANT)
    Q_PROPERTY(QVariantList items READ items NOTIFY changed)
    Q_PROPERTY(bool available READ available NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
public:
    explicit EmulatorService(QObject* parent = nullptr);
    /** Abre o banco já inicializado e carrega a lista. */
    bool open(const QString& databasePath, QString* error = nullptr);
    bool isOpen() const;

    QAbstractItemModel* model();
    QVariantList items() const { return items_; }
    bool available() const { return open_; }
    QString error() const { return error_; }

public slots:
    void refresh();
    QVariantMap get(qint64 id);
    /** Cria e retorna o registro, ou mapa vazio em validação/duplicidade. */
    QVariantMap create(const QVariantMap& input);
    /** Atualiza somente as chaves recebidas. */
    bool update(qint64 id, const QVariantMap& changes);
    /** Recusa RetroArch e remove vínculos por CASCADE. */
    bool remove(qint64 id);
    QVariantList listByPlatform(qint64 platformId);
    QVariantMap listByPlatforms(const QVariantList& platformIds);
    QVariantMap getDefault(qint64 platformId);
    /** Upsert de vínculo com core opcional; retorna o registro relido. */
    QVariantMap link(qint64 emulatorId, qint64 platformId, bool isDefault, const QString& corePath);
    bool unlink(qint64 emulatorId, qint64 platformId);
    bool savePlatformLinks(const QVariantList& changes);
    /** Inventário `coresDir`/`installedCores` de um emulador RetroArch. */
    QVariantMap listRetroArchCores(qint64 emulatorId);
    /** Cores recomendados/fallback para a plataforma, na ordem do catálogo. */
    QStringList retroArchCoreCandidates(const QString& platformName);
    /** Filtra o inventário instalado para os cores compatíveis com a plataforma. */
    QStringList compatibleRetroArchCores(const QString& platformName, const QStringList& installedCores);

signals:
    void changed();
    /** Emitido após alterações de vínculos para recarregar seletores. */
    void linksChanged();

private:
    WriteConnection connection_;
    EmulatorListModel model_;
    QVariantList items_;
    QString error_;
    bool open_ = false;
};
} // namespace gamestock
