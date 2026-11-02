/** Modelo observável de jobs compartilhado entre telas e notificações. */
#pragma once

#include <QAbstractListModel>
#include <QJsonArray>

namespace gamestock {
/** Expõe o retrato do JobRegistry sem permitir mutação pelo QML. */
class JobListModel final : public QAbstractListModel {
    Q_OBJECT
public:
    enum Role {
        JobIdRole = Qt::UserRole + 1,
        KindRole,
        StatusRole,
        TitleRole,
        SubtitleRole,
        DetailRole,
        ProgressCurrentRole,
        ProgressTotalRole,
        ProgressMessageRole,
        IndeterminateRole,
        ErrorRole,
        StartedAtRole,
        ProgressStageRole,
        ProgressFilenameRole,
        ProgressFolderPathRole,
        ProgressImageFilenameRole,
        ResultRole,
    };

    explicit JobListModel(QObject* parent = nullptr);
    int rowCount(const QModelIndex& parent = {}) const override;
    QVariant data(const QModelIndex& index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;
    /** Substitui o retrato após restauração ou transição persistida. */
    void setJobs(const QJsonArray& jobs);

private:
    QJsonArray jobs_;
};
} // namespace gamestock
