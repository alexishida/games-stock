/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
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
    property var awaitingVersionId: 0

    signal versionSelected(var version)
    signal versionLaunched(var versionId)

    width: Math.min(760, parent.width - 48)
    height: Math.min(680, versionBody.implicitHeight + 44, parent.height - 48)
    padding: 22
    panelColor: "#f51c1b1b"
    panelBorder: "#59849495"
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
        if (typeof launchService.beginLaunch === "function") {
            awaitingVersionId = Number(option.id)
            if (!launchService.beginLaunch(awaitingVersionId)) awaitingVersionId = 0
            return
        }
        completeLaunch(Number(option.id), launchService.launch(Number(option.id)))
    }

    /** Fecha o seletor somente quando o serviço confirmou o processo. */
    function completeLaunch(gameId, result) {
        if (!result || !result.success) {
            actionError = launchService.error || "Não foi possível iniciar a versão."
            return
        }
        versions.versionLaunched(gameId)
        versions.close()
    }

    Connections {
        target: versions.launchService
        ignoreUnknownSignals: true
        function onLaunchFinished(gameId, result) {
            if (gameId !== versions.awaitingVersionId) return
            versions.awaitingVersionId = 0
            versions.completeLaunch(gameId, result)
        }
    }

    ColumnLayout {
        id: versionBody
        anchors.fill: parent
        spacing: 18

        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            UiText {
                text: "Escolha versão"
                color: Theme.text
                font.pixelSize: 16
                textWeight: Font.Normal
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

        UiText {
            objectName: "versionBaseTitle"
            text: versions.options.length ? (versions.options[0].baseTitle || "Seleção de versão") : "Seleção de versão"
            color: Theme.text
            font.pixelSize: 22
            textWeight: Font.Bold
            elide: Text.ElideRight
            Layout.fillWidth: true
        }
        UiText {
            text: "Encontramos múltiplas variantes deste jogo. Escolha qual ROM deseja abrir agora."
            color: Theme.secondary
            font.pixelSize: 13
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        UiText {
            objectName: "versionError"
            visible: versions.actionError.length > 0
            text: versions.actionError
            color: "#ffb4ab"
            font.pixelSize: 13
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }

        Flickable {
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentWidth: width
            contentHeight: optionList.implicitHeight
            implicitHeight: optionList.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            /* Roda do mouse um pouco mais rápida que o padrão do Qt. */
            WheelScrollSpeed {}
            ColumnLayout {
                id: optionList
                width: parent.width
                spacing: 12
                Repeater {
                    model: versions.options
                    delegate: Rectangle {
                        required property var modelData
                        Layout.fillWidth: true
                        // A altura acompanha os dados sem deixar um rodapé vazio em cada variante.
                        implicitHeight: Math.max(136, versionRow.implicitHeight + 28)
                        radius: 14
                        color: "#04ffffff"
                        border.color: Theme.border
                        RowLayout {
                            id: versionRow
                            anchors.fill: parent
                            anchors.margins: 14
                            spacing: 14
                            Rectangle {
                                Layout.preferredWidth: 84
                                Layout.preferredHeight: 108
                                Layout.alignment: Qt.AlignVCenter
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
                            // Centro: identifica a variante uma única vez e reserva a linha da ROM.
                            ColumnLayout {
                                Layout.fillWidth: true
                                Layout.minimumWidth: 0
                                Layout.alignment: Qt.AlignVCenter
                                spacing: 8
                                UiText {
                                    text: modelData.title || ""
                                    color: Theme.text
                                    font.pixelSize: 16
                                    textWeight: Font.Bold
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                }
                                RowLayout {
                                    Layout.fillWidth: true
                                    spacing: 6
                                    Image { source: "qrc:/icons/globe-2.svg"; sourceSize: Qt.size(14, 14) }
                                    UiText {
                                        text: modelData.variantLabel || modelData.regionLabel || "Versão padrão"
                                        color: Theme.accentMuted
                                        font.pixelSize: 13
                                        textWeight: Font.DemiBold
                                        elide: Text.ElideRight
                                        Layout.fillWidth: true
                                    }
                                }
                                UiText {
                                    text: modelData.romFileName || "ROM não associada"
                                    color: Theme.secondary
                                    font.pixelSize: 13
                                    wrapMode: Text.WrapAtWordBoundaryOrAnywhere
                                    maximumLineCount: 2
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                }
                            }
                            // Histórico e ação formam uma coluna fixa, alinhada entre todos os cards.
                            ColumnLayout {
                                Layout.preferredWidth: 110
                                Layout.minimumWidth: 110
                                Layout.maximumWidth: 110
                                Layout.alignment: Qt.AlignVCenter
                                spacing: 12
                                RowLayout {
                                    Layout.alignment: Qt.AlignHCenter
                                    spacing: 6
                                    Image { source: "qrc:/icons/rotate-ccw.svg"; sourceSize: Qt.size(14, 14) }
                                    UiText {
                                        text: Number(modelData.launchCount || 0) + (Number(modelData.launchCount || 0) === 1 ? " jogada" : " jogadas")
                                        color: Theme.secondary
                                        font.pixelSize: 13
                                    }
                                }
                                ActionButton {
                                    objectName: "selectVersion"
                                    text: "Jogar"
                                    iconName: "play-white"
                                    successFill: true
                                    Layout.fillWidth: true
                                    implicitHeight: 36
                                    font.weight: Font.DemiBold
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
