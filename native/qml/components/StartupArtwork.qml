/* Reproduz a splash Electron com a arte original, versão no topo e status no rodapé. */
import QtQuick
import QtQuick.Layouts
import GameStock

Item {
    id: root
    property string buildLabel: ""
    property string buildNumber: "local"

    Image {
        anchors.fill: parent
        source: "qrc:/qt/qml/GameStock/assets/gamestock-splash.webp"
        fillMode: Image.PreserveAspectCrop
        sourceSize: Qt.size(1280, 800)
    }
    /* O gradiente original começa em 45% da altura e protege a leitura do rodapé. */
    Rectangle {
        width: parent.width
        height: parent.height * 0.55
        anchors.bottom: parent.bottom
        gradient: Gradient {
            GradientStop { position: 0; color: "transparent" }
            GradientStop { position: 0.65; color: "#eb000000" }
            GradientStop { position: 1; color: "#eb000000" }
        }
    }
    UiText {
        anchors.top: parent.top
        anchors.right: parent.right
        anchors.topMargin: 12
        anchors.rightMargin: 14
        text: "v" + root.buildLabel + "   BUILD " + root.buildNumber
        color: "#73ffffff"
        font.pixelSize: 10
        textWeight: Font.Bold
        font.letterSpacing: 0.7
    }
    RowLayout {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.margins: 20
        spacing: 10
        Rectangle {
            Layout.preferredWidth: 30
            Layout.minimumWidth: 30
            Layout.maximumWidth: 30
            Layout.preferredHeight: 30
            Layout.alignment: Qt.AlignTop
            radius: 8
            color: "#66000000"
            Image {
                anchors.centerIn: parent
                width: 18
                height: 18
                source: "qrc:/icons/refresh-cw-active.svg"
                RotationAnimator on rotation {
                    from: 0
                    to: 360
                    duration: 1150
                    loops: Animation.Infinite
                }
            }
        }
        ColumnLayout {
            Layout.fillWidth: true
            spacing: 4
            UiText {
                Layout.fillWidth: true
                text: "Iniciando GameStock…"
                color: Theme.text
                font.pixelSize: 13
                textWeight: Font.Bold
                Accessible.role: Accessible.StaticText
                Accessible.name: text
            }
            UiText {
                Layout.fillWidth: true
                text: "Preparando ambiente do GameStock."
                color: "#73ffffff"
                font.pixelSize: 11
            }
        }
    }
}
