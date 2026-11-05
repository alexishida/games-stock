/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Hierarquia das introducoes segue SectionIntro.css do Electron. */
/* Aba Sobre: identidade, estatísticas do perfil e manutenção local. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock

Item {
    id: about
    objectName: "aboutSettings"
    property var settingsService: null
    property var updateService: null
    property string buildLabel: ""

    /** Formata o tamanho do perfil; ausente vira traço. */
    function sizeLabel(value) {
        return value !== null && value !== undefined && value >= 0 ? String(value) + " MB" : "—"
    }

    onVisibleChanged: if (visible && about.settingsService) about.settingsService.refreshStats()
    Component.onCompleted: if (about.settingsService && about.visible) about.settingsService.refreshStats()

    Item {
        anchors.fill: parent

        ColumnLayout {
            id: content
            width: Math.min(616, parent.width)
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: 14

            SectionIntro {
                Layout.fillWidth: true
                title: "Sobre o GameStock"
                description: "Versão instalada, dados locais e manutenção rápida do aplicativo."
                bottomGap: 0
            }

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: 170
                radius: 8
                color: "#06ffffff"
                border.color: Theme.border
                RowLayout {
                    id: heroRow
                    anchors.fill: parent
                    anchors.margins: 20
                    spacing: 20
                    ColumnLayout {
                        Layout.preferredWidth: 150
                        spacing: 10
                        Image {
                            Layout.preferredWidth: 132
                            Layout.preferredHeight: 96
                            Layout.alignment: Qt.AlignHCenter
                            source: "qrc:/qt/qml/GameStock/assets/logo.png"
                            fillMode: Image.PreserveAspectFit
                        }
                        Rectangle {
                            Layout.alignment: Qt.AlignHCenter
                            implicitWidth: versionText.implicitWidth + 14
                            implicitHeight: 24
                            radius: 11
                            color: Theme.accentSoft
                            border.color: Theme.borderStrong
                            UiText { id: versionText; anchors.centerIn: parent; text: "v" + (about.buildLabel || "—"); color: Theme.accent; font.pixelSize: 12; textWeight: Font.Bold }
                            /* Canal nativo permanece consultável na versão sem alterar a tabela original. */
                            HoverHandler { id: versionHover }
                            ToolTip {
                                objectName: "aboutChannel"
                                visible: versionHover.hovered
                                text: about.settingsService && about.settingsService.channel.length > 0 ? about.settingsService.channel : "—"
                            }
                        }
                    }
                    UiText {
                        Layout.fillWidth: true
                        text: "Organizador de biblioteca para jogos com cadastro manual, importação de ROMs, gerenciamento de mídia e integração com emuladores."
                        color: Theme.secondary
                        font.pixelSize: 13
                        wrapMode: Text.WordWrap
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: metaColumn.implicitHeight + 2
                radius: 8
                color: "#06ffffff"
                border.color: Theme.border
                ColumnLayout {
                    id: metaColumn
                    anchors.fill: parent
                    anchors.margins: 1
                    spacing: 0
                    RowLayout {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 40
                        Layout.leftMargin: 14; Layout.rightMargin: 14
                        UiText { text: "JOGOS NA BIBLIOTECA"; color: Theme.secondary; font.pixelSize: 12; textWeight: Font.ExtraBold;  Layout.fillWidth: true }
                        UiText {
                            objectName: "aboutTotalGames"
                            text: about.settingsService && about.settingsService.totalGames >= 0 ? about.settingsService.totalGames + " jogos" : (about.settingsService && about.settingsService.statsLoading ? "Carregando..." : "—")
                            color: Theme.text
                            font.pixelSize: 13
                            textWeight: Font.Bold
                        }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 40
                        Layout.leftMargin: 14; Layout.rightMargin: 14
                        UiText { text: "ESPAÇO EM DISCO"; color: Theme.secondary; font.pixelSize: 12; textWeight: Font.ExtraBold;  Layout.fillWidth: true }
                        UiText {
                            objectName: "aboutDataSize"
                            text: about.settingsService ? about.sizeLabel(about.settingsService.dataDirSizeMb) : "—"
                            color: Theme.text
                            font.pixelSize: 13
                            textWeight: Font.Bold
                        }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 40
                        Layout.leftMargin: 14; Layout.rightMargin: 14
                        UiText { text: "CRIADO POR"; color: Theme.secondary; font.pixelSize: 12; textWeight: Font.ExtraBold;  Layout.fillWidth: true }
                        UiText { text: "Alex Ishida"; color: Theme.accent; font.pixelSize: 13; textWeight: Font.Bold }
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: 8
                ActionButton {
                    objectName: "openDataDir"
                    Layout.fillWidth: true; Layout.preferredWidth: 1; implicitHeight: 50; wrapLabel: true
                    text: "Abrir pasta de dados"
                    iconName: "folder-open"
                    enabled: about.settingsService !== null
                    onClicked: about.settingsService.openDataDir()
                }
                ActionButton {
                    objectName: "checkUpdate"
                    Layout.fillWidth: true; Layout.preferredWidth: 1; implicitHeight: 50; wrapLabel: true
                    text: about.updateService && about.updateService.running ? "Buscando..." : "Buscar atualização"
                    iconName: "refresh-cw"
                    enabled: about.updateService !== null && !about.updateService.running
                    onClicked: about.updateService.checkNow()
                }
                ActionButton {
                    objectName: "clearRomCache"
                    Layout.fillWidth: true; Layout.preferredWidth: 1; implicitHeight: 50; wrapLabel: true
                    text: "Limpar cache de ROMs extraídas"
                    iconName: "trash-2"
                    enabled: about.settingsService !== null
                    onClicked: about.settingsService.clearRomCache()
                }
            }

            Rectangle {
                visible: about.updateService && about.updateService.phase !== "idle"
                Layout.fillWidth: true
                implicitHeight: updateColumn.implicitHeight + 28
                radius: 12
                color: Theme.panel
                border.color: Theme.border
                ColumnLayout {
                    id: updateColumn
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 8
                    RowLayout {
                        Layout.fillWidth: true
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 2
                            UiText { text: "Atualizações"; color: Theme.text; font.pixelSize: 14; textWeight: Font.Bold }
                            UiText {
                                objectName: "aboutUpdateStatus"
                                text: about.updateService ? about.updateService.message : "Updater indisponível."
                                color: about.updateService && about.updateService.phase === "error" ? "#ffb4ab" : Theme.secondary
                                font.pixelSize: 12
                                wrapMode: Text.WordWrap
                                Layout.fillWidth: true
                            }
                        }
                    }
                    Rectangle {
                        Layout.fillWidth: true
                        Layout.preferredHeight: 6
                        radius: 3
                        color: Theme.control
                        visible: about.updateService && about.updateService.phase === "downloading"
                        Rectangle {
                            width: parent.width * (about.updateService ? about.updateService.percent : 0) / 100
                            height: parent.height
                            radius: 3
                            color: Theme.accent
                        }
                    }
                }
            }

            UiText {
                objectName: "aboutCacheFeedback"
                visible: text.length > 0
                text: about.settingsService ? about.settingsService.cacheFeedback : ""
                color: text.indexOf("Não") === 0 ? "#ffb4ab" : Theme.accent
                font.pixelSize: 13
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
            UiText {
                text: "O lançamento de arquivos .zip e .7z reaproveita extrações temporárias no cache. Limpar esse cache remove só arquivos temporários, sem apagar suas ROMs originais."
                color: Theme.muted
                font.pixelSize: 12
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
        }
    }
}
