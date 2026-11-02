/* Aliases LaunchBox e extensões de ROM de uma plataforma, em transação no serviço. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

DragDialog {
    id: mappings
    objectName: "platformMappingsDialog"
    property var platformService: null
    property var platform: null
    property string formError: ""

    signal saved()

    width: Math.min(720, parent.width - 48)
    height: Math.min(660, parent.height - 48)
    heading: "Vínculos de plataforma"
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

    Flickable {
        anchors.fill: parent
        contentWidth: width
        contentHeight: body.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        ColumnLayout {
            id: body
            width: parent.width
            spacing: 16
            Text { text: mappings.platform ? mappings.platform.name : ""; color: Theme.accentMuted; font.pixelSize: 13; font.weight: Font.Bold; Layout.fillWidth: true }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 6
                RowLayout {
                    Layout.fillWidth: true
                    Text { text: "Aliases"; color: Theme.text; font.pixelSize: 16; font.weight: Font.Bold; Layout.fillWidth: true }
                    ActionButton { objectName: "addAlias"; iconName: "plus"; toolbar: true; Accessible.name: "Adicionar alias"; onClicked: aliasModel.append({value: ""}) }
                }
                Text { text: "Nomes equivalentes usados na busca e no casamento automático de metadados."; color: Theme.muted; font.pixelSize: 11; wrapMode: Text.WordWrap; Layout.fillWidth: true }
                Repeater {
                    model: aliasModel
                    delegate: RowLayout {
                        required property int index
                        required property string value
                        Layout.fillWidth: true
                        spacing: 6
                        FormField {
                            Layout.fillWidth: true
                            text: value
                            placeholderText: index === 0 ? (mappings.platform ? mappings.platform.name : "") : "Ex.: Sony Playstation"
                            onTextEdited: aliasModel.setProperty(index, "value", text)
                        }
                        ActionButton {
                            objectName: "removeAlias"
                            iconName: "trash-2"
                            toolbar: true
                            enabled: aliasModel.count > 1
                            Accessible.name: "Remover alias"
                            onClicked: aliasModel.remove(index)
                        }
                    }
                }
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 6
                RowLayout {
                    Layout.fillWidth: true
                    Text { text: "Extensões de ROM"; color: Theme.text; font.pixelSize: 16; font.weight: Font.Bold; Layout.fillWidth: true }
                    ActionButton { objectName: "addExtension"; iconName: "plus"; toolbar: true; Accessible.name: "Adicionar extensão"; onClicked: extensionModel.append({extension: "", kind: "", primary: true}) }
                }
                Text { text: "Definem o filtro do importador de pasta para esta plataforma."; color: Theme.muted; font.pixelSize: 11; wrapMode: Text.WordWrap; Layout.fillWidth: true }
                RowLayout {
                    Layout.fillWidth: true
                    spacing: 6
                    Text { text: "Extensão"; color: Theme.muted; font.pixelSize: 10; font.weight: Font.Bold; Layout.preferredWidth: 130 }
                    Text { text: "Descrição"; color: Theme.muted; font.pixelSize: 10; font.weight: Font.Bold; Layout.fillWidth: true }
                    Text { text: "Usar"; color: Theme.muted; font.pixelSize: 10; font.weight: Font.Bold; Layout.preferredWidth: 52 }
                    Item { Layout.preferredWidth: 30 }
                }
                Repeater {
                    model: extensionModel
                    delegate: RowLayout {
                        required property int index
                        required property string extension
                        required property string kind
                        required property bool primary
                        Layout.fillWidth: true
                        spacing: 6
                        FormField {
                            Layout.preferredWidth: 130
                            text: extension
                            placeholderText: ".iso"
                            onTextEdited: extensionModel.setProperty(index, "extension", text)
                        }
                        FormField {
                            Layout.fillWidth: true
                            text: kind
                            placeholderText: "Imagem de disco"
                            onTextEdited: extensionModel.setProperty(index, "kind", text)
                        }
                        CheckBox {
                            Layout.preferredWidth: 52
                            checked: primary
                            text: primary ? "Sim" : "Não"
                            font.pixelSize: 11
                            spacing: 4
                            leftPadding: 0
                            onToggled: extensionModel.setProperty(index, "primary", checked)
                            contentItem: Text {
                                text: parent.text
                                leftPadding: parent.indicator.width + parent.spacing
                                verticalAlignment: Text.AlignVCenter
                                color: Theme.secondary
                                font: parent.font
                            }
                        }
                        ActionButton {
                            objectName: "removeExtension"
                            iconName: "trash-2"
                            toolbar: true
                            enabled: extensionModel.count > 1
                            Accessible.name: "Remover extensão"
                            onClicked: extensionModel.remove(index)
                        }
                    }
                }
            }

            Text {
                objectName: "mappingsError"
                visible: mappings.formError.length > 0
                text: mappings.formError
                color: "#ffb4ab"
                font.pixelSize: 12
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
            RowLayout {
                Layout.fillWidth: true
                Item { Layout.fillWidth: true }
                ActionButton { objectName: "cancelMappings"; text: "Cancelar"; onClicked: mappings.close() }
                ActionButton { objectName: "saveMappings"; text: "Salvar mapeamentos"; iconName: "save"; primary: true; onClicked: mappings.save() }
            }
        }
    }
}
