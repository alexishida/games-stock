/* Exercita gerenciamento de plataformas, vínculos e atualização da sidebar. */
import QtQuick
import QtTest
import "../../qml" as App

Item {
    id: root
    width: 1122
    height: 957

    /* Serviço de plataformas simulado registra criação, edição, exclusão e vínculos. */
    QtObject {
        id: platforms
        property bool available: true
        property var items: [
            {id: 1, name: "Super Nintendo", category: "Console", gameCount: 1, isDefault: false},
            {id: 2, name: "Nintendo NES", category: "Console", gameCount: 0, isDefault: true}
        ]
        property string error: ""
        property bool allowRemove: false
        property var lastMappings: ({})

        function create(name, category) {
            const id = 10 + items.length
            items = items.concat([{id: id, name: name, category: category, gameCount: 0, isDefault: false}])
            return id
        }
        function update(id, name, category) {
            const next = []
            for (let index = 0; index < items.length; index++) {
                const item = items[index]
                next.push(item.id === id ? Object.assign({}, item, {name: name, category: category}) : item)
            }
            items = next
            return true
        }
        function remove(id) {
            if (!allowRemove) {
                error = "Não é possível remover plataforma com jogos associados"
                return false
            }
            const next = []
            for (let index = 0; index < items.length; index++) {
                if (items[index].id !== id) next.push(items[index])
            }
            items = next
            error = ""
            return true
        }
        function getMappings(id) {
            return {
                aliases: [{alias: "SNES"}],
                romExtensions: [{extension: ".sfc", kind: "ROM", isPrimary: true}]
            }
        }
        function saveMappings(id, aliases, extensions) {
            lastMappings = {platformId: id, aliases: aliases, extensions: extensions}
            return true
        }
        function refresh() {}
    }

    /* Serviço de jogos mínimo: a sidebar precisa apenas de contagens e do filtro ativo. */
    QtObject {
        id: games
        property bool available: true
        property var items: []
        property int total: 0
        property int filtered: 0
        property int page: 1
        property string collection: "all"
        property string genre: ""
        property string sortBy: "title"
        property bool includeMissingCovers: true
        property var genres: []
        property string error: ""
        property int mostPlayedCount: 0
        property int favoritesCount: 0
        property int playingCount: 0
        property int completedCount: 0
        property int platformId: 0
        property var platformCounts: ({"1": 1})

        function goToPage(value) { page = value }
        function get(id) { return ({}) }
        function listVersions(id) { return [] }
        function listMedia(id) { return [] }
        function update(id, data) { return true }
        function create(data) { return ({}) }
        function remove(id) { return true }
        function mediaUrl(path) { return "" }
        function refresh() {}
    }

    QtObject {
        id: fixture
        property bool enabled: false
        property var games: []
        property int total: 0
        property int filtered: 0
        property int page: 1
        property string error: ""
        property string sortBy: "title"
        property var genres: []
        property string genre: ""
        property string collection: "all"
        property var counts: ({all: 0, mostPlayed: 0, favorites: 0, playing: 0, completed: 0})
        property bool includeMissingCovers: true
    }

    App.Main {
        id: app
        width: 1122
        height: 957
        fixtureLibrary: fixture
        prototypeCatalog: []
        gameService: games
        platformService: platforms
        emulatorService: null
        launchService: null
        inventoryPreferences: null
        prototypeListView: false
        prototypeSearch: ""
        prototypeBenchmark: false
        prototypeSettingsOpen: false
        prototypeStackedOpen: false
        prototypeDetailOpen: false
        prototypePlatformsOpen: true
        prototypeEmulatorsOpen: false
        prototypePlayHistoryOpen: false
        prototypeDisableBlur: true
        prototypeBlurRadius: 0
        prototypeShadowBlur: 0
        prototypeModalShadowBlur: 0
        buildLabel: "teste"
    }

    TestCase {
        name: "PlatformManager"
        when: windowShown

        /* Restaura a massa antes de cada teste para manter independência de ordem. */
        function init() {
            platforms.items = [
                {id: 1, name: "Super Nintendo", category: "Console", gameCount: 1, isDefault: false},
                {id: 2, name: "Nintendo NES", category: "Console", gameCount: 0, isDefault: true}
            ]
            platforms.error = ""
            platforms.allowRemove = false
            platforms.lastMappings = ({})
            games.platformId = 0
            ensureSettings()
        }

        function ensureSettings() {
            const settings = findChild(app, "settingsDialog")
            app.settingsSection = "plataformas"
            if (settings && !settings.visible) settings.open()
            wait(200)
        }

        function cleanup() {
            const manager = findChild(app, "platformManager")
            if (manager) {
                manager.formDialog.close()
                manager.mappingsDialog.close()
            }
            const confirm = findChild(app, "platformConfirmDialog")
            if (confirm) confirm.close()
        }

        /** A árvore da sidebar filtra por plataforma e "Todos" limpa o filtro. */
        function test_01_sidebarPlatformFilter() {
            // Fecha o modal para alcançar a sidebar, como faria o usuário.
            const settings = findChild(app, "settingsDialog")
            settings.close()
            wait(150)
            const tree = findChild(app, "platformTree")
            verify(tree !== null)
            let item = null
            for (let index = 0; index < tree.children.length; index++) {
                if (tree.children[index].text === "Super Nintendo") item = tree.children[index]
            }
            verify(item !== null)
            mouseClick(item)
            compare(games.platformId, 1)
            mouseClick(findChild(app, "allPlatforms"))
            compare(games.platformId, 0)
            ensureSettings()
        }

        /** A lista mostra nome, categoria, contagem e padrão; criação entra na lista. */
        function test_02_platformListAndCreate() {
            const manager = findChild(app, "platformManager")
            verify(manager !== null)
            compare(platforms.items.length, 2)
            mouseClick(findChild(manager, "newPlatform"))
            const form = manager.formDialog
            tryVerify(function() { return form.visible }, 2000)
            wait(200)
            const name = findChild(form, "platformNameField")
            /* Regressão: o cabeçalho não pode cobrir o primeiro campo do formulário. */
            verify(form.showHeading)
            verify(form.topPadding > form.padding)
            verify(name.mapToItem(form.contentItem, 0, 0).y >= 0)
            compare(name.text, "")
            name.text = "PlayStation 2"
            mouseClick(findChild(form, "savePlatform"))
            tryVerify(function() { return !form.visible }, 2000)
            compare(platforms.items.length, 3)
            compare(platforms.items[2].name, "PlayStation 2")
            compare(platforms.items[2].category, "Console")
        }

        /** Edição pré-preenche o nome e atualiza a lista/sidebar. */
        function test_03_editPlatform() {
            const manager = findChild(app, "platformManager")
            wait(150)
            mouseClick(findChild(manager, "editPlatform"))
            const form = manager.formDialog
            tryVerify(function() { return form.visible }, 2000)
            wait(200)
            const name = findChild(form, "platformNameField")
            compare(name.text, "Super Nintendo")
            name.text = "SNES"
            mouseClick(findChild(form, "savePlatform"))
            tryVerify(function() { return !form.visible }, 2000)
            compare(platforms.items[0].name, "SNES")
        }

        /** Exclusão bloqueada mantém o diálogo e mostra o motivo; liberada remove. */
        function test_04_deleteConfirmation() {
            platforms.allowRemove = false
            const manager = findChild(app, "platformManager")
            wait(150)
            const deleteButton = findChild(manager, "deletePlatform")
            mouseClick(deleteButton)
            const confirm = findChild(app, "platformConfirmDialog")
            tryVerify(function() { return confirm.visible }, 2000)
            wait(200)
            verify(findChild(confirm, "confirmMessage").text.indexOf("Super Nintendo") >= 0)
            mouseClick(findChild(confirm, "acceptConfirm"))
            wait(100)
            verify(confirm.visible)
            compare(findChild(confirm, "confirmError").text, "Não é possível remover plataforma com jogos associados")
            platforms.allowRemove = true
            mouseClick(findChild(confirm, "acceptConfirm"))
            tryVerify(function() { return !confirm.visible }, 2000)
            compare(platforms.items.length, 1)
        }

        /** Aliases e extensões são carregados e salvos pelo serviço. */
        function test_05_mappings() {
            const manager = findChild(app, "platformManager")
            wait(150)
            const mappingsButton = findChild(manager, "platformMappings")
            mouseClick(mappingsButton)
            const dialog = manager.mappingsDialog
            tryVerify(function() { return dialog.visible }, 2000)
            wait(200)
            const alias = findChild(dialog.contentItem, "removeAlias")
            verify(alias !== null)
            mouseClick(findChild(dialog.contentItem, "addAlias"))
            wait(100)
            mouseClick(findChild(dialog.contentItem, "addExtension"))
            wait(100)
            mouseClick(findChild(dialog.contentItem, "saveMappings"))
            tryVerify(function() { return !dialog.visible }, 2000)
            compare(platforms.lastMappings.platformId, 1)
            verify(platforms.lastMappings.aliases.length >= 1)
            verify(platforms.lastMappings.extensions.length >= 2)
        }
    }
}
