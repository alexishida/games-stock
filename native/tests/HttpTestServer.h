/** Servidor HTTP mínimo para testes determinísticos de rede. */
#pragma once

#include <QHash>
#include <QHostAddress>
#include <QPair>
#include <QTcpServer>
#include <QTcpSocket>
#include <QByteArray>
#include <QString>

class HttpTestServer {
public:
    HttpTestServer() {
        QObject::connect(&server_, &QTcpServer::newConnection, [this] {
            while (QTcpSocket* socket = server_.nextPendingConnection()) {
                buffers_.insert(socket, {});
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
                    const QByteArray body = route == routes_.cend() ? QByteArray{} : route.value().first;
                    const int status = route == routes_.cend() ? 404 : route.value().second;
                    const QByteArray reason = status == 200 ? QByteArray("OK") : status == 500 ? QByteArray("Erro") : QByteArray("Not Found");
                    QByteArray response = QByteArray("HTTP/1.1 ") + QByteArray::number(status) + " " + reason +
                        "\r\nContent-Type: application/octet-stream\r\nConnection: close\r\nContent-Length: " +
                        QByteArray::number(body.size()) + "\r\n\r\n" + body;
                    socket->write(response);
                    socket->disconnectFromHost();
                });
                QObject::connect(socket, &QTcpSocket::disconnected, socket, [this, socket] {
                    buffers_.remove(socket);
                    socket->deleteLater();
                });
            }
        });
    }

    bool listen() { return server_.listen(QHostAddress::LocalHost, 0); }
    QString baseUrl() const { return QStringLiteral("http://127.0.0.1:%1").arg(server_.serverPort()); }
    void add(const QString& path, const QByteArray& body, int status = 200) {
        routes_.insert(path, {body, status});
    }
    int requests(const QString& path) const { return requests_.value(path); }

private:
    QTcpServer server_;
    QHash<QString, QPair<QByteArray, int>> routes_;
    QHash<QTcpSocket*, QByteArray> buffers_;
    QHash<QString, int> requests_;
};
