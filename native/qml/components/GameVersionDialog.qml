/* Seletor de variantes do mesmo jogo-base usado antes do lançamento. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

DragDialog {
    id: versions
    objectName: "gameVersionDialog"
    property var gameService: null
    property var options: []
    property bool serviceMode: false
    property var launchService: null
    property string actionError: ""

    signal versionSelected(var version)
    signal versionLaunched(var versionId)

    width: Math.min(760, parent.width - 48)
    height: Math.min(526, parent.height - 48)
    heading: "Escolha versão"
    onClosed: actionError = ""

    function preview(option) {
        if (option.coverUrl) return option.coverUrl
        const path = option.boxArtPath || option.screenshotPath || option.backgroundPath
        return serviceMode && gameService && path ? gameService.mediaUrl(path) : ""
    }

    /** Inicia a variante escolhida e só fecha após o spawn confirmado. */
    function launch(option) {
        actionError = ""
        if (!launchService) {
            actionError = "Serviço de lançamento indisponível."
            return
        }
        const result = launchService.launch(Number(option.id))
        if (!result || !result.success) {
            actionError = launchService.error || "Não foi possível iniciar a versão."
            return
        }
        versions.versionLaunched(Number(option.id))
        versions.close()
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 12

        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            Text {
                text: "Escolha versão"
                color: Theme.text
                font.pixelSize: 16
                font.weight: Font.Bold
                Layout.fillWidth: true
            }
            ActionButton {
                objectName: "closeVersions"
                iconName: "x-danger"
                toolbar: true
                dangerOutline: true
                Accessible.name: "Fechar"
                onClicked: versions.close()
            }
        }

        Text {
            objectName: "versionBaseTitle"
            text: versions.options.length ? (versions.options[0].baseTitle || "Seleção de versão") : "Seleção de versão"
            color: Theme.text
            font.pixelSize: 26
            font.weight: Font.Bold
            elide: Text.ElideRight
            Layout.fillWidth: true
        }
        Text {
            text: "Encontramos múltiplas variantes deste jogo. Escolha qual ROM deseja abrir agora."
            color: Theme.secondary
            font.pixelSize: 14
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        Text {
            objectName: "versionError"
            visible: versions.actionError.length > 0
            text: versions.actionError
            color: "#ffb4ab"
            font.pixelSize: 12
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }

        Flickable {
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentWidth: width
            contentHeight: optionList.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            ColumnLayout {
                id: optionList
                width: parent.width
                spacing: 12
                Repeater {
                    model: versions.options
                    delegate: Rectangle {
                        required property var modelData
                        Layout.fillWidth: true
                        implicitHeight: 176
                        radius: 14
                        color: "#d1121212"
                        border.color: Theme.border
                        RowLayout {
                            anchors.fill: parent
                            anchors.margins: 14
                            spacing: 16
                            Rectangle {
                                Layout.preferredWidth: 84
                                Layout.preferredHeight: 84
                                Layout.alignment: Qt.AlignTop
                                radius: 10
                                color: Theme.control
                                clip: true
                                Image {
                                    anchors.fill: parent
                                    source: versions.preview(modelData)
                                    fillMode: Image.PreserveAspectCrop
                                    visible: source.toString().length > 0
                                }
                                Image {
                                    anchors.centerIn: parent
                                    source: "qrc:/icons/image.svg"
                                    sourceSize: Qt.size(22, 22)
                                    visible: !versions.preview(modelData).length
                                }
                            }
                            ColumnLayout {
                                Layout.fillWidth: true
                                Layout.fillHeight: true
                                spacing: 4
                                Text {
                                    text: modelData.title || ""
                                    color: Theme.text
                                    font.pixelSize: 16
                                    font.weight: Font.Bold
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                }
                                Text {
                                    text: modelData.variantLabel || "Versão padrão"
                                    color: Theme.accentMuted
                                    font.pixelSize: 12
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                }
                                GridLayout {
                                    Layout.fillWidth: true
                                    columns: 2
                                    columnSpacing: 24
                                    rowSpacing: 4
                                    RowLayout {
                                        spacing: 5
                                        Image { source: "qrc:/icons/globe-2.svg"; sourceSize: Qt.size(13, 13) }
                                        Text { text: modelData.regionLabel || "Região não detectada"; color: Theme.secondary; font.pixelSize: 11 }
                                    }
                                    RowLayout {
                                        spacing: 5
                                        Image { source: "qrc:/icons/sparkles.svg"; sourceSize: Qt.size(13, 13) }
                                        Text { text: modelData.typeLabel || "Sem marcador especial"; color: Theme.secondary; font.pixelSize: 11 }
                                    }
                                    RowLayout {
                                        spacing: 5
                                        Image { source: "qrc:/icons/scroll-text.svg"; sourceSize: Qt.size(13, 13) }
                                        Text { text: modelData.romFileName || ""; color: Theme.secondary; font.pixelSize: 11; elide: Text.ElideRight; Layout.maximumWidth: 220 }
                                    }
                                    RowLayout {
                                        spacing: 5
                                        Image { source: "qrc:/icons/rotate-ccw.svg"; sourceSize: Qt.size(13, 13) }
                                        Text {
                                            text: Number(modelData.launchCount || 0) + (Number(modelData.launchCount || 0) === 1 ? " jogada" : " jogadas")
                                            color: Theme.secondary
                                            font.pixelSize: 11
                                        }
                                    }
                                }
                                Item { Layout.fillHeight: true }
                                RowLayout {
                                    Layout.fillWidth: true
                                    Item { Layout.fillWidth: true }
                                    ActionButton {
                                        objectName: "selectVersion"
                                        text: "Jogar"
                                        iconName: "play"
                                        link: true
                                        enabled: versions.serviceMode && versions.launchService
                                        onClicked: versions.launch(modelData)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
