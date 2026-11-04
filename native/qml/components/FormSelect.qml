/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Seletor compartilhado: reproduz o select escuro do Electron inclusive no menu aberto. */
import QtQuick
import QtQuick.Controls.Basic
import GameStock

ComboBox {
    id: control
    implicitHeight: Theme.controlHeight
    implicitWidth: Math.max(120, implicitContentWidth + leftPadding + rightPadding)
    leftPadding: 10
    rightPadding: 34
    topPadding: 0
    bottomPadding: 0
    font.family: Theme.fontFamily
    font.pixelSize: Theme.formControlFontSize
    font.weight: Font.Normal
    hoverEnabled: true
    opacity: enabled ? 1 : 0.55

    contentItem: UiText {
        text: control.displayText
        font: control.font
        color: Theme.text
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
    }
    /* A seta geométrica mantém 10×5 px sem depender do glifo disponível na fonte. */
    indicator: Canvas {
        x: control.width - width - 11
        y: (control.height - height) / 2
        width: 10
        height: 5
        onPaint: {
            const ctx = getContext("2d")
            ctx.reset()
            ctx.fillStyle = Theme.secondary
            ctx.beginPath()
            ctx.moveTo(0, 0)
            ctx.lineTo(10, 0)
            ctx.lineTo(5, 5)
            ctx.closePath()
            ctx.fill()
        }
    }
    background: Rectangle {
        radius: 6
        color: control.hovered ? Theme.controlHover : Theme.control
        border.color: control.activeFocus ? Theme.accent : control.hovered ? "#7000f2ff" : Theme.border
        /* O anel fica fora da caixa para preservar a altura e o alinhamento do campo. */
        Rectangle {
            anchors.fill: parent
            anchors.margins: -2
            radius: 8
            color: "transparent"
            border.width: 2
            border.color: "#2e00f2ff"
            visible: control.activeFocus
        }
    }
    delegate: ItemDelegate {
        required property int index
        width: control.width - 2
        implicitHeight: Theme.controlHeight
        text: control.textAt(index)
        font: control.font
        highlighted: control.highlightedIndex === index
        contentItem: UiText {
            text: parent.text
            font: control.font
            color: Theme.text
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
        }
        background: Rectangle {
            color: parent.highlighted ? Theme.accentSoft : Theme.panel
        }
    }
    popup: Popup {
        y: control.height + 4
        width: control.width
        padding: 1
        implicitHeight: Math.min(contentItem.implicitHeight + 2, 240)
        contentItem: ListView {
            clip: true
            implicitHeight: contentHeight
            model: control.popup.visible ? control.delegateModel : null
            currentIndex: control.highlightedIndex
            boundsBehavior: Flickable.StopAtBounds
            ScrollIndicator.vertical: ScrollIndicator { }
        }
        background: Rectangle {
            radius: 6
            color: Theme.panel
            border.color: Theme.borderStrong
        }
    }
}
