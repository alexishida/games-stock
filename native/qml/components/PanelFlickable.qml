/* Lista com borda fixa no viewport; o contorno não se desloca junto com as linhas. */
import QtQuick
import QtQuick.Controls.Basic
import GameStock

Flickable {
    id: viewport
    clip: true
    /* O overflow:auto original exibe um trilho de 6 px e mantém rolagem por teclado/mouse. */
    ScrollBar.vertical: CollectionScrollBar {}
    /* Roda do mouse um pouco mais rápida que o padrão do Qt. */
    WheelScrollSpeed {}
    Rectangle {
        parent: viewport
        anchors.fill: parent
        z: -1
        color: "transparent"
        radius: 8
        border.color: Theme.border
    }
}
