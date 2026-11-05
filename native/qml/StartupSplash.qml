/* Janela transitória de abertura: aparece antes de inicializar o banco e os serviços. */
import QtQuick
import GameStock
import "components"

Window {
    id: splash
    width: 480
    height: 300
    visible: true
    title: "GameStock"
    flags: Qt.SplashScreen | Qt.FramelessWindowHint
    color: Theme.background
    property string buildLabel: ""
    x: Screen.virtualX + (Screen.width - width) / 2
    y: Screen.virtualY + (Screen.height - height) / 2

    SplashOverlay {
        starting: true
        buildLabel: splash.buildLabel
    }
}
