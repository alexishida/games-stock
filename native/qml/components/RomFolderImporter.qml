/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Seletores usam FormSelect para manter padding, altura e menu iguais ao Electron. */
/* Hierarquia das introducoes segue SectionIntro.css do Electron. */
/* Painel de importação de ROMs por pasta com revisão e histórico persistido. */
import QtQuick
import QtQuick.Controls
import QtQuick.Dialogs
import QtQuick.Layouts
import GameStock
import "."

Item {
    id: root
    /* Serviços injetados pelo bootstrap; o painel não executa SQL. */
    required property var romFolderService
    required property var platformService
    property bool serviceMode: false
    property bool busy: false
    property string errorText: ""
    property int selectedIndex: -1
    property bool addOpen: false
    property bool deleteOpen: false
    /* Passo do assistente: configuração ou revisão dos candidatos. */
    property string step: "configure"
    property string folderPath: ""
    property int selectedPlatformId: 0
    property bool includeSubfolders: false
    property var scanResult: null
    property string reviewView: "candidates"
    signal backdropRequested(bool active)
    signal importStarted()

    readonly property var folders: romFolderService ? romFolderService.folders : []
    readonly property var platforms: platformService ? platformService.items : []

    /** Converte a URL do FolderDialog em caminho local sem depender de APIs de Node. */
    function localPath(value) {
        let text = String(value)
        if (text.startsWith("file:///")) text = text.substring(8)
        else if (text.startsWith("file://")) text = text.substring(7)
        return decodeURIComponent(text)
    }

    /** Atualiza o erro visível sem esconder falhas do serviço. */
    function reportError(message) {
        errorText = message && message.length ? message : (romFolderService ? romFolderService.error : "")
    }

    /** Reseta o assistente para a configuração inicial. */
    function resetWizard() {
        step = "configure"
        folderPath = ""
        selectedPlatformId = 0
        includeSubfolders = false
        scanResult = null
        reviewView = "candidates"
        errorText = ""
    }

    /** Executa o scan e avança para a revisão somente em caso de sucesso. */
    function runScan() {
        if (!serviceMode || !romFolderService || !folderPath.length) return
        busy = true
        errorText = ""
        const request = {
            folderPaths: [folderPath],
            platformId: selectedPlatformId > 0 ? selectedPlatformId : null,
            detectionMode: selectedPlatformId > 0 ? "manual" : "automatic",
            includeSubfolders: subfoldersControl.checked
        }
        const result = romFolderService.scan(request)
        busy = false
        if (!result || !result.ok) { reportError(result ? result.error : ""); return }
        scanResult = result
        reviewView = "candidates"
        step = "review"
    }

    /** Salva as pastas resolvidas e inicia o job em background. */
    function startImport() {
        if (!serviceMode || !scanResult) return
        busy = true
        errorText = ""
        const request = {
            folderPaths: scanResult.folderPaths,
            romFilePaths: scanResult.romFilePaths,
            platformId: scanResult.platformId,
            detectionMode: scanResult.detectionMode,
            includeSubfolders: scanResult.includeSubfolders
        }
        const job = romFolderService.startImport(request)
        if (!job || !job.jobId) { busy = false; reportError(job ? job.error : ""); return }
        // A detecção automática pode resolver várias plataformas para a mesma pasta.
        if (scanResult.detectionMode === "automatic") {
            for (let index = 0; index < scanResult.detectedPlatforms.length; ++index) {
                const detected = scanResult.detectedPlatforms[index]
                romFolderService.saveFolder(scanResult.folderPaths[0], detected.platformId, scanResult.includeSubfolders)
            }
        } else {
            romFolderService.saveFolder(scanResult.folderPaths[0], scanResult.platformId, scanResult.includeSubfolders)
        }
        busy = false
        addOpen = false
        resetWizard()
        addDialog.close()
        importStarted()
    }

    /** Repete os downloads de uma pasta já configurada. */
    function continueFolder(entry) {
        if (!serviceMode || !romFolderService) return
        errorText = ""
        const job = romFolderService.startImport({
            folderPaths: [entry.folderPath],
            platformId: entry.platformId,
            detectionMode: "manual",
            includeSubfolders: entry.includeSubfolders === true
        })
        if (!job || !job.jobId) reportError(job ? job.error : "")
        else importStarted()
    }

    /** Remove registros e a entrada persistida, preservando as ROMs no disco. */
    function removeSelectedFolder() {
        const entry = selectedIndex >= 0 ? folders[selectedIndex] : null
        if (!serviceMode || !entry) return
        const removed = romFolderService.removeFolder(entry.folderPath, entry.platformId)
        if (removed < 0) reportError(romFolderService.error)
        else {
            errorText = ""
            selectedIndex = -1
            deleteDialog.close()
            if (platformService) platformService.refresh()
        }
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 12
        SectionIntro {
            Layout.fillWidth: true
            title: "Pastas em uso"
            description: "Pastas já configuradas para importação, com a plataforma associada e o total de jogos indexados."
            bottomGap: 0
        }
        UiText {
            objectName: "romFolderError"
            visible: errorText.length > 0
            text: errorText
            color: "#ffb4ab"
            font.pixelSize: 13
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Math.min(240, 40 + Math.max(1, folderList.count) * 40)
            color: "#0bffffff"
            radius: 0
            border.color: Theme.border
            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 0
                spacing: 0
                RowLayout {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 38
                    Layout.leftMargin: 12
                    Layout.rightMargin: 12
                    UiText { text: "Pasta"; color: Theme.muted; font.pixelSize: 13; textWeight: Font.Bold; Layout.fillWidth: true; Layout.minimumWidth: 80 }
                    UiText { text: "Plataforma"; color: Theme.muted; font.pixelSize: 13; textWeight: Font.Bold; Layout.preferredWidth: 180 }
                    UiText { text: "Jogos"; color: Theme.muted; font.pixelSize: 13; textWeight: Font.Bold; Layout.preferredWidth: 72 }
                    Item { Layout.fillWidth: true }
                }
                Rectangle { Layout.fillWidth: true; height: 1; color: Theme.border }
                ListView {
                    id: folderList
                    objectName: "romFolderList"
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true
                    spacing: 0
                    /* Roda do mouse um pouco mais rápida que o padrão do Qt. */
                    WheelScrollSpeed {}
                    model: root.folders
                    delegate: Rectangle {
                        required property var modelData
                        required property int index
                        objectName: "romFolderRow" + index
                        width: folderList.width
                        height: 40
                        radius: 6
                        color: root.selectedIndex === index ? Theme.accentSoft : (rowArea.containsMouse ? Theme.controlHover : "transparent")
                        RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 8
                            anchors.rightMargin: 8
                            spacing: 12
                            UiText {
                                text: modelData.folderPath
                                color: Theme.text; font.pixelSize: 13
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                                Layout.minimumWidth: 80
                            }
                            UiText {
                                text: modelData.platformName ? modelData.platformName : "—"
                                color: Theme.secondary; font.pixelSize: 13
                                Layout.preferredWidth: 180
                                elide: Text.ElideRight
                            }
                            UiText {
                                text: modelData.indexedCount !== undefined ? modelData.indexedCount : 0
                                color: Theme.accent; font.pixelSize: 13; textWeight: Font.DemiBold
                                Layout.preferredWidth: 72
                            }
                            UiText {
                                visible: modelData.includeSubfolders === true
                                text: "subpastas"
                                color: Theme.muted; font.pixelSize: 12
                            }
                            Item { Layout.fillWidth: true }
                            ActionButton {
                                objectName: "continueFolder" + index
                                iconName: "refresh-cw"
                                toolbar: true
                                Accessible.name: "Importar ou atualizar pasta"
                                enabled: root.serviceMode && !root.busy
                                onClicked: root.continueFolder(modelData)
                            }
                            ActionButton {
                                objectName: "removeFolder" + index
                                iconName: "trash-2-danger"
                                dangerOutline: true
                                implicitWidth: 28
                                implicitHeight: 28
                                Accessible.name: "Remover pasta"
                                enabled: root.serviceMode && !root.busy
                                onClicked: { root.selectedIndex = index; root.deleteOpen = true; deleteDialog.open() }
                            }
                        }
                        MouseArea {
                            id: rowArea
                            anchors.fill: parent
                            hoverEnabled: true
                            acceptedButtons: Qt.LeftButton
                            onClicked: root.selectedIndex = index
                            z: -1
                        }
                    }
                }
                UiText {
                    visible: folderList.count === 0
                    text: root.serviceMode
                        ? "Nenhuma pasta configurada. Use \"Adicionar pasta\" para começar."
                        : "Abra um perfil com banco para importar ROMs."
                    color: Theme.muted
                    font.pixelSize: 13
                    horizontalAlignment: Text.AlignHCenter
                    Layout.fillWidth: true
                    Layout.alignment: Qt.AlignCenter
                }
            }
        }
        ActionButton {
            objectName: "addRomFolder"
            text: "Adicionar Pasta"
            iconName: "folder-open"
            accentOutline: true
            enabled: serviceMode && !busy
            onClicked: {
                resetWizard()
                addOpen = true
                addDialog.open()
            }
        }
        Item { Layout.fillHeight: true }
    }

    FolderDialog {
        id: folderDialog
        title: "Selecionar pasta de ROMs"
        onAccepted: root.folderPath = root.localPath(selectedFolder)
    }

    /* Assistente de configuração e revisão sobre o painel, na mesma superfície. */
    DragDialog {
        id: addDialog
        objectName: "romFolderWizard"
        backdropBlurEnabled: true
        width: Math.min(720, parent.width - 48)
        height: Math.min(560, parent.height - 48)
        heading: root.step === "configure" ? "Adicionar pasta de ROMs" : "Revisar ROMs"
        onBackdropBlurRequested: function(active) { root.backdropRequested(active) }
        onClosed: { root.addOpen = false; root.resetWizard() }
        ColumnLayout {
            anchors.fill: parent
            spacing: 12
            ColumnLayout {
                visible: root.step === "configure"
                Layout.fillWidth: true
                spacing: 10
                UiText { text: "Pasta"; color: Theme.secondary; font.pixelSize: 13; textWeight: Font.Bold }
                RowLayout {
                    Layout.fillWidth: true
                    FormField {
                        id: pathField
                        objectName: "romFolderPath"
                        Layout.fillWidth: true
                        text: root.folderPath
                        placeholderText: "Selecione a pasta com as ROMs"
                        onTextChanged: root.folderPath = text
                    }
                    ActionButton { objectName: "browseRomFolder"; text: "Procurar"; onClicked: folderDialog.open() }
                }
                UiText { text: "Plataforma"; color: Theme.secondary; font.pixelSize: 13; textWeight: Font.Bold }
                FormSelect {
                    id: platformPicker
                    objectName: "romFolderPlatform"
                    Layout.fillWidth: true
                    implicitHeight: Theme.controlHeight
                    textRole: "name"
                    valueRole: "id"
                    model: {
                        const list = [{id: 0, name: "Detecção automática"}]
                        for (let index = 0; index < root.platforms.length; ++index) list.push(root.platforms[index])
                        return list
                    }
                    onActivated: root.selectedPlatformId = currentValue
                }
                FormCheckBox {
                    id: subfoldersControl
                    objectName: "romFolderSubfolders"
                    text: "Incluir subpastas"
                    checked: root.includeSubfolders
                    onToggled: root.includeSubfolders = checked
                }
                Item { Layout.fillHeight: true }
                RowLayout {
                    Layout.fillWidth: true
                    Item { Layout.fillWidth: true }
                    ActionButton { text: "Cancelar"; onClicked: addDialog.close() }
                    ActionButton {
                        objectName: "scanRomFolder"
                        text: root.busy ? "Escaneando..." : "Escaneando"
                        primary: true
                        enabled: root.serviceMode && !root.busy && root.folderPath.length > 0
                        onClicked: root.runScan()
                    }
                }
            }
            ColumnLayout {
                visible: root.step === "review"
                Layout.fillWidth: true
                Layout.fillHeight: true
                spacing: 8
                UiText {
                    objectName: "romFolderReviewSummary"
                    text: root.scanResult
                        ? (root.scanResult.candidates.length + " ROM(s) encontrada(s) · "
                            + root.scanResult.ignored + " ignorada(s) · " + root.scanResult.platformName)
                        : ""
                    color: Theme.text
                    font.pixelSize: 14
                    textWeight: Font.DemiBold
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }
                RowLayout {
                    spacing: 8
                    ActionButton {
                        text: "Candidatos (" + (root.scanResult ? root.scanResult.candidates.length : 0) + ")"
                        toolbar: true
                        primary: root.reviewView === "candidates"
                        onClicked: root.reviewView = "candidates"
                    }
                    ActionButton {
                        text: "Ignorados (" + (root.scanResult ? root.scanResult.ignored : 0) + ")"
                        toolbar: true
                        primary: root.reviewView === "ignored"
                        onClicked: root.reviewView = "ignored"
                    }
                    Item { Layout.fillWidth: true }
                }
                Rectangle {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    color: Theme.control
                    radius: 8
                    ListView {
                        id: reviewList
                        anchors.fill: parent
                        anchors.margins: 6
                        clip: true
                        spacing: 2
                        /* Roda do mouse um pouco mais rápida que o padrão do Qt. */
                        WheelScrollSpeed {}
                        model: root.scanResult
                            ? (root.reviewView === "candidates" ? root.scanResult.candidates : root.scanResult.ignoredItems)
                            : []
                        delegate: Rectangle {
                            required property var modelData
                            width: reviewList.width
                            height: 40
                            radius: 4
                            color: Theme.panel
                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: 8
                                anchors.rightMargin: 8
                                spacing: 8
                                UiText {
                                    text: modelData.filename
                                    color: Theme.text; font.pixelSize: 13
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                }
                                UiText {
                                    text: root.reviewView === "candidates"
                                        ? (modelData.platformName || "")
                                        : (modelData.reason || "")
                                    color: root.reviewView === "candidates" ? Theme.accentMuted : Theme.muted
                                    font.pixelSize: 12
                                    elide: Text.ElideRight
                                    Layout.maximumWidth: 340
                                }
                            }
                        }
                    }
                    UiText {
                        anchors.centerIn: parent
                        visible: reviewList.count === 0
                        text: root.reviewView === "candidates"
                            ? "Nenhuma ROM compatível encontrada."
                            : "Nenhum arquivo ignorado."
                        color: Theme.muted
                        font.pixelSize: 13
                    }
                }
                RowLayout {
                    Layout.fillWidth: true
                    Item { Layout.fillWidth: true }
                    ActionButton { text: "Voltar"; onClicked: root.step = "configure" }
                    ActionButton {
                        objectName: "importRomFolder"
                        text: root.busy ? "Importando..." : "Importar ROMs"
                        primary: true
                        enabled: root.serviceMode && !root.busy
                            && root.scanResult && root.scanResult.candidates.length > 0
                        onClicked: root.startImport()
                    }
                }
            }
        }
    }

    ConfirmDialog {
        id: deleteDialog
        objectName: "removeRomFolderConfirm"
        message: "Remover esta pasta do GameStock? As ROMs originais permanecem no disco e as imagens baixadas ficam em cache."
        onBackdropBlurRequested: function(active) { root.backdropRequested(active) }
        onConfirmed: root.removeSelectedFolder()
        onClosed: root.deleteOpen = false
    }
}
