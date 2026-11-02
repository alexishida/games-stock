/* Página de detalhe do jogo, equivalente ao GameDetail do renderer Electron. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

Item {
    id: page
    objectName: "gameDetailPage"
    property var gameService: null
    property bool serviceMode: false
    property var libraryGame: null
    property var launchService: null
    property bool hasPrevious: false
    property bool hasNext: false
    property var game: ({})
    property var versions: []
    property var gallery: []
    property string actionError: ""
    readonly property string gameTitle: game.title || ""

    signal editRequested(var game)
    signal deleteRequested(var game)
    signal metadataRequested(var game)
    signal versionsRequested(var game)
    signal previousRequested()
    signal nextRequested()
    signal closeRequested()

    onLibraryGameChanged: reload()
    Component.onCompleted: reload()

    /** Recarrega dados completos, variantes e galeria do jogo selecionado. */
    function reload() {
        actionError = ""
        if (!libraryGame) {
            game = ({})
            versions = []
            gallery = []
            return
        }
        if (serviceMode && gameService) {
            game = gameService.get(libraryGame.id)
            versions = gameService.listVersions(libraryGame.id)
            gallery = mergeGallery(gameService.listMedia(libraryGame.id))
            if (gameService.error && gameService.error.length > 0) actionError = gameService.error
        } else {
            game = libraryGame
            versions = []
            gallery = localGallery()
        }
    }

    /** Mescla a galeria física com as mídias principais do jogo, sem duplicar arquivos. */
    function mergeGallery(media) {
        const items = []
        const seen = ({})
        function add(path, label, kind) {
            if (!path) return
            const name = String(path).split(/[\\/]/).pop().toLowerCase()
            const key = kind + ":" + name
            if (seen[key]) return
            seen[key] = true
            items.push({path: path, label: label, kind: kind})
        }
        for (let index = 0; index < media.length; index++) add(media[index].path, media[index].label, media[index].kind)
        add(game.box_art_path, "Cover", "cover")
        add(game.background_path, "Background", "background")
        add(game.screenshot_path, "Screenshot", "screenshot")
        return items
    }

    /** Fallback da fixture: apenas as mídias principais já exibidas no card. */
    function localGallery() {
        const items = []
        if (game.box_art_path) items.push({path: game.box_art_path, label: "Cover", kind: "cover"})
        if (game.background_path) items.push({path: game.background_path, label: "Background", kind: "background"})
        if (game.screenshot_path) items.push({path: game.screenshot_path, label: "Screenshot", kind: "screenshot"})
        return items
    }

    function fileName(path) {
        const parts = String(path || "").split(/[\\/]/)
        return parts[parts.length - 1] || "ROM não associada"
    }

    function toggleFavorite() {
        if (!serviceMode || !gameService || !game.id) return
        if (!gameService.update(game.id, {favorite: !game.favorite})) actionError = gameService.error
        else reload()
    }

    function toggleStatus(status) {
        if (!serviceMode || !gameService || !game.id) return
        const next = game.play_status === status ? "unplayed" : status
        if (!gameService.update(game.id, {play_status: next})) actionError = gameService.error
        else reload()
    }

    /** Abre o emulador padrão; com variantes, delega a escolha ao seletor. */
    function launch() {
        if (!serviceMode || !gameService || !launchService || !game.id) return
        if (versions.length > 1) {
            versionsRequested(game)
            return
        }
        const result = launchService.launch(game.id)
        if (!result || !result.success) {
            actionError = launchService.error || "Não foi possível iniciar o jogo."
            return
        }
        gameService.refresh()
        reload()
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
            spacing: 18
            RowLayout {
                Layout.fillWidth: true
                spacing: 8
                Item { Layout.fillWidth: true }
                ActionButton { objectName: "detailBack"; text: "Biblioteca"; iconName: "library"; onClicked: page.closeRequested() }
                ActionButton { objectName: "previousGame"; iconName: "chevron-left"; toolbar: true; visible: page.hasPrevious; enabled: page.hasPrevious; Accessible.name: "Jogo anterior"; onClicked: page.previousRequested() }
                ActionButton { objectName: "nextGame"; iconName: "chevron-right"; toolbar: true; visible: page.hasNext; enabled: page.hasNext; Accessible.name: "Próximo jogo"; onClicked: page.nextRequested() }
            }
            RowLayout {
                Layout.fillWidth: true
                spacing: 24
                Rectangle {
                    Layout.preferredWidth: 196
                    Layout.preferredHeight: 274
                    radius: 10
                    color: Theme.card
                    clip: true
                    Image {
                        anchors.fill: parent
                        source: page.game.coverUrl || ""
                        fillMode: Image.PreserveAspectCrop
                        visible: source.toString().length > 0
                    }
                    Image {
                        anchors.centerIn: parent
                        source: "qrc:/icons/gamepad-2.svg"
                        sourceSize: Qt.size(38, 38)
                        visible: !(page.game.coverUrl || "").toString().length
                    }
                }
                ColumnLayout {
                    Layout.fillWidth: true
                    Layout.alignment: Qt.AlignTop
                    spacing: 10
                    RowLayout {
                        spacing: 6
                        Repeater {
                            model: [page.game.platform_name || "Sem plataforma",
                                page.game.year ? String(page.game.year) : "",
                                page.game.rating || ""].filter(function(value) { return String(value).length > 0 })
                            delegate: Rectangle {
                                required property string modelData
                                radius: 999
                                color: "transparent"
                                border.color: Theme.accentMuted
                                implicitWidth: chip.implicitWidth + 18
                                implicitHeight: 24
                                Text {
                                    id: chip
                                    anchors.centerIn: parent
                                    text: modelData
                                    color: Theme.accentMuted
                                    font.pixelSize: 11
                                    font.weight: Font.Bold
                                }
                            }
                        }
                    }
                    Text {
                        text: page.game.title || ""
                        color: Theme.text
                        font.pixelSize: 28
                        font.weight: Font.Bold
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                    }
                    Text {
                        text: (page.game.publisher || "Publisher não informado") + " · " + (page.game.genre || "Gênero não informado")
                        color: Theme.secondary
                        font.pixelSize: 14
                        wrapMode: Text.WrapAtWordBoundaryOrAnywhere
                        Layout.fillWidth: true
                    }
                    RowLayout {
                        objectName: "gameDetailActions"
                        spacing: 6
                        ActionButton {
                            objectName: "launchGame"
                            text: "Jogar"
                            iconName: "play-white"
                            successFill: true
                            enabled: page.serviceMode && !!page.game.rom_path
                                && page.launchService !== null && page.launchService !== undefined
                                && page.launchService.available === true
                            onClicked: page.launch()
                        }
                        ActionButton { objectName: "favoriteGame"; iconName: page.game.favorite ? "star-favorite-white" : "star"; warningFill: page.game.favorite; enabled: page.serviceMode; Accessible.name: page.game.favorite ? "Remover favorito" : "Marcar favorito"; onClicked: page.toggleFavorite() }
                        ActionButton { objectName: "completedGame"; iconName: page.game.play_status === "completed" ? "trophy-completed" : "trophy"; enabled: page.serviceMode; Accessible.name: "Concluído"; onClicked: page.toggleStatus("completed") }
                        ActionButton { objectName: "playingGame"; iconName: page.game.play_status === "playing" ? "gamepad-playing" : "gamepad-2"; enabled: page.serviceMode; Accessible.name: "Jogando"; onClicked: page.toggleStatus("playing") }
                        ActionButton { objectName: "editGame"; iconName: "pencil"; enabled: page.serviceMode; Accessible.name: "Editar"; onClicked: page.editRequested(page.game) }
                        ActionButton { objectName: "deleteGame"; iconName: "trash-2-danger"; dangerOutline: true; enabled: page.serviceMode; Accessible.name: "Excluir"; onClicked: page.deleteRequested(page.game) }
                        Item { Layout.fillWidth: true }
                    }
                    Text {
                        visible: page.actionError.length > 0
                        text: page.actionError
                        color: "#ffb4ab"
                        font.pixelSize: 12
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                    }
                }
            }
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: aboutContent.implicitHeight + 28
                radius: 12
                color: Theme.panel
                border.color: Theme.border
                ColumnLayout {
                    id: aboutContent
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 6
                    Text { text: "Descrição"; color: Theme.text; font.pixelSize: 18; font.weight: Font.Bold }
                    Text { text: page.game.notes && page.game.notes.trim().length ? page.game.notes : "Sem descrição cadastrada para este jogo."; color: Theme.secondary; font.pixelSize: 14; wrapMode: Text.WordWrap; Layout.fillWidth: true }
                }
            }
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: fileContent.implicitHeight + 28
                radius: 12
                color: Theme.panel
                border.color: Theme.border
                ColumnLayout {
                    id: fileContent
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 8
                    Text { text: "Arquivo"; color: Theme.text; font.pixelSize: 18; font.weight: Font.Bold }
                    GridLayout {
                        Layout.fillWidth: true
                        columns: 2
                        columnSpacing: 18
                        rowSpacing: 6
                        Text { text: "ROM"; color: Theme.muted; font.pixelSize: 13 }
                        Text { text: page.fileName(page.game.rom_path); color: Theme.secondary; font.pixelSize: 13; Layout.fillWidth: true; wrapMode: Text.WrapAtWordBoundaryOrAnywhere; horizontalAlignment: Text.AlignRight }
                        Text { visible: page.versions.length > 1; text: "Arquivos encontrados"; color: Theme.muted; font.pixelSize: 13 }
                        Text {
                            visible: page.versions.length > 1
                            text: {
                                const names = []
                                const seen = ({})
                                for (let index = 0; index < page.versions.length; index++) {
                                    const name = String(page.versions[index].romFileName || "")
                                    if (name && !seen[name]) {
                                        seen[name] = true
                                        names.push(name)
                                    }
                                }
                                return names.join("\n")
                            }
                            color: Theme.secondary
                            font.pixelSize: 13
                            Layout.fillWidth: true
                            horizontalAlignment: Text.AlignRight
                        }
                        Text { visible: page.versions.length > 1; text: "Imagens agrupadas"; color: Theme.muted; font.pixelSize: 13 }
                        Text { visible: page.versions.length > 1; text: page.gallery.length; color: Theme.secondary; font.pixelSize: 13; Layout.fillWidth: true; horizontalAlignment: Text.AlignRight }
                        Text { text: "Box Art"; color: Theme.muted; font.pixelSize: 13 }
                        Text { text: page.game.box_art_path ? "Associada" : "Não associada"; color: Theme.secondary; font.pixelSize: 13; Layout.fillWidth: true; horizontalAlignment: Text.AlignRight }
                        Text { text: "Status"; color: Theme.muted; font.pixelSize: 13 }
                        Text { text: page.game.rom_path ? "Pronto" : "Pendente"; color: page.game.rom_path ? Theme.accentMuted : Theme.secondary; font.pixelSize: 13; Layout.fillWidth: true; horizontalAlignment: Text.AlignRight }
                        Text { text: "Histórico"; color: Theme.muted; font.pixelSize: 13 }
                        Text { text: Number(page.game.launch_count || 0) + (Number(page.game.launch_count || 0) === 1 ? " jogada" : " jogadas"); color: Theme.secondary; font.pixelSize: 13; Layout.fillWidth: true; horizontalAlignment: Text.AlignRight }
                    }
                }
            }
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: galleryContent.implicitHeight + 28
                radius: 12
                color: Theme.panel
                border.color: Theme.border
                ColumnLayout {
                    id: galleryContent
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 8
                    Text { text: "Galeria"; color: Theme.text; font.pixelSize: 18; font.weight: Font.Bold }
                    Text { visible: page.gallery.length === 0; text: "Nenhuma imagem baixada"; color: Theme.muted; font.pixelSize: 13 }
                    Flow {
                        Layout.fillWidth: true
                        spacing: 10
                        Repeater {
                            model: page.gallery
                            delegate: Rectangle {
                                required property var modelData
                                width: 132
                                height: 96
                                radius: 8
                                color: Theme.card
                                clip: true
                                Image {
                                    anchors.fill: parent
                                    anchors.bottomMargin: 20
                                    source: page.serviceMode && page.gameService ? page.gameService.mediaUrl(modelData.path) : ""
                                    fillMode: Image.PreserveAspectCrop
                                }
                                Text {
                                    anchors.left: parent.left
                                    anchors.right: parent.right
                                    anchors.bottom: parent.bottom
                                    anchors.margins: 5
                                    text: modelData.label
                                    color: Theme.secondary
                                    font.pixelSize: 10
                                    elide: Text.ElideRight
                                }
                            }
                        }
                    }
                }
            }
            Item { Layout.preferredHeight: 4 }
        }
    }
}
