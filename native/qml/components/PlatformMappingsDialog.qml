/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Aliases LaunchBox e extensões de ROM de uma plataforma, em transação no serviço. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

DragDialog {
    id: mappings
    cornerRadius: 12
    panelBorder: Theme.borderStrong
    secondaryScrim: Theme.scrim
    objectName: "platformMappingsDialog"
    property var platformService: null
    property var platform: null
    property string formError: ""

    signal saved()

    width: Math.min(900, parent.width - 48)
    height: Math.min(body.implicitHeight + 34, parent.height - 48)
    padding: 16
    heading: "Vínculos de plataforma"
    /* Cabeçalho reproduz a identificação do modal de vínculos. */
    showHeading: false
    onOpened: load()

    ListModel { id: aliasModel }
    ListModel { id: extensionModel }

    function load() {
        formError = ""
        aliasModel.clear()
        extensionModel.clear()
        if (!platformService || !platform) return
        const current = platformService.getMappings(Number(platform.id))
        const aliases = current.aliases || []
        const extensions = current.romExtensions || []
        if (aliases.length) {
            for (let index = 0; index < aliases.length; index++) aliasModel.append({value: aliases[index].alias || ""})
        } else {
            aliasModel.append({value: platform.name || ""})
        }
        if (extensions.length) {
            for (let index = 0; index < extensions.length; index++) {
                extensionModel.append({extension: extensions[index].extension || "",
                    kind: extensions[index].kind || "", primary: !!extensions[index].isPrimary})
            }
        } else {
            extensionModel.append({extension: "", kind: "", primary: true})
        }
    }

    function save() {
        formError = ""
        if (!platformService || !platform) return
        const aliases = []
        for (let index = 0; index < aliasModel.count; index++) aliases.push(aliasModel.get(index).value)
        const extensions = []
        for (let index = 0; index < extensionModel.count; index++) {
            const row = extensionModel.get(index)
            extensions.push({extension: row.extension, kind: row.kind, is_primary: row.primary})
        }
        if (!platformService.saveMappings(Number(platform.id), aliases, extensions)) {
            formError = platformService.error || "Não foi possível salvar os vínculos"
            return
        }
        mappings.saved()
        mappings.close()
    }

    /* A altura acompanha aliases e extensoes; paineis e footer repetem o grid do renderer. */
    Flickable {
        anchors.fill: parent
        contentWidth: width
        contentHeight: body.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        /* Roda do mouse um pouco mais rápida que o padrão do Qt. */
        WheelScrollSpeed {}
        ColumnLayout {
            id: body
            width: parent.width
            spacing: 16
            RowLayout {
                Layout.fillWidth: true
                Layout.bottomMargin: 12
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 6
                    UiText { Layout.fillWidth: true; text: mappings.heading; color: Theme.text; font.pixelSize: 22; textWeight: Font.Black; lineHeightMode: Text.FixedHeight; lineHeight: 22 }
                    UiText { Layout.fillWidth: true; text: mappings.platform ? mappings.platform.name : ""; color: Theme.secondary; font.pixelSize: 13 }
                }
                ActionButton { iconName: "x-danger"; Accessible.name: "Fechar"; onClicked: mappings.close() }
            }
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: aliasesBody.implicitHeight + 28
                radius: 10
                color: "#06ffffff"
                border.color: Theme.border
                ColumnLayout {
                    id: aliasesBody
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 8
                    RowLayout {
                        Layout.fillWidth: true
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 4
                            UiText { text: "Aliases"; color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold }
                            UiText { text: "Nomes equivalentes usados na busca e no casamento automático de metadados."; color: Theme.secondary; font.pixelSize: 13; wrapMode: Text.WordWrap; Layout.fillWidth: true }
                        }
                        ActionButton { objectName: "addAlias"; text: "Alias"; iconName: "plus"; onClicked: aliasModel.append({value: ""}) }
                    }
                    Repeater {
                        model: aliasModel
                        delegate: RowLayout {
                            required property int index
                            required property string value
                            Layout.fillWidth: true
                            spacing: 8
                            FormField { Layout.fillWidth: true; text: value; onTextEdited: aliasModel.setProperty(index, "value", text) }
                            ActionButton { objectName: "removeAlias"; iconName: "trash-2-danger"; dangerOutline: true; enabled: aliasModel.count > 1; Accessible.name: "Remover alias"; onClicked: aliasModel.remove(index) }
                        }
                    }
                }
            }
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: extensionsBody.implicitHeight + 28
                radius: 10
                color: "#06ffffff"
                border.color: Theme.border
                ColumnLayout {
                    id: extensionsBody
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 8
                    RowLayout {
                        Layout.fillWidth: true
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 4
                            UiText { Layout.fillWidth: true; text: "Extensões de ROM"; color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold }
                            UiText { Layout.fillWidth: true; text: "Definem o filtro do importador de pasta para esta plataforma."; color: Theme.secondary; font.pixelSize: 13 }
                        }
                        ActionButton { objectName: "addExtension"; text: "Extensão"; iconName: "plus"; onClicked: extensionModel.append({extension: "", kind: "", primary: true}) }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 8
                        UiText { text: "EXTENSÃO"; color: Theme.secondary; font.pixelSize: 12; textWeight: Font.ExtraBold; Layout.preferredWidth: 140 }
                        UiText { text: "DESCRIÇÃO"; color: Theme.secondary; font.pixelSize: 12; textWeight: Font.ExtraBold; Layout.fillWidth: true }
                        UiText { text: "USAR"; color: Theme.secondary; font.pixelSize: 12; textWeight: Font.ExtraBold; Layout.preferredWidth: 88; horizontalAlignment: Text.AlignHCenter }
                        Item { Layout.preferredWidth: 40 }
                    }
                    Repeater {
                        model: extensionModel
                        delegate: RowLayout {
                            required property int index
                            required property string extension
                            required property string kind
                            required property bool primary
                            Layout.fillWidth: true
                            spacing: 8
                            FormField { Layout.preferredWidth: 140; text: extension; onTextEdited: extensionModel.setProperty(index, "extension", text) }
                            FormField { Layout.fillWidth: true; text: kind; onTextEdited: extensionModel.setProperty(index, "kind", text) }
                            ColumnLayout {
                                Layout.preferredWidth: 88
                                spacing: 4
                                FormCheckBox { Layout.alignment: Qt.AlignHCenter; checked: primary; onToggled: extensionModel.setProperty(index, "primary", checked) }
                                UiText { Layout.alignment: Qt.AlignHCenter; text: primary ? "SIM" : "NÃO"; color: Theme.secondary; font.pixelSize: 12; textWeight: Font.ExtraBold }
                            }
                            ActionButton { objectName: "removeExtension"; Layout.preferredWidth: 26; Layout.leftMargin: 7; Layout.rightMargin: 7; iconName: "trash-2-danger"; dangerOutline: true; enabled: extensionModel.count > 1; Accessible.name: "Remover extensão"; onClicked: extensionModel.remove(index) }
                        }
                    }
                }
            }
            UiText { objectName: "mappingsError"; visible: mappings.formError.length > 0; text: mappings.formError; color: Theme.danger; font.pixelSize: 13; wrapMode: Text.WordWrap; Layout.fillWidth: true }
            RowLayout {
                Layout.fillWidth: true
                Layout.topMargin: 4
                spacing: 10
                Item { Layout.fillWidth: true }
                ActionButton { objectName: "cancelMappings"; text: "Cancelar"; iconName: "x-danger"; dangerOutline: true; formAction: true; onClicked: mappings.close() }
                ActionButton { objectName: "saveMappings"; text: "Salvar mapeamentos"; iconName: "save"; accentOutline: true; onClicked: mappings.save() }
            }
        }
    }
}
