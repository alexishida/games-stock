/* Aba Backup: exportaÃ§Ã£o/importaÃ§Ã£o com preview, avisos e jobs em background. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs
import GameStock

Item {
    id: panel
    objectName: "dataPortabilitySettings"
    property var coordinator: null
    property var settingsService: null
    property bool serviceMode: false
    property bool blurEnabled: true

    property var exportCategories: ["metadata", "images", "platforms", "romLocations", "inventoryImages"]
    property var importCategories: []
    property var preview: null
    property string message: ""
    property string error: ""
    property bool busy: false

    readonly property var categories: [
        {key: "metadata", title: "Metadados", description: "Jogos, favoritos, status e dados LaunchBox"},
        {key: "images", title: "Imagens", description: "Capas, fundos e screenshots baixados"},
        {key: "platforms", title: "Plataformas", description: "Plataformas, mapeamentos e emuladores"},
        {key: "romLocations", title: "LocalizaÃ§Ãµes de ROMs", description: "Caminhos de ROM e pastas configuradas"},
        {key: "inventoryImages", title: "InventÃ¡rio (itens e fotos)", description: "Itens fÃ­sicos de hardware e fotos do inventÃ¡rio"}
    ]

    /** Categorias padrÃ£o na mesma ordem do renderer. */
    function allCategories() { return ["metadata", "images", "platforms", "romLocations", "inventoryImages"] }

    /** Verifica presenÃ§a em uma lista JS. */
    function includes(list, key) { return list.indexOf(key) >= 0 }

    /** Liga/desliga categoria preservando a ordem canÃ´nica. */
    function toggle(list, key, checked) {
        const next = list.slice()
        const index = next.indexOf(key)
        if (checked && index < 0) next.push(key)
        if (!checked && index >= 0) next.splice(index, 1)
        const ordered = allCategories().filter(function(entry) { return next.indexOf(entry) >= 0 })
        return ordered
    }

    /** Converte URL do seletor nativo em caminho local. */
    function localPath(url) {
        let value = String(url)
        if (value.indexOf("file:///") === 0) value = value.substring(8)
        return decodeURIComponent(value)
    }

    /** Formata data ISO do manifesto sem deslocamento de fuso. */
    function formatDate(value) {
        if (!value) return ""
        const parts = String(value).substring(0, 10).split("-")
        return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : String(value)
    }

    /** Bloqueia importaÃ§Ã£o sem preview vÃ¡lido, com erros ou sem categoria. */
    readonly property bool importBlocked: !preview || !preview.success || (preview.errors && preview.errors.length > 0)
        || importCategories.length === 0 || busy

    onVisibleChanged: if (visible && panel.settingsService) panel.settingsService.refreshStats()

    Component.onCompleted: if (panel.settingsService) panel.settingsService.refreshStats()

    Flickable {
        anchors.fill: parent
        contentWidth: width
        contentHeight: content.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded; width: 6 }

        ColumnLayout {
            id: content
            width: parent.width
            spacing: 14

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 2
                Text { text: "APLICATIVO"; color: Theme.accent; font.pixelSize: 11; font.weight: Font.ExtraBold; font.letterSpacing: 0.8 }
                Text { text: "Backup da biblioteca"; color: Theme.text; font.pixelSize: 28; font.weight: Font.Bold }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: 10
                readonly property var stats: panel.settingsService
                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: 64
                    radius: 12
                    color: Theme.panel
                    border.color: Theme.border
                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: 12
                        spacing: 10
                        Image { source: "qrc:/icons/library.svg"; sourceSize: Qt.size(18, 18) }
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 2
                            Text { text: "VersÃ£o"; color: Theme.muted; font.pixelSize: 11 }
                            Text { text: panel.settingsService ? ("v" + panel.settingsService.buildLabel) : "â€”"; color: Theme.text; font.pixelSize: 14; font.weight: Font.Bold }
                        }
                    }
                }
                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: 64
                    radius: 12
                    color: Theme.panel
                    border.color: Theme.border
                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: 12
                        spacing: 10
                        Image { source: "qrc:/icons/grid-2x2.svg"; sourceSize: Qt.size(18, 18) }
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 2
                            Text { text: "BIBLIOTECA"; color: Theme.muted; font.pixelSize: 10; font.weight: Font.ExtraBold; font.letterSpacing: 0.6 }
                            Text {
                                text: panel.settingsService && panel.settingsService.totalGames >= 0
                                    ? panel.settingsService.totalGames + " jogos" : "carregando"
                                color: Theme.text
                                font.pixelSize: 14
                                font.weight: Font.Bold
                            }
                        }
                    }
                }
                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: 64
                    radius: 12
                    color: Theme.panel
                    border.color: Theme.border
                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: 12
                        spacing: 10
                        Image { source: "qrc:/icons/save.svg"; sourceSize: Qt.size(18, 18) }
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 2
                            Text { text: "DADOS LOCAIS"; color: Theme.muted; font.pixelSize: 10; font.weight: Font.ExtraBold; font.letterSpacing: 0.6 }
                            Text {
                                text: panel.settingsService && panel.settingsService.dataDirSizeMb >= 0
                                    ? panel.settingsService.dataDirSizeMb + " MB" : "carregando"
                                color: Theme.text
                                font.pixelSize: 14
                                font.weight: Font.Bold
                            }
                        }
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: exportColumn.implicitHeight + 32
                radius: 16
                color: "#dc201f1f"
                border.color: Theme.border
                ColumnLayout {
                    id: exportColumn
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 10
                    Text { text: "Exportar backup"; color: Theme.accent; font.pixelSize: 22; font.weight: Font.Bold }
                    Text { text: "Crie um pacote local com as partes selecionadas da biblioteca."; color: Theme.secondary; font.pixelSize: 12; wrapMode: Text.WordWrap; Layout.fillWidth: true }
                    GridLayout {
                        Layout.fillWidth: true
                        columns: 2
                        columnSpacing: 10
                        rowSpacing: 10
                        Repeater {
                            model: panel.categories
                            delegate: Rectangle {
                                id: exportCard
                                required property var modelData
                                Layout.fillWidth: true
                                implicitHeight: 56
                                radius: 10
                                color: panel.includes(panel.exportCategories, modelData.key) ? Theme.accentSoft : Theme.control
                                border.color: panel.includes(panel.exportCategories, modelData.key) ? Theme.accent : Theme.border
                                RowLayout {
                                    anchors.fill: parent
                                    anchors.margins: 10
                                    spacing: 8
                                    CheckBox {
                                        id: exportCheckbox
                                        checked: panel.includes(panel.exportCategories, modelData.key)
                                        onClicked: panel.exportCategories = panel.toggle(panel.exportCategories, modelData.key, checked)
                                        indicator: Rectangle {
                                            implicitWidth: 16
                                            implicitHeight: 16
                                            radius: 3
                                            color: exportCheckbox.checked ? Theme.accent : Theme.control
                                            border.color: Theme.borderStrong
                                            Text { anchors.centerIn: parent; text: "âœ“"; color: Theme.accentForeground; font.pixelSize: 12; font.bold: true; visible: exportCheckbox.checked }
                                        }
                                    }
                                    ColumnLayout {
                                        Layout.fillWidth: true
                                        spacing: 1
                                        Text { text: exportCard.modelData.title; color: Theme.accent; font.pixelSize: 12; font.weight: Font.Bold; elide: Text.ElideRight; Layout.fillWidth: true }
                                        Text { text: exportCard.modelData.description; color: Theme.muted; font.pixelSize: 10; elide: Text.ElideRight; Layout.fillWidth: true }
                                    }
                                }
                            }
                        }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        Item { Layout.fillWidth: true }
                        ActionButton {
                            objectName: "exportBackup"
                            text: panel.busy ? "Exportando..." : "Exportar"
                            iconName: "download"
                            accentOutline: true
                            enabled: panel.coordinator !== null && panel.exportCategories.length > 0 && !panel.busy
                            onClicked: {
                                if (panel.exportCategories.length === 0) {
                                    panel.error = "Selecione ao menos uma categoria para exportar."
                                    return
                                }
                                saveDialog.open()
                            }
                        }
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: importColumn.implicitHeight + 32
                radius: 16
                color: "#dc201f1f"
                border.color: Theme.border
                ColumnLayout {
                    id: importColumn
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 10
                    Text { text: "Importar backup"; color: Theme.accent; font.pixelSize: 22; font.weight: Font.Bold }
                    Text { text: "PrÃ©-visualize um pacote e restaure somente as categorias escolhidas."; color: Theme.secondary; font.pixelSize: 12; wrapMode: Text.WordWrap; Layout.fillWidth: true }
                    ActionButton {
                        objectName: "selectBackupPackage"
                        text: panel.busy ? "Lendo..." : "Selecionar pacote"
                        iconName: "upload"
                        enabled: panel.coordinator !== null && !panel.busy
                        onClicked: packageDialog.open()
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 8
                        visible: panel.preview !== null
                        RowLayout {
                            Layout.fillWidth: true
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 2
                                Text { text: "Pacote selecionado"; color: Theme.text; font.pixelSize: 13; font.weight: Font.Bold }
                                Text { text: panel.preview ? panel.preview.packagePath : ""; color: Theme.muted; font.pixelSize: 11; elide: Text.ElideMiddle; Layout.fillWidth: true }
                            }
                            Text { text: panel.preview ? panel.formatDate(panel.preview.manifest.createdAt) : ""; color: Theme.muted; font.pixelSize: 11 }
                        }
                        Flow {
                            Layout.fillWidth: true
                            spacing: 8
                            Repeater {
                                model: panel.preview ? [
                                    (panel.preview.counts.games || 0) + " jogos",
                                    (panel.preview.counts.platforms || 0) + " plataformas",
                                    (panel.preview.counts.images || 0) + " imagens",
                                    (panel.preview.counts.romLocations || 0) + " ROMs",
                                    (panel.preview.counts.inventoryItems || 0) + " itens de inventÃ¡rio"
                                ] : []
                                delegate: Text {
                                    required property var modelData
                                    text: modelData
                                    color: Theme.secondary
                                    font.pixelSize: 11
                                }
                            }
                        }
                        GridLayout {
                            Layout.fillWidth: true
                            columns: 2
                            columnSpacing: 10
                            rowSpacing: 10
                            Repeater {
                                model: panel.categories
                                delegate: Rectangle {
                                    id: importCard
                                    required property var modelData
                                    readonly property bool available: panel.preview && panel.preview.availableCategories
                                        && panel.preview.availableCategories.indexOf(modelData.key) >= 0
                                    Layout.fillWidth: true
                                    implicitHeight: 50
                                    opacity: available ? 1 : 0.4
                                    radius: 10
                                    color: available && panel.includes(panel.importCategories, modelData.key) ? Theme.accentSoft : Theme.control
                                    border.color: available && panel.includes(panel.importCategories, modelData.key) ? Theme.accent : Theme.border
                                    RowLayout {
                                        anchors.fill: parent
                                        anchors.margins: 10
                                        spacing: 8
                                        CheckBox {
                                            id: importCheckbox
                                            enabled: importCard.available
                                            checked: importCard.available && panel.includes(panel.importCategories, importCard.modelData.key)
                                            onClicked: panel.importCategories = panel.toggle(panel.importCategories, importCard.modelData.key, checked)
                                            indicator: Rectangle {
                                                implicitWidth: 16
                                                implicitHeight: 16
                                                radius: 3
                                                color: importCheckbox.checked ? Theme.accent : Theme.control
                                                border.color: Theme.borderStrong
                                                Text { anchors.centerIn: parent; text: "âœ“"; color: Theme.accentForeground; font.pixelSize: 12; font.bold: true; visible: importCheckbox.checked }
                                            }
                                        }
                                        Text { text: importCard.modelData.title; color: Theme.accent; font.pixelSize: 11; font.weight: Font.Bold; elide: Text.ElideRight; Layout.fillWidth: true }
                                    }
                                }
                            }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 3
                            visible: panel.preview && panel.preview.errors && panel.preview.errors.length > 0
                            Text { text: "Erros"; color: "#ffb4ab"; font.pixelSize: 11; font.weight: Font.Bold }
                            Repeater {
                                model: panel.preview && panel.preview.errors ? panel.preview.errors.slice(0, 8) : []
                                delegate: Text { required property var modelData; text: "â€¢ " + modelData.message; color: "#ffb4ab"; font.pixelSize: 11; wrapMode: Text.WordWrap; Layout.fillWidth: true }
                            }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 3
                            visible: panel.preview && panel.preview.warnings && panel.preview.warnings.length > 0
                            Text { text: "Avisos"; color: "#fbbf24"; font.pixelSize: 11; font.weight: Font.Bold }
                            Repeater {
                                model: panel.preview && panel.preview.warnings ? panel.preview.warnings.slice(0, 8) : []
                                delegate: Text { required property var modelData; text: "â€¢ " + modelData.message; color: Theme.secondary; font.pixelSize: 11; wrapMode: Text.WordWrap; Layout.fillWidth: true }
                            }
                        }
                        Text {
                            visible: panel.preview && panel.importCategories.length === 0
                            text: "Selecione ao menos uma categoria para importar."
                            color: "#ffb4ab"
                            font.pixelSize: 11
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            ActionButton {
                                objectName: "importBackup"
                                text: panel.busy ? "Importando..." : "Importar selecionados"
                                iconName: "save"
                                primary: true
                                enabled: !panel.importBlocked && panel.coordinator !== null
                                onClicked: panel.startImport()
                            }
                            Item { Layout.fillWidth: true }
                        }
                    }
                }
            }

            Text {
                objectName: "backupMessage"
                visible: panel.message.length > 0
                text: panel.message
                color: Theme.accent
                font.pixelSize: 12
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
            Text {
                objectName: "backupError"
                visible: panel.error.length > 0
                text: panel.error
                color: "#ffb4ab"
                font.pixelSize: 12
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
        }
    }

    /** Envia a importaÃ§Ã£o validada ao coordenador de jobs. */
    function startImport() {
        if (!panel.preview || panel.importCategories.length === 0 || !panel.coordinator) return
        panel.busy = true
        panel.error = ""
        panel.message = ""
        const started = panel.coordinator.startImport({
            packagePath: panel.preview.packagePath,
            categories: panel.importCategories
        })
        panel.busy = false
        if (started) panel.message = "ImportaÃ§Ã£o iniciada em background."
        else panel.error = panel.coordinator.error || "NÃ£o foi possÃ­vel iniciar a importaÃ§Ã£o."
    }

    FileDialog {
        id: saveDialog
        title: "Salvar backup"
        fileMode: FileDialog.SaveFile
        nameFilters: ["Backup GameStock (*.gamestock-backup)"]
        onAccepted: {
            if (!panel.coordinator) return
            panel.busy = true
            panel.error = ""
            panel.message = ""
            const started = panel.coordinator.startExport({
                categories: panel.exportCategories,
                targetPath: panel.localPath(selectedFile),
                romFolderEntries: []
            })
            panel.busy = false
            if (started) panel.message = "ExportaÃ§Ã£o iniciada em background."
            else panel.error = panel.coordinator.error || "NÃ£o foi possÃ­vel iniciar a exportaÃ§Ã£o."
        }
    }

    FileDialog {
        id: packageDialog
        title: "Selecionar pacote de backup"
        nameFilters: ["Backup GameStock (*.gamestock-backup)", "Todos os arquivos (*)"]
        onAccepted: {
            if (!panel.coordinator) return
            panel.busy = true
            panel.error = ""
            panel.message = ""
            panel.preview = panel.coordinator.preview(panel.localPath(selectedFile))
            panel.importCategories = panel.preview && panel.preview.success
                ? panel.preview.availableCategories.slice() : []
            panel.busy = false
            if (!panel.preview || !panel.preview.success) {
                panel.error = panel.preview ? (panel.preview.error || "Pacote invÃ¡lido.") : "Pacote invÃ¡lido."
                panel.preview = null
            }
        }
    }
}

