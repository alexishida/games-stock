/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Hierarquia das introducoes segue SectionIntro.css do Electron. */
/* Gerenciador de plataformas dentro de Configurações, com vínculos e bloqueios. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

Item {
    id: manager
    objectName: "platformManager"
    property var platformService: null
    property bool serviceMode: false
    property bool blurEnabled: true
    property var formPlatform: null
    property var mappingPlatform: null
    property alias formDialog: platformForm
    property alias mappingsDialog: mappings

    signal deleteRequested(var platform)
    signal backdropRequested(bool active)

    function openCreate() {
        formPlatform = null
        platformForm.open()
    }

    function openEdit(platform) {
        formPlatform = platform
        platformForm.open()
    }

    function openMappings(platform) {
        mappingPlatform = platform
        mappings.open()
    }

    function closeDialogs() {
        platformForm.close()
        mappings.close()
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 12
        RowLayout {
            Layout.fillWidth: true
            SectionIntro {
                Layout.fillWidth: true
                title: "Plataformas"
                description: "Plataformas cadastradas para organizar biblioteca, aliases de busca e extensões aceitas no importador."
                bottomGap: 0
            }
        }
        UiText {
            objectName: "platformManagerError"
            visible: manager.serviceMode && manager.platformService && manager.platformService.error.length > 0
            text: manager.platformService ? manager.platformService.error : ""
            color: "#ffb4ab"
            font.pixelSize: 12
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        PanelFlickable {
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentWidth: width
            contentHeight: list.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            ColumnLayout {
                id: list
                width: parent.width - 2
                x: 1
                spacing: 0
                UiText { visible: list.rowCount === 0; text: "Nenhuma plataforma cadastrada."; color: Theme.secondary; font.pixelSize: 13 }
                readonly property int rowCount: manager.platformService ? manager.platformService.items.length : 0
                Repeater {
                    model: manager.platformService ? manager.platformService.items : []
                    delegate: Rectangle {
                        required property var modelData
                        Layout.fillWidth: true
                        implicitHeight: 55
                        radius: 0
                        color: "transparent"
                        Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: Theme.border }
                        RowLayout {
                            anchors.fill: parent
                            anchors.margins: 10
                            spacing: 8
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 2
                                UiText { text: modelData.name || ""; color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold; elide: Text.ElideRight; Layout.fillWidth: true }
                                UiText {
                                    text: (modelData.category || "Sem categoria") + " · " + Number(modelData.gameCount || 0) + " jogos"
                                    color: Theme.muted
                                    font.pixelSize: 11
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                }
                            }
                            ActionButton { objectName: "platformMappings"; iconName: "link-2"; enabled: manager.serviceMode; Accessible.name: "Editar aliases e extensões"; onClicked: manager.openMappings(modelData) }
                            ActionButton { objectName: "editPlatform"; iconName: "pencil"; enabled: manager.serviceMode; Accessible.name: "Editar"; onClicked: manager.openEdit(modelData) }
                            ActionButton { objectName: "deletePlatform"; iconName: "trash-2-danger"; dangerOutline: true; enabled: manager.serviceMode && !modelData.isDefault; visible: !modelData.isDefault; Accessible.name: "Remover"; onClicked: manager.deleteRequested(modelData) }
                        }
                    }
                }
            }
        }
        RowLayout {
            Layout.fillWidth: true
            Item { Layout.fillWidth: true }
            ActionButton { objectName: "newPlatform"; text: "Nova plataforma"; iconName: "plus"; accentOutline: true; enabled: manager.serviceMode; onClicked: manager.openCreate() }
        }
    }

    PlatformFormDialog {
        id: platformForm
        platformService: manager.platformService
        editingPlatform: manager.formPlatform
        backdropBlurEnabled: manager.blurEnabled
        onBackdropBlurRequested: function(active) { manager.backdropRequested(active) }
        onClosed: manager.formPlatform = null
        onSaved: function(platformId) {
            if (manager.serviceMode && manager.platformService) manager.platformService.refresh()
        }
    }
    PlatformMappingsDialog {
        id: mappings
        platformService: manager.platformService
        platform: manager.mappingPlatform
        backdropBlurEnabled: manager.blurEnabled
        onBackdropBlurRequested: function(active) { manager.backdropRequested(active) }
        onClosed: manager.mappingPlatform = null
    }
}
