/* Checkbox compacto com o accent-color do Electron e interação nativa de teclado. */
import QtQuick
import QtQuick.Controls.Basic
import GameStock

CheckBox {
    id: control
    spacing: 8
    padding: 0
    /* Sem texto, Basic não inclui o indicador na largura; manter um alvo clicável de 14 px. */
    implicitWidth: Math.max(indicator.implicitWidth, implicitContentWidth + leftPadding + rightPadding)
    implicitHeight: Math.max(indicator.implicitHeight, implicitContentHeight + topPadding + bottomPadding)
    font.family: Theme.fontFamily
    font.pixelSize: 13
    indicator: Rectangle {
        implicitWidth: 14
        implicitHeight: 14
        x: control.leftPadding
        y: (control.height - height) / 2
        radius: 2
        color: control.checked ? Theme.accent : Theme.panel
        border.color: control.activeFocus ? Theme.accent : Theme.borderStrong
        Canvas {
            anchors.fill: parent
            visible: control.checked
            onPaint: {
                const ctx = getContext("2d")
                ctx.reset()
                ctx.strokeStyle = Theme.accentForeground
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(3, 7)
                ctx.lineTo(6, 10)
                ctx.lineTo(11, 4)
                ctx.stroke()
            }
        }
    }
    contentItem: UiText {
        text: control.text
        font: control.font
        color: Theme.text
        leftPadding: control.text.length ? control.indicator.width + control.spacing : 0
        verticalAlignment: Text.AlignVCenter
        wrapMode: Text.WordWrap
    }
}
