/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Gaps do management-form preservam as medidas originais do Electron. */
/* Seletores usam FormSelect para manter padding, altura e menu iguais ao Electron. */
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

    /* Medidas do formulário original, com título e fechamento explícitos. */
    showHeading: true
    padding: 16
    width: Math.min(420, parent.width - 48)
    height: 272
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
        spacing: Theme.formGroupGap
        ColumnLayout {
            Layout.fillWidth: true
            spacing: Theme.formLabelGap
            UiText { text: "Nome"; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; textWeight: Font.ExtraBold; font.capitalization: Font.AllUppercase; font.letterSpacing: 0.55 }
            FormField { font.family: Theme.heavyFontFamily; font.weight: Theme.cssFontWeight(Font.ExtraBold); id: nameField; objectName: "platformNameField"; Layout.fillWidth: true; placeholderText: "Ex.: PlayStation 2" }
        }
        ColumnLayout {
            Layout.fillWidth: true
            spacing: Theme.formLabelGap
            UiText { text: "Categoria"; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; textWeight: Font.ExtraBold; font.capitalization: Font.AllUppercase; font.letterSpacing: 0.55 }
            FormSelect {
                font.family: Theme.heavyFontFamily; font.weight: Theme.cssFontWeight(Font.ExtraBold)
                id: categoryBox
                objectName: "platformCategoryField"
                /* O CSS deste modal usa select com altura de 36 px. */
                implicitHeight: 36
                Layout.fillWidth: true
                font.pixelSize: Theme.formControlFontSize
                model: form.categories
                contentItem: UiText {
                    text: categoryBox.displayText
                    font: categoryBox.font
                    color: Theme.text
                    verticalAlignment: Text.AlignVCenter
                    elide: Text.ElideRight
                }
            }
        }
        UiText {
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
            spacing: Theme.formActionGap
            /* O espaçador também conta no gap Qt; compensar impede o rodapé de sair do modal. */
            Layout.topMargin: 4 - Theme.formGroupGap
            Item { Layout.fillWidth: true }
            ActionButton { objectName: "cancelPlatform"; text: "Cancelar"; formAction: true; iconName: "x-danger"; dangerOutline: true; onClicked: form.close() }
            ActionButton { objectName: "savePlatform"; text: "Salvar"; formAction: true; iconName: "save"; accentOutline: true; onClicked: form.save() }
        }
    }
}
