/* Exercita revisão/importação por pasta e o centro de notificações. */
import QtQuick
import QtTest
import "../../qml" as App

Item {
    id: root
    width: 1122
    height: 957

    /* Plataformas e jogos mínimos para abrir Configurações > Biblioteca. */
    QtObject {
        id: platforms
        property bool available: true
        property var items: [{id: 23, name: "Sega Mega Drive", category: "Consoles", gameCount: 0, isDefault: false}]
        property string error: ""
        function refresh() {}
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
        property bool includeMissingCovers: true
        property var genres: []
        property string error: ""
        property int mostPlayedCount: 0
        property int favoritesCount: 0
        property int playingCount: 0
        property int completedCount: 0
        property int platformId: 0
        property var platformCounts: ({})
        property string viewMode: "grid"
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

    /* Serviço de importação simulado, com scan determinístico e job imediato. */
    QtObject {
        id: romFolders
        property var folders: []
        property string error: ""
        property var lastRequest: ({})
        property var lastImport: ({})
        property int saveCount: 0
        property int removeCount: 0

        function scan(request) {
            lastRequest = request
            return {
                ok: true,
                folderPaths: request.folderPaths,
                romFilePaths: [],
                platformId: request.platformId,
                platformName: request.platformId ? "Sega Mega Drive" : "Detecção automática",
                detectionMode: request.detectionMode,
                includeSubfolders: request.includeSubfolders,
                candidates: [{
                    folderPath: "C:/roms",
                    romPath: "C:/roms/Sonic (USA).md",
                    filename: "Sonic (USA).md",
                    titleCandidate: "Sonic",
                    platformId: 23,
                    platformName: "Sega Mega Drive"
                }],
                ignoredItems: [{filename: "LEIAME.txt", reason: "Extensão .txt não configurada"}],
                ignored: 1,
                detectedPlatforms: [{platformId: 23, platformName: "Sega Mega Drive", count: 1}]
            }
        }
        function startImport(request) {
            lastImport = request
            return {jobId: "job-rom", kind: "rom-folder-import", status: "running"}
        }
        function saveFolder(path, platformId, includeSubfolders) {
            saveCount += 1
            folders = [{folderPath: path, platformId: platformId, platformName: "Sega Mega Drive",
                indexedCount: 1, includeSubfolders: includeSubfolders}]
            return true
        }
        function removeFolder(path, platformId) {
            removeCount += 1
            folders = []
            return 1
        }
    }

    /* Modelo de jobs e fachada mínima usada pelo NotificationCenter. */
    ListModel {
        id: jobModel
        ListElement {
            jobId: "job-rom"
            kind: "rom-folder-import"
            status: "interrupted"
            title: "Importando ROMs"
            progressCurrent: 2
            progressTotal: 5
            progressMessage: "Interrompido"
            progressStage: "matching"
            progressFilename: "Sonic (USA).md"
            progressFolderPath: "C:/roms"
            error: ""
            startedAt: "2026-01-01T00:00:00.000Z"
        }
    }

    QtObject {
        id: jobs
        property var model: jobModel
        property int dismissed: 0
        function job(id) {
            return {jobId: id, folderPaths: ["C:/roms"], romFilePaths: [], platformId: 23,
                detectionMode: "manual", includeSubfolders: false}
        }
        function dismiss(id) {
            dismissed += 1
            for (let index = jobModel.count - 1; index >= 0; --index) {
                if (jobModel.get(index).jobId === id) jobModel.remove(index)
            }
            return true
        }
    }

    QtObject {
        id: metadata
        property bool available: true
        property bool busy: false
        property bool metadataReady: false
        property string error: ""
        property var results: []
        property var lastSearch: ({})
        property var lastImport: ({})
        signal imported(int gameId)
        function ensureMetadata() { metadataReady = true; return {jobId: "meta-cache"} }
        function search(query, platformName) {
            lastSearch = {query: query, platformName: platformName}
            results = [{id: "10", name: "Game One", platform: "Sega Mega Drive",
                images: [{filename: "box.png", type: "Box - Front", region: "Brazil"}]}]
            return {jobId: "meta-search"}
        }
        function importGame(game, types) {
            lastImport = {game: game, types: types}
            imported(10)
            return {jobId: "meta-import"}
        }
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
        jobManager: jobs
        romFolderService: romFolders
        metadataService: metadata
        prototypeListView: false
        prototypeSearch: ""
        prototypeBenchmark: false
        prototypeSettingsOpen: false
        prototypeStackedOpen: false
        prototypeDetailOpen: false
        prototypePlatformsOpen: false
        prototypeEmulatorsOpen: false
        prototypePlayHistoryOpen: false
        prototypeRomImporterOpen: true
        prototypeDisableBlur: true
        prototypeBlurRadius: 0
        prototypeShadowBlur: 0
        prototypeModalShadowBlur: 0
        buildLabel: "teste"
    }

    TestCase {
        name: "RomFolderImporter"
        when: windowShown

        /** Busca recursiva dentro de delegates; ListView não os expõe via findChild. */
        function findWithin(item, name) {
            if (!item) return null
            if (item.objectName === name) return item
            const children = item.children
            for (let index = 0; index < children.length; ++index) {
                const found = findWithin(children[index], name)
                if (found) return found
            }
            return null
        }

        function init() {
            romFolders.folders = []
            romFolders.error = ""
            romFolders.saveCount = 0
            romFolders.removeCount = 0
            romFolders.lastRequest = ({})
            romFolders.lastImport = ({})
            jobs.dismissed = 0
            app.settingsSection = "biblioteca"
            const settings = findChild(app, "settingsDialog")
            if (settings && !settings.visible) settings.open()
            wait(200)
        }

        function cleanup() {
            const importer = findChild(app, "launchBoxImporter")
            if (importer && importer.visible) importer.close()
            const wizard = findChild(app, "romFolderWizard")
            if (wizard && wizard.visible) wizard.close()
            const confirm = findChild(app, "removeRomFolderConfirm")
            if (confirm && confirm.visible) confirm.close()
            const settings = findChild(app, "settingsDialog")
            if (settings && settings.visible) settings.close()
        }

        /** Revisa candidatos/ignorados e inicia o job com as opções escolhidas. */
        function test_01_scanReviewAndImport() {
            const add = findChild(app, "addRomFolder")
            verify(add !== null)
            mouseClick(add)
            wait(200)
            const wizard = findChild(app, "romFolderWizard")
            verify(wizard !== null && wizard.visible)

            const path = findChild(app, "romFolderPath")
            verify(path !== null)
            path.text = "C:/roms"
            const subfolders = findChild(app, "romFolderSubfolders")
            verify(subfolders !== null)
            subfolders.toggle()

            const scan = findChild(app, "scanRomFolder")
            verify(scan !== null)
            mouseClick(scan)
            wait(200)

            const summary = findChild(app, "romFolderReviewSummary")
            verify(summary !== null)
            verify(summary.text.indexOf("1 ROM(s) encontrada(s)") === 0)
            verify(summary.text.indexOf("1 ignorada(s)") > 0)
            verify(romFolders.lastRequest.includeSubfolders === true)
            verify(romFolders.lastRequest.detectionMode === "automatic")

            const importButton = findChild(app, "importRomFolder")
            verify(importButton !== null && importButton.enabled)
            mouseClick(importButton)
            wait(300)
            verify(romFolders.lastImport.folderPaths[0] === "C:/roms")
            verify(romFolders.lastImport.detectionMode === "automatic")
            // A detecção automática salva uma entrada por plataforma resolvida.
            compare(romFolders.saveCount, 1)
            compare(romFolders.folders.length, 1)
            verify(!findChild(app, "romFolderWizard").visible)
        }

        /** A tabela resume pastas persistidas e remove apenas os registros. */
        function test_02_summaryAndRemoval() {
            romFolders.folders = [{folderPath: "C:/roms", platformId: 23,
                platformName: "Sega Mega Drive", indexedCount: 4, includeSubfolders: true}]
            wait(100)
            const folderList = findChild(app, "romFolderList")
            verify(folderList !== null && folderList.count === 1)
            const folderItem = folderList.itemAtIndex(0)
            verify(folderItem !== null)
            const continueButton = findWithin(folderItem, "continueFolder0")
            verify(continueButton !== null)
            mouseClick(continueButton)
            wait(100)
            verify(romFolders.lastImport.folderPaths[0] === "C:/roms")
            verify(romFolders.lastImport.includeSubfolders === true)

            const remove = findWithin(folderItem, "removeFolder0")
            verify(remove !== null)
            mouseClick(remove)
            wait(200)
            const confirm = findChild(app, "removeRomFolderConfirm")
            verify(confirm !== null && confirm.visible)
            const accept = findChild(confirm, "acceptConfirm")
            verify(accept !== null)
            mouseClick(accept)
            wait(200)
            compare(romFolders.removeCount, 1)
            compare(romFolders.folders.length, 0)
        }

        /** Job interrompido aparece, retoma com os parâmetros e some ao dispensar. */
        function test_03_notificationResumeAndDismiss() {
            const settings = findChild(app, "settingsDialog")
            if (settings && settings.visible) settings.close()
            wait(150)
            if (jobModel.count === 0) {
                jobModel.append({jobId: "job-rom", kind: "rom-folder-import", status: "interrupted",
                    title: "Importando ROMs", progressCurrent: 2, progressTotal: 5,
                    progressMessage: "Interrompido", progressStage: "matching",
                    progressFilename: "Sonic (USA).md", progressFolderPath: "C:/roms",
                    error: "", startedAt: "2026-01-01T00:00:00.000Z"})
            }
            wait(200)
            const center = findChild(app, "notificationCenter")
            verify(center !== null && center.visible)
            const jobList = findChild(app, "jobNotificationList")
            verify(jobList !== null && jobList.count === 1)
            const card = jobList.itemAtIndex(0)
            verify(card !== null)
            const resume = findWithin(card, "resumeJobjob-rom")
            verify(resume !== null && resume.visible)
            mouseClick(resume)
            wait(200)
            verify(romFolders.lastImport.folderPaths[0] === "C:/roms")
            compare(jobs.dismissed, 1)

            // Sem jobs, o painel fica oculto e não bloqueia a biblioteca.
            jobModel.append({jobId: "done-1", kind: "rom-folder-import", status: "completed",
                title: "Importando ROMs", progressCurrent: 1, progressTotal: 1,
                progressMessage: "Concluído", progressStage: "done",
                progressFilename: "", progressFolderPath: "", error: "",
                startedAt: "2026-01-01T00:00:00.000Z"})
            wait(200)
            const doneCard = jobList.itemAtIndex(0)
            verify(doneCard !== null)
            const dismiss = findWithin(doneCard, "dismissJobdone-1")
            verify(dismiss !== null && dismiss.visible)
            mouseClick(dismiss)
            wait(200)
            compare(jobModel.count, 0)
        }

        /** Importador LaunchBox busca, seleciona e importa com tipos de imagem. */
        function test_04_launchBoxSearchAndImport() {
            const settings = findChild(app, "settingsDialog")
            if (settings && settings.visible) settings.close()
            wait(150)
            // A importacao continua acessivel pelo menu de contexto da biblioteca.
            findChild(app, "libraryActionsMenu").open()
            const open = findChild(app, "openMetadataImporter")
            verify(open !== null)
            mouseClick(open)
            wait(200)
            const importer = findChild(app, "launchBoxImporter")
            verify(importer !== null && importer.visible)
            verify(metadata.metadataReady)

            const query = findChild(app, "launchBoxQuery")
            verify(query !== null)
            query.text = "Game"
            mouseClick(findChild(app, "launchBoxSearch"))
            wait(200)
            compare(metadata.lastSearch.query, "Game")
            const results = findChild(app, "launchBoxResults")
            verify(results !== null && results.count === 1)

            importer.selectedGame = metadata.results[0]
            wait(100)
            const importButton = findChild(app, "launchBoxImport")
            verify(importButton !== null && importButton.enabled)
            mouseClick(importButton)
            wait(200)
            compare(metadata.lastImport.game.id, "10")
            compare(metadata.lastImport.types.length, 5)
            verify(metadata.lastImport.types.indexOf("Box - Front") >= 0)
        }
    }
}
