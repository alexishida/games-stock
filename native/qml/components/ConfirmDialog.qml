/* Confirmação interna reutilizada por exclusões e ações destrutivas. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

DragDialog {
    id: confirm
    objectName: "confirmDialog"
    property string message: ""
    property string detail: ""
    property string confirmText: "Confirmar"
    property string error: ""
    property var target: null
    signal confirmed()

    width: Math.min(360, parent.width - 48)
    height: detail.length > 0 ? 186 : 158
    heading: "Confirmar"
    onClosed: error = ""

    ColumnLayout {
        anchors.fill: parent
        spacing: 8
        Text {
            objectName: "confirmMessage"
            text: confirm.message
            color: Theme.text
            font.pixelSize: 14
            font.weight: Font.Bold
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        Text {
            objectName: "confirmDetail"
            visible: confirm.detail.length > 0
            text: confirm.detail
            color: Theme.secondary
            font.pixelSize: 12
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        Text {
            objectName: "confirmError"
            visible: confirm.error.length > 0
            text: confirm.error
            color: "#ffb4ab"
            font.pixelSize: 12
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        Item { Layout.fillHeight: true }
        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            Item { Layout.fillWidth: true }
            ActionButton { objectName: "cancelConfirm"; text: "Cancelar"; onClicked: confirm.close() }
            ActionButton {
                objectName: "acceptConfirm"
                text: confirm.confirmText
                dangerOutline: true
                onClicked: confirm.confirmed()
            }
        }
    }
}
