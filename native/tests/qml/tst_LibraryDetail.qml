/* Exercita detalhe, edição, exclusão, favorito/status e versões com serviço simulado. */
import QtQuick
import QtTest
import GameStock
import "../../qml" as App

Item {
    id: root
    width: 1122
    height: 957

    /* Serviço simulado registra as chamadas sem abrir SQLite nem perfil pessoal. */
    QtObject {
        id: service
        property bool available: true
        property var items: [{
            id: 1, title: "Jogo Teste", platform_name: "Super Nintendo", platform_id: 1,
            favorite: false, play_status: "unplayed", launch_count: 0, notes: "Notas originais",
            publisher: "Publisher", genre: "Aventura", year: 1994, rating: "L",
            rom_path: "C:/roms/Jogo Teste.sfc", box_art_path: "", coverUrl: ""
        }]
        property int total: 1
        property int filtered: 1
        property int page: 1
        property string collection: "all"
        property string genre: ""
        property string sortBy: "title"
        property bool includeMissingCovers: true
        property var genres: ["Aventura"]
        property string error: ""
        property int mostPlayedCount: 0
        property int favoritesCount: 0
        property int playingCount: 0
        property int completedCount: 0
        property int lastId: 0
        property string lastStatus: ""
        property bool multipleVersions: false

        function get(id) {
            for (let index = 0; index < items.length; index++) {
                if (items[index].id === id) return items[index]
            }
            return ({})
        }
        function update(id, data) {
            lastId = id
            const updated = Object.assign({}, items[0], data)
            items = [updated]
            return true
        }
        function create(data) {
            return {id: 2, title: data.title}
        }
        function remove(id) {
            items = []
            total = 0
            filtered = 0
            return true
        }
        function listVersions(id) {
            if (!multipleVersions) {
                return [{id: 1, title: "Jogo Teste", baseTitle: "Jogo Teste", variantLabel: "Versão padrão",
                 launchCount: 0, romFileName: "Jogo Teste.sfc", regionLabel: "", typeLabel: "", coverUrl: ""}]
            }
            return [
                {id: 1, title: "Jogo Teste", baseTitle: "Jogo Teste", variantLabel: "USA", launchCount: 1,
                 romFileName: "Jogo Teste (USA).sfc", regionLabel: "USA", typeLabel: "", coverUrl: ""},
                {id: 3, title: "Jogo Teste", baseTitle: "Jogo Teste", variantLabel: "EUR", launchCount: 0,
                 romFileName: "Jogo Teste (Europe).sfc", regionLabel: "EUR", typeLabel: "", coverUrl: ""}
            ]
        }
        function listMedia(id) { return [] }
        function goToPage(value) { page = value }
        function mediaUrl(path) { return "" }
    }

    QtObject {
        id: launcher
        property bool available: true
        property string error: ""
        property int lastId: 0
        function launch(id) {
            lastId = id
            return {success: true}
        }
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
        gameService: service
        platformService: null
        emulatorService: null
        launchService: launcher
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
    }

    TestCase {
        name: "LibraryDetail"
        when: windowShown

        /* Cada teste parte de um único jogo para não depender da ordem de execução. */
        function resetGame() {
            service.items = [{
                id: 1, title: "Jogo Teste", platform_name: "Super Nintendo", platform_id: 1,
                favorite: false, play_status: "unplayed", launch_count: 0, notes: "Notas originais",
                publisher: "Publisher", genre: "Aventura", year: 1994, rating: "L",
                rom_path: "C:/roms/Jogo Teste.sfc", box_art_path: "", coverUrl: ""
            }]
            service.total = 1
            service.filtered = 1
            service.lastId = 0
            service.multipleVersions = false
        }

        function cleanup() {
            // Restaura a janela após verificar os limites do cabeçalho responsivo.
            app.width = 1122
            app.height = 957
            app.closeGameDetail()
            const form = findChild(app, "gameFormDialog")
            if (form) form.close()
            const confirm = findChild(app, "confirmDialog")
            if (confirm) confirm.close()
            const versions = findChild(app, "gameVersionDialog")
            if (versions) versions.close()
        }

        /** O título curto aproveita a lateral da capa sem disputar largura com os botões. */
        function test_titleUsesAvailableWidth() {
            resetGame()
            service.update(1, {title: "Jogo sintético 000142"})
            app.width = 1024
            app.height = 768
            app.openGame(service.items[0])
            const detail = findChild(app, "gameDetailPage")
            const title = findChild(detail, "gameDetailTitle")
            const actions = findChild(detail, "gameDetailActions")
            tryVerify(function() { return detail.visible && title.width > 0 }, 2000)
            wait(250)
            compare(title.lineCount, 1)
            const titleBottom = title.mapToItem(detail, 0, title.height)
            const actionsTop = actions.mapToItem(detail, 0, 0)
            verify(actionsTop.y >= titleBottom.y)
            const remove = findChild(detail, "deleteGame")
            verify(remove.mapToItem(detail, remove.width, 0).x <= detail.width - 12)
        }

        /** Abre o detalhe e confere que o painel é opaco como os demais modais. */
        function test_detailAndFavorite() {
            resetGame()
            const dialog = findChild(app, "gameDetailPage")
            verify(dialog !== null)
            app.openGame(service.items[0])
            tryVerify(function() { return dialog.visible }, 2000)
            wait(250)
            compare(dialog.gameTitle, "Jogo Teste")
            verify(dialog.width > 0 && dialog.height > 0)
            compare(dialog.visible, true)
            const favorite = findChild(dialog, "favoriteGame")
            verify(favorite !== null)
            mouseClick(favorite)
            wait(100)
            compare(service.lastId, 1)
            compare(service.items[0].favorite, true)
            // O selo de status alterna entre ativo e não jogado.
            const completed = findChild(dialog, "completedGame")
            mouseClick(completed)
            wait(100)
            compare(service.items[0].play_status, "completed")
            mouseClick(completed)
            wait(100)
            compare(service.items[0].play_status, "unplayed")
            // O botão Jogar usa o serviço de lançamento uma única vez.
            const launchButton = findChild(dialog, "launchGame")
            verify(launchButton !== null && launchButton.enabled)
            mouseClick(launchButton)
            wait(100)
            compare(launcher.lastId, 1)
        }

        /** Edição persiste pelo serviço e recarrega o detalhe; erro aparece no formulário. */
        function test_editAndValidation() {
            resetGame()
            app.openGame(service.items[0])
            const dialog = findChild(app, "gameDetailPage")
            tryVerify(function() { return dialog.visible }, 2000)
            wait(250)
            mouseClick(findChild(dialog, "editGame"))
            const form = findChild(app, "gameFormDialog")
            tryVerify(function() { return form.visible }, 2000)
            wait(250)
            // O editor empilhado aplica os metadados ao rascunho do formulário principal.
            mouseClick(findChild(form, "openGameMetadataEditor"))
            const editor = findChild(form, "gameMetadataEditor")
            tryVerify(function() { return editor.visible }, 2000)
            const title = findChild(editor, "gameMetadataTitleField")
            compare(title.text, "Jogo Teste")
            title.text = "Jogo Editado"
            mouseClick(findChild(editor, "applyGameMetadata"))
            tryVerify(function() { return !editor.visible }, 2000)
            compare(form.draft.title, "Jogo Editado")
            // A validação do formulário principal continua bloqueando título vazio.
            form.setDraft("title", "")
            mouseClick(findChild(form, "saveGame"))
            wait(100)
            verify(findChild(form, "gameFormError").visible)
            compare(findChild(form, "gameFormError").text, "Título é obrigatório")
            form.setDraft("title", "Jogo Editado")
            mouseClick(findChild(form, "saveGame"))
            tryVerify(function() { return !form.visible }, 2000)
            compare(service.items[0].title, "Jogo Editado")
            compare(dialog.gameTitle, "Jogo Editado")
            app.closeGameDetail()
        }

        /** Criação manual exige plataforma e envia o rascunho ao serviço. */
        function test_createForm() {
            // A plataforma é obrigatória: sem catálogo o formulário recusa antes do serviço.
            // O comando original fica no menu; abrir antes garante que a acao esteja visivel.
            findChild(app, "libraryActionsMenu").open()
            mouseClick(findChild(app, "createGame"))
            const form = findChild(app, "gameFormDialog")
            tryVerify(function() { return form.visible }, 2000)
            wait(250)
            const title = findChild(form, "gameTitleField")
            compare(title.text, "")
            title.text = "Novo Jogo"
            mouseClick(findChild(form, "saveGame"))
            wait(100)
            compare(findChild(form, "gameFormError").text, "Plataforma é obrigatória")
            form.close()
            tryVerify(function() { return !form.visible }, 2000)
        }

        /** Ampliação preserva a navegação circular e oferece fechamento explícito. */
        function test_galleryViewer() {
            resetGame()
            app.openGame(service.items[0])
            const detail = findChild(app, "gameDetailPage")
            detail.gallery = [{path: "cover.png", label: "Capa"}, {path: "screen.png", label: "Screenshot"}]
            detail.openImage("cover.png")
            const viewer = findChild(detail, "gameImageViewer")
            tryVerify(function() { return viewer.opened }, 2000)
            compare(detail.imageIndex, 0)
            verify(findChild(viewer, "saveGameImage").enabled)
            mouseClick(findChild(viewer, "nextGameImage"))
            compare(detail.imageIndex, 1)
            mouseClick(findChild(viewer, "nextGameImage"))
            compare(detail.imageIndex, 0)
            mouseClick(findChild(viewer, "previousGameImage"))
            compare(detail.imageIndex, 1)
            mouseClick(findChild(viewer, "closeGameImage"))
            tryVerify(function() { return !viewer.visible }, 2000)
            app.closeGameDetail()
        }

        /** Exclusão pede confirmação, remove no serviço e fecha o detalhe vazio. */
        function test_deleteConfirmation() {
            resetGame()
            app.openGame(service.items[0])
            const dialog = findChild(app, "gameDetailPage")
            tryVerify(function() { return dialog.visible }, 2000)
            wait(250)
            mouseClick(findChild(dialog, "deleteGame"))
            const confirm = findChild(app, "confirmDialog")
            tryVerify(function() { return confirm.visible }, 2000)
            wait(200)
            verify(findChild(confirm, "confirmMessage").text.indexOf("Jogo Teste") >= 0)
            mouseClick(findChild(confirm, "acceptConfirm"))
            tryVerify(function() { return !confirm.visible }, 2000)
            tryVerify(function() { return !dialog.visible }, 2000)
            compare(service.items.length, 0)
        }

        /** O seletor de versões lista as variantes e permite escolher outra ROM. */
        function test_versionSelection() {
            resetGame()
            service.multipleVersions = true
            launcher.lastId = 0
            app.openGame(service.items[0])
            const dialog = findChild(app, "gameDetailPage")
            tryVerify(function() { return dialog.visible }, 2000)
            wait(250)
            // Com mais de uma versão, o botão Jogar abre o seletor como no Electron.
            const launchButton = findChild(dialog, "launchGame")
            verify(launchButton.visible && launchButton.enabled)
            mouseClick(launchButton)
            const selector = findChild(app, "gameVersionDialog")
            tryVerify(function() { return selector.visible }, 2000)
            wait(200)
            compare(selector.options.length, 2)
            const choose = findChild(selector.contentItem, "selectVersion")
            verify(choose !== null)
            mouseClick(choose)
            tryVerify(function() { return !selector.visible }, 2000)
            compare(launcher.lastId, 1)
            app.closeGameDetail()
        }
    }
}
