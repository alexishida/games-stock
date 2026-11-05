/* Texto com rasterização adequada à plataforma e métricas compartilhadas. */
import QtQuick
import GameStock

Text {
    /* O peso explícito mantém a variante correta da família sem alterar o tamanho em pixels. */
    property int textWeight: Font.Normal
    font.weight: Theme.cssFontWeight(textWeight)
    font.family: Theme.fontFamily
    /* QtRendering usa o rasterizador da plataforma com antialiasing em tons de cinza. */
    /* O distance field (renderTypeQuality) e o no-hinting deixavam os glifos serrilhados em 100%. */
    renderType: Text.QtRendering
    antialiasing: true
}
