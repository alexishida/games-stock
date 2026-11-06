/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Centro de notificações de jobs em background; fonte única é o JobManager. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

Item {
    id: root
    objectName: "notificationCenter"
    required property var jobManager
    required property var romFolderService
    property int cardWidth: 360
    visible: jobList.count > 0
    width: cardWidth
    height: Math.min(parent ? parent.height - 120 : 600, jobList.contentHeight)
    /* Metadados interativos mostram o progresso no formulário/importador, não como card. */
    readonly property var transientKinds: ["metadata-open", "metadata-search", "metadata-import"]
    function isTransient(kind) {
        return transientKinds.indexOf(String(kind)) >= 0
    }

    /** Texto principal do card, priorizando o resumo persistido. */
    function titleFor(jobId, fallback) {
        const stored = root.jobManager ? root.jobManager.job(jobId) : null
        const job = stored && stored.status ? stored : fallback
        if (!job) return ""
        if (job.status === "failed") return job.error && job.error.length ? job.error : "Job falhou"
        if (job.status === "interrupted") return "Importação interrompida"
        if (job.status === "completed" && job.result && job.result.summary) {
            const summary = job.result.summary
            if (job.kind === "rom-folder-import")
                return summary.created + " criados, " + summary.updated + " atualizados"
            return "Concluído"
        }
        return job.progressMessage && job.progressMessage.length ? job.progressMessage : job.title
    }

    /** Percentual estável mesmo antes de o total ser conhecido. */
    function percentFor(job) {
        if (job.status === "completed") return 100
        const total = job.progressTotal > 0 ? job.progressTotal : 1
        return Math.max(0, Math.min(100, Math.round(job.progressCurrent / total * 100)))
    }

    /** Etapa legível do importador de ROMs e do catálogo. */
    function stageLabel(stage) {
        return {
            preparing_metadata: "preparando dados",
            indexing: "construindo índice",
            loading_index: "carregando índice",
            extracting: "extraindo catálogo",
            matching: "fazendo match",
            downloading: "baixando",
            skipped: "pulando",
            saving: "salvando",
            done: "concluído",
            error: "erro"
        }[stage] || ""
    }

    /** Retoma um job de ROM interrompido com os mesmos parâmetros persistidos. */
    function resume(jobId) {
        if (!root.jobManager || !root.romFolderService) return
        const job = root.jobManager.job(jobId)
        if (!job || !job.folderPaths) return
        const next = root.romFolderService.startImport({
            folderPaths: job.folderPaths,
            romFilePaths: job.romFilePaths,
            platformId: job.platformId,
            detectionMode: job.detectionMode,
            includeSubfolders: job.includeSubfolders === true
        })
        if (next && next.jobId) root.jobManager.dismiss(jobId)
    }

    ListView {
        id: jobList
        objectName: "jobNotificationList"
        anchors.fill: parent
        spacing: 10
        clip: true
        /* Roda do mouse um pouco mais rápida que o padrão do Qt. */
        WheelScrollSpeed {}
        model: root.jobManager ? root.jobManager.model : null
        delegate: Rectangle {
            id: cardRoot
            objectName: "notificationCard" + jobId
            required property string jobId
            required property string kind
            required property string status
            required property string title
            required property string error
            required property int progressCurrent
            required property int progressTotal
            required property string progressMessage
            required property string progressStage
            required property string progressFilename
            required property string progressFolderPath
            property var result: ({})
            readonly property var jobData: ({
                jobId: jobId, kind: kind, status: status, title: title, error: error,
                progressCurrent: progressCurrent, progressTotal: progressTotal,
                progressMessage: progressMessage, progressStage: progressStage,
                progressFilename: progressFilename, progressFolderPath: progressFolderPath,
                result: result
            })
            width: jobList.width
            /* Jobs interativos de metadados não geram card: o formulário já mostra o retorno. */
            visible: !root.isTransient(kind)
            height: visible ? card.implicitHeight + 24 : 0
            radius: 12
            color: Theme.glass
            border.color: status === "failed" ? "#66ffb4ab" : Theme.border
            border.width: 1

            Rectangle { width: 3; height: parent.height; radius: 2; color: cardRoot.status === "completed" ? "#22c55e" : cardRoot.status === "failed" ? "#ef4444" : cardRoot.status === "interrupted" ? Theme.warning : Theme.accent }
            ColumnLayout {
                id: card
                anchors.fill: parent
                anchors.margins: 12
                spacing: 6
                RowLayout {
                    Layout.fillWidth: true
                    spacing: 8
                    UiText {
                        text: root.titleFor(jobId, cardRoot.jobData)
                        color: Theme.text
                        font.pixelSize: 13
                        textWeight: Font.DemiBold
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                    }
                    ActionButton {
                        objectName: "dismissJob" + jobId
                        text: "×"
                        toolbar: true
                        visible: status !== "running"
                        onClicked: root.jobManager.dismiss(jobId)
                    }
                }
                UiText {
                    visible: progressFilename.length > 0 || progressFolderPath.length > 0
                    text: progressFilename.length > 0 ? progressFilename : progressFolderPath
                    color: Theme.secondary
                    font.pixelSize: 12
                    elide: Text.ElideMiddle
                    Layout.fillWidth: true
                }
                Rectangle {
                    Layout.fillWidth: true
                    height: 4
                    radius: 3
                    color: Theme.control
                    Rectangle {
                        width: parent.width * root.percentFor(cardRoot.jobData) / 100
                        height: parent.height
                        radius: 3
                        color: status === "failed" ? "#ffb4ab" : Theme.accent
                    }
                }
                RowLayout {
                    Layout.fillWidth: true
                    UiText {
                        text: {
                            if (status === "completed") return "Concluído"
                            if (status === "failed") return "Erro"
                            if (status === "interrupted") return "Interrompido"
                            const label = root.stageLabel(progressStage)
                            const amount = progressTotal > 0 ? (progressCurrent + " de " + progressTotal)
                                : (progressCurrent > 0 ? progressCurrent + " itens" : "")
                            if (amount.length > 0 && label.length > 0) return amount + " - " + label
                            return label.length > 0 ? label : amount
                        }
                        color: Theme.muted
                        font.pixelSize: 12
                        Layout.fillWidth: true
                    }
                    ActionButton {
                        objectName: "resumeJob" + jobId
                        text: "Continuar"
                        toolbar: true
                        visible: status === "interrupted" && kind === "rom-folder-import"
                        onClicked: root.resume(jobId)
                    }
                }
            }
        }
    }
}
