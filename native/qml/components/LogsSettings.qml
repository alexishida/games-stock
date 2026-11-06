/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Hierarquia das introducoes segue SectionIntro.css do Electron. */
/* Aba Logs: histórico local com atualização, abertura da pasta e limpeza. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock

Item {
    id: logs
    objectName: "logsSettings"
    property var settingsService: null

    /** Formata o timestamp ISO em data/hora local curta. */
    function formatTimestamp(value) {
        const date = new Date(String(value))
        return isNaN(date.getTime()) ? String(value) : date.toLocaleString(Qt.locale("pt_BR"), "dd/MM/yyyy HH:mm:ss")
    }

    /** Cores por nível preservam a leitura rápida dos eventos. */
    function levelColor(level) {
        if (level === "critical" || level === "fatal") return "#fca5a5"
        if (level === "warning") return "#fbbf24"
        if (level === "debug") return Theme.muted
        return Theme.accent
    }

    onVisibleChanged: if (visible && logs.settingsService) logs.settingsService.refreshLogs()
    /* O log pode ser grande; a biblioteca não precisa lê-lo durante o boot. */
    Component.onCompleted: if (visible && logs.settingsService) logs.settingsService.refreshLogs()

    ColumnLayout {
        anchors.fill: parent
        anchors.topMargin: 12
        spacing: 12
        ColumnLayout {
            Layout.fillWidth: true
            spacing: 2
            UiText { text: "APLICATIVO"; color: Theme.accent; font.pixelSize: 12; textWeight: Font.ExtraBold; font.letterSpacing: 0.8 }
            UiText { text: "Logs"; color: Theme.text; font.pixelSize: 28; textWeight: Font.Black; Layout.bottomMargin: 24 }
            UiText { text: "Logs do aplicativo"; color: Theme.accent; font.pixelSize: 16; textWeight: Font.Black }
            UiText {
                text: "Histórico local de eventos, avisos e erros. Mostra até 500 registros recentes."
                color: Theme.secondary
                font.pixelSize: 13
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            Item { Layout.fillWidth: true }
            ActionButton { objectName: "refreshLogs"; text: "Atualizar"; iconName: "refresh-cw"; enabled: logs.settingsService !== null; onClicked: logs.settingsService.refreshLogs() }
            ActionButton { objectName: "openLogsFolder"; text: "Abrir pasta"; iconName: "folder-open"; enabled: logs.settingsService !== null; onClicked: logs.settingsService.openLogsFolder() }
            ActionButton { objectName: "clearLogs"; text: "Limpar logs"; iconName: "trash-2"; enabled: logs.settingsService !== null; onClicked: logs.settingsService.clearLogs() }
        }
        UiText {
            objectName: "logsError"
            visible: logs.settingsService && logs.settingsService.error.length > 0
            text: logs.settingsService ? logs.settingsService.error : ""
            color: "#ffb4ab"
            font.pixelSize: 13
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        Flickable {
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentWidth: width
            contentHeight: logColumn.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            /* Roda do mouse um pouco mais rápida que o padrão do Qt. */
            WheelScrollSpeed {}
            ScrollBar.vertical: CollectionScrollBar { policy: ScrollBar.AsNeeded; width: 6 }
            ColumnLayout {
                id: logColumn
                width: parent.width
                spacing: 6
                UiText {
                    visible: !logs.settingsService || logs.settingsService.logEntries.length === 0
                    text: logs.settingsService ? "Nenhum registro disponível." : "Serviço de logs indisponível."
                    color: Theme.secondary
                    font.pixelSize: 13
                }
                Repeater {
                    model: logs.settingsService ? logs.settingsService.logEntries : []
                    delegate: Rectangle {
                        required property var modelData
                        Layout.fillWidth: true
                        implicitHeight: entryColumn.implicitHeight + 16
                        radius: 6
                        color: "#191919"
                        Rectangle { width: 3; height: parent.height; radius: 2; color: logs.levelColor(modelData.level) }
                        border.color: Theme.border
                        ColumnLayout {
                            id: entryColumn
                            anchors.fill: parent
                            anchors.margins: 8
                            spacing: 4
                            RowLayout {
                                Layout.fillWidth: true
                                spacing: 8
                                UiText { text: logs.formatTimestamp(modelData.timestamp); color: Theme.muted; font.pixelSize: 12 }
                                UiText { text: modelData.source || "GameStock"; color: Theme.secondary; font.pixelSize: 12 }
                                UiText { text: String(modelData.level || "info").toUpperCase(); color: logs.levelColor(modelData.level); font.pixelSize: 12; textWeight: Font.ExtraBold }
                                Item { Layout.fillWidth: true }
                            }
                            UiText {
                                Layout.fillWidth: true
                                text: modelData.message || ""
                                color: Theme.text
                                font.pixelSize: 13
                                font.family: "Consolas"
                                textWeight: Font.Bold
                                wrapMode: Text.WrapAtWordBoundaryOrAnywhere
                            }
                        }
                    }
                }
            }
        }
    }
}
