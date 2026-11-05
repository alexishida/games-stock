/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Linha tabular do inventário; o cabeçalho usa a mesma grade de colunas. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock

Item {
    id: line
    property var item: null
    property bool header: false
    property bool selected: false
    signal clicked()

    /** Em larguras menores o CSS oculta cor, valor e aquisição. */
    readonly property bool compact: width < 900

    /** Valor em reais no formato do renderer; vazio vira traço. */
    function formatValue(value) {
        if (value === null || value === undefined || value === "") return "-"
        return "R$ " + Qt.locale("pt_BR").toString(Number(value), "f", 2)
    }

    /** Data ISO simples convertida sem deslocamento de fuso. */
    function formatDate(value) {
        if (!value) return "-"
        const parts = String(value).split("-")
        return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : String(value)
    }

    /** Texto de célula opcional com o traço padrão da lista. */
    function textOrDash(value) {
        return value !== null && value !== undefined && String(value).trim().length > 0 ? String(value) : "-"
    }

    /** Cores semânticas declaradas como `color` para permitir transparência nos badges. */
    readonly property color colorNew: "#00dbe7"
    readonly property color colorGreat: "#4ade80"
    readonly property color colorGood: "#fbbf24"
    readonly property color colorBad: "#f87171"
    readonly property color colorRepair: "#fb7185"

    /** Cor semântica da condição, igual aos cards. */
    function conditionColor(name) {
        const lower = String(name || "").toLowerCase()
        if (lower === "novo") return line.colorNew
        if (lower === "ótimo" || lower === "otimo") return line.colorGreat
        if (lower === "bom") return line.colorGood
        if (lower === "ruim") return line.colorBad
        if (lower.indexOf("reparo") >= 0 || lower.indexOf("defeito") >= 0) return line.colorRepair
        return Theme.secondary
    }

    height: line.header ? 32 : 54
    Rectangle {
        anchors.fill: parent
        radius: line.header ? 0 : 6
        color: line.header || !line.selected && !rowArea.containsMouse ? "transparent" : Theme.accentSoft
    }

    RowLayout {
        anchors.fill: parent
        anchors.leftMargin: 10
        anchors.rightMargin: 10
        spacing: 10

        Item {
            Layout.preferredWidth: 52
            Layout.fillHeight: true
            Image {
                anchors.centerIn: parent
                visible: false
                source: "qrc:/icons/cpu.svg"
                sourceSize: Qt.size(16, 16)
            }
            Rectangle {
                visible: !line.header
                anchors.centerIn: parent
                width: 38
                height: 42
                radius: 5
                color: Theme.panel
                clip: true
                Image {
                    anchors.fill: parent
                    visible: line.item && line.item.coverUrl
                    source: line.item ? (line.item.coverUrl || "") : ""
                    fillMode: Image.PreserveAspectCrop
                }
                Image {
                    anchors.centerIn: parent
                    visible: !line.item || !line.item.coverUrl
                    source: "qrc:/icons/cpu-active.svg"
                    sourceSize: Qt.size(20, 20)
                }
            }
        }

        UiText {
            Layout.fillWidth: true
            Layout.minimumWidth: 160
            text: line.header ? "Nome" : line.textOrDash(line.item ? line.item.name : "")
            color: line.header ? Theme.secondary : Theme.text
            font.pixelSize: line.header ? 12 : 13
            textWeight: line.header ? Font.ExtraBold : Font.Bold
            elide: Text.ElideRight
        }
        UiText {
            Layout.preferredWidth: 110
            text: line.header ? "Plataforma" : line.textOrDash(line.item ? line.item.platform_name : "")
            color: Theme.secondary
            font.pixelSize: line.header ? 12 : 13
            textWeight: line.header ? Font.ExtraBold : Font.Normal
            elide: Text.ElideRight
        }
        UiText {
            Layout.preferredWidth: 96
            text: line.header ? "Tipo" : line.textOrDash(line.item ? line.item.item_type_name : "")
            color: Theme.secondary
            font.pixelSize: line.header ? 12 : 13
            textWeight: line.header ? Font.ExtraBold : Font.Normal
            elide: Text.ElideRight
        }
        Item {
            Layout.preferredWidth: 88
            Layout.fillHeight: true
            UiText {
                visible: line.header || !line.item || !line.item.conservation_state_name
                anchors.verticalCenter: parent.verticalCenter
                width: parent.width
                text: line.header ? "Estado" : "-"
                color: Theme.secondary
                font.pixelSize: line.header ? 12 : 13
                textWeight: line.header ? Font.ExtraBold : Font.Normal
            }
            Rectangle {
                visible: !line.header && line.item && line.item.conservation_state_name
                anchors.verticalCenter: parent.verticalCenter
                height: 18
                width: Math.min(parent.width, stateLabel.implicitWidth + 12)
                radius: 4
                color: line.item ? Qt.rgba(line.conditionColor(line.item.conservation_state_name).r,
                    line.conditionColor(line.item.conservation_state_name).g,
                    line.conditionColor(line.item.conservation_state_name).b, 0.15) : "transparent"
                UiText {
                    id: stateLabel
                    anchors.centerIn: parent
                    width: Math.min(parent.width - 12, implicitWidth)
                    text: line.item ? (line.item.conservation_state_name || "") : ""
                    color: line.item ? line.conditionColor(line.item.conservation_state_name) : Theme.secondary
                    font.pixelSize: 12
                    textWeight: Font.ExtraBold
                    elide: Text.ElideRight
                }
            }
        }
        UiText {
            visible: !line.compact
            Layout.preferredWidth: 72
            text: line.header ? "Cor" : line.textOrDash(line.item ? line.item.color : "")
            color: Theme.secondary
            font.pixelSize: line.header ? 12 : 13
            textWeight: line.header ? Font.ExtraBold : Font.Normal
            elide: Text.ElideRight
        }
        UiText {
            Layout.fillWidth: !line.compact
            Layout.preferredWidth: 110
            text: line.header ? "Local" : line.textOrDash(line.item ? line.item.storage_location : "")
            color: Theme.secondary
            font.pixelSize: line.header ? 12 : 13
            textWeight: line.header ? Font.ExtraBold : Font.Normal
            elide: Text.ElideRight
        }
        UiText {
            visible: !line.compact
            Layout.preferredWidth: 84
            text: line.header ? "Valor" : line.formatValue(line.item ? line.item.value : null)
            color: Theme.secondary
            font.pixelSize: line.header ? 12 : 13
            textWeight: line.header ? Font.ExtraBold : Font.Normal
            horizontalAlignment: Text.AlignRight
        }
        UiText {
            visible: !line.compact
            Layout.preferredWidth: 92
            text: line.header ? "Aquisição" : line.formatDate(line.item ? line.item.acquisition_date : null)
            color: Theme.secondary
            font.pixelSize: line.header ? 12 : 13
            textWeight: line.header ? Font.ExtraBold : Font.Normal
            horizontalAlignment: Text.AlignRight
        }
    }

    MouseArea {
        id: rowArea
        anchors.fill: parent
        enabled: !line.header
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: line.clicked()
    }
}
