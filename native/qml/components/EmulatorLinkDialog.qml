/* Vincula um emulador a uma plataforma, com core opcional para RetroArch. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

DragDialog {
    id: linkDialog
    objectName: "emulatorLinkDialog"
    property var emulatorService: null
    property var emulator: null
    property var platforms: []
    property string formError: ""
    property var coreOptions: []
    property var inventory: ({})
    readonly property bool isRetroArch: emulator ? Number(emulator.is_retroarch) === 1 : false

    signal saved()

    width: Math.min(560, parent.width - 48)
    height: isRetroArch ? 420 : 300
    heading: "Vincular a plataforma"
    onOpened: populate()
    onClosed: formError = ""

    function populate() {
        formError = ""
        inventory = isRetroArch && emulatorService ? emulatorService.listRetroArchCores(Number(emulator.id)) : ({})
        platformBox.currentIndex = platforms.length ? 0 : -1
        defaultBox.checked = true
        refreshCoreOptions()
    }

    function selectedPlatform() {
        return platformBox.currentIndex >= 0 ? platforms[platformBox.currentIndex] : null
    }

    function refreshCoreOptions() {
        const platform = selectedPlatform()
        if (!isRetroArch || !platform) {
            coreOptions = []
            coreBox.currentIndex = -1
            return
        }
        const options = []
        const candidates = emulatorService.retroArchCoreCandidates(platform.name || "")
        for (let index = 0; index < candidates.length; index++) options.push(candidates[index])
        const installed = inventory.installedCores || []
        const compatible = emulatorService.compatibleRetroArchCores(platform.name || "", installed)
        for (let index = 0; index < compatible.length; index++) {
            if (options.indexOf(compatible[index]) < 0) options.push(compatible[index])
        }
        coreOptions = options
        coreBox.currentIndex = options.length ? 0 : -1
    }

    function save() {
        formError = ""
        if (!emulatorService || !emulator) return
        const platform = selectedPlatform()
        if (!platform) {
            formError = "Selecione uma plataforma"
            return
        }
        const core = isRetroArch && coreBox.currentIndex >= 0 ? coreOptions[coreBox.currentIndex] : ""
        if (isRetroArch && !core.trim().length) {
            formError = "Core do RetroArch é obrigatório"
            return
        }
        const linked = emulatorService.link(Number(emulator.id), Number(platform.id), defaultBox.checked, core)
        if (!linked || !linked.emulator_id) {
            formError = emulatorService.error || "Não foi possível vincular"
            return
        }
        linkDialog.saved()
        linkDialog.close()
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 12
        ColumnLayout {
            Layout.fillWidth: true
            spacing: 4
            Text { text: "Plataforma"; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; font.weight: Font.Bold }
            ComboBox {
                id: platformBox
                objectName: "linkPlatformField"
                Layout.fillWidth: true
                implicitHeight: 30
                font.pixelSize: Theme.formControlFontSize
                model: linkDialog.platforms
                textRole: "name"
                onActivated: linkDialog.refreshCoreOptions()
                contentItem: Text {
                    text: platformBox.currentIndex >= 0 ? platformBox.displayText : "Selecione"
                    font: platformBox.font
                    color: platformBox.currentIndex >= 0 ? Theme.text : Theme.muted
                    verticalAlignment: Text.AlignVCenter
                }
                indicator: Text { x: platformBox.width - width - 11; y: (platformBox.height - height) / 2; text: "▾"; color: Theme.secondary; font.pixelSize: 13 }
                background: Rectangle { radius: 6; color: platformBox.hovered ? Theme.controlHover : Theme.control; border.color: platformBox.activeFocus ? Theme.accent : Theme.border }
            }
        }
        ColumnLayout {
            visible: linkDialog.isRetroArch
            Layout.fillWidth: true
            spacing: 4
            Text { text: "Core"; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; font.weight: Font.Bold }
            ComboBox {
                id: coreBox
                objectName: "linkCoreField"
                Layout.fillWidth: true
                implicitHeight: 30
                font.pixelSize: Theme.formControlFontSize
                model: linkDialog.coreOptions
                contentItem: Text {
                    text: coreBox.currentIndex >= 0 ? coreBox.displayText : "Selecione um core"
                    font: coreBox.font
                    color: coreBox.currentIndex >= 0 ? Theme.text : Theme.muted
                    verticalAlignment: Text.AlignVCenter
                    elide: Text.ElideRight
                }
                indicator: Text { x: coreBox.width - width - 11; y: (coreBox.height - height) / 2; text: "▾"; color: Theme.secondary; font.pixelSize: 13 }
                background: Rectangle { radius: 6; color: coreBox.hovered ? Theme.controlHover : Theme.control; border.color: coreBox.activeFocus ? Theme.accent : Theme.border }
            }
            Text {
                visible: linkDialog.inventory.executableConfigured === false
                text: "Configure o executável do RetroArch para carregar o inventário de cores."
                color: "#ffb4ab"
                font.pixelSize: 10
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
            Text {
                visible: linkDialog.inventory.executableConfigured === true && linkDialog.inventory.coresDirExists === false
                text: "Pasta cores/ não encontrada ao lado do RetroArch."
                color: "#ffb4ab"
                font.pixelSize: 10
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
        }
        CheckBox {
            id: defaultBox
            objectName: "linkDefaultField"
            text: "Definir como emulador padrão desta plataforma"
            checked: true
            font.pixelSize: Theme.formControlFontSize
            spacing: 8
            leftPadding: 0
            contentItem: Text {
                text: defaultBox.text
                leftPadding: defaultBox.indicator.width + defaultBox.spacing
                verticalAlignment: Text.AlignVCenter
                color: Theme.secondary
                font: defaultBox.font
            }
        }
        Text {
            objectName: "emulatorLinkError"
            visible: linkDialog.formError.length > 0
            text: linkDialog.formError
            color: "#ffb4ab"
            font.pixelSize: 12
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        Item { Layout.fillHeight: true }
        RowLayout {
            Layout.fillWidth: true
            Item { Layout.fillWidth: true }
            ActionButton { objectName: "cancelEmulatorLink"; text: "Cancelar"; onClicked: linkDialog.close() }
            ActionButton { objectName: "saveEmulatorLink"; text: "Vincular"; iconName: "link"; primary: true; onClicked: linkDialog.save() }
        }
    }
}
