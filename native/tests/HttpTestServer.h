/** Servidor HTTP mínimo para testes determinísticos de rede. */
#pragma once

#include <QByteArray>
#include <QHash>
#include <QHostAddress>
#include <QString>
#include <QTcpServer>
#include <QTcpSocket>
#include <QTimer>

class HttpTestServer {
public:
    HttpTestServer() {
        QObject::connect(&server_, &QTcpServer::newConnection, [this] {
            while (QTcpSocket* socket = server_.nextPendingConnection()) {
                buffers_.insert(socket, {});
                ++active_;
                maxConcurrent_ = qMax(maxConcurrent_, active_);
                QObject::connect(socket, &QTcpSocket::readyRead, socket, [this, socket] {
                    QByteArray& buffer = buffers_[socket];
                    buffer += socket->readAll();
                    if (!buffer.contains("\r\n\r\n") || socket->property("responded").toBool()) return;
                    socket->setProperty("responded", true);
                    const QByteArray requestLine = buffer.left(buffer.indexOf("\r\n"));
                    const QList<QByteArray> parts = requestLine.split(' ');
                    const QString path = parts.size() >= 2 ? QString::fromLatin1(parts.at(1)) : QString();
                    requests_[path] = requests_.value(path) + 1;
                    const auto route = routes_.constFind(path);
                    const QByteArray body = route == routes_.cend() ? QByteArray{} : route.value().body;
                    const int status = route == routes_.cend() ? 404 : route.value().status;
                    const int delay = route == routes_.cend() ? 0 : route.value().delayMs;
                    const QByteArray reason = status == 200 ? QByteArray("OK") : status == 500 ? QByteArray("Erro") : QByteArray("Not Found");
                    const QByteArray response = QByteArray("HTTP/1.1 ") + QByteArray::number(status) + " " + reason +
                        "\r\nContent-Type: application/octet-stream\r\nConnection: close\r\nContent-Length: " +
                        QByteArray::number(body.size()) + "\r\n\r\n" + body;
                    const auto send = [socket, response] {
                        if (socket->state() != QAbstractSocket::ConnectedState) return;
                        socket->write(response);
                        socket->disconnectFromHost();
                    };
                    // O atraso mantém a conexão aberta para medir concorrência real no cliente.
                    if (delay > 0) QTimer::singleShot(delay, socket, send);
                    else send();
                });
                QObject::connect(socket, &QTcpSocket::disconnected, socket, [this, socket] {
                    buffers_.remove(socket);
                    active_ = qMax(0, active_ - 1);
                    socket->deleteLater();
                });
            }
        });
    }

    bool listen() { return server_.listen(QHostAddress::LocalHost, 0); }
    QString baseUrl() const { return QStringLiteral("http://127.0.0.1:%1").arg(server_.serverPort()); }
    /** Registra uma rota; `delayMs` simula latência e expõe conexões simultâneas. */
    void add(const QString& path, const QByteArray& body, int status = 200, int delayMs = 0) {
        routes_.insert(path, {body, status, delayMs});
    }
    int requests(const QString& path) const { return requests_.value(path); }
    /** Maior quantidade de conexões simultâneas observada desde a criação. */
    int maxConcurrent() const { return maxConcurrent_; }

private:
    struct Route {
        QByteArray body;
        int status = 200;
        int delayMs = 0;
    };
    QTcpServer server_;
    QHash<QString, Route> routes_;
    QHash<QTcpSocket*, QByteArray> buffers_;
    QHash<QString, int> requests_;
    int active_ = 0;
    int maxConcurrent_ = 0;
};
