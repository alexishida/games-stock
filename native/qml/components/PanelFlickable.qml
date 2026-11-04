/* Lista com borda fixa no viewport; o contorno não se desloca junto com as linhas. */
import QtQuick
import GameStock

Flickable {
    id: viewport
    clip: true
    Rectangle {
        parent: viewport
        anchors.fill: parent
        z: -1
        color: "transparent"
        radius: 8
        border.color: Theme.border
    }
}
