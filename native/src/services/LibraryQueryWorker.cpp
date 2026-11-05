/** Implementação do worker de leitura da biblioteca. */
#include "LibraryQueryWorker.h"

namespace gamestock {
LibraryQueryWorker::LibraryQueryWorker(QString databasePath, QObject* parent)
    : QObject(parent), databasePath_(std::move(databasePath)) {}

bool LibraryQueryWorker::openConnection() {
    // A conexão nasce e morre nesta thread; o contrato do projeto proíbe migração implícita.
    connection_ = std::make_unique<ReadOnlyConnection>();
    QString error;
    if (connection_->open(databasePath_, &error)) return true;
    connection_.reset();
    return false;
}

void LibraryQueryWorker::closeConnection() {
    connection_.reset();
}

void LibraryQueryWorker::run(const Request& request) {
    Response response;
    response.generation = request.generation;
    if (!connection_) {
        response.error = QStringLiteral("Conexão de leitura indisponível.");
        emit finished(response);
        return;
    }
    GameReadDao dao(connection_->database());
    QString error;
    if (!dao.list(request.page, request.pageSize, &response.page, &error, request.filters)) {
        response.error = error;
        emit finished(response);
        return;
    }
    // Cada agregado só é consultado quando o serviço indicou que ele está desatualizado.
    if (request.wantSidebar) {
        if (!dao.sidebarCounts(request.filters, &response.sidebar, &error)) {
            response.error = error;
            emit finished(response);
            return;
        }
        response.hasSidebar = true;
    }
    if (request.wantGenres) {
        if (!dao.listGenres(&response.genres, &error)) {
            response.error = error;
            emit finished(response);
            return;
        }
        response.hasGenres = true;
    }
    if (request.wantLaunchStats) {
        if (!dao.launchStats(&response.launchStats, &error)) {
            response.error = error;
            emit finished(response);
            return;
        }
        response.hasLaunchStats = true;
    }
    if (request.wantCoverStats) {
        if (!dao.coverStats(&response.coverStats, &error)) {
            response.error = error;
            emit finished(response);
            return;
        }
        response.hasCoverStats = true;
    }
    response.ok = true;
    emit finished(response);
}
} // namespace gamestock
