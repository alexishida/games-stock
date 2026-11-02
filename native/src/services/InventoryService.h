/** Fachada tipada do inventário físico: filtros, CRUD, fotos e cadastros auxiliares. */
#pragma once

#include "db/WriteConnection.h"
#include "models/HardwareItemListModel.h"

#include <QObject>
#include <QVariantList>
#include <QVariantMap>

namespace gamestock {
/** Uma conexão por instância; a UI conversa apenas com propriedades e slots. */
class InventoryService final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QAbstractItemModel* model READ model CONSTANT)
    Q_PROPERTY(QVariantList items READ items NOTIFY changed)
    Q_PROPERTY(bool available READ available NOTIFY changed)
    Q_PROPERTY(QString search READ search WRITE setSearch NOTIFY changed)
    Q_PROPERTY(QString sortBy READ sortBy WRITE setSortBy NOTIFY changed)
    Q_PROPERTY(qint64 itemTypeId READ itemTypeId WRITE setItemTypeId NOTIFY changed)
    Q_PROPERTY(qint64 conservationStateId READ conservationStateId WRITE setConservationStateId NOTIFY changed)
    Q_PROPERTY(qint64 platformId READ platformId WRITE setPlatformId NOTIFY changed)
    Q_PROPERTY(int page READ page NOTIFY changed)
    Q_PROPERTY(int pageSize READ pageSize WRITE setPageSize NOTIFY changed)
    Q_PROPERTY(qint64 total READ total NOTIFY changed)
    Q_PROPERTY(qint64 filtered READ filtered NOTIFY changed)
    Q_PROPERTY(QVariantList types READ types NOTIFY changed)
    Q_PROPERTY(QVariantList states READ states NOTIFY changed)
    Q_PROPERTY(QVariantList typeCounts READ typeCounts NOTIFY changed)
    Q_PROPERTY(QVariantList stateCounts READ stateCounts NOTIFY changed)
    Q_PROPERTY(QVariantList platforms READ platforms NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
public:
    explicit InventoryService(QObject* parent = nullptr);
    /** Abre o banco e define o perfil usado para gravar/remover fotos. */
    bool open(const QString& databasePath, const QString& profileRoot, QString* error = nullptr);
    bool isOpen() const;
    void setMediaRoot(const QString& path) { mediaRoot_ = path; }

    QAbstractItemModel* model();
    QVariantList items() const { return items_; }
    bool available() const { return open_; }
    QString search() const { return search_; }
    QString sortBy() const { return sortBy_; }
    qint64 itemTypeId() const { return itemTypeId_; }
    qint64 conservationStateId() const { return conservationStateId_; }
    qint64 platformId() const { return platformId_; }
    int page() const { return page_; }
    int pageSize() const { return pageSize_; }
    qint64 total() const { return total_; }
    qint64 filtered() const { return filtered_; }
    QVariantList types() const { return types_; }
    QVariantList states() const { return states_; }
    QVariantList typeCounts() const { return typeCounts_; }
    QVariantList stateCounts() const { return stateCounts_; }
    QVariantList platforms() const { return platforms_; }
    QString error() const { return error_; }

public slots:
    void setSearch(const QString& value);
    void setSortBy(const QString& value);
    void setItemTypeId(qint64 value);
    void setConservationStateId(qint64 value);
    void setPlatformId(qint64 value);
    void setPageSize(int value);
    void goToPage(int value);
    /** Recarrega página, auxiliares e contadores. */
    void refresh();

    /** Item completo com `coverUrl`; mapa vazio indica erro. */
    QVariantMap get(qint64 id);
    /** Cria e retorna o item persistido; mapa vazio indica validação/erro. */
    QVariantMap create(const QVariantMap& input);
    /** Atualiza apenas as chaves presentes; recarrega a consulta. */
    bool update(qint64 id, const QVariantMap& changes);
    /** Exclui item, fotos do banco e arquivos do diretório do item. */
    bool remove(qint64 id);

    /** Fotos ordenadas, já com `fileUrl` para o provider de mídia. */
    QVariantList listPhotos(qint64 itemId);
    /** Valida e copia uma imagem para `inventario/images/<item_id>/`. */
    QVariantMap addPhoto(qint64 itemId, const QString& sourcePath);
    /** Remove registro e arquivo físico da foto. */
    bool removePhoto(qint64 photoId);
    /** Troca a ordem de duas fotos do mesmo item. */
    bool reorderPhotos(qint64 idA, qint64 idB);

    /** Cria tipo/estado do usuário e devolve o registro persistido. */
    QVariantMap createType(const QString& name);
    QVariantMap createState(const QString& name);
    bool removeType(qint64 id);
    bool removeState(qint64 id);
    /** Plataformas com itens, para a árvore da sidebar no modo inventário. */
    QVariantList platformsWithItems();

    /** Converte caminho local no identificador do provider de mídia. */
    QString mediaUrl(const QString& path) const;

signals:
    void changed();

private:
    /** Aplica a consulta paginada atual e publica itens/modelo. */
    void reload();
    void reloadTypes();
    void reloadStates();
    void reloadPlatforms();
    /** Acrescenta URL do provider e rótulo de capa ao mapa exposto ao QML. */
    static void decorate(QVariantMap* item);
    /** Verifica assinatura JPEG/PNG/WebP antes de copiar para o perfil. */
    static bool isSupportedImage(const QString& path);
    /** Caminho canônico de arquivo de foto dentro de `inventario/images`, ou vazio. */
    QString authorizedPhotoPath(const QString& path) const;

    WriteConnection connection_;
    HardwareItemListModel model_;
    QVariantList items_;
    QVariantList types_;
    QVariantList states_;
    QVariantList typeCounts_;
    QVariantList stateCounts_;
    QVariantList platforms_;
    QString mediaRoot_;
    QString profileRoot_;
    QString search_;
    QString sortBy_ = QStringLiteral("name");
    qint64 itemTypeId_ = 0;
    qint64 conservationStateId_ = 0;
    qint64 platformId_ = 0;
    int page_ = 1;
    int pageSize_ = 36;
    qint64 total_ = 0;
    qint64 filtered_ = 0;
    QString error_;
    bool open_ = false;
};
} // namespace gamestock
