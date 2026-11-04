/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Botão base com foco visível, estados e geometria compatíveis com o renderer. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock

Button {
    id: control
    property bool primary: false
    /* scan-button do Electron: ícone de 18 px, altura de 38 px e preenchimento sem borda. */
    property bool sidebarAction: false
    property int iconSize: sidebarAction ? 18 : 16
    /* O fechamento usa o botão vermelho de 26 px definido no renderer. */
    property bool closeButton: iconName === "x-danger" && text.length === 0
    property bool wrapLabel: false
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
    /* Icon-button e text-button têm caixas distintas no CSS, sem padding textual em ícones. */
    readonly property bool iconOnly: iconName.length > 0 && text.length === 0
    property bool formAction: false
    implicitHeight: sidebarAction ? 38 : closeButton ? 26 : toolbar || pagination ? 30 : iconOnly ? 26 : primary ? Theme.controlHeight : 31
    implicitWidth: closeButton ? 26 : toolbar || pagination ? 30 : iconOnly ? 26 : Math.max(formAction ? Theme.formActionMinWidth : 34, label.implicitWidth + (iconName ? iconSize + 6 : 0) + 22)
    hoverEnabled: true
    padding: closeButton || iconOnly ? 0 : 6
    leftPadding: closeButton || iconOnly ? 0 : toolbar || pagination ? 6 : 10
    rightPadding: leftPadding
    opacity: pagination && !enabled ? 0.3 : 1
    font.family: sidebarAction ? Theme.heavyFontFamily : Theme.fontFamily
    font.pixelSize: Theme.formControlFontSize
    font.weight: Font.Normal
    contentItem: Item {
        /* Centralizar o grupo evita que espaçadores consumam o espaço de ícones compactos. */
        RowLayout {
            anchors.centerIn: parent
            width: Math.min(implicitWidth, parent.width)
            spacing: 6
            Image {
                visible: control.iconName.length > 0
                /* As variantes locais preservam a cor ativa sem depender de shader. */
                source: control.iconName ? "qrc:/icons/" + control.iconName + (((control.toolbar && control.primary) || control.link) ? "-active" : ((control.sidebarAction || control.iconName === "settings") && control.primary ? "-dark" : "")) + ".svg" : ""
                sourceSize: Qt.size(control.iconSize, control.iconSize)
                Layout.alignment: Qt.AlignCenter
            }
            UiText {
                id: label
                visible: text.length > 0
                text: control.text
                font: control.font
                color: (control.successFill || control.warningFill) ? "#ffffff" : control.link ? Theme.accent : control.dangerOutline ? "#fecaca" : (control.primary ? Theme.accentForeground : Theme.text)
                Behavior on color { ColorAnimation { duration: 150 } }
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
                wrapMode: control.wrapLabel ? Text.WordWrap : Text.NoWrap
                elide: control.wrapLabel ? Text.ElideNone : Text.ElideRight
                Layout.fillWidth: control.wrapLabel
                Layout.maximumWidth: Math.max(0, control.availableWidth - (control.iconName ? control.iconSize + 6 : 0))
            }
        }
    }
    background: Rectangle {
        radius: 6
        color: control.closeButton ? (control.hovered ? "#94b91c1c" : "#617f1d1d") : control.link
            ? "transparent"
            : control.warningFill
            ? (control.hovered ? "#b45309" : "#e0713f12")
            : control.successFill
            ? (control.hovered ? "#15803d" : "#16a34a")
            : control.accentOutline || control.dangerOutline
            ? (control.dangerOutline ? (control.hovered ? "#80b91c1c" : "#407f1d1d") : Theme.accentSoft)
            : control.toolbar ? ((control.primary || control.hovered) ? Theme.accentSoft : "transparent") : (control.primary ? Theme.accent : (control.hovered ? Theme.controlHover : Theme.control))
        border.width: control.sidebarAction ? (control.activeFocus ? 1 : 0) : control.link ? 0 : (control.toolbar && !control.activeFocus && !control.accentOutline && !control.dangerOutline) ? 0 : 1
        border.color: control.closeButton ? (control.hovered ? "#ccf87171" : "#8cf87171") : control.activeFocus ? Theme.accent
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
