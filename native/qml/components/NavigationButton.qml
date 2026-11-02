/* Item de navegação reutiliza ícones Lucide locais e destaca a seleção atual. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock

Button {
    id: control
    property string iconName: "library"
    property string counter: ""
    property bool selected: false
    property bool compact: false
    property bool treeItem: false
    implicitHeight: compact || treeItem ? 32 : 38
    hoverEnabled: true
    padding: 12
    leftPadding: compact ? 36 : treeItem ? 14 : 12
    contentItem: RowLayout {
        spacing: 8
        Image {
            visible: control.iconName.length > 0
            /* A seleção também colore o desenho, como no botão original. */
            source: control.iconName ? "qrc:/icons/" + control.iconName + (control.selected ? "-active" : "") + ".svg" : ""
            sourceSize: Qt.size(control.compact ? 15 : 18, control.compact ? 15 : 18)
            Layout.preferredWidth: control.compact ? 15 : 18
            Layout.preferredHeight: control.compact ? 15 : 18
        }
        Text {
            text: control.text
            color: control.selected ? Theme.accent : Theme.secondary
            Behavior on color { ColorAnimation { duration: 150 } }
            font.family: Theme.fontFamily
            font.pixelSize: control.compact ? 12 : 13
            font.weight: Font.Bold
            elide: Text.ElideRight
            Layout.fillWidth: true
        }
        Text {
            text: control.counter
            color: control.selected ? Theme.accent : Theme.secondary
            Behavior on color { ColorAnimation { duration: 150 } }
            font.pixelSize: 11
            font.weight: Font.Bold
            opacity: 0.7
        }
    }
    background: Rectangle {
        radius: 6
        color: control.selected ? Theme.accentSoft : (control.hovered ? Theme.controlHover : "transparent")
        Behavior on color { ColorAnimation { duration: 150 } }
        Rectangle {
            width: 2
            height: parent.height
            color: control.selected ? Theme.accent : "transparent"
            Behavior on color { ColorAnimation { duration: 150 } }
        }
    }
}
