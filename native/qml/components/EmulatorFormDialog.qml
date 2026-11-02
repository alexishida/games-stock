/* Cadastro e edição de emulador, com seletor nativo de executável. */
import QtQuick
import QtQuick.Controls
import QtQuick.Dialogs
import QtQuick.Layouts
import GameStock
import "."

DragDialog {
    id: form
    objectName: "emulatorFormDialog"
    property var emulatorService: null
    property var editingEmulator: null
    property string formError: ""
    readonly property bool editMode: !!editingEmulator

    signal saved(var emulatorId)

    width: Math.min(560, parent.width - 48)
    height: 430
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
        spacing: 12
        ColumnLayout {
            Layout.fillWidth: true
            spacing: 4
            Text { text: "Nome"; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; font.weight: Font.Bold }
            FormField { id: nameField; objectName: "emulatorNameField"; Layout.fillWidth: true; placeholderText: "Ex.: PCSX2" }
        }
        ColumnLayout {
            Layout.fillWidth: true
            spacing: 4
            Text { text: "Executável"; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; font.weight: Font.Bold }
            RowLayout {
                Layout.fillWidth: true
                spacing: 6
                FormField { id: executableField; objectName: "emulatorExecutableField"; Layout.fillWidth: true; placeholderText: "Caminho do executável" }
                ActionButton { objectName: "browseEmulator"; iconName: "folder-open"; toolbar: true; Accessible.name: "Selecionar executável"; onClicked: executableDialog.open() }
            }
        }
        ColumnLayout {
            Layout.fillWidth: true
            spacing: 4
            Text { text: "Argumentos (opcional, separados por espaço)"; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; font.weight: Font.Bold }
            FormField { id: argsField; objectName: "emulatorArgsField"; Layout.fillWidth: true; placeholderText: "Ex.: -fullscreen ou --profile={romFileName}" }
            Text { text: "Use {romPath} para o caminho completo ou {romFileName} para somente o arquivo."; color: Theme.muted; font.pixelSize: 10; wrapMode: Text.WordWrap; Layout.fillWidth: true }
        }
        Text {
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
            Item { Layout.fillWidth: true }
            ActionButton { objectName: "cancelEmulator"; text: "Cancelar"; onClicked: form.close() }
            ActionButton { objectName: "saveEmulator"; text: "Salvar"; iconName: "save"; primary: true; onClicked: form.save() }
        }
    }
}
