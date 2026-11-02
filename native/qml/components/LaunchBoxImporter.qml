/* Modal de importação de metadados e mídia do LaunchBox. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

DragDialog {
    id: importer
    objectName: "launchBoxImporter"
    required property var metadataService
    required property var platformService
    required property var gameService
    property bool serviceMode: false
    property string query: ""
    property string platformName: ""
    property var selectedGame: null
    property var selectedTypes: [
        "Box - Back", "Box - Front", "Cart - Front", "Fanart - Background", "Screenshot - Gameplay"
    ]
    signal backdropRequested(bool active)

    readonly property var imageTypes: [
        "Box - Back", "Box - Front", "Cart - Front", "Fanart - Background", "Screenshot - Gameplay"
    ]
    readonly property var results: metadataService ? metadataService.results : []
    readonly property bool busy: metadataService ? metadataService.busy : false
    readonly property var platforms: platformService ? platformService.items : []

    width: Math.min(860, parent.width - 48)
    height: Math.min(640, parent.height - 48)
    heading: "Importar do LaunchBox"
    onBackdropBlurRequested: function(active) { importer.backdropRequested(active) }

    /** Abre já filtrado por um jogo do detalhe, quando houver. */
    function openFor(title, platform) {
        query = title || ""
        platformName = platform || ""
        selectedGame = null
        errorText = ""
        open()
        if (metadataService && !metadataService.metadataReady) metadataService.ensureMetadata()
    }

    /** Executa a busca com os filtros atuais. */
    function runSearch() {
        if (!serviceMode || !metadataService || busy) return
        errorText = ""
        selectedGame = null
        const job = metadataService.search(query, platformName)
        if (!job || !job.jobId) errorText = metadataService.error
    }

    /** Importa o jogo selecionado com os tipos marcados. */
    function runImport() {
        if (!serviceMode || !metadataService || !selectedGame || busy) return
        errorText = ""
        const job = metadataService.importGame(selectedGame, selectedTypes)
        if (!job || !job.jobId) errorText = metadataService.error
    }

    /** Marca/desmarca um tipo de imagem. */
    function toggleType(type, checked) {
        const next = []
        for (let index = 0; index < selectedTypes.length; ++index) {
            if (selectedTypes[index] !== type) next.push(selectedTypes[index])
        }
        if (checked) next.push(type)
        selectedTypes = next
    }

    property string errorText: ""

    ColumnLayout {
        anchors.fill: parent
        spacing: 10
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            FormField {
                id: queryField
                objectName: "launchBoxQuery"
                Layout.fillWidth: true
                text: importer.query
                placeholderText: "Buscar jogo no LaunchBox"
                onTextChanged: importer.query = text
                onAccepted: importer.runSearch()
            }
            ComboBox {
                id: platformFilter
                objectName: "launchBoxPlatform"
                implicitHeight: Theme.controlHeight
                Layout.preferredWidth: 190
                textRole: "name"
                model: {
                    const list = [{id: 0, name: "Todas plataformas"}]
                    for (let index = 0; index < importer.platforms.length; ++index) list.push(importer.platforms[index])
                    return list
                }
                onActivated: importer.platformName = currentIndex === 0 ? "" : currentText
            }
            ActionButton {
                objectName: "launchBoxSearch"
                text: importer.busy ? "Aguarde..." : "Buscar"
                primary: true
                enabled: importer.serviceMode && !importer.busy
                onClicked: importer.runSearch()
            }
        }
        Text {
            objectName: "launchBoxError"
            visible: importer.errorText.length > 0
                || (importer.metadataService && importer.metadataService.error.length > 0)
            text: importer.errorText.length > 0 ? importer.errorText
                : (importer.metadataService ? importer.metadataService.error : "")
            color: "#ffb4ab"
            font.pixelSize: 12
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 12
            Rectangle {
                Layout.fillWidth: true
                Layout.fillHeight: true
                color: Theme.control
                radius: 8
                ListView {
                    id: resultList
                    objectName: "launchBoxResults"
                    anchors.fill: parent
                    anchors.margins: 6
                    clip: true
                    spacing: 3
                    model: importer.results
                    delegate: Rectangle {
                        required property var modelData
                        required property int index
                        width: resultList.width
                        height: 52
                        radius: 6
                        color: importer.selectedGame && importer.selectedGame.id === modelData.id
                            ? Theme.accentSoft : Theme.panel
                        ColumnLayout {
                            anchors.fill: parent
                            anchors.margins: 8
                            spacing: 1
                            Text {
                                text: modelData.name
                                color: Theme.text; font.pixelSize: 13; font.weight: Font.DemiBold
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                            }
                            Text {
                                text: modelData.platform + " · "
                                    + (modelData.images ? modelData.images.length : 0) + " imagens"
                                color: Theme.muted; font.pixelSize: 11
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                            }
                        }
                        MouseArea {
                            anchors.fill: parent
                            onClicked: importer.selectedGame = modelData
                        }
                    }
                    Text {
                        anchors.centerIn: parent
                        visible: resultList.count === 0
                        text: importer.busy ? "Carregando catálogo..." : "Busque um jogo para importar."
                        color: Theme.muted
                        font.pixelSize: 12
                    }
                }
            }
            ColumnLayout {
                Layout.preferredWidth: 240
                spacing: 6
                Text { text: "IMAGENS"; color: Theme.accent; font.pixelSize: 11; font.weight: Font.Bold }
                Repeater {
                    model: importer.imageTypes
                    delegate: CheckBox {
                        required property string modelData
                        text: modelData
                        checked: importer.selectedTypes.indexOf(modelData) >= 0
                        onToggled: importer.toggleType(modelData, checked)
                    }
                }
                Item { Layout.fillHeight: true }
                Text {
                    visible: importer.selectedGame !== null
                    text: importer.selectedGame ? importer.selectedGame.name : ""
                    color: Theme.secondary; font.pixelSize: 11
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }
                ActionButton {
                    objectName: "launchBoxImport"
                    text: importer.busy ? "Importando..." : "Importar selecionado"
                    primary: true
                    Layout.fillWidth: true
                    enabled: importer.serviceMode && !importer.busy && importer.selectedGame !== null
                    onClicked: importer.runImport()
                }
            }
        }
    }

    Connections {
        target: importer.metadataService
        function onImported(gameId) {
            if (importer.gameService) importer.gameService.refresh()
            if (importer.platformService) importer.platformService.refresh()
        }
    }
}
