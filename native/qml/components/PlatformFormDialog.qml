/* Criação e edição de plataforma, equivalente ao PlatformFormModal do Electron. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

DragDialog {
    id: form
    objectName: "platformFormDialog"
    property var platformService: null
    property var editingPlatform: null
    property string formError: ""
    readonly property bool editMode: !!editingPlatform
    readonly property var categories: ["Console", "Portatil", "PC"]

    signal saved(var platformId)

    width: Math.min(460, parent.width - 48)
    height: 320
    heading: editMode ? "Editar plataforma" : "Nova plataforma"
    onOpened: populate()
    onClosed: formError = ""

    function populate() {
        formError = ""
        nameField.text = editMode ? editingPlatform.name || "" : ""
        categoryBox.currentIndex = editMode ? Math.max(0, categories.indexOf(normalizeCategory(editingPlatform.category))) : 0
    }

    function normalizeCategory(value) {
        const normalized = String(value || "").toLowerCase()
        if (normalized === "pc") return "PC"
        if (normalized.indexOf("port") >= 0) return "Portatil"
        return "Console"
    }

    function save() {
        formError = ""
        if (!platformService) {
            formError = "Serviço de plataformas indisponível."
            return
        }
        const name = nameField.text.trim()
        if (!name.length) {
            formError = "Nome da plataforma é obrigatório"
            nameField.forceActiveFocus()
            return
        }
        if (editMode) {
            if (!platformService.update(Number(editingPlatform.id), name, categories[categoryBox.currentIndex])) {
                formError = platformService.error || "Não foi possível salvar a plataforma"
                return
            }
            form.saved(Number(editingPlatform.id))
        } else {
            const id = platformService.create(name, categories[categoryBox.currentIndex])
            if (id <= 0) {
                formError = platformService.error || "Não foi possível criar a plataforma"
                return
            }
            form.saved(Number(id))
        }
        form.close()
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 12
        ColumnLayout {
            Layout.fillWidth: true
            spacing: 4
            Text { text: "Nome"; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; font.weight: Font.Bold }
            FormField { id: nameField; objectName: "platformNameField"; Layout.fillWidth: true; placeholderText: "Ex.: PlayStation 2" }
        }
        ColumnLayout {
            Layout.fillWidth: true
            spacing: 4
            Text { text: "Categoria"; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; font.weight: Font.Bold }
            ComboBox {
                id: categoryBox
                objectName: "platformCategoryField"
                Layout.fillWidth: true
                implicitHeight: 30
                leftPadding: 10
                rightPadding: 30
                font.pixelSize: Theme.formControlFontSize
                model: form.categories
                contentItem: Text {
                    text: categoryBox.displayText
                    font: categoryBox.font
                    color: Theme.text
                    verticalAlignment: Text.AlignVCenter
                }
                indicator: Text { x: categoryBox.width - width - 11; y: (categoryBox.height - height) / 2; text: "▾"; color: Theme.secondary; font.pixelSize: 13 }
                background: Rectangle { radius: 6; color: categoryBox.hovered ? Theme.controlHover : Theme.control; border.color: categoryBox.activeFocus ? Theme.accent : Theme.border }
            }
        }
        Text {
            objectName: "platformFormError"
            visible: form.formError.length > 0
            text: form.formError
            color: "#ffb4ab"
            font.pixelSize: 12
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        Item { Layout.fillHeight: true }
        RowLayout {
            Layout.fillWidth: true
            Item { Layout.fillWidth: true }
            ActionButton { objectName: "cancelPlatform"; text: "Cancelar"; onClicked: form.close() }
            ActionButton { objectName: "savePlatform"; text: "Salvar"; iconName: "save"; primary: true; onClicked: form.save() }
        }
    }
}
