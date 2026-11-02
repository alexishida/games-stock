/** Preferências independentes do inventário, sem interferir na biblioteca. */
#pragma once

#include <QObject>
#include <QString>

namespace gamestock {
/**
 * Mantém busca, ordenação e visualização do inventário em memória, como o
 * store Electron. A biblioteca persiste seu próprio conjunto em `app_state`.
 */
class InventoryPreferences final : public QObject {
    Q_OBJECT
    Q_PROPERTY(QString viewMode READ viewMode WRITE setViewMode NOTIFY changed)
    Q_PROPERTY(QString search READ search WRITE setSearch NOTIFY changed)
    Q_PROPERTY(QString sortBy READ sortBy WRITE setSortBy NOTIFY changed)
public:
    explicit InventoryPreferences(QObject* parent = nullptr);

    QString viewMode() const { return viewMode_; }
    QString search() const { return search_; }
    QString sortBy() const { return sortBy_; }

public slots:
    void setViewMode(const QString& value);
    void setSearch(const QString& value);
    void setSortBy(const QString& value);

signals:
    void changed();

private:
    QString viewMode_ = QStringLiteral("grid");
    QString search_;
    QString sortBy_ = QStringLiteral("name");
};
} // namespace gamestock
