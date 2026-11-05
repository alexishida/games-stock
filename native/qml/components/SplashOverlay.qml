/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Splash condicional do updater: fases, progresso, arraste e modo offline. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock

Item {
    id: splash
    objectName: "updateSplash"
    property var updateService: null
    /* A abertura independe do updater, inclusive no canal portátil e sem rede. */
    property bool starting: false
    property string buildLabel: ""
    property real offsetX: 0
    property real offsetY: 0
    anchors.fill: parent
    z: 100
    visible: starting || (updateService !== null && updateService !== undefined && updateService.startupVisible)

    Rectangle { anchors.fill: parent; color: splash.starting ? Theme.background : Theme.scrim }
    /* A splash bloqueia a biblioteca enquanto a apresentação inicial está visível. */
    MouseArea { anchors.fill: parent; acceptedButtons: Qt.AllButtons; onWheel: function(wheel) { wheel.accepted = true } }

    Rectangle {
        id: card
        objectName: "updateSplashCard"
        width: Math.min(430, parent.width - 48)
        height: content.implicitHeight + 40
        radius: 16
        color: Theme.panel
        border.color: Theme.border
        x: Math.max(0, Math.min(parent.width - width, (parent.width - width) / 2 + splash.offsetX))
        y: Math.max(0, Math.min(parent.height - height, (parent.height - height) / 2 + splash.offsetY))

        DragHandler {
            target: null
            acceptedButtons: Qt.LeftButton
            grabPermissions: PointerHandler.TakeOverForbidden
            property real startX: 0
            property real startY: 0
            onActiveChanged: if (active) { startX = splash.offsetX; startY = splash.offsetY }
            onTranslationChanged: if (active) {
                splash.offsetX = startX + translation.x
                splash.offsetY = startY + translation.y
            }
        }

        ColumnLayout {
            id: content
            anchors.fill: parent
            anchors.margins: 20
            spacing: 10

            RowLayout {
                Layout.fillWidth: true
                spacing: 12
                Image {
                    Layout.preferredWidth: 96
                    Layout.preferredHeight: 52
                    source: "qrc:/qt/qml/GameStock/assets/logo.png"
                    fillMode: Image.PreserveAspectFit
                }
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 2
                    UiText { text: "GAMES MANAGEMENT"; color: Theme.muted; font.pixelSize: 12; textWeight: Font.ExtraBold; font.letterSpacing: 1.2 }
                    UiText { text: "GameStock"; color: Theme.text; font.pixelSize: 22; textWeight: Font.Black }
                    UiText { text: "v" + (splash.buildLabel || (splash.updateService ? splash.updateService.appVersion : "")); color: Theme.secondary; font.pixelSize: 12 }
                }
            }

            Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; color: Theme.border }

            UiText {
                objectName: "updateSplashMessage"
                Layout.fillWidth: true
                text: splash.starting ? "Iniciando GameStock…" : (splash.updateService ? splash.updateService.message : "")
                color: Theme.text
                font.pixelSize: 13
                wrapMode: Text.WordWrap
            }
            ProgressBar {
                Layout.fillWidth: true
                /* A verificação não informa percentual; o download usa a barra real abaixo. */
                visible: splash.starting || (splash.updateService && splash.updateService.phase === "checking")
                indeterminate: visible
                Accessible.name: splash.starting ? "Iniciando GameStock" : "Verificando atualizações"
                background: Rectangle { implicitHeight: 4; color: Theme.control; radius: 2 }
                palette.highlight: Theme.accent
            }
            UiText {
                objectName: "updateSplashDetail"
                Layout.fillWidth: true
                visible: splash.updateService && splash.updateService.error.length > 0
                text: splash.updateService ? splash.updateService.error : ""
                color: "#ffb4ab"
                font.pixelSize: 12
                wrapMode: Text.WrapAtWordBoundaryOrAnywhere
            }
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 8
                radius: 4
                color: Theme.control
                visible: splash.updateService && (splash.updateService.phase === "downloading" || splash.updateService.phase === "applying")
                Rectangle {
                    width: parent.width * (splash.updateService ? splash.updateService.percent : 0) / 100
                    height: parent.height
                    radius: 4
                    color: Theme.accent
                }
            }
            UiText {
                Layout.fillWidth: true
                visible: splash.updateService && splash.updateService.version.length > 0
                text: splash.updateService ? ("Disponível: v" + splash.updateService.version
                    + (splash.updateService.releaseDate.length > 0 ? " · " + splash.updateService.releaseDate : "")) : ""
                color: Theme.secondary
                font.pixelSize: 12
            }
            UiText {
                Layout.fillWidth: true
                visible: splash.updateService && splash.updateService.notes.length > 0
                text: splash.updateService ? splash.updateService.notes : ""
                color: Theme.muted
                font.pixelSize: 12
                wrapMode: Text.WordWrap
                maximumLineCount: 3
                elide: Text.ElideRight
            }
            RowLayout {
                Layout.fillWidth: true
                Item { Layout.fillWidth: true }
                ActionButton {
                    objectName: "continueOffline"
                    text: "Continuar offline"
                    visible: splash.updateService && splash.updateService.requiresAction
                    onClicked: if (splash.updateService) splash.updateService.skip()
                }
            }
        }
    }
}
