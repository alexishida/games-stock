/* Janela transitória de abertura: aparece antes de inicializar o banco e os serviços. */
import QtQuick
import GameStock
import "components"

Window {
    id: splash
    /* Dimensões e arte preservam a apresentação original da janela Electron. */
    width: 640
    height: 400
    visible: true
    title: "GameStock"
    flags: Qt.SplashScreen | Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint
    color: Theme.background
    property string buildLabel: ""
    /* Identificação local igual à faixa de versão/build da splash original. */
    property string buildNumber: "local"
    x: Screen.virtualX + (Screen.width - width) / 2
    y: Screen.virtualY + (Screen.height - height) / 2

    MouseArea {
        anchors.fill: parent
        onPressed: splash.startSystemMove()
    }
    StartupArtwork {
        anchors.fill: parent
        buildLabel: splash.buildLabel
        buildNumber: splash.buildNumber
    }
}
