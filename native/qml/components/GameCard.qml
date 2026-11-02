/* Card visual de fixture: capa, gradiente e metadados mantêm as medidas do CSS atual. */
import QtQuick
import QtQuick.Controls
import QtQuick.Effects
import GameStock

AbstractButton {
    id: card
    property string gameTitle: ""
    property string platformName: ""
    property url coverSource: ""
    property bool favorite: false
    /* Raio do desfoque da sombra em pixels; diagnóstico permite comparar com o CSS. */
    property int shadowBlurPixels: Theme.shadowElevatedBlurMax
    implicitWidth: 212
    implicitHeight: 260
    hoverEnabled: true
    /* O card sobe 2 px como no CSS, com transição de 180 ms. */
    transform: Translate {
        y: card.hovered ? -2 : 0
        Behavior on y { NumberAnimation { duration: 180; easing.type: Easing.OutCubic } }
    }
    background: Rectangle {
        radius: 16
        color: Theme.card
        border.color: card.activeFocus ? Theme.accent : (card.hovered ? "#6b00f2ff" : Theme.border)
        Behavior on border.color { ColorAnimation { duration: 180 } }
        /* Sombra elevada em repouso; no hover prevalece o brilho ciano da referência. */
        layer.enabled: true
        /* autoPaddingEnabled reserva a margem do desfoque sem recortar a sombra. */
        layer.effect: MultiEffect {
            shadowEnabled: true
            blurEnabled: true
            blur: 0
            /* MultiEffect normaliza o raio em blurMax; 30 px corresponde ao CSS. */
            blurMax: card.shadowBlurPixels
            shadowColor: card.hovered ? "#1f00f2ff" : Theme.shadowElevatedColor
            shadowBlur: 1.0
            shadowHorizontalOffset: 0
            shadowVerticalOffset: card.hovered ? 14 : Theme.shadowElevatedOffsetY
            autoPaddingEnabled: true
            Behavior on shadowColor { ColorAnimation { duration: 180 } }
            Behavior on shadowVerticalOffset { NumberAnimation { duration: 180 } }
        }
        Image {
            id: coverImage
            anchors.fill: parent
            source: card.coverSource
            fillMode: Image.PreserveAspectCrop
            visible: false
            layer.enabled: source.toString().length > 0
            asynchronous: true
        }
        /* O clip retangular do Qt não recorta a imagem nos cantos arredondados. */
        Rectangle { id: coverMask; anchors.fill: parent; radius: 16; visible: false; layer.enabled: coverImage.source.toString().length > 0 }
        MultiEffect { anchors.fill: parent; source: coverImage; maskSource: coverMask; maskEnabled: true; visible: coverImage.status === Image.Ready }
        Rectangle {
            anchors.fill: parent
            visible: card.coverSource.toString().length === 0
            radius: 16
            gradient: Gradient {
                GradientStop { position: 0; color: "#203a3c" }
                GradientStop { position: 1; color: Theme.panel }
            }
            /* O brilho radial estático reproduz a camada sobreposta ao gradiente da referência. */
            Canvas {
                anchors.fill: parent
                onWidthChanged: requestPaint()
                onHeightChanged: requestPaint()
                onPaint: {
                    const context = getContext("2d")
                    context.reset()
                    const cx = width * 0.5
                    const cy = height * 0.26
                    const radius = Math.sqrt(cx * cx + (height - cy) * (height - cy)) * 0.34
                    const glow = context.createRadialGradient(cx, cy, 0, cx, cy, radius)
                    glow.addColorStop(0, "rgba(0,242,255,0.18)")
                    glow.addColorStop(1, "rgba(0,242,255,0)")
                    context.fillStyle = glow
                    context.fillRect(0, 0, width, height)
                }
            }
            /* A referência destaca o ícone em um círculo translúcido sobre o placeholder. */
            Rectangle {
                anchors.centerIn: parent
                width: 40; height: 40; radius: 20
                color: "#14ffffff"
                Image { anchors.centerIn: parent; source: "qrc:/icons/gamepad-2-active.svg"; sourceSize: Qt.size(26, 26) }
            }
        }
        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            height: parent.height * 0.58
            gradient: Gradient {
                GradientStop { position: 0; color: "#00131313" }
                GradientStop { position: 0.46; color: "#bd131313" }
                GradientStop { position: 1; color: "#fa131313" }
            }
        }
        Column {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.margins: 16
            spacing: 4
            Text { text: card.platformName.toUpperCase(); color: Theme.accent; font.pixelSize: 9; font.weight: Font.Black; font.letterSpacing: 0.72; width: parent.width; elide: Text.ElideRight }
            Text { text: card.gameTitle; color: Theme.text; font.pixelSize: 14; font.weight: Font.Bold; width: parent.width; wrapMode: Text.WordWrap; maximumLineCount: 2; elide: Text.ElideRight }
        }
        Image {
            anchors.top: parent.top; anchors.right: parent.right; anchors.margins: 10
            source: "qrc:/icons/star-card.svg"; sourceSize: Qt.size(16, 16)
            visible: opacity > 0
            opacity: card.favorite && !card.hovered ? 1 : 0
            Behavior on opacity { NumberAnimation { duration: 160 } }
        }
        Rectangle { anchors.fill: parent; radius: 16; color: "transparent"; border.width: 1; border.color: card.activeFocus ? Theme.accent : "transparent" }
    }
}
