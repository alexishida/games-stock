/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Seletores usam FormSelect para manter padding, altura e menu iguais ao Electron. */
/* Cores do RetroArch por plataforma, salvando o lote em uma transação. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

DragDialog {
    id: cores
    cornerRadius: 12
    panelBorder: Theme.borderStrong
    secondaryScrim: Theme.scrim
    objectName: "retroArchCoresDialog"
    property var emulatorService: null
    property var emulator: null
    property var platforms: []
    property var inventory: ({})
    property var linksByPlatform: ({})
    property var coreDrafts: ({})
    property var edited: ({})
    property string search: ""
    property string formError: ""

    width: Math.min(760, parent.width - 56)
    height: Math.min(620, parent.height - 56)
    heading: "Cores do RetroArch"
    /* Cabeçalho compartilhado conserva título e acesso ao fechamento. */
    showHeading: false
    padding: 18
    onOpened: load()

    function load() {
        formError = ""
        edited = ({})
        coreDrafts = ({})
        inventory = emulatorService ? emulatorService.listRetroArchCores(Number(emulator ? emulator.id : 0)) : ({})
        const ids = []
        for (let index = 0; index < platforms.length; index++) ids.push(Number(platforms[index].id))
        linksByPlatform = emulatorService ? emulatorService.listByPlatforms(ids) : ({})
        const drafts = ({})
        for (let index = 0; index < platforms.length; index++) {
            const platform = platforms[index]
            const existing = existingLink(platform)
            const candidates = emulatorService ? emulatorService.retroArchCoreCandidates(platform.name || "") : []
            drafts[String(platform.id)] = existing && existing.core_path ? existing.core_path : (candidates.length ? candidates[0] : "")
        }
        coreDrafts = drafts
    }

    function existingLink(platform) {
        const entries = linksByPlatform[String(platform.id)] || []
        for (let index = 0; index < entries.length; index++) {
            if (Number(entries[index].emulator_id) === Number(emulator ? emulator.id : 0)) return entries[index]
        }
        return null
    }

    function optionsFor(platform) {
        const options = []
        const candidates = emulatorService ? emulatorService.retroArchCoreCandidates(platform.name || "") : []
        for (let index = 0; index < candidates.length; index++) options.push(candidates[index])
        const installed = inventory.installedCores || []
        const compatible = emulatorService ? emulatorService.compatibleRetroArchCores(platform.name || "", installed) : []
        for (let index = 0; index < compatible.length; index++) {
            if (options.indexOf(compatible[index]) < 0) options.push(compatible[index])
        }
        const draft = coreDrafts[String(platform.id)] || ""
        if (draft && options.indexOf(draft) < 0) options.unshift(draft)
        return options
    }

    function currentIndexFor(platform) {
        const options = optionsFor(platform)
        return Math.max(0, options.indexOf(coreDrafts[String(platform.id)] || ""))
    }

    function setDraft(platform, value) {
        const drafts = Object.assign({}, coreDrafts)
        drafts[String(platform.id)] = value
        coreDrafts = drafts
        const changed = Object.assign({}, edited)
        changed[String(platform.id)] = true
        edited = changed
    }

    function filteredPlatforms() {
        const query = search.trim().toLowerCase()
        if (!query.length) return platforms
        const matches = []
        for (let index = 0; index < platforms.length; index++) {
            const platform = platforms[index]
            const core = coreDrafts[String(platform.id)] || ""
            if (String(platform.name || "").toLowerCase().indexOf(query) >= 0 || core.toLowerCase().indexOf(query) >= 0) {
                matches.push(platform)
            }
        }
        return matches
    }

    function save() {
        formError = ""
        const ids = Object.keys(edited)
        if (!ids.length) {
            formError = "Nenhuma alteração para salvar"
            return
        }
        const changes = []
        for (let index = 0; index < ids.length; index++) {
            const platformId = Number(ids[index])
            const value = (coreDrafts[ids[index]] || "").trim()
            if (!value.length) {
                formError = "Selecione um core para todas as plataformas alteradas"
                return
            }
            let platform = null
            for (let position = 0; position < platforms.length; position++) {
                if (Number(platforms[position].id) === platformId) platform = platforms[position]
            }
            const existing = platform ? existingLink(platform) : null
            changes.push({platformId: platformId, emulatorId: Number(emulator ? emulator.id : 0),
                isDefault: existing ? !!existing.isDefault : false, corePath: value})
        }
        if (!emulatorService.savePlatformLinks(changes)) {
            formError = emulatorService.error || "Não foi possível salvar os cores"
            return
        }
        cores.close()
    }

    /* O seletor ocupa uma linha completa sob os dados da plataforma, como no renderer. */
    ColumnLayout {
        anchors.fill: parent
        spacing: 14
        RowLayout {
            Layout.fillWidth: true
            ColumnLayout {
                Layout.fillWidth: true
                spacing: 8
                UiText { text: cores.heading; color: Theme.text; font.pixelSize: 22; textWeight: Font.Black; lineHeightMode: Text.FixedHeight; lineHeight: 22 }
                UiText { text: "Escolha cores recomendados ou DLLs instaladas e salve tudo de uma vez."; color: Theme.secondary; font.pixelSize: 12; Layout.fillWidth: true; wrapMode: Text.WordWrap }
            }
            ActionButton { iconName: "x-danger"; Accessible.name: "Fechar"; onClicked: cores.close() }
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: 12
            ColumnLayout {
                Layout.fillWidth: true
                Layout.maximumWidth: 360
                spacing: 8
                UiText { text: "BUSCAR"; color: Theme.secondary; font.pixelSize: 11; textWeight: Font.ExtraBold; font.letterSpacing: 0.55 }
                FormField { Layout.fillWidth: true; placeholderText: "Plataforma ou core"; onTextChanged: cores.search = text }
            }
            Item { Layout.fillWidth: true }
            ActionButton { objectName: "refreshCores"; Layout.alignment: Qt.AlignBottom; text: "Atualizar cores"; iconName: "refresh-cw"; implicitHeight: 34; onClicked: cores.load() }
        }
        PanelFlickable {
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentWidth: width
            contentHeight: coreList.implicitHeight
            boundsBehavior: Flickable.StopAtBounds
            ScrollBar.vertical: CollectionScrollBar { }
            ColumnLayout {
                id: coreList
                width: parent.width - 2
                x: 1
                spacing: 0
                Repeater {
                    model: cores.filteredPlatforms()
                    delegate: Rectangle {
                        id: coreRow
                        required property var modelData
                        readonly property string draft: cores.coreDrafts[String(modelData.id)] || ""
                        Layout.fillWidth: true
                        implicitHeight: rowBody.implicitHeight + 24
                        color: "#04ffffff"
                        Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.border }
                        ColumnLayout {
                            id: rowBody
                            anchors.fill: parent
                            anchors.margins: 12
                            spacing: 10
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 2
                                UiText { text: coreRow.modelData.name || ""; color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold; Layout.fillWidth: true; elide: Text.ElideRight }
                                UiText { text: "Defina o core usado pelo RetroArch nesta plataforma."; color: Theme.secondary; font.pixelSize: 11 }
                                UiText {
                                    visible: coreRow.draft.length > 0 && (cores.inventory.installedCores || []).indexOf(coreRow.draft) < 0
                                    text: "Core recomendado " + coreRow.draft + ", não instalado. Baixe no RetroArch."
                                    color: "#ff7b7b"; font.pixelSize: 10; Layout.fillWidth: true; wrapMode: Text.WordWrap
                                }
                            }
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 6
                                RowLayout {
                                    Layout.fillWidth: true
                                    UiText { text: "CORE"; color: Theme.secondary; font.pixelSize: 11; textWeight: Font.ExtraBold; Layout.fillWidth: true }
                                    UiText { visible: coreRow.draft.length > 0; text: "Sugestão: " + coreRow.draft; color: Theme.secondary; font.pixelSize: 11; textWeight: Font.Bold }
                                }
                                FormSelect {
                                    id: corePicker
                                    Layout.fillWidth: true
                                    implicitHeight: 36
                                    font.weight: Font.Bold
                                    model: cores.optionsFor(coreRow.modelData)
                                    currentIndex: cores.currentIndexFor(coreRow.modelData)
                                    onActivated: cores.setDraft(coreRow.modelData, model[currentIndex])
                                    contentItem: UiText { text: corePicker.displayText.length ? corePicker.displayText + (corePicker.displayText.endsWith(".dll") ? "" : ".dll") : "Selecione um core"; font: corePicker.font; color: Theme.text; verticalAlignment: Text.AlignVCenter; elide: Text.ElideRight }
                                }
                            }
                        }
                    }
                }
            }
        }
        RowLayout {
            Layout.fillWidth: true
            spacing: 10
            UiText {
                objectName: "retroArchCoresError"
                Layout.fillWidth: true
                text: cores.formError.length ? cores.formError : cores.inventory.executableConfigured === false ? "Configure o executável do RetroArch antes de selecionar cores." : cores.inventory.coresDirExists === false ? "Pasta cores/ não encontrada ao lado do RetroArch." : ""
                color: "#ff7b7b"; font.pixelSize: 11; textWeight: Font.Bold; wrapMode: Text.WordWrap
            }
            ActionButton { objectName: "cancelCores"; text: "Fechar"; iconName: "x-danger"; dangerOutline: true; formAction: true; onClicked: cores.close() }
            ActionButton { objectName: "saveCores"; text: "Salvar"; iconName: "save"; accentOutline: true; formAction: true; onClicked: cores.save() }
        }
    }
}
