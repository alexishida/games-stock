/* Exercita busca e limpeza da biblioteca sem banco nem perfil pessoal. */
import QtQuick
import QtQuick.Controls
import QtTest
import "../../qml" as App
import "../../qml/components" as Components

Item {
App.Main {
    id: app
    fixtureLibrary: library
    prototypeCatalog: []
    gameService: null
    platformService: null
    emulatorService: null
    launchService: null
    inventoryPreferences: null
    prototypeListView: false
    prototypeSearch: ""
    prototypeBenchmark: false
    prototypeSettingsOpen: false
    prototypeStackedOpen: false
    prototypeDetailOpen: false
    prototypePlatformsOpen: false
    prototypeEmulatorsOpen: false
    prototypePlayHistoryOpen: false
    prototypeDisableBlur: true
    prototypeBlurRadius: 0
    prototypeShadowBlur: 0
    prototypeModalShadowBlur: 0
    buildLabel: "teste"

    /* O serviço simulado evidencia a transição que a interface envia ao backend. */
    QtObject {
        id: library
        property bool enabled: true
        property var games: [{title: "Jogo", platform_name: "Fixture Console"}]
        property int total: 1
        property int filtered: 1
        property int page: 1
        property string error: ""
        property string sortBy: "title"
        property var genres: []
        property string genre: ""
        property string collection: "all"
        property var counts: ({all: filtered, mostPlayed: 0, favorites: 0, playing: 0, completed: 0})
        property bool includeMissingCovers: true
        property string lastSearch: ""
        function setSearch(value) {
            lastSearch = value
            games = value.length ? [] : [{title: "Jogo", platform_name: "Fixture Console"}]
            filtered = games.length
        }
        function setSortBy(value) { sortBy = value }
        function setGenre(value) { genre = value }
        function setCollection(value) { collection = value }
        function setIncludeMissingCovers(value) { includeMissingCovers = value }
        function goToPage(value) { page = value }
    }

    /* Um segundo diálogo exercita a camada modal compartilhada do protótipo. */
    Component {
        id: nestedDialogFactory
        Components.DragDialog {
            width: 260; height: 180
            Components.FormField { objectName: "nestedInput"; anchors.centerIn: parent; width: 150 }
            Button { objectName: "nestedAction"; text: "Confirmar"; anchors.right: parent.right; anchors.bottom: parent.bottom }
        }
    }

    TestCase {
    name: "LibrarySearch"
    when: windowShown

    /* Garante isolamento mesmo quando uma verificação de modal falha. */
    function cleanup() {
        const dialog = findChild(app, "settingsDialog")
        if (dialog) dialog.close()
    }

    /* Escape fecha o diálogo que possui foco na própria janela de teste. */
    function test_dialogEscape() {
        const openButton = findChild(app, "openSettings")
        const dialog = findChild(app, "settingsDialog")
        mouseClick(openButton)
        tryVerify(function() { return dialog.visible }, 2000)
        app.requestActivate()
        dialog.contentItem.forceActiveFocus()
        wait(50)
        keyClick(Qt.Key_Escape)
        tryVerify(function() { return !dialog.visible }, 2000)
    }

    /* O diálogo inferior não deve receber cliques enquanto outro modal está aberto. */
    function test_stackedDialogs() {
        const openButton = findChild(app, "openSettings")
        const dialog = findChild(app, "settingsDialog")
        const closeButton = findChild(app, "closeSettings")
        mouseClick(openButton)
        tryVerify(function() { return dialog.visible }, 2000)
        wait(100)
        const sampleX = Math.round(dialog.x + 40)
        const sampleY = Math.round(dialog.y + 80)
        const before = grabImage(app.contentItem).pixel(sampleX, sampleY)
        const nested = nestedDialogFactory.createObject(app.contentItem)
        verify(nested !== null)
        nested.open()
        tryVerify(function() { return nested.visible }, 2000)
        const input = findChild(nested, "nestedInput")
        verify(input !== null)
        const nestedX = nested.x
        // O diálogo superior também usa o comportamento de arraste compartilhado.
        mousePress(nested.background, 35, 35)
        mouseMove(nested.background, 15, 25, 30)
        mouseMove(nested.background, 0, 20, 30)
        mouseRelease(nested.background, 0, 20)
        tryVerify(function() { return nested.x < nestedX }, 2000)
        verify(nested.x >= 0 && nested.x + nested.width <= app.width)
        const movedX = nested.x
        mousePress(input, input.width / 2, input.height / 2)
        mouseMove(input, input.width / 2 + 20, input.height / 2, 30)
        mouseMove(input, input.width / 2 + 35, input.height / 2, 30)
        mouseRelease(input, input.width / 2 + 35, input.height / 2)
        compare(nested.x, movedX)
        app.requestActivate()
        input.forceActiveFocus()
        wait(50)
        keyClick(Qt.Key_A)
        compare(input.text, "a")
        const action = findChild(nested, "nestedAction")
        verify(action !== null)
        keyClick(Qt.Key_Tab)
        tryVerify(function() { return action.activeFocus }, 1000)
        wait(100)
        const after = grabImage(app.contentItem).pixel(sampleX, sampleY)
        verify(after.r < before.r || after.g < before.g || after.b < before.b)
        mouseClick(closeButton)
        verify(dialog.visible)
        verify(nested.visible)
        // Escape atua no topo da pilha e conserva o diálogo inferior aberto.
        app.requestActivate()
        nested.contentItem.forceActiveFocus()
        wait(50)
        keyClick(Qt.Key_Escape)
        tryVerify(function() { return !nested.visible }, 2000)
        nested.destroy()
        verify(dialog.visible)
    }

    /* O modal deve abrir e responder ao arraste sem sair da área da janela. */
    function test_dialogDrag() {
        const openButton = findChild(app, "openSettings")
        const dialog = findChild(app, "settingsDialog")
        verify(openButton !== null && dialog !== null)
        mouseClick(openButton)
        tryVerify(function() { return dialog.visible }, 2000)
        const before = dialog.x
        // Movimento iniciado em botão deve permanecer no controle, sem arrastar o modal.
        const closeButton = findChild(app, "closeSettings")
        verify(closeButton !== null)
        mousePress(closeButton, closeButton.width / 2, closeButton.height / 2)
        mouseMove(closeButton, closeButton.width / 2 - 20, closeButton.height / 2, 30)
        mouseMove(closeButton, closeButton.width / 2 - 30, closeButton.height / 2, 30)
        mouseRelease(closeButton, closeButton.width / 2 - 30, closeButton.height / 2)
        compare(dialog.x, before)
        const startX = dialog.background.width - 60
        const startY = dialog.background.height - 80
        mousePress(dialog.background, startX, startY)
        mouseMove(dialog.background, startX - 20, startY - 10, 30)
        mouseMove(dialog.background, startX - 35, startY - 15, 30)
        mouseRelease(dialog.background, startX - 35, startY - 15)
        tryVerify(function() { return dialog.x < before }, 2000)
        verify(dialog.x >= 0 && dialog.x + dialog.width <= app.width)
        verify(dialog.y >= 0 && dialog.y + dialog.height <= app.height)
        // Mesmo um arraste longo não pode tirar o diálogo da área visível.
        mousePress(dialog.background, startX, startY)
        mouseMove(dialog.background, startX - 20, startY - 10, 30)
        mouseMove(dialog.background, startX - 1200, startY - 900, 30)
        mouseRelease(dialog.background, startX - 1200, startY - 900)
        verify(dialog.x >= 0 && dialog.x + dialog.width <= app.width)
        verify(dialog.y >= 0 && dialog.y + dialog.height <= app.height)
        dialog.close()
    }

    /* Os extremos e passos intermediários devem alcançar as páginas corretas. */
    function test_pagination() {
        library.filtered = 80
        library.page = 1
        const games = []
        for (let index = 0; index < 36; index++) games.push({title: "Jogo " + index, platform_name: "Fixture Console"})
        library.games = games
        const first = findChild(app, "firstLibraryPage")
        const previous = findChild(app, "previousLibraryPage")
        const next = findChild(app, "nextLibraryPage")
        const last = findChild(app, "lastLibraryPage")
        const grid = findChild(app, "libraryGridScroll")
        verify(first !== null && previous !== null && next !== null && last !== null && grid !== null)
        tryVerify(function() { return next.visible && next.enabled }, 2000)
        verify(!first.enabled)
        tryVerify(function() { return grid.contentHeight > grid.height }, 2000)
        grid.contentY = 100
        verify(grid.contentY > 0)
        mouseClick(next)
        compare(library.page, 2)
        compare(grid.contentY, 0)
        mouseClick(last)
        compare(library.page, 3)
        verify(!next.enabled)
        mouseClick(previous)
        compare(library.page, 2)
        mouseClick(first)
        compare(library.page, 1)
        library.filtered = 1
        library.games = [{title: "Jogo", platform_name: "Fixture Console"}]
    }

    /* Limpar deve remover o filtro imediatamente e restaurar a coleção. */
    function test_searchAndClear() {
        const search = findChild(app, "librarySearch")
        const clear = findChild(app, "clearLibrarySearch")
        const empty = findChild(app, "libraryEmptyState")
        verify(search !== null && clear !== null && empty !== null)
        // O teclado envia texto à janela do protótipo e aciona o debounce real.
        app.requestActivate()
        search.forceActiveFocus()
        wait(50)
        keyClick(Qt.Key_A)
        tryCompare(library, "lastSearch", "a", 2000)
        verify(clear.visible)
        tryVerify(function() { return empty.visible }, 2000)
        mouseClick(clear)
        compare(library.lastSearch, "")
        compare(search.text, "")
        tryVerify(function() { return !empty.visible }, 2000)
    }

    /* A lista estreita conserva acesso horizontal às colunas que não cabem na janela. */
    function test_listHorizontalScroll() {
        const listButton = findChild(app, "libraryListView")
        const viewport = findChild(app, "libraryListViewport")
        const scrollbar = findChild(app, "libraryHorizontalScrollBar")
        verify(listButton !== null && viewport !== null && scrollbar !== null)
        app.width = 1024
        mouseClick(listButton)
        tryVerify(function() { return viewport.visible && viewport.contentWidth > viewport.width }, 2000)
        tryVerify(function() { return scrollbar.visible && scrollbar.width > 0 }, 2000)
        mousePress(scrollbar, scrollbar.width / 2, scrollbar.height / 2)
        mouseMove(scrollbar, scrollbar.width / 2 + 20, scrollbar.height / 2, 30)
        mouseMove(scrollbar, scrollbar.width / 2 + 50, scrollbar.height / 2, 30)
        mouseRelease(scrollbar, scrollbar.width / 2 + 50, scrollbar.height / 2)
        tryVerify(function() { return viewport.contentX > 0 }, 1000)
        app.setListView(false)
    }
    }
}
}
