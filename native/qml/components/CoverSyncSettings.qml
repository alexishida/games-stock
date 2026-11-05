/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Hierarquia das introducoes segue SectionIntro.css do Electron. */
/* Seção "Mídia da biblioteca": estatísticas e sincronização LaunchBox. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

Item {
    id: root
    required property var mediaSyncService
    required property var gameService
    required property var jobManager
    property var metadataService: null
    property bool serviceMode: false
    property var stats: ({})
    property string errorText: ""
    property bool syncRunning: false
    property bool refreshAll: false

    /** Recarrega contadores a partir da conexão do serviço. */
    function refreshStats() {
        if (!serviceMode || !mediaSyncService) {
            stats = ({})
            return
        }
        stats = mediaSyncService.stats()
    }

    /** Inicia o job e mantém a UI informada pelo estado persistido. */
    function startSync() {
        if (!serviceMode || !mediaSyncService) return
        errorText = ""
        const job = mediaSyncService.startSync(refreshAll)
        if (!job || !job.jobId) {
            errorText = mediaSyncService.error
            return
        }
        syncRunning = true
    }

    /** Verifica se ainda existe job de mídia em execução. */
    function hasRunningSync() {
        if (!jobManager) return false
        const jobs = jobManager.jobs()
        for (let index = 0; index < jobs.length; ++index) {
            if (jobs[index].kind === "media-sync" && jobs[index].status === "running") return true
        }
        return false
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 12

        Rectangle {
            Layout.fillWidth: true
            implicitHeight: updatePanel.implicitHeight + 28
            radius: 8
            color: Theme.control
            border.color: Theme.border
            ColumnLayout {
                id: updatePanel
                anchors.fill: parent
                anchors.margins: 14
                spacing: 8
                UiText { text: "Atualizar dados"; color: Theme.text; font.pixelSize: 14; textWeight: Font.Bold }
                UiText {
                    objectName: "metadataDownloadedAt"
                    text: root.metadataService && root.metadataService.metadataReady ? "Metadados prontos no cache local" : "Metadados ainda não baixados"
                    color: Theme.secondary
                    font.pixelSize: 12
                }
                ActionButton {
                    objectName: "updateMetadataBase"
                    Layout.fillWidth: true
                    text: root.metadataService && root.metadataService.busy ? "Atualizando..." : "Atualizar"
                    iconName: "scroll-text"
                    accentOutline: true
                    enabled: root.metadataService !== null && !root.metadataService.busy
                    onClicked: root.metadataService.ensureMetadata()
                }
            }
        }

        SectionIntro {
                Layout.fillWidth: true
                Layout.topMargin: 12
                title: "Mídia da biblioteca"
                description: "Situação das capas principais e metadados baixados para os jogos da biblioteca."
                bottomGap: 0
            }

        GridLayout {
            columns: 3
            columnSpacing: 10
            Layout.fillWidth: true
            Repeater {
                model: [
                    {key: "downloaded", label: "Covers", icon: "image-active"},
                    {key: "missing", label: "Sem Covers", icon: "image"},
                    {key: "total", label: "Jogos", icon: "gamepad-2-active"}
                ]
                delegate: Rectangle {
                    required property var modelData
                    Layout.fillWidth: true
                    Layout.preferredWidth: 1
                    Layout.preferredHeight: 86
                    radius: 8
                    color: "#09ffffff"
                    border.color: Theme.border
                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: 12
                        spacing: 6
                        RowLayout {
                            spacing: 8
                            Image { source: "qrc:/icons/" + modelData.icon + ".svg"; sourceSize: Qt.size(18, 18) }
                            UiText { text: modelData.label; color: Theme.secondary; font.pixelSize: 13; textWeight: Font.ExtraBold }
                        }
                        UiText { text: root.stats && root.stats[modelData.key] !== undefined ? root.stats[modelData.key] : 0; color: Theme.text; font.pixelSize: 28; textWeight: Font.Bold; lineHeightMode: Text.FixedHeight; lineHeight: 28 }
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            implicitHeight: syncPanel.implicitHeight + 28
            radius: 8
            color: Theme.control
            border.color: Theme.border
            ColumnLayout {
                id: syncPanel
                anchors.fill: parent
                anchors.margins: 14
                spacing: 8
                UiText { text: "Sincronização de mídia"; color: Theme.text; font.pixelSize: 14; textWeight: Font.Bold }
                UiText {
                    text: "Completa somente dados e imagens que estão faltando."
                    color: Theme.secondary
                    font.pixelSize: 12
                }
                RowLayout {
                    Layout.fillWidth: true
                    spacing: 8
                    ActionButton {
                        objectName: "refreshAllCovers"
                        text: "Somente pendentes"
                        iconName: "download"
                        accentOutline: !root.refreshAll
                        onClicked: root.refreshAll = false
                    }
                    ActionButton {
                        objectName: "refreshAllCoversButton"
                        text: "Atualizar tudo"
                        iconName: "refresh-cw"
                        accentOutline: root.refreshAll
                        onClicked: root.refreshAll = true
                    }
                    Item { Layout.fillWidth: true }
                    ActionButton {
                        objectName: "syncCovers"
                        text: root.syncRunning ? "Sincronizando..." : "Sincronizar"
                        iconName: "play"
                        accentOutline: true
                        enabled: root.serviceMode && !root.syncRunning
                        onClicked: root.startSync()
                    }
                }
                UiText {
                    objectName: "mediaSyncError"
                    visible: root.errorText.length > 0
                    text: root.errorText
                    color: "#ffb4ab"
                    font.pixelSize: 13
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }
                UiText {
                    visible: root.syncRunning
                    text: "O progresso aparece no centro de notificações e continua ao fechar as configurações."
                    color: Theme.secondary
                    font.pixelSize: 12
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }
            }
        }
        Item { Layout.fillHeight: true }
    }

    Connections {
        target: root.jobManager
        function onChanged() {
            if (!root.syncRunning && !root.hasRunningSync()) return
            if (root.hasRunningSync()) {
                root.syncRunning = true
                return
            }
            // A transição para terminal atualiza contadores e a grade.
            root.syncRunning = false
            root.refreshStats()
            if (root.gameService) root.gameService.refresh()
        }
    }

    Component.onCompleted: refreshStats()
}
