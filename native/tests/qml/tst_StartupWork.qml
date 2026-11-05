/* Garante que abas ocultas não leiam o perfil durante a abertura da biblioteca. */
import QtQuick
import QtTest
import "../../qml/components" as UI

Item {
    width: 1100
    height: 800
    QtObject {
        id: settings
        property int scans: 0
        property int logReads: 0
        property string error: ""
        property var logEntries: []
        property string buildLabel: "teste"
        property int totalGames: 0
        property real dataDirSizeMb: 0
        function refreshStats() { scans++ }
        function refreshLogs() { logReads++ }
    }
    QtObject {
        id: media
        property int reads: 0
        function stats() { reads++; return ({}) }
    }
    Component {
        id: logsComponent
        UI.LogsSettings { visible: false; settingsService: settings }
    }
    Component {
        id: backupComponent
        UI.DataPortabilitySettings { visible: false; settingsService: settings }
    }
    Component {
        id: coversComponent
        UI.CoverSyncSettings {
            visible: false
            serviceMode: true
            mediaSyncService: media
            gameService: null
            jobManager: null
        }
    }
    TestCase {
        name: "StartupWork"
        when: windowShown

        /** A leitura ocorre ao abrir a aba e continua disponível nas próximas aberturas. */
        function test_hiddenSettingsDoNotScanProfile() {
            settings.scans = 0
            settings.logReads = 0
            media.reads = 0
            const backup = createTemporaryObject(backupComponent, parent)
            const covers = createTemporaryObject(coversComponent, parent)
            const logs = createTemporaryObject(logsComponent, parent)
            verify(backup !== null)
            verify(covers !== null)
            verify(logs !== null)
            compare(settings.scans, 0)
            compare(media.reads, 0)
            compare(settings.logReads, 0)
            backup.visible = true
            covers.visible = true
            logs.visible = true
            compare(settings.scans, 1)
            compare(media.reads, 1)
            compare(settings.logReads, 1)
            backup.visible = false
            covers.visible = false
            logs.visible = false
            backup.visible = true
            covers.visible = true
            logs.visible = true
            compare(settings.scans, 2)
            compare(media.reads, 2)
            compare(settings.logReads, 2)
        }
    }
}
