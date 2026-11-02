/* Campo de formulário com contraste, foco e dimensões do tema da aplicação. */
import QtQuick
import QtQuick.Controls
import GameStock

TextField {
    id: field
    implicitHeight: Theme.controlHeight
    padding: 8
    font.family: Theme.fontFamily
    font.pixelSize: Theme.formControlFontSize
    color: Theme.text
    placeholderTextColor: Theme.muted
    selectByMouse: true
    background: Rectangle {
        radius: 6
        color: Theme.control
        border.color: field.activeFocus ? Theme.accent : Theme.border
        opacity: field.enabled ? 1 : 0.45
    }
}
