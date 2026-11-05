/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Gaps do management-form preservam as medidas originais do Electron. */
/* Seletores usam FormSelect para manter padding, altura e menu iguais ao Electron. */
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

    padding: 16
    width: Math.min(460, parent.width - 48)
    /* O modal acompanha os campos visiveis e nao cria uma faixa vazia acima do footer. */
    height: Math.min(parent.height - 48, linkBody.implicitHeight + topPadding + bottomPadding)
    heading: "Vincular a plataforma"
    /* Mantém o título e o fechamento visíveis no modal empilhado. */
    showHeading: true
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
        id: linkBody
        anchors.fill: parent
        spacing: Theme.formGroupGap
        ColumnLayout {
            Layout.fillWidth: true
            spacing: Theme.formLabelGap
            UiText { text: "PLATAFORMA"; color: Theme.secondary; font.pixelSize: Theme.formLabelFontSize; textWeight: Font.ExtraBold; font.capitalization: Font.AllUppercase; font.letterSpacing: 0.55 }
            FormSelect {
                font.family: Theme.heavyFontFamily; font.weight: Theme.cssFontWeight(Font.ExtraBold)
                id: platformBox
                objectName: "linkPlatformField"
                Layout.fillWidth: true
                font.pixelSize: Theme.formControlFontSize
                model: linkDialog.platforms
                textRole: "name"
                onActivated: linkDialog.refreshCoreOptions()
                contentItem: UiText {
                    text: platformBox.currentIndex >= 0 ? platformBox.displayText : "Selecione"
                    font: platformBox.font
                    color: platformBox.currentIndex >= 0 ? Theme.text : Theme.muted
                    verticalAlignment: Text.AlignVCenter
                    elide: Text.ElideRight
                }
            }
        }
        ColumnLayout {
            visible: linkDialog.isRetroArch
            Layout.fillWidth: true
            spacing: Theme.formLabelGap
            UiText { text: "CORE"; color: Theme.secondary; font.pixelSize: Theme.formLabelFontSize; textWeight: Font.ExtraBold; font.capitalization: Font.AllUppercase; font.letterSpacing: 0.55 }
            FormSelect {
                font.family: Theme.heavyFontFamily; font.weight: Theme.cssFontWeight(Font.ExtraBold)
                id: coreBox
                objectName: "linkCoreField"
                Layout.fillWidth: true
                font.pixelSize: Theme.formControlFontSize
                model: linkDialog.coreOptions
                contentItem: UiText {
                    text: coreBox.currentIndex >= 0 ? coreBox.displayText : "Selecione um core"
                    font: coreBox.font
                    color: coreBox.currentIndex >= 0 ? Theme.text : Theme.muted
                    verticalAlignment: Text.AlignVCenter
                    elide: Text.ElideRight
                }
            }
            UiText {
                visible: linkDialog.inventory.executableConfigured === false
                text: "Configure o executável do RetroArch para carregar o inventário de cores."
                color: "#ffb4ab"
                font.pixelSize: 12
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
            UiText {
                visible: linkDialog.inventory.executableConfigured === true && linkDialog.inventory.coresDirExists === false
                text: "Pasta cores/ não encontrada ao lado do RetroArch."
                color: "#ffb4ab"
                font.pixelSize: 12
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
        }
        FormCheckBox {
            id: defaultBox
            objectName: "linkDefaultField"
            text: "Definir como emulador padrão desta plataforma"
            checked: true
            font.pixelSize: Theme.formControlFontSize
            spacing: 8
            leftPadding: 0
            contentItem: UiText {
                text: defaultBox.text
                leftPadding: defaultBox.indicator.width + defaultBox.spacing
                verticalAlignment: Text.AlignVCenter
                color: Theme.secondary
                font: defaultBox.font
            }
        }
        UiText {
            objectName: "emulatorLinkError"
            visible: linkDialog.formError.length > 0
            text: linkDialog.formError
            color: "#ffb4ab"
            font.pixelSize: 13
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: Theme.formActionGap
            Layout.topMargin: 4
            Item { Layout.fillWidth: true }
            ActionButton { objectName: "cancelEmulatorLink"; text: "Cancelar"; formAction: true; iconName: "x-danger"; dangerOutline: true; onClicked: linkDialog.close() }
            ActionButton { objectName: "saveEmulatorLink"; text: "Vincular"; iconName: "link"; accentOutline: true; onClicked: linkDialog.save() }
        }
    }
}
