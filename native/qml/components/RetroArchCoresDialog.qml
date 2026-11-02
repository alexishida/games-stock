/* Cores do RetroArch por plataforma, salvando o lote em uma transação. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

DragDialog {
    id: cores
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

    width: Math.min(820, parent.width - 48)
    height: Math.min(700, parent.height - 48)
    heading: "Cores do RetroArch"
    onOpened: load()

    function load() {
        formError = ""
        edited = ({})
        coreDrafts = ({})
        inventory = emulatorService ? emulatorService.listRetroArchCores(Number(emulator.id)) : ({})
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
            if (Number(entries[index].emulator_id) === Number(emulator.id)) return entries[index]
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
            changes.push({platformId: platformId, emulatorId: Number(emulator.id),
                isDefault: existing ? !!existing.isDefault : false, corePath: value})
        }
        if (!emulatorService.savePlatformLinks(changes)) {
            formError = emulatorService.error || "Não foi possível salvar os cores"
            return
        }
        cores.close()
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 12
        Text { text: "Escolha cores recomendados ou instalados e salve tudo de uma vez."; color: Theme.secondary; font.pixelSize: 12; wrapMode: Text.WordWrap; Layout.fillWidth: true }
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            FormField {
                Layout.fillWidth: true
                placeholderText: "Buscar plataforma ou core"
                onTextChanged: cores.search = text
            }
            ActionButton { objectName: "refreshCores"; text: "Atualizar cores"; iconName: "refresh-cw"; onClicked: cores.load() }
        }
        Text {
            visible: cores.inventory.executableConfigured === false
            text: "Configure o executável do RetroArch antes de selecionar cores."
            color: "#ffb4ab"
            font.pixelSize: 11
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        Text {
            visible: cores.inventory.executableConfigured === true && cores.inventory.coresDirExists === false
            text: "Pasta cores/ não encontrada ao lado do RetroArch."
            color: "#ffb4ab"
            font.pixelSize: 11
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        Flickable {
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentWidth: width
            contentHeight: coreList.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            ColumnLayout {
                id: coreList
                width: parent.width
                spacing: 6
                Repeater {
                    model: cores.filteredPlatforms()
                    delegate: Rectangle {
                        required property var modelData
                        Layout.fillWidth: true
                        implicitHeight: 62
                        radius: 10
                        color: Theme.card
                        border.color: cores.edited[String(modelData.id)] ? Theme.accent : Theme.border
                        RowLayout {
                            anchors.fill: parent
                            anchors.margins: 10
                            spacing: 10
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 1
                                Text { text: modelData.name || ""; color: Theme.text; font.pixelSize: 13; font.weight: Font.Bold; elide: Text.ElideRight; Layout.fillWidth: true }
                                Text {
                                    text: {
                                        const existing = cores.existingLink(modelData)
                                        return existing && existing.core_path ? "Core salvo: " + existing.core_path : "Sem core salvo"
                                    }
                                    color: Theme.muted
                                    font.pixelSize: 10
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                }
                            }
                            ComboBox {
                                id: corePicker
                                Layout.preferredWidth: 300
                                implicitHeight: 30
                                font.pixelSize: Theme.formControlFontSize
                                model: cores.optionsFor(modelData)
                                currentIndex: cores.currentIndexFor(modelData)
                                onActivated: cores.setDraft(modelData, corePicker.model[currentIndex])
                                contentItem: Text {
                                    text: corePicker.currentIndex >= 0 ? corePicker.displayText : "Selecione um core"
                                    font: corePicker.font
                                    color: Theme.text
                                    verticalAlignment: Text.AlignVCenter
                                    elide: Text.ElideRight
                                }
                                indicator: Text { x: corePicker.width - width - 10; y: (corePicker.height - height) / 2; text: "▾"; color: Theme.secondary; font.pixelSize: 12 }
                                background: Rectangle { radius: 6; color: Theme.control; border.color: Theme.border }
                            }
                        }
                    }
                }
            }
        }
        Text {
            objectName: "retroArchCoresError"
            visible: cores.formError.length > 0
            text: cores.formError
            color: "#ffb4ab"
            font.pixelSize: 12
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        RowLayout {
            Layout.fillWidth: true
            Item { Layout.fillWidth: true }
            ActionButton { objectName: "cancelCores"; text: "Fechar"; onClicked: cores.close() }
            ActionButton { objectName: "saveCores"; text: "Salvar"; iconName: "save"; primary: true; onClicked: cores.save() }
        }
    }
}
