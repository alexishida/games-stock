/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Hero e paineis usam a composicao lateral do GameDetail.css. */
/* Página de detalhe do jogo, equivalente ao GameDetail do renderer Electron. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Effects
import QtQuick.Dialogs
import QtCore
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
    /* O visualizador reutiliza a galeria existente e não interfere no layout do detalhe. */
    property int imageIndex: -1
    readonly property var selectedImage: imageIndex >= 0 && imageIndex < gallery.length ? gallery[imageIndex] : null

    /** Abre a mídia escolhida, mantendo navegação circular e Escape no overlay compartilhado. */
    function openImage(path) {
        for (let index = 0; index < gallery.length; index++) {
            if (gallery[index].path === path) {
                imageIndex = index
                imageViewer.open()
                return
            }
        }
    }
    function stepImage(direction) {
        if (gallery.length) imageIndex = (imageIndex + direction + gallery.length) % gallery.length
    }
    /* A página tem fundo próprio; o brilho da biblioteca não atravessa o detalhe. */
    Rectangle { anchors.fill: parent; color: Theme.background }
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
        imageViewer.close()
        imageIndex = -1
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
        id: detailViewport
        anchors.fill: parent
        /* Reserva o trilho de 6 px e 12 px de respiro para ações e cartões não encostarem nele. */
        contentWidth: Math.max(0, width - (contentHeight > height ? 18 : 0))
        contentHeight: body.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        ScrollBar.vertical: CollectionScrollBar { }
        ColumnLayout {
            id: body
            width: detailViewport.contentWidth
            spacing: 18
            Item {
                Layout.fillWidth: true
                Layout.preferredHeight: 300
                /* O fundo usa a midia do jogo, com as camadas tonais do hero CSS. */
                Image {
                    id: heroBackground
                    anchors.fill: parent
                    source: page.serviceMode && page.gameService && (page.game.background_path || page.game.screenshot_path) ? page.gameService.mediaUrl(page.game.background_path || page.game.screenshot_path) : ""
                    fillMode: Image.PreserveAspectCrop
                    visible: false
                }
                MultiEffect { anchors.fill: parent; source: heroBackground; visible: heroBackground.status === Image.Ready; blurEnabled: true; blur: 1; blurMax: 32; autoPaddingEnabled: false }
                Rectangle {
                    anchors.fill: parent
                    visible: heroBackground.status === Image.Ready
                    gradient: Gradient {
                        GradientStop { position: 0; color: "#14131313" }
                        GradientStop { position: 0.66; color: "#b3131313" }
                        GradientStop { position: 1; color: Theme.background }
                    }
                }
            RowLayout {
                anchors.top: parent.top; anchors.right: parent.right; z: 2
                spacing: 8
                Item { Layout.fillWidth: true }
                ActionButton { objectName: "detailBack"; font.pixelSize: 13; font.weight: Theme.cssFontWeight(Font.ExtraBold); font.family: Theme.heavyFontFamily; text: "Biblioteca"; iconName: "library"; onClicked: page.closeRequested() }
                ActionButton { objectName: "previousGame"; iconName: "chevron-left"; implicitWidth: 40; visible: page.hasPrevious; enabled: page.hasPrevious; Accessible.name: "Jogo anterior"; onClicked: page.previousRequested() }
                ActionButton { objectName: "nextGame"; iconName: "chevron-right"; implicitWidth: 40; visible: page.hasNext; enabled: page.hasNext; Accessible.name: "Próximo jogo"; onClicked: page.nextRequested() }
            }
            RowLayout {
                anchors.fill: parent
                anchors.bottomMargin: 20
                /* Na janela mínima, a capa cede espaço para preservar toda a linha de ações. */
                spacing: body.width < 780 ? 16 : 28
                Rectangle {
                    Layout.preferredWidth: body.width < 780 ? 150 : 195
                    Layout.minimumWidth: body.width < 780 ? 150 : 195
                    Layout.maximumWidth: body.width < 780 ? 150 : 195
                    Layout.preferredHeight: 280
                    Layout.alignment: Qt.AlignBottom
                    rotation: -1
                    radius: 16
                    border.color: Theme.border
                    color: Theme.card
                    clip: true
                    layer.enabled: true
                    layer.effect: MultiEffect { maskEnabled: true; maskSource: detailCoverMask }
                    Rectangle { id: detailCoverMask; anchors.fill: parent; radius: 16; visible: false; layer.enabled: true }
                    TapHandler { enabled: !!page.game.box_art_path; onTapped: page.openImage(page.game.box_art_path) }
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
                    Rectangle { anchors.fill: parent; radius: 16; color: "transparent"; border.color: Theme.border }
                }
                ColumnLayout {
                    /* Título e metadados ocupam toda a lateral da capa; ações ficam na linha seguinte. */
                    Layout.fillWidth: true
                    Layout.alignment: Qt.AlignBottom
                    Layout.bottomMargin: 8
                    spacing: 6
                    RowLayout {
                        spacing: 6
                        Repeater {
                            model: [page.game.platform_name || "Sem plataforma",
                                page.game.year ? String(page.game.year) : "",
                                page.game.rating || ""].filter(function(value) { return String(value).length > 0 })
                            delegate: Rectangle {
                                required property string modelData
                                radius: 999
                                color: Theme.accentSoft
                                border.color: "#4d00f2ff"
                                implicitWidth: chip.implicitWidth + 18
                                implicitHeight: 24
                                UiText {
                                    id: chip
                                    anchors.centerIn: parent
                                    text: modelData.toUpperCase()
                                    color: Theme.accent
                                    /* Rótulos de metadados precisam continuar legíveis em escala normal. */
                                    font.pixelSize: 13
                                    textWeight: Font.Black
                                }
                            }
                        }
                    }
                    UiText {
                        objectName: "gameDetailTitle"
                        text: page.game.title || ""
                        color: Theme.text
                        font.pixelSize: 28
                        textWeight: Font.Bold
                        lineHeightMode: Text.FixedHeight
                        lineHeight: 32.2
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                    }
                    UiText {
                        text: (page.game.publisher || "Publisher não informado") + " · " + (page.game.genre || "Gênero não informado")
                        color: Theme.accent
                        textWeight: Font.Bold
                        font.pixelSize: 14
                        wrapMode: Text.WrapAtWordBoundaryOrAnywhere
                        Layout.fillWidth: true
                    }
                    UiText {
                        visible: page.actionError.length > 0
                        text: page.actionError
                        color: "#ffb4ab"
                        font.pixelSize: 13
                        wrapMode: Text.WordWrap
                        Layout.fillWidth: true
                    }
                    RowLayout {
                        objectName: "gameDetailActions"
                        Layout.alignment: Qt.AlignRight
                        /* O respiro sobe os metadados, preservando os botões alinhados à base da capa. */
                        Layout.topMargin: 24
                        spacing: 8
                        ActionButton {
                            objectName: "launchGame"
                            font.pixelSize: 13
                            font.weight: Font.Black
                            font.family: Theme.heavyFontFamily
                            text: "Jogar"
                            iconName: "play-white"
                            successFill: true
                            implicitWidth: 132; implicitHeight: 44
                            enabled: page.serviceMode && !!page.game.rom_path
                                && page.launchService !== null && page.launchService !== undefined
                                && page.launchService.available === true
                            onClicked: page.launch()
                        }
                        ActionButton { objectName: "favoriteGame"; implicitWidth: 38; implicitHeight: 38; iconName: page.game.favorite ? "star-favorite-white" : "star"; warningFill: !!page.game.favorite; enabled: page.serviceMode; Accessible.name: page.game.favorite ? "Remover favorito" : "Marcar favorito"; onClicked: page.toggleFavorite() }
                        ActionButton { objectName: "completedGame"; implicitWidth: 38; implicitHeight: 38; iconName: page.game.play_status === "completed" ? "trophy-completed" : "trophy"; enabled: page.serviceMode; Accessible.name: "Concluído"; onClicked: page.toggleStatus("completed") }
                        ActionButton { objectName: "playingGame"; implicitWidth: 38; implicitHeight: 38; iconName: page.game.play_status === "playing" ? "gamepad-playing" : "gamepad-2"; enabled: page.serviceMode; Accessible.name: "Jogando"; onClicked: page.toggleStatus("playing") }
                        ActionButton { objectName: "editGame"; implicitWidth: 38; implicitHeight: 38; iconName: "pencil"; enabled: page.serviceMode; Accessible.name: "Editar"; onClicked: page.editRequested(page.game) }
                        ActionButton { objectName: "deleteGame"; implicitWidth: 38; implicitHeight: 38; iconName: "trash-2-danger"; dangerOutline: true; enabled: page.serviceMode; Accessible.name: "Excluir"; onClicked: page.deleteRequested(page.game) }
                    }
                }
            }
            }
            RowLayout {
                Layout.fillWidth: true
                spacing: 16
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredWidth: Math.max(0, body.width - 284)
                Layout.maximumWidth: Math.max(0, body.width - 284)
                Layout.fillHeight: true
                implicitHeight: Math.max(284, aboutContent.implicitHeight + 32)
                radius: 16
                color: Theme.panel
                border.color: Theme.border
                ColumnLayout {
                    id: aboutContent
                    anchors.left: parent.left; anchors.right: parent.right; anchors.top: parent.top
                    anchors.margins: 16
                    /* CSS: h2 com margin-bottom 12px e parágrafo com line-height 1.6. */
                    spacing: 12
                    UiText { text: "Descrição"; color: Theme.text; font.pixelSize: 18; textWeight: Font.Bold }
                    UiText { text: page.game.notes && page.game.notes.trim().length ? page.game.notes : "Sem descrição cadastrada para este jogo."; color: Theme.secondary; font.pixelSize: 14; lineHeight: 1.6; wrapMode: Text.WordWrap; Layout.fillWidth: true }
                }
            }
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredWidth: 268
                Layout.maximumWidth: 268
                Layout.minimumWidth: 260
                implicitHeight: Math.max(284, fileContent.implicitHeight + 32)
                radius: 16
                color: Theme.panel
                border.color: Theme.border
                ColumnLayout {
                    id: fileContent
                    anchors.fill: parent
                    anchors.margins: 16
                    /* O h2 do CSS usa margin 0 0 12px antes da lista dt/dd. */
                    spacing: 12
                    UiText { text: "Arquivo"; color: Theme.text; font.pixelSize: 18; textWeight: Font.Bold }
                    /* Cada linha distribui seu proprio espaco, como os pares dt/dd do CSS. */
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 11
                        RowLayout {
                            Layout.fillWidth: true
                            visible: true
                            spacing: 14
                            UiText { text: "ROM"; color: Theme.secondary; font.pixelSize: 13; Layout.fillWidth: true; wrapMode: Text.WordWrap }
                            UiText { text: page.fileName(page.game.rom_path); color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold; Layout.maximumWidth: fileContent.width * 0.62; horizontalAlignment: Text.AlignRight; wrapMode: Text.WrapAnywhere }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            visible: page.versions.length > 1
                            spacing: 14
                            UiText { text: "Arquivos encontrados"; color: Theme.secondary; font.pixelSize: 13; Layout.fillWidth: true; wrapMode: Text.WordWrap }
                            /* detail-info-row-wrap usa max-width 95% para caber os nomes em uma linha. */
                            UiText { text: page.versions.map(function(v) { return v.romFileName || "" }).filter(function(v, i, a) { return v.length > 0 && a.indexOf(v) === i }).join("\n"); color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold; Layout.maximumWidth: fileContent.width * 0.95; horizontalAlignment: Text.AlignRight; wrapMode: Text.WrapAnywhere }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            visible: page.versions.length > 1
                            spacing: 14
                            UiText { text: "Imagens agrupadas"; color: Theme.secondary; font.pixelSize: 13; Layout.fillWidth: true; wrapMode: Text.WordWrap }
                            UiText { text: String(page.gallery.length); color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold; Layout.maximumWidth: fileContent.width * 0.62; horizontalAlignment: Text.AlignRight; wrapMode: Text.WrapAnywhere }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            visible: true
                            spacing: 14
                            UiText { text: "Box Art"; color: Theme.secondary; font.pixelSize: 13; Layout.fillWidth: true; wrapMode: Text.WordWrap }
                            UiText { text: page.game.box_art_path ? "Associada" : "Não associada"; color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold; Layout.maximumWidth: fileContent.width * 0.62; horizontalAlignment: Text.AlignRight; wrapMode: Text.WrapAnywhere }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            visible: true
                            spacing: 14
                            UiText { text: "Status"; color: Theme.secondary; font.pixelSize: 13; Layout.fillWidth: true; wrapMode: Text.WordWrap }
                            UiText { text: page.game.rom_path ? "Pronto" : "Pendente"; color: Theme.success; font.pixelSize: 13; textWeight: Font.Bold; Layout.maximumWidth: fileContent.width * 0.62; horizontalAlignment: Text.AlignRight; wrapMode: Text.WrapAnywhere }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            visible: true
                            spacing: 14
                            UiText { text: "Histórico"; color: Theme.secondary; font.pixelSize: 13; Layout.fillWidth: true; wrapMode: Text.WordWrap }
                            UiText { text: "Jogadas: " + Number(page.game.launch_count || 0) + " vezes"; color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold; Layout.maximumWidth: fileContent.width * 0.62; horizontalAlignment: Text.AlignRight; wrapMode: Text.WrapAnywhere }
                        }
                    }
                }
            }
            }
            Rectangle {
                Layout.fillWidth: true
                implicitHeight: galleryContent.implicitHeight + 28
                radius: 16
                color: Theme.panel
                border.color: Theme.border
                ColumnLayout {
                    id: galleryContent
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 8
                    UiText { text: "Galeria"; color: Theme.text; font.pixelSize: 18; textWeight: Font.Bold }
                    UiText { visible: page.gallery.length === 0; text: "Nenhuma imagem baixada"; color: Theme.muted; font.pixelSize: 13 }
                    Flow {
                        Layout.fillWidth: true
                        spacing: 10
                        Repeater {
                            model: page.gallery
                            delegate: Rectangle {
                                id: galleryTile
                                required property var modelData
                                width: (galleryContent.width - (Math.max(1, Math.min(page.gallery.length, Math.floor((galleryContent.width + 10) / 230))) - 1) * 10) / Math.max(1, Math.min(page.gallery.length, Math.floor((galleryContent.width + 10) / 230)))
                                height: 240
                                radius: 8
                                color: Theme.card
                                clip: true
                                TapHandler { onTapped: page.openImage(galleryTile.modelData.path) }
                                Image {
                                    anchors.fill: parent
                                    anchors.bottomMargin: 20
                                    source: page.serviceMode && page.gameService ? page.gameService.mediaUrl(modelData.path) : ""
                                    fillMode: Image.PreserveAspectCrop
                                }
                                UiText {
                                    anchors.left: parent.left
                                    anchors.right: parent.right
                                    anchors.bottom: parent.bottom
                                    anchors.margins: 5
                                    text: modelData.label
                                    color: Theme.secondary
                                    font.pixelSize: 12
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
    /* A ampliação é um overlay arrastável, com a mesma gestão de foco e blur dos outros fluxos. */
    DragDialog {
        id: imageViewer
        objectName: "gameImageViewer"
        heading: page.selectedImage ? page.selectedImage.label : "Imagem"
        showHeading: true
        width: Math.min(960, parent.width - 48)
        height: Math.min(740, parent.height - 48)
        property string saveError: ""
        onAboutToShow: saveError = ""
        onBackdropBlurRequested: function(active) {
            const host = page.Window.window
            if (host && host.blurDepth !== undefined) host.blurDepth = Math.max(0, host.blurDepth + (active ? 1 : -1))
        }
        contentItem: ColumnLayout {
            spacing: 12
            Image {
                Layout.fillWidth: true
                Layout.fillHeight: true
                source: page.selectedImage && page.gameService ? page.gameService.mediaUrl(page.selectedImage.path) : ""
                fillMode: Image.PreserveAspectFit
                asynchronous: true
                TapHandler { onTapped: page.stepImage(1) }
                Accessible.name: page.selectedImage ? page.selectedImage.label : "Imagem"
            }
            UiText { visible: imageViewer.saveError.length > 0; text: imageViewer.saveError; color: Theme.danger; Layout.fillWidth: true; wrapMode: Text.WordWrap }
            RowLayout {
                Layout.fillWidth: true
                ActionButton { objectName: "previousGameImage"; text: "Anterior"; visible: page.gallery.length > 1; onClicked: page.stepImage(-1) }
                UiText { text: page.selectedImage ? String(page.imageIndex + 1) + " / " + page.gallery.length : ""; color: Theme.secondary }
                ActionButton { objectName: "nextGameImage"; text: "Próxima"; visible: page.gallery.length > 1; onClicked: page.stepImage(1) }
                Item { Layout.fillWidth: true }
                ActionButton { objectName: "closeGameImage"; text: "Fechar"; onClicked: imageViewer.close() }
                ActionButton { objectName: "saveGameImage"; text: "Salvar imagem"; enabled: page.selectedImage !== null && page.gameService !== null; onClicked: saveImageDialog.open() }
            }
        }
        Shortcut { sequence: "Left"; enabled: imageViewer.opened; onActivated: page.stepImage(-1) }
        Shortcut { sequence: "Right"; enabled: imageViewer.opened; onActivated: page.stepImage(1) }
    }
    FileDialog {
        id: saveImageDialog
        title: "Salvar imagem"
        fileMode: FileDialog.SaveFile
        nameFilters: ["Imagens (*.jpg *.jpeg *.png *.webp)"]
        /* StandardPaths em QML retorna URL; codificar só o nome preserva espaços e #. */
        currentFile: page.selectedImage ? String(StandardPaths.writableLocation(StandardPaths.PicturesLocation)) + "/" + encodeURIComponent(page.fileName(page.selectedImage.path)) : ""
        onAccepted: {
            if (!page.selectedImage || !page.gameService) return
            const result = page.gameService.saveImage(page.selectedImage.path, selectedFile)
            imageViewer.saveError = result.success ? "" : (result.error || "Não foi possível salvar a imagem.")
        }
    }
}
