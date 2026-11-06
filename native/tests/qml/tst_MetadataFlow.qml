/* Regressão da busca adiada e seleção sem persistência do cadastro em edição. */
import QtQuick
import QtTest
import "../../qml/components" as Ui
Item {
    id: root
    width: 1024; height: 768
    QtObject {
        id: service
        property bool busy: false
        property bool metadataReady: true
        property string error: ""
        property var results: []
        property int searches: 0
        signal changed()
        signal prepared(var values)
        function search(query, platform) {
            searches++
            results = [{id: "10", name: query, platform: platform, images: []}]
            return {jobId: "search"}
        }
        function importGame(game, types, draftOnly) {
            if (draftOnly) prepared({title: "Selecionado", launchbox_id: "10"})
            return {jobId: "import"}
        }
    }
    Ui.LaunchBoxImporter {
        id: importer
        metadataService: service; platformService: null; gameService: null
        serviceMode: true; backdropBlurEnabled: false
    }
    /* O formulário de edição resolve a busca no próprio cartão, sem modal. */
    Ui.GameFormDialog {
        id: form
        metadataService: service
        platforms: [{id: 23, name: "Sega Mega Drive"}]
        editingGame: ({id: 1, title: "Sonic", platform_id: 23, launchbox_id: "", rom_path: ""})
        backdropBlurEnabled: false
    }
    SignalSpy { id: selected; target: importer; signalName: "metadataSelected" }
    TestCase {
        name: "MetadataFlow"; when: windowShown
        function initTestCase() {
            // O Overlay usa o tamanho real da janela, inclusive no runner offscreen.
            root.Window.window.width = 1024
            root.Window.window.height = 768
        }
        function test_searchAndSelectDraft() {
            const before = service.searches
            importer.openFor("Sonic", "Sega Mega Drive", true)
            tryCompare(importer, "opened", true)
            compare(service.searches, before + 1)
            compare(findChild(importer, "launchBoxResults").count, 1)
            // Contar itens não basta: a lista deve ter área visível e aceitar cliques.
            const list = findChild(importer, "launchBoxResults")
            tryVerify(function() { return list.width >= 240 && list.height > 0 })
            tryVerify(function() { return list.itemAtIndex(0) !== null })
            mouseClick(list.itemAtIndex(0), 20, 20)
            compare(importer.selectedGame.id, "10")
            mouseClick(findChild(importer, "launchBoxImport"))
            compare(selected.count, 1)
            compare(selected.signalArguments[0][0].launchbox_id, "10")
            compare(importer.visible, false)
        }
        function test_waitForCatalog() {
            service.busy = true
            importer.openFor("Mario", "", false)
            tryCompare(importer, "opened", true)
            const before = service.searches
            compare(importer.pendingSearch, true)
            service.busy = false
            service.changed()
            compare(service.searches, before + 1)
            compare(importer.pendingSearch, false)
            importer.close()
        }

        /* A busca do formulário mostra os resultados no cartão, sem abrir outro modal. */
        function test_formSearchShowsInlineResults() {
            form.open()
            tryCompare(form, "opened", true)
            compare(importer.visible, false)
            form.searchMetadata("Sonic")
            compare(form.metadataSearchActive, true)
            service.changed()
            compare(form.metadataResults.length, 1)
            const list = findChild(form, "gameMetadataResults")
            verify(list !== null)
            tryVerify(function() { return list.count === 1 && list.itemAtIndex(0) !== null })
        }

        /* Escolher o resultado aplica o rascunho e fecha o painel, sem gravar o jogo. */
        function test_formSelectionAppliesDraft() {
            const list = findChild(form, "gameMetadataResults")
            mouseClick(list.itemAtIndex(0), 20, 20)
            compare(form.draft.title, "Selecionado")
            compare(form.draft.launchbox_id, "10")
            compare(form.metadataSearchActive, false)
            form.close()
        }
    }
}
