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
            width: parent.width
            spacing: 14

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 2
                Text { text: "Sobre o GameStock"; color: Theme.accent; font.pixelSize: 22; font.weight: Font.Bold }
                Text {
                    text: "Versão instalada, dados locais e manutenção rápida do aplicativo."
                    color: Theme.secondary
                    font.pixelSize: 12
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }
            }

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: heroRow.implicitHeight + 32
                radius: 16
                color: "#dc201f1f"
                border.color: Theme.border
                RowLayout {
                    id: heroRow
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 18
                    ColumnLayout {
                        Layout.preferredWidth: 180
                        spacing: 8
                        Image {
                            Layout.preferredWidth: 160
                            Layout.preferredHeight: 110
                            source: "qrc:/qt/qml/GameStock/assets/logo.png"
                            fillMode: Image.PreserveAspectFit
                        }
                        Rectangle {
                            Layout.alignment: Qt.AlignLeft
                            implicitWidth: versionText.implicitWidth + 14
                            implicitHeight: 22
                            radius: 11
                            color: Theme.accentSoft
                            border.color: Theme.borderStrong
                            Text { id: versionText; anchors.centerIn: parent; text: "v" + (about.buildLabel || "—"); color: Theme.accent; font.pixelSize: 11; font.weight: Font.Bold }
                        }
                    }
                    Text {
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
                implicitHeight: metaColumn.implicitHeight + 32
                radius: 16
                color: "#dc201f1f"
                border.color: Theme.border
                ColumnLayout {
                    id: metaColumn
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 10
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "JOGOS NA BIBLIOTECA"; color: Theme.muted; font.pixelSize: 11; font.weight: Font.ExtraBold; font.letterSpacing: 0.6; Layout.fillWidth: true }
                        Text {
                            objectName: "aboutTotalGames"
                            text: about.settingsService && about.settingsService.totalGames >= 0 ? about.settingsService.totalGames + " jogos" : (about.settingsService && about.settingsService.statsLoading ? "Carregando..." : "—")
                            color: Theme.text
                            font.pixelSize: 13
                            font.weight: Font.Bold
                        }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "ESPAÇO EM DISCO"; color: Theme.muted; font.pixelSize: 11; font.weight: Font.ExtraBold; font.letterSpacing: 0.6; Layout.fillWidth: true }
                        Text {
                            objectName: "aboutDataSize"
                            text: about.settingsService ? about.sizeLabel(about.settingsService.dataDirSizeMb) : "—"
                            color: Theme.text
                            font.pixelSize: 13
                            font.weight: Font.Bold
                        }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "CANAL"; color: Theme.muted; font.pixelSize: 11; font.weight: Font.ExtraBold; font.letterSpacing: 0.6; Layout.fillWidth: true }
                        Text {
                            objectName: "aboutChannel"
                            text: about.settingsService && about.settingsService.channel.length > 0 ? about.settingsService.channel : "—"
                            color: Theme.text
                            font.pixelSize: 13
                            font.weight: Font.Bold
                        }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        Text { text: "CRIADO POR"; color: Theme.muted; font.pixelSize: 11; font.weight: Font.ExtraBold; font.letterSpacing: 0.6; Layout.fillWidth: true }
                        Text { text: "Alex Ishida"; color: Theme.accent; font.pixelSize: 13; font.weight: Font.Bold }
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                spacing: 8
                ActionButton {
                    objectName: "openDataDir"
                    text: "Abrir pasta de dados"
                    iconName: "folder-open"
                    enabled: about.settingsService !== null
                    onClicked: about.settingsService.openDataDir()
                }
                ActionButton {
                    objectName: "checkUpdate"
                    text: about.updateService && about.updateService.running ? "Buscando..." : "Buscar atualização"
                    iconName: "refresh-cw"
                    enabled: about.updateService !== null && !about.updateService.running
                    onClicked: about.updateService.checkNow()
                }
                ActionButton {
                    objectName: "clearRomCache"
                    text: "Limpar cache de ROMs extraídas"
                    iconName: "trash-2"
                    enabled: about.settingsService !== null
                    onClicked: about.settingsService.clearRomCache()
                }
                Item { Layout.fillWidth: true }
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
                            Text { text: "Atualizações"; color: Theme.text; font.pixelSize: 14; font.weight: Font.Bold }
                            Text {
                                objectName: "aboutUpdateStatus"
                                text: about.updateService ? about.updateService.message : "Updater indisponível."
                                color: about.updateService && about.updateService.phase === "error" ? "#ffb4ab" : Theme.secondary
                                font.pixelSize: 11
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

            Text {
                objectName: "aboutCacheFeedback"
                visible: text.length > 0
                text: about.settingsService ? about.settingsService.cacheFeedback : ""
                color: text.indexOf("Não") === 0 ? "#ffb4ab" : Theme.accent
                font.pixelSize: 12
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
            Text {
                text: "O lançamento de arquivos .zip e .7z reaproveita extrações temporárias no cache. Limpar esse cache remove só arquivos temporários, sem apagar suas ROMs originais."
                color: Theme.muted
                font.pixelSize: 11
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
        }
    }
}
