/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Campo de formulário com contraste, foco e dimensões do tema da aplicação. */
import QtQuick
import QtQuick.Controls
import GameStock

TextField {
    id: field
    implicitHeight: Theme.controlHeight
    padding: 8
    /* A borda CSS faz parte do padding externo; o texto permanece centrado a 34 px. */
    leftPadding: 9
    rightPadding: 9
    verticalAlignment: TextInput.AlignVCenter
    font.family: Theme.fontFamily
    font.pixelSize: Theme.formControlFontSize
    font.weight: Font.Normal
    /* A edição usa a mesma suavização dos rótulos, inclusive em escala fracionária. */
    renderType: TextInput.QtRendering
    antialiasing: true
    font.hintingPreference: Font.PreferNoHinting
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
