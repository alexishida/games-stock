/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Gaps do management-form preservam as medidas originais do Electron. */
/* Editor manual de metadados, empilhado sobre o formulário de edição do jogo. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

DragDialog {
    id: editor
    objectName: "gameMetadataEditor"
    property var game: ({})
    signal applied(var values)

    width: Math.min(680, parent.width - 48)
    height: Math.min(620, parent.height - 48)
    heading: "Metadados existentes"
    onClosed: errorText.text = ""

    /** Copia o jogo para os campos locais antes de abrir. */
    function openFor(source) {
        game = source || ({})
        titleField.text = game.title || ""
        publisherField.text = game.publisher || ""
        genreField.text = game.genre || ""
        yearField.text = game.year ? String(game.year) : ""
        ratingField.text = game.rating || ""
        notesField.text = game.notes || ""
        errorText.text = ""
        open()
    }

    /** Aplica os valores ao rascunho do formulário sem chamar o serviço. */
    function apply() {
        const title = titleField.text.trim()
        if (!title.length) {
            errorText.text = "Título é obrigatório"
            titleField.forceActiveFocus()
            return
        }
        applied({
            title: title,
            publisher: publisherField.text.trim(),
            genre: genreField.text.trim(),
            rating: ratingField.text.trim(),
            year: yearField.text.trim().length ? Number(yearField.text) : null,
            notes: notesField.text.trim()
        })
        close()
    }

    component LabeledField: ColumnLayout {
        property alias label: labelText.text
        property alias text: field.text
        property alias fieldObjectName: field.objectName
        Layout.fillWidth: true
        spacing: Theme.formLabelGap
        UiText { id: labelText; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; textWeight: Font.ExtraBold; font.capitalization: Font.AllUppercase; font.letterSpacing: 0.55 }
        FormField { font.family: Theme.heavyFontFamily; font.weight: Theme.cssFontWeight(Font.ExtraBold); id: field; Layout.fillWidth: true }
    }

    Flickable {
        anchors.fill: parent
        contentWidth: width
        contentHeight: body.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        ColumnLayout {
            id: body
            width: parent.width
            spacing: Theme.formGroupGap

            UiText {
                text: "Dados usados no detalhe do jogo."
                color: Theme.secondary
                font.pixelSize: 13
                Layout.fillWidth: true
            }

            GridLayout {
                Layout.fillWidth: true
                columns: 4
                columnSpacing: 8
                Repeater {
                    model: [
                        {label: "METADATA ID", value: editor.game.launchbox_id || "Não vinculado"},
                        {label: "CAPA", value: editor.game.box_art_path ? "Associada" : "Não associada"},
                        {label: "BACKGROUND", value: editor.game.background_path ? "Associado" : "Não associado"},
                        {label: "SCREENSHOT", value: editor.game.screenshot_path ? "Associado" : "Não associado"}
                    ]
                    delegate: Rectangle {
                        required property var modelData
                        Layout.fillWidth: true
                        implicitHeight: 54
                        radius: 8
                        color: Theme.card
                        border.color: Theme.border
                        ColumnLayout {
                            anchors.fill: parent
                            anchors.margins: 9
                            spacing: 1
                            UiText { text: modelData.label; color: Theme.muted; font.pixelSize: 12; textWeight: Font.ExtraBold }
                            UiText { text: modelData.value; color: Theme.text; font.pixelSize: 12; textWeight: Font.Bold; elide: Text.ElideRight; Layout.fillWidth: true }
                        }
                    }
                }
            }

            LabeledField { id: titleField; objectName: "gameMetadataTitleRow"; label: "Título"; fieldObjectName: "gameMetadataTitleField" }
            GridLayout {
                Layout.fillWidth: true
                columns: 2
                columnSpacing: 12
                rowSpacing: 10
                LabeledField { id: publisherField; label: "Publisher"; fieldObjectName: "gameMetadataPublisherField" }
                LabeledField { id: genreField; label: "Gênero"; fieldObjectName: "gameMetadataGenreField" }
                LabeledField { id: yearField; label: "Ano"; fieldObjectName: "gameMetadataYearField" }
                LabeledField { id: ratingField; label: "Rating"; fieldObjectName: "gameMetadataRatingField" }
            }
            ColumnLayout {
                Layout.fillWidth: true
                spacing: Theme.formLabelGap
                UiText { text: "Descrição"; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; textWeight: Font.ExtraBold; font.capitalization: Font.AllUppercase; font.letterSpacing: 0.55 }
                TextArea {
                    /* Mantém o texto editável suave como os demais controles. */
                    renderType: TextEdit.QtRendering
                    antialiasing: true
                    id: notesField
                    objectName: "gameMetadataNotesField"
                    Layout.fillWidth: true
                    Layout.preferredHeight: 84
                    padding: 8
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.formControlFontSize
                    color: Theme.text
                    wrapMode: TextArea.Wrap
                    background: Rectangle { radius: 6; color: Theme.control; border.color: notesField.activeFocus ? Theme.accent : Theme.border }
                }
            }
            UiText {
                id: errorText
                visible: text.length > 0
                color: "#ffb4ab"
                font.pixelSize: 13
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
            RowLayout {
                Layout.fillWidth: true
                spacing: 8
                Item { Layout.fillWidth: true }
                ActionButton { objectName: "closeGameMetadataEditor"; text: "Fechar"; onClicked: editor.close() }
                ActionButton { objectName: "applyGameMetadata"; text: "Salvar"; formAction: true; iconName: "save"; primary: true; onClicked: editor.apply() }
            }
        }
    }
}
