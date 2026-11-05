/* Texto com rasterização adequada à plataforma e métricas compartilhadas. */
import QtQuick
import GameStock

Text {
    /* O peso explícito mantém a variante correta da família sem alterar o tamanho em pixels. */
    property int textWeight: Font.Normal
    font.weight: Theme.cssFontWeight(textWeight)
    font.family: Theme.fontFamily
    /* Distance field em alta qualidade suaviza os glifos pequenos sem franjas coloridas. */
    renderType: Text.QtRendering
    renderTypeQuality: Text.HighRenderTypeQuality
    antialiasing: true
    font.hintingPreference: Font.PreferNoHinting
}
