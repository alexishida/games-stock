/* Barra de 6 px com trilho e polegar do CSS; aparece somente quando há conteúdo fora da área. */
import QtQuick
import QtQuick.Controls.Basic
import GameStock

ScrollBar {
    implicitWidth: 6
    implicitHeight: 6
    padding: 0
    policy: ScrollBar.AsNeeded
    visible: size < 1
    contentItem: Rectangle { implicitWidth: 6; implicitHeight: 6; radius: 4; color: Theme.elevated }
    background: Rectangle { color: Theme.background }
}
