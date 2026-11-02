/* Card individual do inventário: capa ou placeholder, plataforma, tipo e condição. */
import QtQuick
import QtQuick.Controls
import GameStock

Item {
    id: card
    property var item: null
    signal clicked()

    width: 180
    height: 192

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
        color: Theme.panel
        border.width: 1
        border.color: hoverArea.containsMouse ? "#6b00dbe7" : Theme.border
        clip: true
        Behavior on border.color { ColorAnimation { duration: 180 } }
    }

    Item {
        id: cover
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
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
                Text {
                    width: 130
                    text: card.item ? (card.item.item_type_name || "Hardware") : "Hardware"
                    color: Theme.muted
                    opacity: 0.7
                    font.pixelSize: 10
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
            spacing: 2
            Text {
                width: parent.width
                visible: card.item && card.item.platform_name
                text: card.item ? (card.item.platform_name || "") : ""
                color: Theme.accent
                opacity: 0.85
                font.pixelSize: 10
                elide: Text.ElideRight
            }
            Text {
                width: parent.width
                text: card.item ? (card.item.name || "") : ""
                color: "#ffffff"
                font.pixelSize: 12
                font.weight: Font.DemiBold
                elide: Text.ElideRight
            }
        }
    }

    Row {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: cover.bottom
        anchors.leftMargin: 8
        anchors.rightMargin: 8
        anchors.topMargin: 6
        spacing: 6

        Rectangle {
            height: 18
            width: Math.min(90, typeLabel.implicitWidth + 10)
            visible: card.item && card.item.item_type_name
            radius: 4
            color: "#1c1b1b"
            Text {
                id: typeLabel
                anchors.centerIn: parent
                width: Math.min(84, implicitWidth)
                text: card.item ? (card.item.item_type_name || "") : ""
                color: Theme.secondary
                font.pixelSize: 10
                elide: Text.ElideRight
            }
        }

        Rectangle {
            height: 18
            width: conditionLabel.implicitWidth + 10
            visible: card.item && card.item.conservation_state_name
            radius: 4
            color: card.item ? card.conditionBackground(card.item.conservation_state_name) : "transparent"
            Text {
                id: conditionLabel
                anchors.centerIn: parent
                text: card.item ? (card.item.conservation_state_name || "") : ""
                color: card.item ? card.conditionColor(card.item.conservation_state_name) : Theme.secondary
                font.pixelSize: 10
                font.weight: Font.DemiBold
            }
        }
    }

    MouseArea {
        id: hoverArea
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: card.clicked()
    }
}
