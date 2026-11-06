/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Textos UTF-8 e altura dos cards seguem a referencia de backup. */
/* Hierarquia das introducoes segue SectionIntro.css do Electron. */
/* Aba Backup: exportação/importação com preview, avisos e jobs em background. */
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
        {key: "romLocations", title: "Localizações de ROMs", description: "Caminhos de ROM e pastas configuradas"},
        {key: "inventoryImages", title: "Inventário (itens e fotos)", description: "Itens físicos de hardware e fotos do inventário"}
    ]

    /** Categorias padrão na mesma ordem do renderer. */
    function allCategories() { return ["metadata", "images", "platforms", "romLocations", "inventoryImages"] }

    /** Verifica presença em uma lista JS. */
    function includes(list, key) { return list.indexOf(key) >= 0 }

    /** Liga/desliga categoria preservando a ordem canônica. */
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

    /** Bloqueia importação sem preview válido, com erros ou sem categoria. */
    readonly property bool importBlocked: !preview || !preview.success || (preview.errors && preview.errors.length > 0)
        || importCategories.length === 0 || busy

    onVisibleChanged: if (visible && panel.settingsService) panel.settingsService.refreshStats()

    /* Não percorre o perfil inteiro na abertura da biblioteca com esta aba oculta. */
    Component.onCompleted: if (visible && panel.settingsService) panel.settingsService.refreshStats()

    Flickable {
        id: backupViewport
        anchors.fill: parent
        anchors.topMargin: 12
        /* O scrollbar e o padding direito do CSS ocupam 8 px sem cobrir os cards. */
        contentWidth: width - (contentHeight > height ? 8 : 0)
        contentHeight: content.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        /* Roda do mouse um pouco mais rápida que o padrão do Qt. */
        WheelScrollSpeed {}
        ScrollBar.vertical: CollectionScrollBar { policy: ScrollBar.AsNeeded; width: 6 }

        ColumnLayout {
            id: content
            width: backupViewport.contentWidth
            spacing: 14

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 2
                UiText { text: "APLICATIVO"; color: Theme.accent; font.pixelSize: 12; textWeight: Font.ExtraBold; font.letterSpacing: 0.8 }
                UiText { text: "Backup da biblioteca"; color: Theme.text; font.pixelSize: 28; textWeight: Font.Black; Layout.bottomMargin: 12 }
            }

            GridLayout {
                Layout.fillWidth: true
                columns: 3
                columnSpacing: 10
                Repeater {
                    model: [
                        {label: "VERSÃO", icon: "scroll-text", value: panel.settingsService ? panel.settingsService.buildLabel : "—"},
                        {label: "BIBLIOTECA", icon: "grid-2x2", value: panel.settingsService && panel.settingsService.totalGames >= 0 ? panel.settingsService.totalGames + " jogos" : "carregando"},
                        {label: "DADOS LOCAIS", icon: "database-backup", value: panel.settingsService && panel.settingsService.dataDirSizeMb >= 0 ? panel.settingsService.dataDirSizeMb + " MB" : "carregando"}
                    ]
                    delegate: Rectangle {
                        required property var modelData
                        Layout.fillWidth: true
                        Layout.preferredWidth: 1
                        implicitHeight: 76
                        radius: 8
                        color: "#09ffffff"
                        border.color: Theme.border
                        ColumnLayout {
                            anchors.fill: parent
                            anchors.margins: 12
                            spacing: 6
                            RowLayout {
                                spacing: 8
                                /* O DOM de referência usa ícones lucide de 18 px nos cards de status. */
                                Image { source: "qrc:/icons/" + modelData.icon + "-active.svg"; sourceSize: Qt.size(18, 18) }
                                UiText { text: modelData.label; color: Theme.secondary; font.pixelSize: 12; textWeight: Font.ExtraBold; font.letterSpacing: 0.55 }
                            }
                            UiText { text: modelData.value; color: Theme.text; font.pixelSize: 18; textWeight: Font.Bold; Layout.fillWidth: true; elide: Text.ElideRight }
                        }
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: exportColumn.implicitHeight + 32
                radius: 8
                color: "#08ffffff"
                border.color: Theme.border
                ColumnLayout {
                    id: exportColumn
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 10
                    UiText { text: "Exportar backup"; color: Theme.accent; font.pixelSize: 16; textWeight: Font.Black }
                    UiText { text: "Crie um pacote local com as partes selecionadas da biblioteca."; color: Theme.secondary; font.pixelSize: 13; wrapMode: Text.WordWrap; Layout.fillWidth: true }
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
                                implicitHeight: 72
                                radius: 8
                                color: panel.includes(panel.exportCategories, modelData.key) ? Theme.accentSoft : Theme.control
                                border.color: panel.includes(panel.exportCategories, modelData.key) ? Theme.accent : Theme.border
                                RowLayout {
                                    anchors.fill: parent
                                    anchors.margins: 10
                                    spacing: 10
                                    FormCheckBox {
                                        id: exportCheckbox
                                        objectName: "exportCategory" + exportCard.modelData.key
                                        checked: panel.includes(panel.exportCategories, modelData.key)
                                        onClicked: panel.exportCategories = panel.toggle(panel.exportCategories, modelData.key, checked)

                                    }
                                    ColumnLayout {
                                        Layout.fillWidth: true
                                        spacing: 1
                                        UiText { text: exportCard.modelData.title; color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold; elide: Text.ElideRight; Layout.fillWidth: true }
                                        UiText { text: exportCard.modelData.description; color: Theme.secondary; font.pixelSize: 12; elide: Text.ElideRight; Layout.fillWidth: true }
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
                radius: 8
                color: "#08ffffff"
                border.color: Theme.border
                ColumnLayout {
                    id: importColumn
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 10
                    UiText { text: "Importar backup"; color: Theme.accent; font.pixelSize: 16; textWeight: Font.Black }
                    UiText { text: "Pré-visualize um pacote e restaure somente as categorias escolhidas."; color: Theme.secondary; font.pixelSize: 13; wrapMode: Text.WordWrap; Layout.fillWidth: true }
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
                                UiText { text: "Pacote selecionado"; color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold }
                                UiText { text: panel.preview ? panel.preview.packagePath : ""; color: Theme.muted; font.pixelSize: 12; elide: Text.ElideMiddle; Layout.fillWidth: true }
                            }
                            UiText { text: panel.preview ? panel.formatDate(panel.preview.manifest.createdAt) : ""; color: Theme.muted; font.pixelSize: 12 }
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
                                    (panel.preview.counts.inventoryItems || 0) + " itens de inventário"
                                ] : []
                                delegate: UiText {
                                    required property var modelData
                                    text: modelData
                                    color: Theme.secondary
                                    font.pixelSize: 12
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
                                    radius: 8
                                    color: available && panel.includes(panel.importCategories, modelData.key) ? Theme.accentSoft : Theme.control
                                    border.color: available && panel.includes(panel.importCategories, modelData.key) ? Theme.accent : Theme.border
                                    RowLayout {
                                        anchors.fill: parent
                                        anchors.margins: 10
                                        spacing: 8
                                        FormCheckBox {
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
                                                UiText { anchors.centerIn: parent; text: "✓"; color: Theme.accentForeground; font.pixelSize: 13; font.bold: true; visible: importCheckbox.checked }
                                            }
                                        }
                                        UiText { text: importCard.modelData.title; color: Theme.accent; font.pixelSize: 12; textWeight: Font.Bold; elide: Text.ElideRight; Layout.fillWidth: true }
                                    }
                                }
                            }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 3
                            visible: panel.preview && panel.preview.errors && panel.preview.errors.length > 0
                            UiText { text: "Erros"; color: "#ffb4ab"; font.pixelSize: 12; textWeight: Font.Bold }
                            Repeater {
                                model: panel.preview && panel.preview.errors ? panel.preview.errors.slice(0, 8) : []
                                delegate: UiText { required property var modelData; text: "• " + modelData.message; color: "#ffb4ab"; font.pixelSize: 12; wrapMode: Text.WordWrap; Layout.fillWidth: true }
                            }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 3
                            visible: panel.preview && panel.preview.warnings && panel.preview.warnings.length > 0
                            UiText { text: "Avisos"; color: "#fbbf24"; font.pixelSize: 12; textWeight: Font.Bold }
                            Repeater {
                                model: panel.preview && panel.preview.warnings ? panel.preview.warnings.slice(0, 8) : []
                                delegate: UiText { required property var modelData; text: "• " + modelData.message; color: Theme.secondary; font.pixelSize: 12; wrapMode: Text.WordWrap; Layout.fillWidth: true }
                            }
                        }
                        UiText {
                            visible: panel.preview && panel.importCategories.length === 0
                            text: "Selecione ao menos uma categoria para importar."
                            color: "#ffb4ab"
                            font.pixelSize: 12
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

            UiText {
                objectName: "backupMessage"
                visible: panel.message.length > 0
                text: panel.message
                color: Theme.accent
                font.pixelSize: 13
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
            UiText {
                objectName: "backupError"
                visible: panel.error.length > 0
                text: panel.error
                color: "#ffb4ab"
                font.pixelSize: 13
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
        }
    }

    /** Envia a importação validada ao coordenador de jobs. */
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
        if (started) panel.message = "Importação iniciada em background."
        else panel.error = panel.coordinator.error || "Não foi possível iniciar a importação."
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
            if (started) panel.message = "Exportação iniciada em background."
            else panel.error = panel.coordinator.error || "Não foi possível iniciar a exportação."
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
                panel.error = panel.preview ? (panel.preview.error || "Pacote inválido.") : "Pacote inválido."
                panel.preview = null
            }
        }
    }
}

