/** Modelo somente leitura; jobs são alterados apenas pelo JobManager. */
#include "JobListModel.h"

#include <QJsonObject>

namespace gamestock {
JobListModel::JobListModel(QObject* parent) : QAbstractListModel(parent) {}

int JobListModel::rowCount(const QModelIndex& parent) const {
    return parent.isValid() ? 0 : static_cast<int>(jobs_.size());
}

QVariant JobListModel::data(const QModelIndex& index, int role) const {
    if (!index.isValid() || index.row() < 0 || index.row() >= jobs_.size()) return {};
    const QJsonObject job = jobs_.at(index.row()).toObject();
    const QJsonObject progress = job.value(QStringLiteral("progress")).toObject();
    switch (role) {
    case JobIdRole: return job.value(QStringLiteral("jobId")).toString();
    case KindRole: return job.value(QStringLiteral("kind")).toString();
    case StatusRole: return job.value(QStringLiteral("status")).toString();
    case TitleRole: return job.value(QStringLiteral("title")).toString();
    case SubtitleRole: return job.value(QStringLiteral("subtitle")).toString();
    case DetailRole: return job.value(QStringLiteral("detail")).toString();
    case ProgressCurrentRole: return progress.value(QStringLiteral("current")).toDouble();
    case ProgressTotalRole: return progress.value(QStringLiteral("total")).toDouble();
    case ProgressMessageRole: return progress.value(QStringLiteral("message")).toString();
    case IndeterminateRole: return progress.value(QStringLiteral("indeterminate")).toBool();
    case ErrorRole: return job.value(QStringLiteral("error")).toString();
    case StartedAtRole: return job.value(QStringLiteral("startedAt")).toString();
    case ProgressStageRole: return progress.value(QStringLiteral("stage")).toString();
    case ProgressFilenameRole: return progress.value(QStringLiteral("filename")).toString();
    case ProgressFolderPathRole: return progress.value(QStringLiteral("folderPath")).toString();
    case ProgressImageFilenameRole: return progress.value(QStringLiteral("imageFilename")).toString();
    case ResultRole: return job.value(QStringLiteral("result")).toObject().toVariantMap();
    default: return {};
    }
}

QHash<int, QByteArray> JobListModel::roleNames() const {
    return {{JobIdRole, "jobId"}, {KindRole, "kind"}, {StatusRole, "status"},
        {TitleRole, "title"}, {SubtitleRole, "subtitle"}, {DetailRole, "detail"},
        {ProgressCurrentRole, "progressCurrent"}, {ProgressTotalRole, "progressTotal"},
        {ProgressMessageRole, "progressMessage"}, {IndeterminateRole, "indeterminate"},
        {ErrorRole, "error"}, {StartedAtRole, "startedAt"}, {ProgressStageRole, "progressStage"},
        {ProgressFilenameRole, "progressFilename"}, {ProgressFolderPathRole, "progressFolderPath"},
        {ProgressImageFilenameRole, "progressImageFilename"}, {ResultRole, "result"}};
}

void JobListModel::setJobs(const QJsonArray& jobs) {
    beginResetModel();
    jobs_ = jobs;
    endResetModel();
}
} // namespace gamestock
