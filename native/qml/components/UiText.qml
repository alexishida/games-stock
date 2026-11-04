/* Texto com suavização por distance field e métricas da referência Electron. */
import QtQuick
import GameStock

Text {
    /* O peso explícito mantém a variante correta da família sem alterar o tamanho em pixels. */
    property int textWeight: Font.Normal
    font.weight: Theme.cssFontWeight(textWeight)
    font.family: Theme.fontFamily
    /* A rasterização nativa deixou traços pequenos irregulares; Qt mantém cobertura subpixel. */
    renderType: Text.QtRendering
    renderTypeQuality: Text.HighRenderTypeQuality
    antialiasing: true
    font.hintingPreference: Font.PreferNoHinting
}
