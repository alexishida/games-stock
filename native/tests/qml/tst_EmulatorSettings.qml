/* Exercita emuladores, vínculos, cores RetroArch e histórico de partidas. */
import QtQuick
import QtTest
import "../../qml" as App

Item {
    id: root
    width: 1122
    height: 957

    QtObject {
        id: emulators
        property bool available: true
        property var items: [
            {id: 1, name: "RetroArch", executable: "C:/retroarch.exe", args: "", is_retroarch: 1},
            {id: 2, name: "PCSX2", executable: "C:/pcsx2.exe", args: "", is_retroarch: 0}
        ]
        property string error: ""
        property var lastLink: ({})
        property var lastLinks: []

        function create(input) {
            const id = 10 + items.length
            items = items.concat([{id: id, name: input.name, executable: input.executable, args: input.args,
                is_retroarch: input.is_retroarch ? 1 : 0}])
            return {id: id}
        }
        function update(id, changes) {
            const next = []
            for (let index = 0; index < items.length; index++) {
                next.push(items[index].id === id ? Object.assign({}, items[index], changes) : items[index])
            }
            items = next
            return true
        }
        function remove(id) {
            const next = []
            for (let index = 0; index < items.length; index++) {
                if (items[index].id !== id) next.push(items[index])
            }
            items = next
            return true
        }
        function listByPlatforms(ids) {
            return {
                "1": [{platform_id: 1, emulator_id: 1, isDefault: true, core_path: "snes9x_libretro",
                    emulator: items[0]}],
                "2": []
            }
        }
        function link(emulatorId, platformId, isDefault, corePath) {
            lastLink = {emulatorId: emulatorId, platformId: platformId, isDefault: isDefault, corePath: corePath}
            return {emulator_id: emulatorId, platform_id: platformId, is_default: isDefault ? 1 : 0,
                isDefault: isDefault, core_path: corePath}
        }
        function unlink(emulatorId, platformId) { return true }
        function savePlatformLinks(changes) {
            lastLinks = changes
            return true
        }
        function listRetroArchCores(id) {
            return {coresDir: "C:/cores", coresDirExists: true, executableConfigured: true,
                installedCores: ["snes9x_libretro", "bsnes_libretro"]}
        }
        function retroArchCoreCandidates(platformName) {
            return platformName === "Super Nintendo" ? ["snes9x_libretro", "bsnes_libretro"] : ["nestopia_libretro"]
        }
        function compatibleRetroArchCores(platformName, installedCores) {
            return installedCores
        }
        function refresh() {}
    }

    QtObject {
        id: platforms
        property bool available: true
        property var items: [
            {id: 1, name: "Super Nintendo", category: "Console", gameCount: 1, isDefault: false},
            {id: 2, name: "Nintendo NES", category: "Console", gameCount: 0, isDefault: true}
        ]
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
        property string viewMode: "grid"
        property bool includeMissingCovers: true
        property var genres: []
        property string error: ""
        property int totalLaunches: 7
        property int playedGames: 3
        property int mostPlayedCount: 0
        property int favoritesCount: 0
        property int playingCount: 0
        property int completedCount: 0
        property int platformId: 0
        property var platformCounts: ({"1": 1})
        function refresh() {}
        function resetLaunchStats() {
            totalLaunches = 0
            playedGames = 0
            return {success: true, updated: 1}
        }
        function goToPage(value) { page = value }
        function get(id) { return ({}) }
        function listVersions(id) { return [] }
        function listMedia(id) { return [] }
        function update(id, data) { return true }
        function create(data) { return ({}) }
        function remove(id) { return true }
        function mediaUrl(path) { return "" }
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
        emulatorService: emulators
        launchService: null
        inventoryPreferences: null
        prototypeListView: false
        prototypeSearch: ""
        prototypeBenchmark: false
        prototypeSettingsOpen: false
        prototypeStackedOpen: false
        prototypeDetailOpen: false
        prototypePlatformsOpen: false
        prototypeEmulatorsOpen: true
        prototypePlayHistoryOpen: false
        prototypeDisableBlur: true
        prototypeBlurRadius: 0
        prototypeShadowBlur: 0
        prototypeModalShadowBlur: 0
        buildLabel: "teste"
    }

    TestCase {
        name: "EmulatorSettings"
        when: windowShown

        function init() {
            emulators.items = [
                {id: 1, name: "RetroArch", executable: "C:/retroarch.exe", args: "", is_retroarch: 1},
                {id: 2, name: "PCSX2", executable: "C:/pcsx2.exe", args: "", is_retroarch: 0}
            ]
            emulators.error = ""
            emulators.lastLink = ({})
            emulators.lastLinks = []
            games.totalLaunches = 7
            games.playedGames = 3
            ensureSettings()
        }

        function ensureSettings() {
            const settings = findChild(app, "settingsDialog")
            app.settingsSection = "emuladores"
            if (settings && !settings.visible) settings.open()
            wait(200)
        }

        function cleanup() {
            const manager = findChild(app, "emulatorManager")
            if (manager) {
                manager.formDialog.close()
                manager.linkDialog.close()
                manager.coresDialog.close()
            }
            const confirm = findChild(app, "emulatorConfirmDialog")
            if (confirm) confirm.close()
            const reset = findChild(app, "resetConfirmDialog")
            if (reset) reset.close()
        }

        /** RetroArch aparece primeiro e a criação entra na lista. */
        function test_01_listAndCreate() {
            const manager = findChild(app, "emulatorManager")
            verify(manager !== null)
            compare(manager.orderedEmulators.length, 2)
            compare(manager.orderedEmulators[0].name, "RetroArch")
            compare(manager.orderedEmulators[1].name, "PCSX2")
            mouseClick(findChild(manager, "newEmulator"))
            const form = manager.formDialog
            tryVerify(function() { return form.visible }, 2000)
            wait(200)
            const name = findChild(form, "emulatorNameField")
            name.text = "Dolphin"
            findChild(form, "emulatorExecutableField").text = "C:/dolphin.exe"
            mouseClick(findChild(form, "saveEmulator"))
            tryVerify(function() { return !form.visible }, 2000)
            compare(emulators.items.length, 3)
            compare(emulators.items[2].name, "Dolphin")
        }

        /** Edição pré-preenche e persiste nome/executável/args. */
        function test_02_edit() {
            const manager = findChild(app, "emulatorManager")
            wait(150)
            mouseClick(findChild(manager, "editEmulator"))
            const form = manager.formDialog
            tryVerify(function() { return form.visible }, 2000)
            wait(200)
            compare(findChild(form, "emulatorNameField").text, "RetroArch")
            findChild(form, "emulatorNameField").text = "RetroArch Editado"
            findChild(form, "emulatorArgsField").text = "-v"
            mouseClick(findChild(form, "saveEmulator"))
            tryVerify(function() { return !form.visible }, 2000)
            compare(emulators.items[0].name, "RetroArch Editado")
            compare(emulators.items[0].args, "-v")
        }

        /** Expandir vínculos e vincular uma plataforma usa o serviço. */
        function test_03_associationsAndLink() {
            const manager = findChild(app, "emulatorManager")
            wait(150)
            mouseClick(findChild(manager, "emulatorAssociations"))
            wait(200)
            compare(manager.associations(1).length, 1)
            mouseClick(findChild(manager, "linkEmulator"))
            const dialog = manager.linkDialog
            tryVerify(function() { return dialog.visible }, 2000)
            wait(200)
            mouseClick(findChild(dialog, "saveEmulatorLink"))
            tryVerify(function() { return !dialog.visible }, 2000)
            compare(emulators.lastLink.emulatorId, 1)
            compare(emulators.lastLink.platformId, 1)
            compare(emulators.lastLink.isDefault, true)
        }

        /** O modal de cores salva o lote de vínculos RetroArch. */
        function test_04_retroArchCores() {
            const manager = findChild(app, "emulatorManager")
            wait(150)
            mouseClick(findChild(manager, "emulatorCores"))
            const dialog = manager.coresDialog
            tryVerify(function() { return dialog.visible }, 2000)
            wait(200)
            compare(dialog.inventory.installedCores.length, 2)
            dialog.setDraft(platforms.items[0], "snes9x_libretro")
            mouseClick(findChild(dialog, "saveCores"))
            tryVerify(function() { return !dialog.visible }, 2000)
            compare(emulators.lastLinks.length, 1)
            compare(emulators.lastLinks[0].corePath, "snes9x_libretro")
        }

        /** Exclusão de emulador passa por confirmação; reset zera as partidas. */
        function test_05_deleteAndResetHistory() {
            app.requestEmulatorDelete(emulators.items[1])
            const confirm = findChild(app, "emulatorConfirmDialog")
            tryVerify(function() { return confirm.visible }, 2000)
            wait(200)
            mouseClick(findChild(confirm, "acceptConfirm"))
            tryVerify(function() { return !confirm.visible }, 2000)
            compare(emulators.items.length, 1)

            app.settingsSection = "partidas"
            wait(200)
            const history = findChild(app, "playHistorySettings")
            verify(history !== null && history.visible)
            compare(findChild(history, "totalLaunchesLabel").text, "7 partidas jogadas")
            compare(findChild(history, "playedGamesLabel").text, "3 jogos com histórico")
            mouseClick(findChild(history, "resetLaunchStats"))
            const reset = findChild(app, "resetConfirmDialog")
            tryVerify(function() { return reset.visible }, 2000)
            wait(200)
            mouseClick(findChild(reset, "acceptConfirm"))
            tryVerify(function() { return !reset.visible }, 2000)
            compare(games.totalLaunches, 0)
            compare(findChild(history, "totalLaunchesLabel").text, "0 partidas jogadas")
        }
    }
}
