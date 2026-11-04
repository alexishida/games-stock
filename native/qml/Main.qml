/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Seletores usam FormSelect para manter padding, altura e menu iguais ao Electron. */
/* Protótipo navegável da biblioteca; apenas dados sintéticos, sem escrita no SQLite. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Effects
import GameStock
import "components"

ApplicationWindow {
    id: window
    required property var fixtureLibrary
    required property var prototypeCatalog
    required property var gameService
    required property var platformService
    required property var emulatorService
    required property var launchService
    required property var inventoryPreferences
    property var inventoryService: null
    property bool inventoryMode: false
    property bool prototypeInventoryOpen: false
    property bool prototypeInventoryForm: false
    property bool prototypeInventoryNewType: false
    property bool prototypeInventoryDetail: false
    property bool prototypeInventoryEdit: false
    property bool prototypeInventoryDelete: false
    property bool prototypeInventoryList: false
    property bool prototypeLogsOpen: false
    property bool prototypeBackupOpen: false
    property bool prototypeUpdateSplash: false
    property var jobManager: null
    property var settingsService: null
    property var backupCoordinator: null
    property var updateService: null
    property var romFolderService: null
    property var mediaSyncService: null
    property var metadataService: null
    required property bool prototypeListView
    required property string prototypeSearch
    required property bool prototypeBenchmark
    required property bool prototypeSettingsOpen
    required property bool prototypeStackedOpen
    required property bool prototypeDetailOpen
    property bool prototypeDetailEdit: false
    property bool prototypeDetailVersions: false
    required property bool prototypePlatformsOpen
    property bool prototypePlatformNew: false
    property bool prototypePlatformEdit: false
    property bool prototypePlatformMappings: false
    required property bool prototypeEmulatorsOpen
    property bool prototypeEmulatorNew: false
    property bool prototypeEmulatorEdit: false
    property bool prototypeEmulatorLinks: false
    property bool prototypeEmulatorLink: false
    property bool prototypeEmulatorCores: false
    required property bool prototypePlayHistoryOpen
    property bool prototypeRomImporterOpen: false
    property bool prototypeCoversOpen: false
    required property bool prototypeDisableBlur
    required property int prototypeBlurRadius
    required property int prototypeShadowBlur
    required property int prototypeModalShadowBlur
    required property string buildLabel
    visible: true
    minimumWidth: 1024
    minimumHeight: 768
    width: 1122
    height: 957
    title: "GameStock v" + window.buildLabel
    color: Theme.background
    font.family: Theme.fontFamily
    /* Controls Basic também herdam paleta escura, inclusive seletores e estados desabilitados. */
    palette.window: Theme.background
    palette.base: Theme.panel
    palette.button: Theme.control
    palette.text: Theme.text
    palette.windowText: Theme.text
    palette.buttonText: Theme.text
    palette.highlight: Theme.accent
    palette.highlightedText: Theme.accentForeground
    property bool fixtureListView: prototypeListView
    /* A visualização da biblioteca é persistida; o inventário terá estado próprio. */
    readonly property bool listView: dbMode ? gameService.viewMode === "list" : fixtureListView
    property bool benchmarkPulse: false
    /* Contador compartilhado: cada diálogo informa quando precisa do fundo desfocado. */
    property int blurDepth: 0
    property var selectedGame: null
    /* Nulo cria um jogo; um mapa de catálogo abre a edição. */
    property var formGame: null
    property string settingsSection: "sobre"
    /* Modo banco usa a página do serviço nativo; a fixture continua servindo às capturas. */
    readonly property bool dbMode: gameService !== null && gameService !== undefined && gameService.available === true
    readonly property bool libraryService: dbMode || window.fixtureLibrary.enabled
    readonly property bool inventoryAvailable: window.inventoryService !== null && window.inventoryService !== undefined && window.inventoryService.available === true
    readonly property var libCounts: dbMode ? ({all: gameService.total, mostPlayed: gameService.mostPlayedCount, favorites: gameService.favoritesCount, playing: gameService.playingCount, completed: gameService.completedCount}) : window.fixtureLibrary.counts
    readonly property int filteredTotal: dbMode ? gameService.filtered : window.fixtureLibrary.filtered
    readonly property int allTotal: dbMode ? gameService.total : window.fixtureLibrary.total
    readonly property int currentPage: dbMode ? gameService.page : window.fixtureLibrary.page
    readonly property string activeCollection: dbMode ? gameService.collection : window.fixtureLibrary.collection
    readonly property string activeGenre: dbMode ? gameService.genre : window.fixtureLibrary.genre
    readonly property string activeSortBy: dbMode ? gameService.sortBy : window.fixtureLibrary.sortBy
    readonly property bool activeIncludeMissingCovers: dbMode ? gameService.includeMissingCovers : window.fixtureLibrary.includeMissingCovers
    readonly property var activeGenres: dbMode ? gameService.genres : window.fixtureLibrary.genres
    /* A lista de plataformas só existe quando o serviço nativo abriu o banco. */
    readonly property var platformCatalog: (window.platformService !== null && window.platformService !== undefined && window.platformService.available) ? window.platformService.items : []
    readonly property int activePlatformId: dbMode ? gameService.platformId : 0
    /* A árvore replica o PlatformTree: só plataformas com jogos, agrupadas por categoria. */
    readonly property var sidebarPlatforms: {
        if (!window.dbMode) return []
        const groups = ({})
        for (let index = 0; index < window.platformCatalog.length; index++) {
            const platform = window.platformCatalog[index]
            if (Number(platform.gameCount || 0) <= 0) continue
            const category = platform.category || ""
            if (!groups[category]) groups[category] = []
            groups[category].push(platform)
        }
        const categories = Object.keys(groups).sort(function(left, right) { return left.localeCompare(right, "pt-BR") })
        const ordered = []
        for (let index = 0; index < categories.length; index++) {
            const entries = groups[categories[index]]
            entries.sort(function(left, right) { return String(left.name).localeCompare(String(right.name), "pt-BR", {sensitivity: "base"}) })
            for (let entry = 0; entry < entries.length; entry++) ordered.push(entries[entry])
        }
        return ordered
    }
    property var catalog: dbMode ? window.gameService.items : (window.fixtureLibrary.enabled ? window.fixtureLibrary.games : prototypeCatalog)
    /* Filtro de fixture serve à comparação visual; consultas SQL terão modelo C++ paginado. */
    readonly property var visibleGames: catalog.filter(function(game) {
        return window.dbMode || window.fixtureLibrary.enabled || !search.text || game.title.toLowerCase().includes(search.text.toLowerCase())
    })
    readonly property int selectedIndex: {
        if (!window.selectedGame) return -1
        for (let index = 0; index < window.catalog.length; index++) {
            if (window.catalog[index].id === window.selectedGame.id) return index
        }
        return -1
    }
    readonly property bool hasPreviousGame: window.selectedIndex > 0 || window.currentPage > 1
    readonly property bool hasNextGame: window.selectedIndex >= 0
        && (window.selectedIndex < window.catalog.length - 1 || window.currentPage * 36 < window.filteredTotal)

    /* Os filtros da sidebar e da TopBar falam com o serviço ativo, sem SQL na interface. */
    function setCollection(value) {
        if (window.dbMode) window.gameService.collection = value
        else window.fixtureLibrary.setCollection(value)
    }
    function setSearch(value) {
        if (window.dbMode) window.gameService.search = value
        else window.fixtureLibrary.setSearch(value)
    }
    function setGenre(value) {
        if (window.dbMode) window.gameService.genre = value
        else window.fixtureLibrary.setGenre(value)
    }
    function setSortBy(value) {
        if (window.dbMode) window.gameService.sortBy = value
        else window.fixtureLibrary.setSortBy(value)
    }
    function setIncludeMissingCovers(value) {
        if (window.dbMode) window.gameService.includeMissingCovers = value
        else window.fixtureLibrary.setIncludeMissingCovers(value)
    }
    function setPlatformFilter(value) {
        if (window.dbMode) window.gameService.platformId = value
    }
    function setListView(value) {
        if (window.dbMode) window.gameService.viewMode = value ? "list" : "grid"
        else window.fixtureListView = value
    }

    /* Uma nova página deve começar no topo nas duas visualizações da coleção. */
    function goToLibraryPage(page) {
        window.dbMode ? window.gameService.goToPage(page) : window.fixtureLibrary.goToPage(page)
        gridScroll.contentY = 0
        listBody.positionViewAtBeginning()
    }

    /* Abre o detalhe do jogo; a página reage à troca de `libraryGame`. */
    function openGame(game) {
        if (!game) return
        window.selectedGame = game
        detail.reload()
    }

    function closeGameDetail() {
        window.selectedGame = null
    }

    /* Navega no catálogo atual e atravessa a borda da página, como o GameDetail Electron. */
    function selectAdjacent(delta) {
        if (!window.selectedGame) return
        const index = window.selectedIndex
        if (index >= 0 && index + delta >= 0 && index + delta < window.catalog.length) {
            window.openGame(window.catalog[index + delta])
            return
        }
        if (delta > 0 && window.currentPage * 36 < window.filteredTotal) {
            window.goToLibraryPage(window.currentPage + 1)
            if (window.catalog.length) window.openGame(window.catalog[0])
        } else if (delta < 0 && window.currentPage > 1) {
            window.goToLibraryPage(window.currentPage - 1)
            if (window.catalog.length) window.openGame(window.catalog[window.catalog.length - 1])
        }
    }

    /** Título da seção exibido acima do conteúdo, como o header do SettingsModal Electron. */
    function settingsHeader(section) {
        return ({
            plataformas: "Gerenciar plataformas",
            emuladores: "Gerenciar emuladores",
            biblioteca: "Gerenciar biblioteca",
            covers: "Gerenciar mídia da biblioteca",
            partidas: "Histórico de partidas"
        })[section] || ""
    }

    function openCreateForm() {
        window.formGame = null
        gameForm.open()
    }

    function openEditForm(game) {
        window.formGame = game
        gameForm.open()
    }

    /* Seleciona o jogo recém-salvo mesmo quando ele não está na página filtrada. */
    function afterGameSaved(gameId) {
        if (!window.dbMode) return
        const saved = window.gameService.get(gameId)
        if (saved && saved.id) {
            window.selectedGame = saved
            detail.reload()
        }
    }

    function requestDelete(game) {
        confirmDelete.message = "Excluir \"" + (game ? game.title : "") + "\" da biblioteca?"
        confirmDelete.detail = "O jogo sairá da biblioteca; as ROMs físicas não serão apagadas."
        confirmDelete.confirmText = "Deletar"
        confirmDelete.error = ""
        confirmDelete.target = game
        confirmDelete.open()
    }

    function confirmDeleteGame() {
        const target = confirmDelete.target
        if (!target) return
        if (!window.dbMode) {
            confirmDelete.close()
            return
        }
        let index = -1
        for (let position = 0; position < window.catalog.length; position++) {
            if (window.catalog[position].id === target.id) { index = position; break }
        }
        if (!window.gameService.remove(target.id)) {
            confirmDelete.error = window.gameService.error
            return
        }
        confirmDelete.close()
        if (window.catalog.length === 0) {
            window.selectedGame = null
        } else {
            window.openGame(window.catalog[Math.min(index < 0 ? 0 : index, window.catalog.length - 1)])
        }
    }

    function requestPlatformDelete(platform) {
        platformConfirm.message = "Remover a plataforma \"" + (platform ? platform.name : "") + "\"?"
        platformConfirm.detail = "A plataforma só pode ser removida quando não possui jogos ou itens vinculados."
        platformConfirm.confirmText = "Remover"
        platformConfirm.error = ""
        platformConfirm.target = platform
        platformConfirm.open()
    }

    function confirmPlatformDelete() {
        const target = platformConfirm.target
        if (!target) return
        if (!window.dbMode || !window.platformService) {
            platformConfirm.close()
            return
        }
        if (!window.platformService.remove(Number(target.id))) {
            platformConfirm.error = window.platformService.error
            return
        }
        if (Number(window.gameService.platformId) === Number(target.id)) window.gameService.platformId = 0
        platformConfirm.close()
    }

    function requestEmulatorDelete(emulator) {
        emulatorConfirm.message = "Remover o emulador \"" + (emulator ? emulator.name : "") + "\"?"
        emulatorConfirm.detail = "Os vínculos de plataforma deste emulador também serão removidos."
        emulatorConfirm.confirmText = "Remover"
        emulatorConfirm.error = ""
        emulatorConfirm.target = emulator
        emulatorConfirm.open()
    }

    function confirmEmulatorDelete() {
        const target = emulatorConfirm.target
        if (!target) return
        if (!window.dbMode || !window.emulatorService) {
            emulatorConfirm.close()
            return
        }
        if (!window.emulatorService.remove(Number(target.id))) {
            emulatorConfirm.error = window.emulatorService.error
            return
        }
        emulatorConfirm.close()
    }

    function requestResetStats() {
        resetConfirm.message = "Resetar todo o contador de partidas jogadas?"
        resetConfirm.detail = "Os contadores de todos os jogos voltarão a zero."
        resetConfirm.confirmText = "Resetar"
        resetConfirm.error = ""
        resetConfirm.open()
    }

    function confirmResetStats() {
        if (!window.dbMode) {
            resetConfirm.close()
            return
        }
        const result = window.gameService.resetLaunchStats()
        if (!result || !result.success) {
            resetConfirm.error = window.gameService.error
            return
        }
        resetConfirm.close()
        window.gameService.refresh()
    }

    /* Comandos do menu Electron permanecem acessiveis por contexto e atalhos. */
    Menu {
        id: libraryActionsMenu
        objectName: "libraryActionsMenu"
        MenuItem {
            objectName: "createGame"
            action: Action { text: "Novo jogo"; shortcut: StandardKey.New; enabled: window.dbMode; onTriggered: window.openCreateForm() }
        }
        MenuItem {
            objectName: "openMetadataImporter"
            action: Action { text: "Importar metadados"; shortcut: "Ctrl+I"; enabled: window.dbMode; onTriggered: metadataImporter.openFor("", "") }
        }
    }

    /* Coordenadas lógicas na janela permitem comparar a captura com o DOM Electron. */
    function geometrySnapshot() {
        function bounds(item) {
            if (!item) return null
            const point = item.mapToItem(null, 0, 0)
            return { x: point.x, y: point.y, width: item.width, height: item.height }
        }
        // As caixas de texto permitem comparar fonte e alinhamento com as medidas do DOM Electron.
        const typography = []
        const names = ["navigationLabel", "navigationCounter", "libraryCardPlatform", "libraryCardTitle", "inventoryCardCover", "inventoryCardPlatform", "inventoryCardTitle"]
        function collect(item) {
            if (!item || !item.visible) return
            if (names.indexOf(item.objectName) >= 0) {
                const entry = {role: item.objectName, rect: bounds(item)}
                if (item.font !== undefined) {
                    entry.text = item.text
                    entry.font = {family: item.font.family, size: item.font.pixelSize, weight: item.font.weight}
                }
                if (item.objectName === "navigationLabel") entry.row = bounds(item.parent.parent)
                typography.push(entry)
            }
            const children = item.children || []
            for (let i = 0; i < children.length; ++i) collect(children[i])
        }
        collect(window.contentItem)
        return { viewport: { width: window.width, height: window.height, scale: Screen.devicePixelRatio }, sidebar: bounds(sidebar), topbar: bounds(topbar), search: bounds(search), firstCard: bounds(gameCards.itemAt(0)), typography: typography }
    }

    /* Os filtros mantêm o tamanho, contraste e foco dos seletores da biblioteca Electron. */
    component FilterSelect: FormSelect {
        id: select
        implicitHeight: 30
        font.pixelSize: Theme.formControlFontSize
        font.weight: Font.Bold
        contentItem: UiText {
            text: select.displayText
            font: select.font
            color: Theme.text
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
        }
    }

    /* O brilho discreto pertence à superfície inteira e permanece atrás da navegação. */
    Canvas {
        anchors.fill: parent
        z: -1
        onWidthChanged: requestPaint()
        onHeightChanged: requestPaint()
        onPaint: {
            const context = getContext("2d")
            context.reset()
            const cx = width * 0.76
            const cy = height * 0.12
            const radius = Math.sqrt(cx * cx + (height - cy) * (height - cy)) * 0.28
            const glow = context.createRadialGradient(cx, cy, 0, cx, cy, radius)
            glow.addColorStop(0, "rgba(0,242,255,0.06)")
            glow.addColorStop(1, "rgba(0,242,255,0)")
            context.fillStyle = glow
            context.fillRect(0, 0, width, height)
        }
    }

    RowLayout {
        id: applicationSurface
        anchors.fill: parent
        spacing: 0
        /* O backdrop-filter do CSS desfoca a superfície inteira abaixo do overlay modal. */
        layer.enabled: window.blurDepth > 0 && !window.prototypeDisableBlur
        layer.effect: MultiEffect {
            blurEnabled: true
            blur: 1.0
            /* MultiEffect limita o raio por blurMax; a referência usa 8 px. */
            blurMax: window.prototypeBlurRadius > 0 ? window.prototypeBlurRadius : Theme.backdropBlurMax
        }
        /* A pulsação altera a fonte do blur apenas durante o benchmark controlado. */
        opacity: window.prototypeBenchmark && window.benchmarkPulse ? 0.99 : 1
        Rectangle {
            id: sidebar
            Layout.preferredWidth: Theme.sidebarWidth
            Layout.fillHeight: true
            color: Theme.sidebar
            /* box-shadow elevado da sidebar; o backdrop-filter não muda o gradiente plano. */
            layer.enabled: true
            layer.effect: MultiEffect {
                shadowEnabled: true
                blurMax: Theme.shadowElevatedBlurMax
                shadowColor: Theme.shadowElevatedColor
                shadowBlur: 1.0
                shadowHorizontalOffset: 0
                shadowVerticalOffset: Theme.shadowElevatedOffsetY
                autoPaddingEnabled: true
            }
            Rectangle { anchors.right: parent.right; height: parent.height; width: 1; color: Theme.border }
            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 12
                /* A borda de 1 px da sidebar entra no box-sizing do CSS original. */
                anchors.rightMargin: 13
                anchors.topMargin: 10
                anchors.bottomMargin: 10
                spacing: 8
                /* A marca mantém a proporção do asset e o espaçamento próprio do renderer. */
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 4
                    Image { source: "qrc:/qt/qml/GameStock/assets/logo.png"; fillMode: Image.PreserveAspectFit; Layout.fillWidth: true; Layout.preferredHeight: 119 }
                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2
                        UiText { text: "GAMES MANAGEMENT"; color: Theme.muted; font.pixelSize: 9; textWeight: Font.ExtraBold; font.letterSpacing: 1.62; Layout.fillWidth: true; horizontalAlignment: Text.AlignHCenter }
                        UiText { text: "v" + window.buildLabel; color: Theme.secondary; font.pixelSize: 10; textWeight: Font.Bold; font.letterSpacing: 0.8; Layout.fillWidth: true; horizontalAlignment: Text.AlignHCenter }
                    }
                }
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 3
                    NavigationButton {
                        objectName: "librarySection"
                        text: "Biblioteca"
                        selected: !window.inventoryMode
                        Layout.fillWidth: true
                        onClicked: window.inventoryMode = false
                    }
                    NavigationButton {
                        objectName: "inventorySection"
                        text: "Inventário"
                        iconName: "cpu"
                        selected: window.inventoryMode
                        Layout.fillWidth: true
                        enabled: window.inventoryAvailable
                        onClicked: window.inventoryMode = true
                    }
                }
                /* Margens do separador seguem o Sidebar.css, sem comprimir as cole??es. */
                Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; Layout.leftMargin: 10; Layout.rightMargin: 10; Layout.topMargin: 4; Layout.bottomMargin: 4; color: Theme.border }
                /* A área contextual rola sozinha; as ações do rodapé permanecem acessíveis. */
                Flickable {
                    id: sidebarContextViewport
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    /* A faixa de rolagem não deve cobrir os contadores da navegação. */
                    contentWidth: width - (contentHeight > height ? 6 : 0)
                    contentHeight: sidebarContext.implicitHeight
                    clip: true
                    boundsBehavior: Flickable.StopAtBounds
                    ScrollBar.vertical: CollectionScrollBar {
                        policy: ScrollBar.AsNeeded
                        width: 6
                        background: Rectangle { implicitWidth: 6; color: Theme.sidebar }
                        contentItem: Rectangle { implicitWidth: 6; radius: 3; color: parent.pressed ? Theme.borderStrong : Theme.elevated }
                    }
                    ColumnLayout {
                        id: sidebarContext
                        width: sidebarContextViewport.contentWidth
                        spacing: 3
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 3
                            visible: !window.inventoryMode
                            NavigationButton { text: "Todos os jogos"; compact: true; counter: ((window.dbMode || window.fixtureLibrary.enabled) ? window.libCounts.all : window.catalog.length).toString(); selected: window.activeCollection === "all"; Layout.fillWidth: true; enabled: window.libraryService; onClicked: window.setCollection("all") }
                            NavigationButton { text: "Mais Jogados"; compact: true; iconName: "chart-no-axes-column"; counter: String(window.libCounts.mostPlayed || 0); selected: window.activeCollection === "mostPlayed"; Layout.fillWidth: true; enabled: window.libraryService; onClicked: window.setCollection("mostPlayed") }
                            NavigationButton { text: "Favoritos"; compact: true; iconName: "star"; counter: String(window.libCounts.favorites || 0); selected: window.activeCollection === "favorites"; Layout.fillWidth: true; enabled: window.libraryService; onClicked: window.setCollection("favorites") }
                            NavigationButton { text: "Jogando"; compact: true; iconName: "gamepad-2"; counter: String(window.libCounts.playing || 0); selected: window.activeCollection === "playing"; Layout.fillWidth: true; enabled: window.libraryService; onClicked: window.setCollection("playing") }
                            NavigationButton { text: "Concluído"; compact: true; iconName: "trophy"; counter: String(window.libCounts.completed || 0); selected: window.activeCollection === "completed"; Layout.fillWidth: true; enabled: window.libraryService; onClicked: window.setCollection("completed") }
                        }
                        /* As margens completam os 9 px medidos entre coleção e árvore de plataformas. */
                        Rectangle { Layout.fillWidth: true; Layout.preferredHeight: 1; Layout.topMargin: 1; Layout.bottomMargin: 1; color: Theme.border; visible: !window.inventoryMode }
                        ColumnLayout {
                            objectName: "platformTree"
                            Layout.fillWidth: true
                            spacing: 0
                            visible: !window.inventoryMode
                            /* A árvore mostra o total e somente plataformas com jogos, como o PlatformTree. */
                            NavigationButton { objectName: "allPlatforms"; text: "Todos"; iconName: ""; treeItem: true; platformItem: true; counter: ((window.dbMode || window.fixtureLibrary.enabled) ? window.libCounts.all : window.visibleGames.length).toString(); selected: window.activePlatformId === 0; Layout.fillWidth: true; enabled: window.libraryService; onClicked: window.setPlatformFilter(0) }
                            Repeater {
                                model: window.dbMode ? window.sidebarPlatforms : (window.fixtureLibrary.enabled ? [{id: 0, name: "Fixture Console"}] : [])
                                delegate: NavigationButton {
                                    required property var modelData
                                    objectName: "platformTreeItem"
                                    platformItem: true
                                    text: modelData.name
                                    iconName: ""
                                    treeItem: true
                                    counter: window.dbMode ? String(window.gameService.platformCounts[String(modelData.id)] || 0) : String(window.libCounts.all)
                                    selected: window.dbMode && Number(window.activePlatformId) === Number(modelData.id)
                                    Layout.fillWidth: true
                                    enabled: window.libraryService && window.dbMode
                                    onClicked: window.setPlatformFilter(Number(modelData.id))
                                }
                            }
                        }
                        /* Filtros de tipo e condição substituem a árvore de plataformas no inventário. */
                        ColumnLayout {
                            objectName: "inventoryFilters"
                            Layout.fillWidth: true
                            spacing: 0
                            visible: window.inventoryMode
                            UiText { text: "Tipo"; color: Theme.muted; font.pixelSize: Theme.navigationSectionFontSize; textWeight: Font.Black; Layout.leftMargin: 10; Layout.topMargin: 12; Layout.bottomMargin: 2; lineHeightMode: Text.FixedHeight; lineHeight: 12 }
                            NavigationButton {
                                objectName: "allInventoryTypes"
                                text: "Todos"
                                treeItem: true
                                iconName: ""
                                counter: window.inventoryAvailable ? String(window.inventoryService.total) : "0"
                                selected: window.inventoryAvailable && Number(window.inventoryService.itemTypeId) === 0
                                Layout.fillWidth: true
                                onClicked: if (window.inventoryAvailable) window.inventoryService.itemTypeId = 0
                            }
                            Repeater {
                                model: window.inventoryAvailable ? window.inventoryService.typeCounts : []
                                delegate: NavigationButton {
                                    required property var modelData
                                    text: modelData.name
                                    treeItem: true
                                iconName: ""
                                    counter: String(modelData.count || 0)
                                    selected: window.inventoryAvailable && Number(window.inventoryService.itemTypeId) === Number(modelData.id)
                                    Layout.fillWidth: true
                                    onClicked: if (window.inventoryAvailable) {
                                        const current = Number(window.inventoryService.itemTypeId)
                                        window.inventoryService.itemTypeId = current === Number(modelData.id) ? 0 : Number(modelData.id)
                                    }
                                }
                            }
                            UiText { text: "Condição"; color: Theme.muted; font.pixelSize: Theme.navigationSectionFontSize; textWeight: Font.Black; Layout.leftMargin: 10; Layout.topMargin: 14; Layout.bottomMargin: 2; lineHeightMode: Text.FixedHeight; lineHeight: 12 }
                            NavigationButton {
                                objectName: "allInventoryStates"
                                text: "Todas"
                                treeItem: true
                                iconName: ""
                                counter: window.inventoryAvailable ? String(window.inventoryService.total) : "0"
                                selected: window.inventoryAvailable && Number(window.inventoryService.conservationStateId) === 0
                                Layout.fillWidth: true
                                onClicked: if (window.inventoryAvailable) window.inventoryService.conservationStateId = 0
                            }
                            Repeater {
                                model: window.inventoryAvailable ? window.inventoryService.stateCounts : []
                                delegate: NavigationButton {
                                    required property var modelData
                                    text: modelData.name
                                    treeItem: true
                                iconName: ""
                                    counter: String(modelData.count || 0)
                                    selected: window.inventoryAvailable && Number(window.inventoryService.conservationStateId) === Number(modelData.id)
                                    Layout.fillWidth: true
                                    onClicked: if (window.inventoryAvailable) {
                                        const current = Number(window.inventoryService.conservationStateId)
                                        window.inventoryService.conservationStateId = current === Number(modelData.id) ? 0 : Number(modelData.id)
                                    }
                                }
                            }
                            UiText {
                                visible: !window.inventoryAvailable || (window.inventoryService && window.inventoryService.typeCounts.length === 0)
                                text: "Nenhum item no inventário ainda."
                                color: Theme.muted
                                font.pixelSize: 12
                                wrapMode: Text.WordWrap
                                Layout.fillWidth: true
                            }
                        }
                    }
                }
                ActionButton {
                    objectName: "newHardwareItem"
                    visible: window.inventoryMode
                    text: "Novo item"
                    sidebarAction: true
                    Layout.minimumHeight: 38
                    Layout.preferredHeight: 38
                    font.weight: Font.Black
                    iconName: "plus"
                    primary: true
                    Layout.fillWidth: true
                    enabled: window.inventoryAvailable
                    onClicked: inventoryPage.openCreate()
                }
                ActionButton { objectName: "openSettings"; sidebarAction: true; Layout.minimumHeight: 38; Layout.preferredHeight: 38; font.weight: Font.Black; text: "Configurações"; iconName: "settings"; primary: true; Layout.fillWidth: true; onClicked: settings.open() }
            }
        }
        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0
            Rectangle {
                id: topbar
                Layout.fillWidth: true
                Layout.preferredHeight: 52
                visible: !window.inventoryMode
                color: "#e0131313"
                /* box-shadow 0 8px 24px rgba(0,0,0,0.18) medida na TopBar de referência. */
                layer.enabled: true
                layer.effect: MultiEffect {
                    shadowEnabled: true
                    blurMax: Theme.shadowTopbarBlurMax
                    shadowColor: Theme.shadowTopbarColor
                    shadowBlur: 1.0
                    shadowHorizontalOffset: 0
                    shadowVerticalOffset: Theme.shadowTopbarOffsetY
                    autoPaddingEnabled: true
                }
                Rectangle { anchors.bottom: parent.bottom; height: 1; width: parent.width; color: Theme.border }
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 20
                    anchors.rightMargin: 20
                    spacing: 12
                    FormField {
                        id: search
                        objectName: "librarySearch"
                        Layout.fillWidth: true
                        Layout.maximumWidth: 480
                        Layout.preferredHeight: Theme.controlHeight
                        placeholderText: "Buscar biblioteca"
                        text: window.prototypeSearch
                        // Debounce mantém a digitação fluida e acompanha o renderer de referência.
                        onTextChanged: if (window.libraryService) searchDelay.restart()
                        color: Theme.text
                        placeholderTextColor: Theme.muted
                        font.pixelSize: Theme.formControlFontSize
                        leftPadding: 36
                        rightPadding: 36
                        background: Rectangle { radius: 6; color: Theme.control; border.color: search.activeFocus ? Theme.accent : Theme.border }
                        Image { x: 10; anchors.verticalCenter: parent.verticalCenter; source: "qrc:/icons/search.svg"; sourceSize: Qt.size(16, 16) }
                        /* Limpar aplica o filtro imediatamente, como o botão do renderer. */
                        ToolButton {
                            id: clearSearch
                            objectName: "clearLibrarySearch"
                            anchors.right: parent.right
                            anchors.rightMargin: 6
                            anchors.verticalCenter: parent.verticalCenter
                            width: 24; height: 24
                            padding: 4
                            visible: search.text.length > 0
                            Accessible.name: "Limpar busca"
                            background: Rectangle { radius: 4; color: clearSearch.hovered ? Theme.controlHover : "transparent" }
                            contentItem: Image { source: "qrc:/icons/x.svg"; sourceSize: Qt.size(16, 16); fillMode: Image.PreserveAspectFit }
                            onClicked: {
                                search.clear()
                                searchDelay.stop()
                                window.setSearch("")
                                search.forceActiveFocus()
                            }
                        }
                    }
                    Timer { id: searchDelay; interval: 180; repeat: false; onTriggered: window.setSearch(search.text) }
                    Item { Layout.fillWidth: true; Layout.minimumWidth: 0 }
                    /* O agrupamento reproduz os espaçamentos internos da TopBar de referência. */
                    RowLayout {
                        spacing: 6
                        visible: window.selectedGame === null
                        ActionButton {
                            iconName: "arrow-up-down"
                            toolbar: true
                            enabled: window.libraryService
                            Accessible.name: "Ordenar"
                            /* A barra superior usa o mesmo ciclo de ordenação da referência. */
                            onClicked: window.setSortBy(window.activeSortBy === "title" ? "year" : window.activeSortBy === "year" ? "recent" : "title")
                        }
                        RowLayout {
                            spacing: 3
                            ActionButton { iconName: "grid-2x2"; toolbar: true; primary: !window.listView; onClicked: window.setListView(false); Accessible.name: "Grade" }
                            ActionButton { objectName: "libraryListView"; iconName: "list"; toolbar: true; primary: window.listView; onClicked: window.setListView(true); Accessible.name: "Lista" }
                        }
                    }
                    UiText {
                        visible: window.selectedGame === null
                        text: "Exibindo " + window.filteredTotal + " de " + window.allTotal + " jogos"
                        color: Theme.secondary; font.pixelSize: 11; textWeight: Font.Bold
                    }
                }
            }
            ColumnLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                Layout.leftMargin: window.selectedGame ? 20 : 24
                Layout.rightMargin: window.selectedGame ? 20 : 24
                Layout.topMargin: 20
                Layout.bottomMargin: 20
                spacing: 12
                visible: !window.inventoryMode
                TapHandler { acceptedButtons: Qt.RightButton; onTapped: libraryActionsMenu.popup() }
                RowLayout {
                    Layout.fillWidth: true
                    visible: window.selectedGame === null
                    /* O renderer reserva a linha aos filtros; comandos ficam no menu de contexto. */


                    Item { Layout.fillWidth: true }
                    FormCheckBox {
                        id: coverVisibility
                        text: "Exibir sem capa"
                        checked: window.activeIncludeMissingCovers
                        palette.windowText: Theme.secondary
                        font.pixelSize: 10
                        enabled: window.libraryService
                        onClicked: window.setIncludeMissingCovers(checked)
                        spacing: 6
                        leftPadding: 0
                        indicator: Rectangle {
                            implicitWidth: 14; implicitHeight: 14
                            x: coverVisibility.leftPadding; y: (coverVisibility.height - height) / 2
                            radius: 2; color: coverVisibility.checked ? Theme.accent : Theme.control
                            UiText { anchors.centerIn: parent; text: "✓"; font.pixelSize: 11; font.bold: true; color: Theme.accentForeground; visible: coverVisibility.checked }
                        }
                        contentItem: UiText { text: coverVisibility.text; leftPadding: coverVisibility.indicator.width + coverVisibility.spacing; verticalAlignment: Text.AlignVCenter; color: Theme.muted; font: coverVisibility.font }
                    }
                    UiText { text: "CATEGORIA:"; color: Theme.muted; font.pixelSize: 10; textWeight: Font.ExtraBold; font.letterSpacing: 0.8 }
                    FilterSelect {
                        objectName: "genreFilter"
                        model: ["Todas"].concat(window.activeGenres)
                        Layout.preferredWidth: 100
                        enabled: window.libraryService
                        currentIndex: Math.max(0, model.indexOf(window.activeGenre))
                        onActivated: window.setGenre(currentIndex === 0 ? "" : model[currentIndex])
                    }
                    UiText { text: "ORDENAR POR:"; color: Theme.muted; font.pixelSize: 10; textWeight: Font.ExtraBold; font.letterSpacing: 0.8 }
                    FilterSelect {
                        objectName: "sortFilter"
                        model: ["A–Z", "Ano", "Recentes", "Mais jogados"]
                        Layout.preferredWidth: 130
                        enabled: window.libraryService
                        currentIndex: Math.max(0, ["title", "year", "recent", "mostPlayed"].indexOf(window.activeSortBy))
                        onActivated: window.setSortBy(["title", "year", "recent", "mostPlayed"][currentIndex])
                    }
                }
                Flickable {
                    id: gridScroll
                    objectName: "libraryGridScroll"
                    visible: !window.listView && window.selectedGame === null && window.visibleGames.length > 0
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true
                    contentWidth: width
                    contentHeight: gridFlow.height + 2
                    boundsBehavior: Flickable.StopAtBounds
                    /* A referência desenha 6 px, trilho #131313 e polegar #353534. */
                    ScrollBar.vertical: CollectionScrollBar {
                        objectName: "libraryVerticalScrollBar"
                        policy: ScrollBar.AsNeeded
                        width: 6
                        background: Rectangle { implicitWidth: 6; color: Theme.background }
                        contentItem: Rectangle {
                            implicitWidth: 6
                            radius: 3
                            color: parent.pressed ? Theme.borderStrong : Theme.elevated
                        }
                    }
                    Flow {
                        id: gridFlow
                        /* O grid CSS reserva 4 px de cada lado e centraliza colunas fixas. */
                        readonly property real cardWidth: window.width <= 760 ? 148 : window.width <= 1180 ? 188 : 212
                        readonly property real cardHeight: window.width <= 760 ? 182 : window.width <= 1180 ? 230 : 260
                        readonly property real gap: window.width <= 760 ? 16 : window.width <= 1180 ? 20 : 24
                        readonly property int columns: Math.max(1, Math.floor((parent.width - 8 + gap) / (cardWidth + gap)))
                        width: columns * cardWidth + (columns - 1) * gap
                        // A referência reserva 6 px ao scrollbar quando a grade precisa rolar.
                        x: Math.max(4, (parent.width - width - (height > gridScroll.height ? 6 : 0)) / 2)
                        y: 2
                        spacing: gap
                        Repeater {
                            id: gameCards
                            model: window.visibleGames
                            delegate: GameCard {
                                required property var modelData
                                width: parent.cardWidth
                                height: parent.cardHeight
                                gameTitle: modelData.title
                                platformName: modelData.platform_name || "Fixture Console"
                                coverSource: modelData.coverUrl || ""
                                favorite: !!modelData.favorite
                                shadowBlurPixels: window.prototypeShadowBlur > 0 ? window.prototypeShadowBlur : Theme.shadowElevatedBlurMax
                                onClicked: window.openGame(modelData)
                            }
                        }
                    }
                }
                /* A lista usa linhas próprias; o card não se adapta à estrutura tabular. */
                Flickable {
                    id: listViewport
                    objectName: "libraryListViewport"
                    visible: window.listView && window.selectedGame === null && window.visibleGames.length > 0
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    /* A largura mínima preserva todas as colunas e permite rolagem horizontal. */
                    contentWidth: Math.max(width, 772)
                    contentHeight: height
                    boundsBehavior: Flickable.StopAtBounds
                    flickableDirection: Flickable.HorizontalFlick
                    clip: true
                    ScrollBar.horizontal: CollectionScrollBar {
                        objectName: "libraryHorizontalScrollBar"
                        policy: ScrollBar.AsNeeded
                        active: true
                        interactive: true
                    }
                    ColumnLayout {
                        width: listViewport.contentWidth
                        height: listViewport.height
                        spacing: 0
                        GameListLine { header: true; Layout.fillWidth: true }
                        ListView {
                            id: listBody
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            clip: true
                            model: window.visibleGames
                            delegate: GameListLine {
                                required property var modelData
                                width: ListView.view.width
                                game: modelData
                                onClicked: window.openGame(modelData)
                            }
                        }
                    }
                }
                Item {
                    objectName: "libraryEmptyState"
                    visible: window.selectedGame === null && window.visibleGames.length === 0
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    /* A mensagem ocupa o espaço da coleção, como no estado vazio Electron. */
                    UiText {
                        anchors.centerIn: parent
                        text: "Nenhum jogo encontrado"
                        color: Theme.secondary
                        font.pixelSize: 16
                    }
                }
                UiText {
                    objectName: "libraryError"
                    visible: window.selectedGame === null && (window.dbMode ? gameService.error.length > 0 : window.fixtureLibrary.error.length > 0)
                    text: window.dbMode ? gameService.error : window.fixtureLibrary.error
                    color: "#ffb4ab"
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }
                RowLayout {
                    /* A referência oculta a paginação quando os resultados cabem em uma página. */
                    visible: window.selectedGame === null && window.libraryService && window.filteredTotal > 36
                    Layout.alignment: Qt.AlignHCenter
                    spacing: 12
                    UiText { text: ((window.currentPage - 1) * 36 + 1) + "–" + Math.min(window.currentPage * 36, window.filteredTotal) + " de " + window.filteredTotal; color: Theme.secondary; font.pixelSize: 12; Layout.minimumWidth: 100; horizontalAlignment: Text.AlignRight }
                    RowLayout {
                        spacing: 4
                        ActionButton { objectName: "firstLibraryPage"; iconName: "chevrons-left"; pagination: true; enabled: window.currentPage > 1; Accessible.name: "Primeira página"; onClicked: window.goToLibraryPage(1) }
                        ActionButton { objectName: "previousLibraryPage"; iconName: "chevron-left"; pagination: true; enabled: window.currentPage > 1; Accessible.name: "Página anterior"; onClicked: window.goToLibraryPage(window.currentPage - 1) }
                        UiText { text: window.currentPage + " / " + Math.ceil(window.filteredTotal / 36); color: Theme.text; font.pixelSize: 13; Layout.minimumWidth: 56; horizontalAlignment: Text.AlignHCenter }
                        ActionButton { objectName: "nextLibraryPage"; iconName: "chevron-right"; pagination: true; enabled: window.currentPage * 36 < window.filteredTotal; Accessible.name: "Próxima página"; onClicked: window.goToLibraryPage(window.currentPage + 1) }
                        ActionButton { objectName: "lastLibraryPage"; iconName: "chevrons-right"; pagination: true; enabled: window.currentPage * 36 < window.filteredTotal; Accessible.name: "Última página"; onClicked: window.goToLibraryPage(Math.ceil(window.filteredTotal / 36)) }
                    }
                }
                /* O detalhe substitui a coleção dentro da área principal, como no Electron. */
                GameDetailPage {
                    id: detail
                    visible: window.selectedGame !== null
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    gameService: window.gameService
                    serviceMode: window.dbMode
                    launchService: window.launchService
                    libraryGame: window.selectedGame
                    hasPrevious: window.hasPreviousGame
                    hasNext: window.hasNextGame
                    onCloseRequested: window.closeGameDetail()
                    onPreviousRequested: window.selectAdjacent(-1)
                    onNextRequested: window.selectAdjacent(1)
                    onEditRequested: function(game) { window.openEditForm(game) }
                    onDeleteRequested: function(game) { window.requestDelete(game) }
                    onMetadataRequested: function(game) {
                        metadataImporter.openFor(game.title || "", game.platformName || "")
                    }
                    onVersionsRequested: function(game) {
                        versions.options = window.gameService.listVersions(game.id)
                        versions.open()
                    }
                }
            }
            /* O inventário ocupa a mesma coluna da biblioteca, com TopBar própria fixa. */
            HardwareInventoryPage {
                id: inventoryPage
                visible: window.inventoryMode
                Layout.fillWidth: true
                Layout.fillHeight: true
                inventoryService: window.inventoryService
                preferences: window.inventoryPreferences
                platforms: window.platformCatalog
                blurEnabled: !window.prototypeDisableBlur
                modalShadowBlurMax: window.prototypeModalShadowBlur > 0 ? window.prototypeModalShadowBlur : Theme.shadowModalBlurMax
                onBackdropBlurRequested: function(active) { window.blurDepth = Math.max(0, window.blurDepth + (active ? 1 : -1)) }
            }
        }
    }
    Timer {
        interval: 16
        repeat: true
        running: window.prototypeBenchmark
        onTriggered: window.benchmarkPulse = !window.benchmarkPulse
    }
    /* O formulário cobre criação manual e edição com o mesmo serviço tipado. */
    GameFormDialog {
        id: gameForm
        gameService: window.gameService
        serviceMode: window.dbMode
        platforms: window.platformCatalog
        editingGame: window.formGame
        backdropBlurEnabled: !window.prototypeDisableBlur
        modalShadowBlurMax: window.prototypeModalShadowBlur > 0 ? window.prototypeModalShadowBlur : Theme.shadowModalBlurMax
        onBackdropBlurRequested: function(active) { window.blurDepth = Math.max(0, window.blurDepth + (active ? 1 : -1)) }
        onClosed: window.formGame = null
        onSaved: function(gameId) { window.afterGameSaved(gameId) }
        onMetadataRequested: function(title, platformName) {
            gameForm.close()
            metadataImporter.openFor(title, platformName)
        }
    }
    ConfirmDialog {
        id: confirmDelete
        backdropBlurEnabled: !window.prototypeDisableBlur
        modalShadowBlurMax: window.prototypeModalShadowBlur > 0 ? window.prototypeModalShadowBlur : Theme.shadowModalBlurMax
        onBackdropBlurRequested: function(active) { window.blurDepth = Math.max(0, window.blurDepth + (active ? 1 : -1)) }
        onConfirmed: window.confirmDeleteGame()
    }
    ConfirmDialog {
        id: platformConfirm
        objectName: "platformConfirmDialog"
        backdropBlurEnabled: !window.prototypeDisableBlur
        modalShadowBlurMax: window.prototypeModalShadowBlur > 0 ? window.prototypeModalShadowBlur : Theme.shadowModalBlurMax
        onBackdropBlurRequested: function(active) { window.blurDepth = Math.max(0, window.blurDepth + (active ? 1 : -1)) }
        onConfirmed: window.confirmPlatformDelete()
    }
    ConfirmDialog {
        id: emulatorConfirm
        objectName: "emulatorConfirmDialog"
        backdropBlurEnabled: !window.prototypeDisableBlur
        modalShadowBlurMax: window.prototypeModalShadowBlur > 0 ? window.prototypeModalShadowBlur : Theme.shadowModalBlurMax
        onBackdropBlurRequested: function(active) { window.blurDepth = Math.max(0, window.blurDepth + (active ? 1 : -1)) }
        onConfirmed: window.confirmEmulatorDelete()
    }
    ConfirmDialog {
        id: resetConfirm
        objectName: "resetConfirmDialog"
        backdropBlurEnabled: !window.prototypeDisableBlur
        modalShadowBlurMax: window.prototypeModalShadowBlur > 0 ? window.prototypeModalShadowBlur : Theme.shadowModalBlurMax
        onBackdropBlurRequested: function(active) { window.blurDepth = Math.max(0, window.blurDepth + (active ? 1 : -1)) }
        onConfirmed: window.confirmResetStats()
    }
    GameVersionDialog {
        id: versions
        gameService: window.gameService
        launchService: window.launchService
        serviceMode: window.dbMode
        backdropBlurEnabled: !window.prototypeDisableBlur
        modalShadowBlurMax: window.prototypeModalShadowBlur > 0 ? window.prototypeModalShadowBlur : Theme.shadowModalBlurMax
        onBackdropBlurRequested: function(active) { window.blurDepth = Math.max(0, window.blurDepth + (active ? 1 : -1)) }
        onVersionLaunched: function(versionId) {
            if (!window.dbMode) return
            window.gameService.refresh()
            const selected = window.gameService.get(versionId)
            if (selected && selected.id) {
                window.selectedGame = selected
                detail.reload()
            }
        }
    }
    /* Importador LaunchBox disponível pela barra superior e pelo detalhe. */
    LaunchBoxImporter {
        id: metadataImporter
        metadataService: window.metadataService
        platformService: window.platformService
        gameService: window.gameService
        serviceMode: window.dbMode && window.metadataService !== null && window.metadataService !== undefined
        backdropBlurEnabled: !window.prototypeDisableBlur
        modalShadowBlurMax: window.prototypeModalShadowBlur > 0 ? window.prototypeModalShadowBlur : Theme.shadowModalBlurMax
        onBackdropRequested: function(active) { window.blurDepth = Math.max(0, window.blurDepth + (active ? 1 : -1)) }
    }
    DragDialog {
        id: settings
        objectName: "settingsDialog"
        backdropBlurEnabled: !window.prototypeDisableBlur
        modalShadowBlurMax: window.prototypeModalShadowBlur > 0 ? window.prototypeModalShadowBlur : Theme.shadowModalBlurMax
        onBackdropBlurRequested: function(active) { window.blurDepth = Math.max(0, window.blurDepth + (active ? 1 : -1)) }
        /* Dimensões e centralização do SettingsModal.css, incluindo o espaço da navegação. */
        width: Math.min(960, parent.width - 48)
        height: Math.min(680, parent.height - 48)
        padding: 0
        onClosed: platformManager.closeDialogs()
        ActionButton {
            objectName: "closeSettings"
            iconName: "x-danger"
            toolbar: true
            dangerOutline: true
            anchors.top: parent.top
            anchors.right: parent.right
            anchors.margins: 20
            z: 10
            Accessible.name: "Fechar"
            onClicked: settings.close()
        }
        Rectangle {
            x: 1; y: 1; width: 199; height: parent.height - 2; radius: 15
            gradient: Gradient {
                GradientStop { position: 0; color: "#203334" }
                GradientStop { position: 0.6; color: "#262525" }
                GradientStop { position: 1; color: "#262525" }
            }
        }
        Rectangle { x: 200; width: 1; height: parent.height; color: Theme.border }
        RowLayout {
            anchors.fill: parent
            spacing: 0
            ColumnLayout {
                Layout.preferredWidth: 176
                /* A coluna de navegação não pode absorver o espaço do conteúdo. */
                Layout.minimumWidth: 176
                Layout.maximumWidth: 176
                Layout.leftMargin: 12
                Layout.rightMargin: 12
                Layout.topMargin: 20
                Layout.bottomMargin: 20
                Layout.fillHeight: true
                spacing: 2
                RowLayout {
                    Layout.leftMargin: 8
                    Layout.bottomMargin: 12
                    spacing: 8
                    Image { source: "qrc:/icons/settings-active.svg"; sourceSize: Qt.size(15, 15) }
                    UiText { text: "CONFIGURAÇÕES"; color: Theme.accent; font.pixelSize: 13; textWeight: Font.Black; Layout.fillWidth: true }
                }
                Repeater {
                    model: [
                        {key: "plataformas", label: "Plataformas", icon: "gamepad-2", enabled: true},
                        {key: "emuladores", label: "Emuladores", icon: "monitor-play", enabled: true},
                        {key: "biblioteca", label: "Biblioteca", icon: "folder-open", enabled: true},
                        {key: "covers", label: "Mídia da biblioteca", icon: "images", enabled: true},
                        {key: "partidas", label: "Partidas jogadas", icon: "rotate-ccw", enabled: true},
                        {key: "backup", label: "Backup", icon: "database-backup", enabled: true},
                        {key: "logs", label: "Logs", icon: "scroll-text", enabled: true},
                        {key: "sobre", label: "Sobre", icon: "info", enabled: true}
                    ]
                    delegate: ColumnLayout {
                        required property var modelData
                        Layout.fillWidth: true
                        spacing: 2
                        /* Separadores delimitam os mesmos grupos do menu original. */
                        Rectangle {
                            visible: ["plataformas", "biblioteca", "backup"].indexOf(modelData.key) >= 0
                            Layout.fillWidth: true; Layout.preferredHeight: 1
                            Layout.leftMargin: 8; Layout.rightMargin: 8
                            Layout.topMargin: 10; Layout.bottomMargin: 10
                            color: Theme.border
                        }
                        NavigationButton {
                        settingsItem: true
                        text: modelData.label
                        iconName: modelData.icon
                        Layout.fillWidth: true
                        selected: window.settingsSection === modelData.key
                        enabled: modelData.enabled
                        onClicked: {
                            window.settingsSection = modelData.key
                            if (modelData.key === "emuladores" && window.emulatorService) window.emulatorService.refresh()
                            if (modelData.key === "partidas" && window.dbMode) window.gameService.refresh()
                            if (modelData.key === "covers") coverSettings.refreshStats()
                            if (modelData.key === "logs" && window.settingsService) window.settingsService.refreshLogs()
                            if (modelData.key === "sobre" && window.settingsService) window.settingsService.refreshStats()
                            if (modelData.key === "backup" && window.settingsService) window.settingsService.refreshStats()
                        }
                        }
                    }
                }
                Item { Layout.fillHeight: true }
            }
            ColumnLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                Layout.leftMargin: 24
                Layout.rightMargin: 24
                Layout.topMargin: 20
                Layout.bottomMargin: 20
                spacing: 28
                UiText {
                    visible: window.settingsHeader(window.settingsSection).length > 0
                    text: window.settingsHeader(window.settingsSection)
                    color: Theme.text
                    font.pixelSize: 28
                    textWeight: Font.Black
                    /* O header CSS usa line-height: 1; a métrica Qt padrão acrescentava 6 px. */
                    lineHeightMode: Text.FixedHeight
                    lineHeight: 28
                    Layout.fillWidth: true
                }
                Item {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    PlatformManager {
                        id: platformManager
                        anchors.fill: parent
                        visible: window.settingsSection === "plataformas"
                        platformService: window.platformService
                        serviceMode: window.dbMode
                        blurEnabled: !window.prototypeDisableBlur
                        onBackdropRequested: function(active) { window.blurDepth = Math.max(0, window.blurDepth + (active ? 1 : -1)) }
                        onDeleteRequested: function(platform) { window.requestPlatformDelete(platform) }
                    }
                    EmulatorManager {
                        id: emulatorManager
                        anchors.fill: parent
                        visible: window.settingsSection === "emuladores"
                        emulatorService: window.emulatorService
                        platformService: window.platformService
                        serviceMode: window.dbMode
                        blurEnabled: !window.prototypeDisableBlur
                        onBackdropRequested: function(active) { window.blurDepth = Math.max(0, window.blurDepth + (active ? 1 : -1)) }
                        onDeleteRequested: function(emulator) { window.requestEmulatorDelete(emulator) }
                    }
                    PlayHistorySettings {
                        anchors.fill: parent
                        visible: window.settingsSection === "partidas"
                        gameService: window.gameService
                        serviceMode: window.dbMode
                        onResetRequested: window.requestResetStats()
                    }
                    RomFolderImporter {
                        anchors.fill: parent
                        visible: window.settingsSection === "biblioteca"
                        romFolderService: window.romFolderService
                        platformService: window.platformService
                        serviceMode: window.dbMode && window.romFolderService !== null && window.romFolderService !== undefined
                        onBackdropRequested: function(active) { window.blurDepth = Math.max(0, window.blurDepth + (active ? 1 : -1)) }
                        onImportStarted: {
                            if (window.dbMode) {
                                window.gameService.refresh()
                                window.platformService.refresh()
                            }
                        }
                    }
                    CoverSyncSettings {
                        id: coverSettings
                        anchors.fill: parent
                        visible: window.settingsSection === "covers"
                        mediaSyncService: window.mediaSyncService
                        gameService: window.gameService
                        jobManager: window.jobManager
                        metadataService: window.metadataService
                        serviceMode: window.dbMode && window.mediaSyncService !== null && window.mediaSyncService !== undefined
                    }
                    DataPortabilitySettings {
                        anchors.fill: parent
                        visible: window.settingsSection === "backup"
                        coordinator: window.backupCoordinator
                        settingsService: window.settingsService
                        serviceMode: window.backupCoordinator !== null && window.backupCoordinator !== undefined
                        blurEnabled: !window.prototypeDisableBlur
                    }
                    LogsSettings {
                        anchors.fill: parent
                        visible: window.settingsSection === "logs"
                        settingsService: window.settingsService
                    }
                    AboutSettings {
                        anchors.fill: parent
                        anchors.topMargin: 42
                        visible: window.settingsSection === "sobre"
                        settingsService: window.settingsService
                        updateService: window.updateService
                        buildLabel: window.buildLabel
                    }
                }
            }
        }
    }
    /* Notificações ficam acima do conteúdo, sem bloquear a navegação quando vazias. */
    NotificationCenter {
        id: notifications
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.rightMargin: 18
        anchors.bottomMargin: 18
        z: 30
        jobManager: window.jobManager
        romFolderService: window.romFolderService
    }
    SplashOverlay {
        anchors.fill: parent
        updateService: window.updateService
    }
    /* A flag é exclusiva da captura reproduzível do protótipo. */
    Component.onCompleted: {        if (prototypeListView) window.setListView(true)
        if (window.prototypeInventoryOpen) window.inventoryMode = true
        if (window.prototypeInventoryList && window.inventoryAvailable) window.inventoryPreferences.viewMode = "list"
        if (prototypeSettingsOpen) {
            window.settingsSection = "sobre"
            settings.open()
        }
        if (prototypePlatformsOpen || prototypePlatformNew || prototypePlatformEdit || prototypePlatformMappings) {
            window.settingsSection = "plataformas"
            settings.open()
        }
        if (prototypeEmulatorsOpen || prototypeEmulatorNew || prototypeEmulatorEdit
                || prototypeEmulatorLinks || prototypeEmulatorLink || prototypeEmulatorCores) {
            window.settingsSection = "emuladores"
            settings.open()
        }
        if (prototypePlayHistoryOpen) {
            window.settingsSection = "partidas"
            if (window.dbMode) window.gameService.refresh()
            settings.open()
        }
        if (prototypeRomImporterOpen) {
            window.settingsSection = "biblioteca"
            settings.open()
        }
        if (prototypeCoversOpen) {
            window.settingsSection = "covers"
            coverSettings.refreshStats()
            settings.open()
        }
        if (window.prototypeLogsOpen) {
            window.settingsSection = "logs"
            if (window.settingsService) window.settingsService.refreshLogs()
            settings.open()
        }
        if (window.prototypeBackupOpen) {
            window.settingsSection = "backup"
            if (window.settingsService) window.settingsService.refreshStats()
            settings.open()
        }
        if (window.prototypeUpdateSplash && window.updateService) window.updateService.showStartupPreview()
        if ((prototypeDetailOpen || prototypeDetailEdit || prototypeDetailVersions) && catalog.length > 0)
            window.openGame(catalog[0])
        // A camada secundária reproduz o backdrop de 4 px sobre o primeiro modal.
        if (prototypeStackedOpen) {
            if (!settings.visible) settings.open()
            if (catalog.length > 0) {
                window.openGame(catalog[0])
                // O detalhe agora é página; o segundo modal exercita o empilhamento real.
                if (window.dbMode) window.openEditForm(catalog[0])
            }
        }
        if (prototypeDetailEdit && catalog.length > 0 && window.dbMode) window.openEditForm(catalog[0])
        if (prototypeDetailVersions && catalog.length > 0) {
            versions.options = window.gameService.listVersions(catalog[0].id)
            versions.open()
        }
        // Estados de captura das telas de plataformas e emuladores usam o primeiro registro da fixture.
        if (prototypePlatformNew) platformManager.openCreate()
        if (prototypePlatformEdit && platformManager.platformService && platformManager.platformService.items.length > 0)
            platformManager.openEdit(platformManager.platformService.items[0])
        if (prototypePlatformMappings && platformManager.platformService && platformManager.platformService.items.length > 0)
            platformManager.openMappings(platformManager.platformService.items[0])
        var emulators = emulatorManager.orderedEmulators
        if (prototypeEmulatorNew) emulatorManager.openCreate()
        if (prototypeEmulatorEdit && emulators.length > 0) emulatorManager.openEdit(emulators[0])
        if (prototypeEmulatorLinks && emulators.length > 0) emulatorManager.toggle(emulators[0])
        if (prototypeEmulatorLink && emulators.length > 0) emulatorManager.openLink(emulators[0])
        if (prototypeEmulatorCores && emulators.length > 0) emulatorManager.openCores(emulators[0])
        if (window.prototypeInventoryForm) inventoryPage.openCreate()
        if (window.prototypeInventoryNewType) {
            inventoryPage.openCreate()
            inventoryPage.showTypeInline()
        }
        if ((window.prototypeInventoryDetail || window.prototypeInventoryEdit || window.prototypeInventoryDelete)
                && window.inventoryAvailable && window.inventoryService.items.length > 0) {
            inventoryPage.openItem(window.inventoryService.items[0])
            if (window.prototypeInventoryEdit) inventoryPage.openEdit(window.inventoryService.items[0])
            if (window.prototypeInventoryDelete) inventoryPage.openDelete(window.inventoryService.items[0])
        }
    }
}
