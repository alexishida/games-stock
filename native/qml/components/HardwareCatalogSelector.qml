/* Seletor de tipo/estado com criação inline, como os seletores do formulário Electron. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock

ColumnLayout {
    id: selector
    objectName: selector.mode === "type" ? "hardwareTypeSelector" : "hardwareStateSelector"
    property var service: null
    /* `type` usa item_types; `state` usa conservation_states. */
    property string mode: "type"
    property string label: ""
    property int currentValue: 0
    signal picked(int id)

    spacing: 4

    readonly property var options: {
        if (!selector.service) return []
        return selector.mode === "type" ? selector.service.types : selector.service.states
    }
    readonly property string kindLabel: selector.mode === "type" ? "tipo" : "estado"

    Text { text: selector.label.toUpperCase(); color: Theme.muted; font.pixelSize: 10; font.weight: Font.ExtraBold; font.letterSpacing: 0.6 }

    ColumnLayout {
        Layout.fillWidth: true
        spacing: 6
        ComboBox {
            id: combo
            objectName: selector.mode === "type" ? "hardwareItemTypeCombo" : "hardwareItemStateCombo"
            Layout.fillWidth: true
            implicitHeight: Theme.controlHeight
            font.pixelSize: Theme.formControlFontSize
            leftPadding: 8
            rightPadding: 26
            model: {
                const values = ["Selecione um " + selector.kindLabel + "..."]
                for (let index = 0; index < selector.options.length; index++) values.push(selector.options[index].name)
                return values
            }
            currentIndex: {
                for (let index = 0; index < selector.options.length; index++) {
                    if (Number(selector.options[index].id) === Number(selector.currentValue)) return index + 1
                }
                return 0
            }
            onActivated: {
                const pickedId = currentIndex <= 0 ? 0 : Number(selector.options[currentIndex - 1].id)
                selector.currentValue = pickedId
                selector.picked(pickedId)
            }
            background: Rectangle {
                radius: 6
                color: combo.hovered ? Theme.controlHover : Theme.control
                border.color: combo.activeFocus ? Theme.accent : Theme.border
            }
            contentItem: Text {
                text: combo.displayText
                font: combo.font
                color: Theme.text
                verticalAlignment: Text.AlignVCenter
                elide: Text.ElideRight
            }
            indicator: Text {
                x: combo.width - width - 10
                y: (combo.height - height) / 2
                text: "▾"
                color: Theme.secondary
                font.pixelSize: 12
            }
        }
        ActionButton {
            objectName: selector.mode === "type" ? "newItemType" : "newConservationState"
            text: "Novo " + selector.kindLabel
            iconName: "plus"
            Layout.alignment: Qt.AlignLeft
            onClicked: {
                newName.text = ""
                createError.text = ""
                inline.visible = !inline.visible
                if (inline.visible) newName.forceActiveFocus()
            }
        }
    }

    RowLayout {
        id: inline
        visible: false
        Layout.fillWidth: true
        spacing: 6
        FormField {
            id: newName
            objectName: selector.mode === "type" ? "newItemTypeName" : "newConservationStateName"
            Layout.fillWidth: true
            placeholderText: "Nome do novo " + selector.kindLabel
            onAccepted: selector.createInline()
            Keys.onEscapePressed: inline.visible = false
        }
        ActionButton {
            objectName: selector.mode === "type" ? "createItemType" : "createConservationState"
            text: "Criar"
            primary: true
            enabled: newName.text.trim().length > 0
            onClicked: selector.createInline()
        }
        ActionButton {
            text: "Cancelar"
            onClicked: inline.visible = false
        }
    }

    Text {
        id: createError
        visible: text.length > 0
        color: "#ffb4ab"
        font.pixelSize: 11
        wrapMode: Text.WordWrap
        Layout.fillWidth: true
    }

    /** Abre a linha de criação inline sem depender do clique no botão. */
    function showInline() {
        inline.visible = true
        newName.forceActiveFocus()
    }

    /** Cria o valor no serviço e seleciona o registro devolvido. */
    function createInline() {
        if (!selector.service) return
        createError.text = ""
        const created = selector.mode === "type"
            ? selector.service.createType(newName.text.trim())
            : selector.service.createState(newName.text.trim())
        if (!created || !created.id) {
            createError.text = selector.service.error || "Não foi possível criar."
            return
        }
        inline.visible = false
        selector.currentValue = Number(created.id)
        selector.picked(Number(created.id))
    }
}
