/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Hierarquia das introducoes segue SectionIntro.css do Electron. */
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
        spacing: 16
        SectionIntro {
            Layout.fillWidth: true
            title: "Contador de partidas"
            description: "Acompanhe quantas vezes seus jogos foram iniciados e limpe o histórico quando quiser."
            bottomGap: 0
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: 14
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: 80
                radius: 14
                color: "#08ffffff"
                border.color: Theme.border
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 8
                    UiText { text: "TOTAL ACUMULADO"; color: Theme.muted; font.pixelSize: 12; textWeight: Font.ExtraBold; font.letterSpacing: 0.6 }
                    UiText {
                        objectName: "totalLaunchesLabel"
                        text: history.serviceMode ? history.launchLabel(history.gameService.totalLaunches) : "Modo fixture"
                        color: Theme.text
                        font.pixelSize: 18
                        textWeight: Font.Bold
                    }
                }
            }
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: 80
                radius: 14
                color: "#08ffffff"
                border.color: Theme.border
                ColumnLayout {
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 8
                    UiText { text: "JOGOS ALCANÇADOS"; color: Theme.muted; font.pixelSize: 12; textWeight: Font.ExtraBold; font.letterSpacing: 0.6 }
                    UiText {
                        objectName: "playedGamesLabel"
                        text: history.serviceMode ? history.gameLabel(history.gameService.playedGames) : "Modo fixture"
                        color: Theme.text
                        font.pixelSize: 18
                        textWeight: Font.Bold
                    }
                }
            }
        }
        UiText {
            visible: history.serviceMode && history.gameService.error.length > 0
            text: history.gameService ? history.gameService.error : ""
            color: "#ffb4ab"
            font.pixelSize: 13
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: 10
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
