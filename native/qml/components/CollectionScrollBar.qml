/* Barra de 6 px com trilho e polegar do CSS; aparece somente quando há conteúdo fora da área. */
import QtQuick
import QtQuick.Controls.Basic
import GameStock

ScrollBar {
    id: bar
    implicitWidth: 6
    implicitHeight: 6
    padding: 0
    policy: ScrollBar.AsNeeded
    visible: size < 1
    /* O polegar mantém contraste nas superfícies escuras e não desaparece em repouso. */
    active: true
    minimumSize: 0.08
    contentItem: Rectangle {
        implicitWidth: 6
        implicitHeight: 6
        radius: 4
        color: bar.pressed ? Theme.accentMuted : bar.hovered ? Theme.secondary : Theme.muted
    }
    background: Rectangle { color: Theme.background }
}
