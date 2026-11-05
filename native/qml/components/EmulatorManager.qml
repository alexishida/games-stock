/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Hierarquia das introducoes segue SectionIntro.css do Electron. */
/* Gerenciador de emuladores, vínculos por plataforma e cores do RetroArch. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

Item {
    id: manager
    objectName: "emulatorManager"
    property var emulatorService: null
    property var platformService: null
    property bool serviceMode: false
    property bool blurEnabled: true
    property var formEmulator: null
    property var linkEmulator: null
    property string formError: ""
    property var expanded: ({})
    property var links: ({})
    property alias formDialog: emulatorForm
    property alias linkDialog: emulatorLink
    property alias coresDialog: retroCores

    signal deleteRequested(var emulator)
    signal backdropRequested(bool active)

    readonly property var orderedEmulators: {
        const all = emulatorService ? emulatorService.items : []
        const result = []
        let retro = null
        const others = []
        for (let index = 0; index < all.length; index++) {
            if (Number(all[index].is_retroarch) === 1) retro = all[index]
            else others.push(all[index])
        }
        others.sort(function(left, right) {
            return String(left.name).localeCompare(String(right.name), "pt-BR", {sensitivity: "base"})
        })
        if (retro) result.push(retro)
        for (let index = 0; index < others.length; index++) result.push(others[index])
        return result
    }

    function platformName(id) {
        const platforms = platformService ? platformService.items : []
        for (let index = 0; index < platforms.length; index++) {
            if (Number(platforms[index].id) === Number(id)) return platforms[index].name
        }
        return "#" + id
    }

    function associations(emulatorId) {
        return links[String(emulatorId)] || []
    }

    function loadLinks(emulatorId) {
        if (!emulatorService || !platformService) return
        const platforms = platformService.items
        const ids = []
        for (let index = 0; index < platforms.length; index++) ids.push(Number(platforms[index].id))
        const grouped = emulatorService.listByPlatforms(ids)
        const found = []
        const keys = Object.keys(grouped)
        for (let index = 0; index < keys.length; index++) {
            const entries = grouped[keys[index]]
            for (let entry = 0; entry < entries.length; entry++) {
                const link = entries[entry]
                if (Number(link.emulator_id) !== Number(emulatorId)) continue
                found.push({emulatorId: Number(emulatorId), platformId: Number(link.platform_id), platformName: platformName(link.platform_id),
                    corePath: link.core_path || "", isDefault: !!link.isDefault})
            }
        }
        found.sort(function(left, right) { return left.platformName.localeCompare(right.platformName, "pt-BR") })
        const next = Object.assign({}, links)
        next[String(emulatorId)] = found
        links = next
    }

    function toggle(emulator) {
        const id = String(emulator.id)
        const next = Object.assign({}, expanded)
        if (next[id]) {
            next[id] = false
            expanded = next
            return
        }
        next[id] = true
        expanded = next
        loadLinks(emulator.id)
    }

    function openCreate() {
        formEmulator = null
        emulatorForm.open()
    }

    function openEdit(emulator) {
        formEmulator = emulator
        emulatorForm.open()
    }

    function openLink(emulator) {
        linkEmulator = emulator
        emulatorLink.open()
    }

    function openCores(emulator) {
        linkEmulator = emulator
        retroCores.open()
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 12
        RowLayout {
            Layout.fillWidth: true
            SectionIntro {
                Layout.fillWidth: true
                title: "Emuladores"
                description: "Configure emuladores e vincule-os às plataformas para lançar jogos diretamente da biblioteca."
                /* Mantém a margem do parágrafo de SectionIntro.css. */
                bottomGap: 12
            }
        }
        UiText {
            objectName: "emulatorManagerError"
            visible: manager.serviceMode && manager.emulatorService && manager.emulatorService.error.length > 0
            text: manager.emulatorService ? manager.emulatorService.error : ""
            color: "#ffb4ab"
            font.pixelSize: 13
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        PanelFlickable {
            Layout.fillWidth: true
            Layout.preferredHeight: Math.min(list.implicitHeight, manager.height - 110)
            contentWidth: width
            contentHeight: list.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            ColumnLayout {
                id: list
                /* Reserva o trilho interno do overflow:auto como na lista original. */
                width: parent.width - 2 - (parent.contentHeight > parent.height ? 6 : 0)
                x: 1
                spacing: 0
                UiText { visible: manager.orderedEmulators.length === 0; text: "Nenhum emulador cadastrado."; color: Theme.secondary; font.pixelSize: 13 }
                Repeater {
                    model: manager.orderedEmulators
                    delegate: ColumnLayout {
                        required property var modelData
                        Layout.fillWidth: true
                        spacing: 0
                        Rectangle {
                            Layout.fillWidth: true
                            /* Mais altura acompanha os textos ampliados sem comprimir as linhas. */
                            implicitHeight: 64
                            radius: 0
                            color: "transparent"
                            Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.border }
                            RowLayout {
                                anchors.fill: parent
                                anchors.margins: 10
                                /* Padding de 12 px e gap de 4 px das ações de platform-row. */
                                anchors.leftMargin: 12
                                anchors.rightMargin: 12
                                spacing: 4
                                ColumnLayout {
                                    Layout.fillWidth: true
                                    spacing: 2
                                    UiText { text: modelData.name || ""; color: Theme.text; font.pixelSize: 15; textWeight: Font.Bold; elide: Text.ElideRight; Layout.fillWidth: true }
                                    UiText {
                                        text: modelData.executable && String(modelData.executable).length
                                            ? modelData.executable : "Executável não configurado"
                                        color: Theme.secondary
                                        font.pixelSize: 13
                                        font.italic: true
                                        elide: Text.ElideRight
                                        Layout.fillWidth: true
                                    }
                                }
                                /* O Electron usa o elo diagonal nesta ação. */
                                ActionButton { objectName: "emulatorAssociations"; iconName: "link"; enabled: manager.serviceMode; Accessible.name: "Plataformas vinculadas"; onClicked: manager.toggle(modelData) }
                                ActionButton { objectName: "editEmulator"; iconName: "pencil"; enabled: manager.serviceMode; Accessible.name: "Editar"; onClicked: manager.openEdit(modelData) }
                                ActionButton { objectName: "emulatorCores"; text: "Cores"; iconName: "sliders-horizontal"; implicitHeight: 26; accentOutline: true; visible: Number(modelData.is_retroarch) === 1; enabled: manager.serviceMode; onClicked: manager.openCores(modelData) }
                                ActionButton { objectName: "deleteEmulator"; iconName: "trash-2-danger"; dangerOutline: true; visible: Number(modelData.is_retroarch) !== 1; enabled: manager.serviceMode; Accessible.name: "Remover"; onClicked: manager.deleteRequested(modelData) }
                            }
                        }
                        Rectangle {
                            Layout.fillWidth: true
                            visible: !!manager.expanded[String(modelData.id)]
                            implicitHeight: visible ? associationContent.implicitHeight + 20 : 0
                            radius: 8
                            color: Theme.panel
                            border.color: Theme.border
                            ColumnLayout {
                                id: associationContent
                                anchors.fill: parent
                                anchors.margins: 10
                                spacing: 6
                                UiText { visible: manager.associations(modelData.id).length === 0; text: "Nenhuma plataforma vinculada."; color: Theme.muted; font.pixelSize: 13 }
                                Repeater {
                                    model: manager.associations(modelData.id)
                                    delegate: RowLayout {
                                        required property var modelData
                                        Layout.fillWidth: true
                                        spacing: 8
                                        UiText { text: modelData.platformName; color: Theme.secondary; font.pixelSize: 13; Layout.fillWidth: true; elide: Text.ElideRight }
                                        UiText { text: modelData.corePath || "-"; color: Theme.muted; font.pixelSize: 12; Layout.preferredWidth: 260; elide: Text.ElideRight; horizontalAlignment: Text.AlignRight }
                                        UiText { text: modelData.isDefault ? "padrão" : ""; color: Theme.accentMuted; font.pixelSize: 12; Layout.preferredWidth: 44; horizontalAlignment: Text.AlignRight }
                                        ActionButton {
                                            objectName: "unlinkEmulator"
                                            iconName: "unlink"
                                            toolbar: true
                                            Accessible.name: "Desvincular"
                                            onClicked: {
                                                if (manager.emulatorService.unlink(Number(modelData.emulatorId), Number(modelData.platformId))) {
                                                    manager.loadLinks(Number(modelData.emulatorId))
                                                }
                                            }
                                        }
                                    }
                                }
                                ActionButton { objectName: "linkEmulator"; text: "Vincular plataforma"; iconName: "plus"; onClicked: manager.openLink(modelData) }
                            }
                        }
                    }
                }
            }
        }
        RowLayout {
            Layout.fillWidth: true
            Item { Layout.fillWidth: true }
            ActionButton { objectName: "newEmulator"; text: "Novo emulador"; iconName: "plus"; accentOutline: true; enabled: manager.serviceMode; onClicked: manager.openCreate() }
        }
        Item { Layout.fillHeight: true }
    }

    EmulatorFormDialog {
        id: emulatorForm
        emulatorService: manager.emulatorService
        editingEmulator: manager.formEmulator
        backdropBlurEnabled: manager.blurEnabled
        onBackdropBlurRequested: function(active) { manager.backdropRequested(active) }
        onClosed: manager.formEmulator = null
        onSaved: function(emulatorId) {
            if (manager.emulatorService) manager.emulatorService.refresh()
        }
    }
    EmulatorLinkDialog {
        id: emulatorLink
        emulatorService: manager.emulatorService
        emulator: manager.linkEmulator
        platforms: manager.platformService ? manager.platformService.items : []
        backdropBlurEnabled: manager.blurEnabled
        onBackdropBlurRequested: function(active) { manager.backdropRequested(active) }
        onClosed: manager.linkEmulator = null
        onSaved: function() {
            const id = manager.linkEmulator ? manager.linkEmulator.id : 0
            if (id) manager.loadLinks(Number(id))
        }
    }
    RetroArchCoresDialog {
        id: retroCores
        emulatorService: manager.emulatorService
        emulator: manager.linkEmulator
        platforms: manager.platformService ? manager.platformService.items : []
        backdropBlurEnabled: manager.blurEnabled
        onBackdropBlurRequested: function(active) { manager.backdropRequested(active) }
        onClosed: manager.linkEmulator = null
    }
}
