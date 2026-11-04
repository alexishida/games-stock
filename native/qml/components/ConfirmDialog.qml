/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Confirmação interna reutilizada por exclusões e ações destrutivas. */
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import GameStock
import "."

DragDialog {
    id: confirm
    cornerRadius: 12
    panelBorder: Theme.borderStrong
    objectName: "confirmDialog"
    property string message: ""
    property string detail: ""
    property string confirmText: "Confirmar"
    property string error: ""
    property var target: null
    signal confirmed()

    /* O diálogo original ajusta a altura ao texto e usa uma caixa compacta de 320 px. */
    width: Math.min(320, parent.width - 48)
    height: Math.min(parent.height - 48, confirmContent.implicitHeight + 48)
    heading: "Confirmar"
    onClosed: error = ""

    ColumnLayout {
        id: confirmContent
        anchors.fill: parent
        spacing: 8
        UiText {
            objectName: "confirmMessage"
            text: confirm.message
            color: Theme.text
            font.pixelSize: 14
            textWeight: Font.Bold
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        UiText {
            objectName: "confirmDetail"
            visible: confirm.detail.length > 0
            text: confirm.detail
            color: Theme.secondary
            font.pixelSize: 12
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        UiText {
            objectName: "confirmError"
            visible: confirm.error.length > 0
            text: confirm.error
            color: "#ffb4ab"
            font.pixelSize: 12
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
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
