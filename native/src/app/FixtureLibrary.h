/** Expõe somente consultas paginadas de um banco sintético ao protótipo QML. */
#pragma once
#include "db/ReadOnlyConnection.h"
#include <QObject>
#include <QVariantList>
#include <QStringList>

namespace gamestock {
/** Serviço temporário de leitura, sem CRUD nem abertura automática do perfil real. */
class FixtureLibrary final : public QObject {
    Q_OBJECT
    Q_PROPERTY(bool enabled READ enabled NOTIFY changed)
    Q_PROPERTY(QVariantList games READ games NOTIFY changed)
    Q_PROPERTY(qint64 total READ total NOTIFY changed)
    Q_PROPERTY(qint64 filtered READ filtered NOTIFY changed)
    Q_PROPERTY(int page READ page NOTIFY changed)
    Q_PROPERTY(QString error READ error NOTIFY changed)
    Q_PROPERTY(QString sortBy READ sortBy NOTIFY changed)
    Q_PROPERTY(QStringList genres READ genres NOTIFY changed)
    Q_PROPERTY(QString genre READ genre NOTIFY changed)
    Q_PROPERTY(QString collection READ collection NOTIFY changed)
    Q_PROPERTY(QVariantMap counts READ counts NOTIFY changed)
    Q_PROPERTY(bool includeMissingCovers READ includeMissingCovers NOTIFY changed)
public:
    /** Inicializa o serviço vazio na thread gráfica. */
    explicit FixtureLibrary(QObject* parent = nullptr);
    /** Abre banco existente somente para leitura e carrega sua primeira página. */
    bool open(const QString& path);
    /** Indica se há uma fixture aberta. */
    bool enabled() const;
    /** Entrega apenas os representantes visuais da página atual. */
    QVariantList games() const;
    /** Contagem de grupos sem filtros. */
    qint64 total() const;
    /** Contagem de grupos após busca. */
    qint64 filtered() const;
    /** Página atual baseada em um. */
    int page() const;
    /** Último diagnóstico da consulta. */
    QString error() const;
    /** Ordenação ativa entre as opções suportadas pelo DAO. */
    QString sortBy() const;
    /** Retorna gêneros únicos encontrados na fixture. */
    QStringList genres() const;
    /** Retorna gênero selecionado, ou vazio para todos. */
    QString genre() const;
    /** Devolve a coleção selecionada. */
    QString collection() const;
    /** Devolve contagens de coleções para a sidebar. */
    QVariantMap counts() const;
    /** Informa se jogos sem caminho de capa são exibidos. */
    bool includeMissingCovers() const;
    /** Atualiza a página sem permitir navegação fora dos limites. */
    Q_INVOKABLE void goToPage(int page);
    /** Aplica busca na primeira página. */
    Q_INVOKABLE void setSearch(const QString& value);
    /** Atualiza a ordenação usando somente valores conhecidos. */
    Q_INVOKABLE void setSortBy(const QString& value);
    /** Seleciona um gênero retornado pela própria fixture. */
    Q_INVOKABLE void setGenre(const QString& value);
    /** Seleciona uma coleção entre as suportadas pelo DAO. */
    Q_INVOKABLE void setCollection(const QString& value);
    /** Atualiza o filtro de presença de capa e volta à primeira página. */
    Q_INVOKABLE void setIncludeMissingCovers(bool value);
signals:
    /** Notifica mudança atômica da página e contagens. */
    void changed();
private:
    /** Executa a consulta preservando a página anterior em caso de erro. */
    void reload(int page);
    ReadOnlyConnection connection_;
    bool enabled_ = false;
    QVariantList games_;
    qint64 total_ = 0;
    qint64 filtered_ = 0;
    int page_ = 1;
    QString search_;
    QString sortBy_ = QStringLiteral("title");
    QStringList genres_;
    QString genre_;
    QString collection_ = QStringLiteral("all");
    QVariantMap counts_;
    bool includeMissingCovers_ = true;
    QString error_;
};
}
