/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Gaps do management-form preservam as medidas originais do Electron. */
/* Cadastro e edição de emulador, com seletor nativo de executável. */
import QtQuick
import QtQuick.Controls
import QtQuick.Dialogs
import QtQuick.Layouts
import GameStock
import "."

DragDialog {
    id: form
    /* Cabeçalho compartilhado evita formulário sem título. */
    showHeading: true
    objectName: "emulatorFormDialog"
    property var emulatorService: null
    property var editingEmulator: null
    property string formError: ""
    readonly property bool editMode: !!editingEmulator

    signal saved(var emulatorId)

    padding: 16
    width: Math.min(460, parent.width - 48)
    height: Math.min(404, parent.height - 48)
    heading: editMode ? "Editar emulador" : "Novo emulador"
    onOpened: populate()
    onClosed: formError = ""

    function populate() {
        formError = ""
        nameField.text = editMode ? editingEmulator.name || "" : ""
        executableField.text = editMode ? editingEmulator.executable || "" : ""
        argsField.text = editMode ? editingEmulator.args || "" : ""
    }

    function save() {
        formError = ""
        if (!emulatorService) {
            formError = "Serviço de emuladores indisponível."
            return
        }
        const name = nameField.text.trim()
        if (!name.length) {
            formError = "Nome do emulador é obrigatório"
            nameField.forceActiveFocus()
            return
        }
        if (editMode) {
            if (!emulatorService.update(Number(editingEmulator.id), {
                name: name,
                executable: executableField.text.trim(),
                args: argsField.text.trim()
            })) {
                formError = emulatorService.error || "Não foi possível salvar"
                return
            }
            form.saved(Number(editingEmulator.id))
        } else {
            const created = emulatorService.create({
                name: name,
                executable: executableField.text.trim(),
                args: argsField.text.trim(),
                is_retroarch: false
            })
            if (!created || !created.id) {
                formError = emulatorService.error || "Não foi possível salvar"
                return
            }
            form.saved(Number(created.id))
        }
        form.close()
    }

    FileDialog {
        id: executableDialog
        title: "Selecionar executável"
        fileMode: FileDialog.OpenFile
        onAccepted: executableField.text = decodeURIComponent(selectedFile.toString().replace(/^file:\/\/\//, ""))
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: Theme.formGroupGap
        ColumnLayout {
            Layout.fillWidth: true
            spacing: Theme.formLabelGap
            UiText { text: "NOME"; color: Theme.secondary; font.pixelSize: Theme.formLabelFontSize; textWeight: Font.ExtraBold; font.capitalization: Font.AllUppercase; font.letterSpacing: 0.55 }
            FormField { font.family: Theme.heavyFontFamily; font.weight: Theme.cssFontWeight(Font.ExtraBold); id: nameField; objectName: "emulatorNameField"; Layout.fillWidth: true; placeholderText: "Ex.: PCSX2" }
        }
        ColumnLayout {
            Layout.fillWidth: true
            spacing: Theme.formLabelGap
            UiText { text: "EXECUTÁVEL"; color: Theme.secondary; font.pixelSize: Theme.formLabelFontSize; textWeight: Font.ExtraBold; font.capitalization: Font.AllUppercase; font.letterSpacing: 0.55 }
            RowLayout {
                Layout.fillWidth: true
                spacing: 6
                FormField { font.family: Theme.heavyFontFamily; font.weight: Theme.cssFontWeight(Font.ExtraBold); id: executableField; objectName: "emulatorExecutableField"; Layout.fillWidth: true; placeholderText: "Caminho do executável" }
                ActionButton { objectName: "browseEmulator"; iconName: "folder-open"; Accessible.name: "Selecionar executável"; onClicked: executableDialog.open() }
            }
        }
        ColumnLayout {
            Layout.fillWidth: true
            spacing: Theme.formLabelGap
            UiText { text: "ARGUMENTOS"; color: Theme.secondary; font.pixelSize: Theme.formLabelFontSize; textWeight: Font.ExtraBold; font.letterSpacing: 0.55 }
            /* A dica fica em linha própria, sem herdar caixa alta ou peso do rótulo. */
            UiText { text: "(opcional, separados por espaço)"; color: Theme.secondary; font.pixelSize: 10; Layout.leftMargin: 4 }
            FormField { font.family: Theme.heavyFontFamily; font.weight: Theme.cssFontWeight(Font.ExtraBold); id: argsField; objectName: "emulatorArgsField"; Layout.fillWidth: true; placeholderText: "Ex.: -fullscreen ou --profile={romFileName}" }
            UiText { text: "Use {romPath} para o caminho completo ou {romFileName} para somente o arquivo."; color: Theme.muted; font.pixelSize: 10; wrapMode: Text.WordWrap; Layout.fillWidth: true }
        }
        UiText {
            objectName: "emulatorFormError"
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
            Layout.topMargin: 4
            Item { Layout.fillWidth: true }
            ActionButton { objectName: "cancelEmulator"; text: "Cancelar"; formAction: true; iconName: "x-danger"; dangerOutline: true; onClicked: form.close() }
            ActionButton { objectName: "saveEmulator"; text: "Salvar"; formAction: true; iconName: "save"; accentOutline: true; onClicked: form.save() }
        }
    }
}
