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
    Component.onCompleted: if (logs.settingsService) logs.settingsService.refreshLogs()

    ColumnLayout {
        anchors.fill: parent
        spacing: 12
        ColumnLayout {
            Layout.fillWidth: true
            spacing: 2
            Text { text: "Aplicativo"; color: Theme.accent; font.pixelSize: 11; font.weight: Font.ExtraBold; font.letterSpacing: 0.8 }
            Text { text: "Logs"; color: Theme.text; font.pixelSize: 28; font.weight: Font.Bold }
            Text { text: "Logs do aplicativo"; color: Theme.accent; font.pixelSize: 22; font.weight: Font.Bold }
            Text {
                text: "Histórico local de eventos, avisos e erros. Mostra até 500 registros recentes."
                color: Theme.secondary
                font.pixelSize: 12
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            ActionButton { objectName: "refreshLogs"; text: "Atualizar"; iconName: "refresh-cw"; enabled: logs.settingsService !== null; onClicked: logs.settingsService.refreshLogs() }
            ActionButton { objectName: "openLogsFolder"; text: "Abrir pasta"; iconName: "folder-open"; enabled: logs.settingsService !== null; onClicked: logs.settingsService.openLogsFolder() }
            ActionButton { objectName: "clearLogs"; text: "Limpar logs"; iconName: "trash-2"; enabled: logs.settingsService !== null; onClicked: logs.settingsService.clearLogs() }
            Item { Layout.fillWidth: true }
        }
        Text {
            objectName: "logsError"
            visible: logs.settingsService && logs.settingsService.error.length > 0
            text: logs.settingsService ? logs.settingsService.error : ""
            color: "#ffb4ab"
            font.pixelSize: 12
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
            ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded; width: 6 }
            ColumnLayout {
                id: logColumn
                width: parent.width
                spacing: 6
                Text {
                    visible: !logs.settingsService || logs.settingsService.logEntries.length === 0
                    text: logs.settingsService ? "Nenhum registro disponível." : "Serviço de logs indisponível."
                    color: Theme.secondary
                    font.pixelSize: 12
                }
                Repeater {
                    model: logs.settingsService ? logs.settingsService.logEntries : []
                    delegate: Rectangle {
                        required property var modelData
                        Layout.fillWidth: true
                        implicitHeight: entryColumn.implicitHeight + 16
                        radius: 8
                        color: Theme.panel
                        border.color: Theme.border
                        ColumnLayout {
                            id: entryColumn
                            anchors.fill: parent
                            anchors.margins: 8
                            spacing: 4
                            RowLayout {
                                Layout.fillWidth: true
                                spacing: 8
                                Text { text: logs.formatTimestamp(modelData.timestamp); color: Theme.muted; font.pixelSize: 11 }
                                Text { text: modelData.source || "GameStock"; color: Theme.secondary; font.pixelSize: 11 }
                                Text { text: String(modelData.level || "info").toUpperCase(); color: logs.levelColor(modelData.level); font.pixelSize: 10; font.weight: Font.ExtraBold }
                                Item { Layout.fillWidth: true }
                            }
                            Text {
                                Layout.fillWidth: true
                                text: modelData.message || ""
                                color: Theme.text
                                font.pixelSize: 12
                                font.family: "Consolas"
                                wrapMode: Text.WrapAtWordBoundaryOrAnywhere
                            }
                        }
                    }
                }
            }
        }
    }
}
