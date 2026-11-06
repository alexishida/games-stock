/* Progresso de metadados na própria tela, no lugar de um card flutuante de notificação. */
import QtQuick
import QtQuick.Layouts
import GameStock
import "."

Rectangle {
    id: status
    /* O formulário e o importador compartilham o mesmo retrato do JobManager. */
    property var jobManager: null
    property var job: null
    readonly property var progress: job && job.progress ? job.progress : ({})
    readonly property bool failed: job !== null && job.status === "failed"
    readonly property real total: Number(progress.total || 0)
    readonly property real current: Number(progress.current || 0)
    readonly property int percent: total > 0 ? Math.max(0, Math.min(100, Math.round(current / total * 100))) : 0
    readonly property bool visibleJob: job !== null
    readonly property string statusText: {
        if (!job) return ""
        if (job.status === "failed") return job.error && job.error.length ? job.error : "Falha na operação de metadados"
        if (job.status === "completed") return "Concluído"
        const message = progress.message && progress.message.length ? progress.message : job.title
        const amount = total > 0 ? current + " de " + total : ""
        const filename = progress.filename && progress.filename.length ? progress.filename : ""
        const details = [amount, filename].filter(function(value) { return value.length > 0 }).join(" · ")
        return details.length > 0 ? message + " · " + details : message
    }

    visible: visibleJob
    implicitHeight: visible ? body.implicitHeight + 20 : 0
    radius: 8
    color: failed ? "#12ff6b6b" : "#0a00f2ff"
    border.color: failed ? "#66ffb4ab" : Theme.border

    /** Guarda apenas o job de metadados mais recente ainda em execução. */
    function refresh() {
        if (!jobManager || typeof jobManager.jobs !== "function") {
            job = null
            return
        }
        const jobs = jobManager.jobs()
        job = null
        for (let index = 0; index < jobs.length; ++index) {
            const candidate = jobs[index]
            if (candidate.kind !== "metadata-open" && candidate.kind !== "metadata-search"
                && candidate.kind !== "metadata-import") continue
            if (candidate.status !== "running") continue
            job = candidate
            break
        }
    }

    Component.onCompleted: refresh()
    onJobManagerChanged: refresh()

    Connections {
        target: status.jobManager
        ignoreUnknownSignals: true
        function onChanged() { status.refresh() }
    }

    ColumnLayout {
        id: body
        anchors.fill: parent
        anchors.margins: 10
        spacing: 5
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            UiText {
                objectName: "metadataJobTitle"
                text: status.job ? String(status.job.title || "") : ""
                color: status.failed ? "#ffb4ab" : Theme.text
                font.pixelSize: 12
                textWeight: Font.DemiBold
                elide: Text.ElideRight
                Layout.fillWidth: true
            }
            UiText {
                visible: status.total > 0
                text: status.percent + "%"
                color: Theme.secondary
                font.pixelSize: 12
                textWeight: Font.Bold
            }
        }
        Rectangle {
            Layout.fillWidth: true
            implicitHeight: 4
            radius: 3
            color: Theme.control
            Rectangle {
                width: parent.width * (status.total > 0 ? status.percent / 100 : 0.15)
                height: parent.height
                radius: 3
                color: status.failed ? "#ffb4ab" : Theme.accent
            }
        }
        UiText {
            objectName: "metadataJobStatus"
            text: status.statusText
            color: status.failed ? "#ffb4ab" : Theme.muted
            font.pixelSize: 11
            elide: Text.ElideMiddle
            Layout.fillWidth: true
        }
    }
}
