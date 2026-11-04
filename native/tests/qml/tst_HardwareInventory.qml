/* Exercita inventário: navegação, filtros, busca, CRUD, fotos e visualizações. */
import QtQuick
import QtTest
import "../../qml" as App

Item {
    id: root
    width: 1122
    height: 957

    /* Serviço simulado espelha propriedades e slots do InventoryService. */
    QtObject {
        id: inventory
        property bool available: true
        property var items: [
            {id: 1, name: "Super Nintendo", platform_id: 10, is_multiplatform: 0, platform_name: "Super Nintendo",
             item_type_id: 1, item_type_name: "Console", conservation_state_id: 1, conservation_state_name: "Novo",
             description: "Console completo", acquisition_date: "2024-05-10", acquisition_url: "https://exemplo.com/item",
             color: "Cinza", value: 350, serial_number: "SN-1", region: "NTSC", storage_location: "Prateleira 3",
             loan_to: "", cover_photo_path: null, coverUrl: ""}
        ]
        property var types: [{id: 1, name: "Console", is_default: 1, created_at: ""}, {id: 2, name: "Controle", is_default: 1, created_at: ""}]
        property var states: [{id: 1, name: "Novo", is_default: 1, created_at: ""}, {id: 2, name: "Bom", is_default: 1, created_at: ""}]
        property var typeCounts: [{id: 1, name: "Console", count: 1}, {id: 2, name: "Controle", count: 0}]
        property var stateCounts: [{id: 1, name: "Novo", count: 1}, {id: 2, name: "Bom", count: 0}]
        property var platforms: [{id: 10, name: "Super Nintendo", count: 1}]
        property int total: 1
        property int filtered: 1
        property int page: 1
        property int pageSize: 36
        property string search: ""
        property string sortBy: "name"
        property int itemTypeId: 0
        property int conservationStateId: 0
        property int platformId: 0
        property string error: ""
        property var photos: []
        property int lastRemoved: 0

        function refresh() {}
        function goToPage(value) { page = value }
        function get(id) {
            for (let index = 0; index < items.length; index++) {
                if (Number(items[index].id) === Number(id)) return items[index]
            }
            return ({})
        }
        function createType(name) { return ({id: 9, name: name, is_default: 0}) }
        function createState(name) { return ({id: 9, name: name, is_default: 0}) }
        function platformsWithItems() { return platforms }
        function listPhotos(itemId) { return photos }
        function addPhoto(itemId, source) { return ({}) }
        function removePhoto(photoId) { return true }
        function reorderPhotos(idA, idB) { return true }
        function create(data) {
            const id = items.length + 1
            const item = Object.assign({}, data, {id: id, platform_name: "Super Nintendo",
                item_type_name: "Console", conservation_state_name: "Novo", coverUrl: ""})
            items = items.concat([item])
            total = items.length
            filtered = items.length
            return item
        }
        function update(id, data) {
            const next = []
            for (let index = 0; index < items.length; index++) {
                next.push(Number(items[index].id) === Number(id) ? Object.assign({}, items[index], data) : items[index])
            }
            items = next
            return true
        }
        function remove(id) {
            const next = []
            for (let index = 0; index < items.length; index++) {
                if (Number(items[index].id) !== Number(id)) next.push(items[index])
            }
            items = next
            total = items.length
            filtered = items.length
            lastRemoved = id
            return true
        }
        function mediaUrl(path) { return "" }
    }

    /* Preferências independentes do inventário, como InventoryPreferences. */
    QtObject {
        id: prefs
        property string viewMode: "grid"
        property string search: ""
        property string sortBy: "name"
    }

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
        property string viewMode: "grid"
        property bool includeMissingCovers: true
        property var genres: []
        property string error: ""
        property int mostPlayedCount: 0
        property int favoritesCount: 0
        property int playingCount: 0
        property int completedCount: 0
        property int platformId: 0
        property var platformCounts: ({})
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
        id: platforms
        property bool available: true
        property var items: [{id: 10, name: "Super Nintendo", category: "Console", gameCount: 0, isDefault: false}]
        property string error: ""
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

    /* Logs/estatísticas simulados para verificar as seções sem disco real. */
    QtObject {
        id: settings
        property var logEntries: [
            {id: 1, timestamp: "2026-11-02T10:00:00.000Z", level: "info", source: "GameStock", message: "Iniciando protótipo Qt."},
            {id: 2, timestamp: "2026-11-02T10:00:01.000Z", level: "warning", source: "GameStock", message: "Provider não carregou a capa."}
        ]
        property string logFilePath: "C:/perfil/native-prototype.log"
        property string dataDirPath: "C:/perfil"
        property int totalGames: 3
        property int totalInventoryItems: 2
        property real dataDirSizeMb: 12.5
        property bool statsLoading: false
        property string buildLabel: "teste"
        property string channel: "development"
        property string executableDir: "C:/GameStock"
        property string error: ""
        property string cacheFeedback: ""
        property int logRefreshes: 0
        property int statRefreshes: 0
        function refreshLogs() { logRefreshes++ }
        function clearLogs() { logEntries = []; return true }
        function openLogsFolder() { return true }
        function openDataDir() { return true }
        function refreshStats() { statRefreshes++ }
        function clearRomCache() { cacheFeedback = "Cache já estava vazio."; return true }
    }

    /* Job ativo simulado: navegar entre seções não pode perder o progresso. */
    ListModel {
        id: activeJobs
        ListElement {
            jobId: "job-1"
            kind: "rom-folder-import"
            status: "interrupted"
            title: "Importação"
            error: ""
            progressCurrent: 1
            progressTotal: 4
            progressMessage: "Interrompido"
            progressStage: "matching"
            progressFilename: ""
            progressFolderPath: "C:/ROMs"
        }
    }

    QtObject {
        id: jobs
        property var model: activeJobs
        function job(id) { return null }
        function dismiss(id) {}
    }

    /* Coordenador de backup simulado, sem abrir diálogos nativos. */
    QtObject {
        id: backup
        property string error: ""
        property var lastImport: null
        property var lastExport: null
        function preview(path) {
            return {
                success: true,
                packagePath: path,
                manifest: {schemaVersion: 1, appVersion: "1.1.4", createdAt: "2026-11-02T10:00:00.000Z",
                    categories: ["metadata", "images", "platforms", "romLocations", "inventoryImages"], counts: {}},
                availableCategories: ["metadata", "images", "platforms", "romLocations", "inventoryImages"],
                counts: {games: 2, platforms: 3, images: 1, romLocations: 1, inventoryItems: 1},
                warnings: [{message: "ROM não encontrada no disco atual"}],
                errors: []
            }
        }
        function startImport(request) { lastImport = request; return true }
        function startExport(request) { lastExport = request; return true }
    }

    /* Updater simulado para splash e busca manual. */
    QtObject {
        id: update
        property string phase: "idle"
        property string message: "Pronto"
        property int percent: 0
        property string error: ""
        property string version: ""
        property string releaseDate: ""
        property string notes: ""
        property bool requiresAction: false
        property bool startupVisible: false
        property bool running: false
        property string channel: "installed"
        property string appVersion: "teste"
        property int checkCalls: 0
        function checkNow() { checkCalls++; phase = "checking"; message = "Verificando atualizações..."; running = true }
        function skip() { startupVisible = false; requiresAction = false }
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
        inventoryPreferences: prefs
        inventoryService: inventory
        settingsService: settings
        backupCoordinator: backup
        updateService: update
        jobManager: jobs
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
        name: "HardwareInventory"
        when: windowShown

        function init() {
            inventory.items = [
                {id: 1, name: "Super Nintendo", platform_id: 10, is_multiplatform: 0, platform_name: "Super Nintendo",
                 item_type_id: 1, item_type_name: "Console", conservation_state_id: 1, conservation_state_name: "Novo",
                 description: "Console completo", acquisition_date: "2024-05-10", acquisition_url: "https://exemplo.com/item",
                 color: "Cinza", value: 350, serial_number: "SN-1", region: "NTSC", storage_location: "Prateleira 3",
                 loan_to: "", cover_photo_path: null, coverUrl: ""}
            ]
            inventory.total = 1
            inventory.filtered = 1
            inventory.page = 1
            inventory.search = ""
            inventory.sortBy = "name"
            inventory.itemTypeId = 0
            inventory.conservationStateId = 0
            inventory.lastRemoved = 0
            inventory.photos = [{id: 7, item_id: 1, file_path: "C:/perfil/inventario/images/1/a.png",
                sort_order: 0, fileUrl: "image://profilemedia/a"}]
            prefs.viewMode = "grid"
            prefs.search = ""
            prefs.sortBy = "name"
            app.inventoryMode = true
            page.selectedItem = null
            page.formItem = null
            wait(150)
        }

        function page() { return findChild(app, "hardwareInventoryPage") }

        function cleanup() {
            const form = findChild(app, "hardwareItemFormDialog")
            if (form) form.close()
            const confirm = findChild(app, "hardwareDeleteConfirm")
            if (confirm) confirm.close()
        }

        /* A sidebar alterna os modos e aplica filtros de tipo/condição no serviço. */
        function test_01_sidebarFilters() {
            verify(findChild(app, "librarySection") !== null)
            verify(findChild(app, "inventorySection") !== null)
            const typeFilter = findChild(app, "inventoryFilters")
            verify(typeFilter !== null)
            const allTypes = findChild(typeFilter, "allInventoryTypes")
            verify(allTypes !== null)
            compare(allTypes.counter, "1")
            // Repeaters nomeiam os botões; o segundo tipo tem contagem zero.
            let consoleButton = null
            for (let index = 0; index < typeFilter.children.length; index++) {
                const child = typeFilter.children[index]
                if (child.text === "Console") consoleButton = child
            }
            verify(consoleButton !== null)
            mouseClick(consoleButton)
            compare(inventory.itemTypeId, 1)
            mouseClick(allTypes)
            compare(inventory.itemTypeId, 0)
        }

        /* Busca aplica debounce e mantém a preferência independente. */
        function test_02_searchAndSort() {
            const search = findChild(page(), "inventorySearch")
            verify(search !== null)
            search.text = "console"
            wait(450)
            compare(inventory.search, "console")
            compare(prefs.search, "console")

            const sortButton = findChild(page(), "inventorySort")
            verify(sortButton !== null)
            mouseClick(sortButton)
            compare(inventory.sortBy, "type")
            compare(prefs.sortBy, "type")
            mouseClick(sortButton)
            compare(inventory.sortBy, "recent")
            mouseClick(sortButton)
            compare(inventory.sortBy, "name")
        }

        /* Alternância cards/lista é independente e mantém o contador da coleção. */
        function test_03_viewMode() {
            const listButton = findChild(page(), "inventoryListView")
            verify(listButton !== null)
            mouseClick(listButton)
            compare(prefs.viewMode, "list")
            wait(100)
            compare(inventory.total, 1)
            const gridButton = findChild(page(), "inventoryGridView")
            verify(gridButton !== null)
            mouseClick(gridButton)
            compare(prefs.viewMode, "grid")
        }

        /* Card abre o detalhe com chips, dados e galeria; voltar retorna à lista. */
        function test_04_detailNavigation() {
            const card = findChild(page(), "hardwareItemCard")
            verify(card !== null)
            mouseClick(card)
            const detail = findChild(page(), "hardwareItemDetail")
            verify(detail !== null)
            verify(detail.visible)
            compare(detail.item.name, "Super Nintendo")
            compare(detail.photos.length, 1)
            // Os paineis devem manter caixas positivas e o gutter, sem sobrepor dados e fotos.
            const infoPanel = findChild(detail, "hardwareInfoPanel")
            const photoPanel = findChild(detail, "hardwarePhotoPanel")
            verify(infoPanel !== null && photoPanel !== null)
            tryVerify(function() {
                return infoPanel.width > 0 && photoPanel.width > 0
                    && (photoPanel.x >= infoPanel.x + infoPanel.width + 15
                        || photoPanel.y >= infoPanel.y + infoPanel.height + 15)
            })
            const backButton = findChild(detail, "backToInventory")
            verify(backButton !== null)
            backButton.clicked()
            tryVerify(function() { return !detail.visible }, 2000)
        }

        /* Criação preenche plataforma, tipo, condição e abre o detalhe do registro salvo. */
        function test_05_createItem() {
            page().openCreate()
            const form = findChild(app, "hardwareItemFormDialog")
            tryVerify(function() { return form.visible }, 2000)
            wait(150)
            const name = findChild(form, "hardwareItemName")
            compare(name.text, "")
            name.text = "Controle novo"
            const platform = findChild(form, "hardwareItemPlatform")
            platform.currentIndex = 2
            findChild(form, "hardwareTypeSelector").currentValue = 2
            findChild(form, "hardwareStateSelector").currentValue = 2
            mouseClick(findChild(form, "saveHardwareItem"))
            tryVerify(function() { return !form.visible }, 2000)
            compare(inventory.items.length, 2)
            compare(inventory.items[1].name, "Controle novo")
            const detail = findChild(page(), "hardwareItemDetail")
            verify(detail.visible)
            compare(detail.item.name, "Controle novo")
        }

        /* Exclusão passa pela confirmação e remove o item pelo serviço. */
        function test_06_deleteItem() {
            const detail = findChild(page(), "hardwareItemDetail")
            mouseClick(findChild(detail, "deleteHardwareItem"))
            const confirm = findChild(app, "hardwareDeleteConfirm")
            tryVerify(function() { return confirm.visible }, 2000)
            wait(100)
            verify(findChild(confirm, "confirmMessage").text.indexOf("Controle novo") >= 0)
            mouseClick(findChild(confirm, "acceptConfirm"))
            tryVerify(function() { return !confirm.visible }, 2000)
            compare(inventory.lastRemoved, 2)
            compare(inventory.items.length, 1)
            tryVerify(function() { return !detail.visible }, 2000)
        }

        /* Configurações exibe logs reais do serviço e estatísticas do perfil no Sobre. */
        function test_07_logsAndAbout() {
            const dialog = findChild(app, "settingsDialog")
            verify(dialog !== null)
            app.settingsSection = "logs"
            dialog.open()
            tryVerify(function() { return dialog.visible }, 2000)
            wait(200)
            const logsPanel = findChild(app, "logsSettings")
            verify(logsPanel !== null)
            verify(logsPanel.visible)
            verify(settings.logRefreshes >= 1)
            mouseClick(findChild(app, "clearLogs"))
            compare(settings.logEntries.length, 0)

            app.settingsSection = "sobre"
            wait(200)
            /* Regressão: configurações deve abrir ao centro, sem a antiga âncora no canto. */
            verify(Math.abs(dialog.x - (app.width - dialog.width) / 2) <= 1)
            verify(Math.abs(dialog.y - (app.height - dialog.height) / 2) <= 1)
            const about = findChild(app, "aboutSettings")
            verify(about !== null)
            verify(about.visible)
            compare(findChild(app, "aboutTotalGames").text, "3 jogos")
            compare(findChild(app, "aboutDataSize").text, "12.5 MB")
            compare(findChild(app, "aboutChannel").text, "development")
            mouseClick(findChild(app, "clearRomCache"))
            compare(settings.cacheFeedback, "Cache já estava vazio.")
            dialog.close()
        }

        /* Navegação entre seções e coleções preserva o job ativo (fonte única). */
        function test_08_jobsSurviveNavigation() {
            const notification = findChild(app, "notificationCenter")
            verify(notification !== null)
            verify(notification.visible)
            compare(jobs.model.count, 1)
            const dialog = findChild(app, "settingsDialog")
            app.settingsSection = "plataformas"
            dialog.open()
            app.settingsSection = "logs"
            wait(100)
            app.settingsSection = "sobre"
            wait(100)
            app.settingsSection = "emuladores"
            wait(100)
            dialog.close()
            app.inventoryMode = false
            wait(100)
            app.inventoryMode = true
            wait(100)
            compare(jobs.model.count, 1)
            verify(notification.visible)
            compare(jobs.model.get(0).progressCurrent, 1)
        }

        /* Backup: seleção vazia bloqueada, preview habilita importação e envia categorias. */
        function test_09_backupPanel() {
            const dialog = findChild(app, "settingsDialog")
            app.settingsSection = "backup"
            dialog.open()
            tryVerify(function() { return dialog.visible }, 2000)
            wait(150)
            const panel = findChild(app, "dataPortabilitySettings")
            verify(panel !== null)
            verify(panel.visible)
            const exportButton = findChild(app, "exportBackup")
            verify(exportButton !== null)
            // Todas as categorias devem continuar clicaveis depois de alterar o layout do resumo.
            const categoryKeys = panel.allCategories()
            for (let i = 0; i < categoryKeys.length; ++i) {
                const category = findChild(panel, "exportCategory" + categoryKeys[i])
                verify(category !== null)
                verify(category.visible)
                mouseClick(category)
                compare(panel.exportCategories.length, 4)
                mouseClick(category)
                compare(panel.exportCategories.length, 5)
            }
            verify(exportButton.enabled)
            panel.exportCategories = []
            verify(!exportButton.enabled)
            panel.exportCategories = panel.allCategories()

            panel.preview = backup.preview("C:/fixtures/pacote.gamestock-backup")
            panel.importCategories = panel.preview.availableCategories.slice()
            wait(100)
            verify(panel.preview.success)
            compare(panel.importCategories.length, 5)
            const importButton = findChild(app, "importBackup")
            verify(importButton !== null)
            verify(importButton.enabled)
            panel.startImport()
            verify(backup.lastImport !== null)
            compare(backup.lastImport.categories.length, 5)
            compare(backup.lastImport.packagePath, "C:/fixtures/pacote.gamestock-backup")

            panel.preview = backup.preview("C:/fixtures/pacote.gamestock-backup")
            panel.preview.errors = [{message: "Pacote sem data/games.json"}]
            panel.importCategories = panel.preview.availableCategories.slice()
            wait(100)
            verify(!importButton.enabled)
            dialog.close()
        }

        /* Updater: busca manual e splash com modo offline/arraste. */
        function test_10_updateSplashAndManualCheck() {
            const dialog = findChild(app, "settingsDialog")
            app.settingsSection = "sobre"
            dialog.open()
            tryVerify(function() { return dialog.visible }, 2000)
            wait(150)
            update.checkCalls = 0
            update.phase = "idle"
            update.message = "Pronto"
            mouseClick(findChild(app, "checkUpdate"))
            compare(update.checkCalls, 1)
            wait(100)
            verify(findChild(app, "aboutUpdateStatus").text.indexOf("Verificando") >= 0)
            dialog.close()

            const splash = findChild(app, "updateSplash")
            verify(splash !== null)
            verify(!splash.visible)
            update.phase = "no-connection"
            update.message = "Sem conexão para verificar atualizações."
            update.startupVisible = true
            update.requiresAction = true
            wait(100)
            verify(splash.visible)
            verify(findChild(app, "updateSplashMessage").text.indexOf("Sem conexão") >= 0)
            const card = findChild(app, "updateSplashCard")
            const startX = card.x
            splash.offsetX = -20
            splash.offsetY = -10
            wait(50)
            compare(card.x, startX - 20)
            splash.offsetX = 0
            splash.offsetY = 0
            const offline = findChild(app, "continueOffline")
            verify(offline.visible)
            mouseClick(offline)
            tryVerify(function() { return !splash.visible }, 2000)
            verify(!update.startupVisible)
        }
    }
}
