/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Card individual do inventário: capa ou placeholder, plataforma, tipo e condição. */
import QtQuick
import QtQuick.Controls
import QtQuick.Effects
import GameStock

Item {
    id: card
    property var item: null
    signal clicked()

    width: 180
    /* CSS: capa de 160 px, bordas de 2 px e padding vertical de 12 px no rodapé. */
    height: 174 + metadataFlow.implicitHeight
    /* Recorta foto e gradiente nos cantos do card inteiro, como overflow: hidden. */
    layer.enabled: true
    layer.effect: MultiEffect { maskEnabled: true; maskSource: cardMask }
    Rectangle { id: cardMask; anchors.fill: parent; radius: 12; visible: false; layer.enabled: true }
    transform: Translate { y: hoverArea.containsMouse ? -2 : 0; Behavior on y { NumberAnimation { duration: 180 } } }

    /** Cores semânticas declaradas como `color` para permitir transparência nos badges. */
    readonly property color colorNew: "#00dbe7"
    readonly property color colorGreat: "#4ade80"
    readonly property color colorGood: "#fbbf24"
    readonly property color colorBad: "#f87171"
    readonly property color colorRepair: "#fb7185"

    /** Cor semântica da condição, tolerante a estados criados pelo usuário. */
    function conditionColor(name) {
        const lower = String(name || "").toLowerCase()
        if (lower === "novo") return card.colorNew
        if (lower === "ótimo" || lower === "otimo") return card.colorGreat
        if (lower === "bom") return card.colorGood
        if (lower === "ruim") return card.colorBad
        if (lower.indexOf("reparo") >= 0 || lower.indexOf("defeito") >= 0) return card.colorRepair
        return Theme.secondary
    }

    /** Fundo translúcido do badge segue a cor semântica com baixa opacidade. */
    function conditionBackground(name) {
        const color = card.conditionColor(name)
        return Qt.rgba(color.r, color.g, color.b, 0.15)
    }

    Rectangle {
        id: surface
        anchors.fill: parent
        radius: 12
        color: Theme.card
        border.width: 1
        border.color: hoverArea.containsMouse ? "#6b00dbe7" : Theme.border
        clip: true
        Behavior on border.color { ColorAnimation { duration: 180 } }
    }

    Item {
        id: cover
        objectName: "inventoryCardCover"
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.leftMargin: 1
        anchors.rightMargin: 1
        anchors.topMargin: 1
        height: 160
        clip: true

        Image {
            anchors.fill: parent
            source: card.item ? (card.item.coverUrl || "") : ""
            fillMode: Image.PreserveAspectCrop
            asynchronous: true
            cache: true
        }

        /* Placeholder com ícone Lucide e nome do tipo, como o renderer. */
        Rectangle {
            anchors.fill: parent
            visible: !card.item || !card.item.coverUrl
            color: "#1c1b1b"
            Column {
                anchors.centerIn: parent
                spacing: 6
                Image { anchors.horizontalCenter: parent.horizontalCenter; source: "qrc:/icons/cpu.svg"; sourceSize: Qt.size(28, 28) }
                UiText {
                    width: 130
                    text: card.item ? (card.item.item_type_name || "Hardware") : "Hardware"
                    color: Theme.muted
                    opacity: 0.7
                    font.pixelSize: Theme.inventoryCardMetaFontSize
                    lineHeightMode: Text.FixedHeight
                    lineHeight: 13
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.Wrap
                }
            }
        }

        /* Gradiente inferior protege a leitura do texto sobre a foto. */
        Rectangle {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            height: 80
            gradient: Gradient {
                GradientStop { position: 0.0; color: "transparent" }
                GradientStop { position: 1.0; color: "#bf000000" }
            }
        }

        Column {
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.margins: 8
            anchors.bottomMargin: 6
            spacing: 2
            UiText {
                objectName: "inventoryCardPlatform"
                width: parent.width
                visible: card.item && card.item.platform_name
                text: card.item ? (card.item.platform_name || "") : ""
                color: Theme.accent
                opacity: 0.85
                font.pixelSize: Theme.inventoryCardMetaFontSize
                lineHeightMode: Text.FixedHeight
                lineHeight: 14
                elide: Text.ElideRight
            }
            UiText {
                objectName: "inventoryCardTitle"
                width: parent.width
                text: card.item ? (card.item.name || "") : ""
                color: "#ffffff"
                font.pixelSize: Theme.inventoryCardTitleFontSize
                lineHeightMode: Text.FixedHeight
                lineHeight: 16
                textWeight: Font.DemiBold
                elide: Text.ElideRight
            }
        }
    }

    Flow {
        id: metadataFlow
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: cover.bottom
        anchors.leftMargin: 9
        anchors.rightMargin: 9
        anchors.topMargin: 6
        spacing: 6

        Rectangle {
            height: 16
            width: Math.min(90, typeLabel.implicitWidth + 10)
            visible: card.item && card.item.item_type_name
            radius: 4
            color: "#1c1b1b"
            UiText {
                id: typeLabel
                anchors.centerIn: parent
                width: Math.min(84, implicitWidth)
                text: card.item ? (card.item.item_type_name || "") : ""
                color: Theme.secondary
                font.pixelSize: Theme.inventoryCardMetaFontSize
                elide: Text.ElideRight
            }
        }

        Rectangle {
            height: 16
            width: conditionLabel.implicitWidth + 10
            visible: card.item && card.item.conservation_state_name
            radius: 4
            color: card.item ? card.conditionBackground(card.item.conservation_state_name) : "transparent"
            UiText {
                id: conditionLabel
                anchors.centerIn: parent
                text: card.item ? (card.item.conservation_state_name || "") : ""
                color: card.item ? card.conditionColor(card.item.conservation_state_name) : Theme.secondary
                font.pixelSize: Theme.inventoryCardMetaFontSize
                textWeight: Font.DemiBold
            }
        }
    }

    Rectangle { anchors.fill: parent; radius: 12; color: "transparent"; border.color: hoverArea.containsMouse ? "#6b00dbe7" : Theme.border }

    MouseArea {
        id: hoverArea
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: card.clicked()
    }
}
