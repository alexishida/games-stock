/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
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
    /* PlatformTree usa spans herdados de 13 px; filtros de inventário usam nav-item-count de 11 px. */
    property bool platformItem: false
    /* Configurações usa itens de 36 px, sem a barra de seleção da biblioteca. */
    property bool settingsItem: false
    /* A navega??o principal acende tamb?m no hover; a ?rvore mant?m seu fundo discreto. */
    readonly property bool navigationHighlighted: selected || (hovered && !treeItem && !settingsItem)
    /* Alturas efetivas do DOM: nav 38 px, subitem 32 px e árvore 31 px. */
    implicitHeight: settingsItem ? 36 : compact ? Theme.navigationCompactRowHeight : treeItem ? Theme.navigationTreeRowHeight : Theme.navigationRowHeight
    hoverEnabled: true
    padding: settingsItem ? 9 : 0
    leftPadding: settingsItem ? 10 : compact ? 38 : treeItem ? 16 : 14
    rightPadding: settingsItem ? 9 : treeItem ? 10 : 12
    contentItem: RowLayout {
        spacing: control.settingsItem ? 10 : control.treeItem ? 6 : 8
        Image {
            visible: control.iconName.length > 0
            /* A seleção também colore o desenho, como no botão original. */
            source: control.iconName ? "qrc:/icons/" + control.iconName + (control.navigationHighlighted ? "-active" : "") + ".svg" : ""
            sourceSize: Qt.size(control.compact ? 15 : 18, control.compact ? 15 : 18)
            Layout.preferredWidth: control.compact ? 15 : 18
            Layout.preferredHeight: control.compact ? 15 : 18
        }
        UiText {
            objectName: "navigationLabel"
            text: control.text
            color: control.navigationHighlighted ? Theme.accent : Theme.secondary
            Behavior on color { ColorAnimation { duration: 150 } }
            font.family: Theme.fontFamily
            font.pixelSize: control.settingsItem ? 13 : control.compact ? Theme.navigationCompactFontSize : Theme.navigationFontSize
            textWeight: control.settingsItem ? Font.Medium : Font.Bold
            elide: Text.ElideRight
            Layout.fillWidth: true
        }
        UiText {
            objectName: "navigationCounter"
            text: control.counter
            color: control.navigationHighlighted ? Theme.accent : Theme.secondary
            Behavior on color { ColorAnimation { duration: 150 } }
            font.pixelSize: control.platformItem ? Theme.navigationFontSize : control.settingsItem ? 11 : Theme.navigationCounterFontSize
            textWeight: Font.Bold
            opacity: control.platformItem ? 1 : 0.7
        }
    }
    background: Rectangle {
        radius: 6
        color: control.navigationHighlighted ? Theme.accentSoft : (control.hovered ? Theme.controlHover : "transparent")
        Behavior on color { ColorAnimation { duration: 150 } }
        Rectangle {
            width: 2
            height: parent.height
            color: control.navigationHighlighted && !control.settingsItem ? Theme.accent : "transparent"
            Behavior on color { ColorAnimation { duration: 150 } }
        }
    }
}
