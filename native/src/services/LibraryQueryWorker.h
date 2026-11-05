/** Executa as consultas de leitura da biblioteca fora da thread gráfica. */
#pragma once

#include "db/ReadOnlyConnection.h"
#include "db/dao/GameReadDao.h"

#include <QMetaType>
#include <QObject>
#include <QString>
#include <QStringList>

#include <memory>

namespace gamestock {
/** Worker dono de uma conexão somente leitura criada e usada na própria thread. */
class LibraryQueryWorker final : public QObject {
    Q_OBJECT
public:
    /** Pedido imutável: página/filtros e quais agregados precisam ser recalculados. */
    struct Request {
        quint64 generation = 0;
        int page = 1;
        int pageSize = 36;
        GameListFilters filters;
        bool wantSidebar = false;
        bool wantGenres = false;
        bool wantLaunchStats = false;
        bool wantCoverStats = false;
    };
    /** Resposta correspondente a uma geração; o serviço descarta gerações antigas. */
    struct Response {
        quint64 generation = 0;
        bool ok = false;
        QString error;
        GamePage page;
        GameReadDao::SidebarCounts sidebar;
        QStringList genres;
        GameReadDao::LaunchStats launchStats;
        GameReadDao::CoverStats coverStats;
        bool hasSidebar = false;
        bool hasGenres = false;
        bool hasLaunchStats = false;
        bool hasCoverStats = false;
    };

    explicit LibraryQueryWorker(QString databasePath, QObject* parent = nullptr);

public slots:
    /** Abre a conexão na thread do worker; falso mantém o serviço no modo síncrono. */
    bool openConnection();
    /** Libera a conexão na própria thread antes do encerramento. */
    void closeConnection();
    /** Executa a consulta e publica o resultado sem tocar na thread gráfica. */
    void run(const Request& request);

signals:
    void finished(const Response& response);

private:
    QString databasePath_;
    std::unique_ptr<ReadOnlyConnection> connection_;
};
} // namespace gamestock

// As estruturas atravessam conexões enfileiradas entre a thread de consulta e a GUI.
Q_DECLARE_METATYPE(gamestock::LibraryQueryWorker::Request)
Q_DECLARE_METATYPE(gamestock::LibraryQueryWorker::Response)
