/* Botão base com foco visível, estados e geometria compatíveis com o renderer. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock

Button {
    id: control
    property bool primary: false
    property string iconName: ""
    /* A barra de coleção usa botões compactos e fundo discreto próprios. */
    property bool toolbar: false
    property bool pagination: false
    /* Variantes apenas com contorno, usadas pelos modais do detalhe. */
    property bool accentOutline: false
    property bool dangerOutline: false
    /* O botão Jogar usa o verde semântico do detalhe, não o ciano de ação. */
    property bool successFill: false
    /* Link textual sem moldura, usado nas ações de versão do jogo. */
    property bool link: false
    /* Favorito ativo usa o dourado do renderer. */
    property bool warningFill: false
    implicitHeight: toolbar || pagination ? 30 : Theme.controlHeight
    /* Reserva a margem interna e evita cortar rótulos curtos após o layout. */
    implicitWidth: toolbar || pagination ? 30 : Math.max(34, label.implicitWidth + (iconName ? 20 : 0) + 32)
    hoverEnabled: true
    padding: toolbar || pagination ? 6 : 12
    opacity: pagination && !enabled ? 0.3 : 1
    font.family: Theme.fontFamily
    font.pixelSize: Theme.formControlFontSize
    contentItem: RowLayout {
        spacing: 4
        /* Os espaçadores centralizam ícone e rótulo como um único grupo. */
        Item { Layout.fillWidth: true }
        Image {
            visible: control.iconName.length > 0
            /* As variantes locais preservam a cor ativa sem depender de shader. */
            source: control.iconName ? "qrc:/icons/" + control.iconName + (((control.toolbar && control.primary) || control.accentOutline || control.link) ? "-active" : (control.iconName === "settings" && control.primary ? "-dark" : "")) + ".svg" : ""
            sourceSize: Qt.size(16, 16)
            Layout.alignment: Qt.AlignCenter
        }
        Text {
            id: label
            visible: text.length > 0
            text: control.text
            font: control.font
            color: (control.successFill || control.warningFill) ? "#ffffff" : (control.accentOutline || control.link) ? Theme.accent : control.dangerOutline ? Theme.danger : (control.primary ? Theme.accentForeground : Theme.text)
            Behavior on color { ColorAnimation { duration: 150 } }
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
            Layout.maximumWidth: Math.max(0, control.availableWidth - (control.iconName ? 20 : 0))
        }
        Item { Layout.fillWidth: true }
    }
    background: Rectangle {
        radius: 6
        color: control.link
            ? "transparent"
            : control.warningFill
            ? (control.hovered ? "#b45309" : "#eab308")
            : control.successFill
            ? (control.hovered ? "#15803d" : "#22c55e")
            : control.accentOutline || control.dangerOutline
            ? (control.hovered ? Theme.controlHover : "transparent")
            : control.toolbar ? ((control.primary || control.hovered) ? Theme.accentSoft : "transparent") : (control.primary ? Theme.accent : (control.hovered ? Theme.controlHover : Theme.control))
        border.width: control.link ? 0 : (control.toolbar && !control.activeFocus && !control.accentOutline && !control.dangerOutline) ? 0 : 1
        border.color: control.activeFocus ? Theme.accent
            : control.accentOutline ? Theme.accent
            : control.dangerOutline ? Theme.danger
            : control.warningFill ? "#eab308"
            : Theme.border
        opacity: control.enabled || control.pagination ? 1 : 0.45
        /* A referência anima fundo e borda em 150 ms. */
        Behavior on color { ColorAnimation { duration: 150 } }
        Behavior on border.color { ColorAnimation { duration: 150 } }
        Behavior on opacity { NumberAnimation { duration: 150 } }
    }
}
