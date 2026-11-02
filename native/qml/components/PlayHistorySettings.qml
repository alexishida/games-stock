/* Histórico agregado de partidas e limpeza manual dos contadores. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

Item {
    id: history
    objectName: "playHistorySettings"
    property var gameService: null
    property bool serviceMode: false

    signal resetRequested()

    function launchLabel(total) {
        return Number(total || 0) + (Number(total || 0) === 1 ? " partida jogada" : " partidas jogadas")
    }

    function gameLabel(total) {
        return Number(total || 0) + (Number(total || 0) === 1 ? " jogo com histórico" : " jogos com histórico")
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 14
        Text { text: "Contador de partidas"; color: Theme.accent; font.pixelSize: 22; font.weight: Font.Bold }
        Text { text: "Acompanhe quantas vezes seus jogos foram iniciados e limpe o histórico quando quiser."; color: Theme.secondary; font.pixelSize: 12; wrapMode: Text.WordWrap; Layout.fillWidth: true }
        RowLayout {
            Layout.fillWidth: true
            spacing: 12
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: 92
                radius: 12
                color: Theme.card
                border.color: Theme.border
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 4
                    Text { text: "TOTAL ACUMULADO"; color: Theme.muted; font.pixelSize: 11; font.weight: Font.ExtraBold; font.letterSpacing: 0.6 }
                    Text {
                        objectName: "totalLaunchesLabel"
                        text: history.serviceMode ? history.launchLabel(history.gameService.totalLaunches) : "Modo fixture"
                        color: Theme.text
                        font.pixelSize: 22
                        font.weight: Font.Bold
                    }
                }
            }
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: 92
                radius: 12
                color: Theme.card
                border.color: Theme.border
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 4
                    Text { text: "JOGOS ALCANÇADOS"; color: Theme.muted; font.pixelSize: 11; font.weight: Font.ExtraBold; font.letterSpacing: 0.6 }
                    Text {
                        objectName: "playedGamesLabel"
                        text: history.serviceMode ? history.gameLabel(history.gameService.playedGames) : "Modo fixture"
                        color: Theme.text
                        font.pixelSize: 22
                        font.weight: Font.Bold
                    }
                }
            }
        }
        Text {
            visible: history.serviceMode && history.gameService.error.length > 0
            text: history.gameService ? history.gameService.error : ""
            color: "#ffb4ab"
            font.pixelSize: 12
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            Item { Layout.fillWidth: true }
            ActionButton {
                objectName: "refreshLaunchStats"
                text: "Atualizar"
                iconName: "refresh-cw"
                enabled: history.serviceMode
                onClicked: history.gameService.refresh()
            }
            ActionButton {
                objectName: "resetLaunchStats"
                text: "Resetar contador"
                iconName: "rotate-ccw-danger"
                dangerOutline: true
                enabled: history.serviceMode
                onClicked: history.resetRequested()
            }
        }
        Item { Layout.fillHeight: true }
    }
}
