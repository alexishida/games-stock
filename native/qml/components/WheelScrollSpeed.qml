/* Acelera a rolagem vertical da roda do mouse em um Flickable/ListView.

   O Qt rola 72 px por clique de roda (3 linhas × 24 px, padrão do Windows) e
   aplica uma animação de inércia. Aqui o deslocamento é aplicado de forma
   direta e multiplicado, mantendo o passo previsível e mais rápido sem
   alterar arraste, touch ou o comportamento da barra de rolagem. */
import QtQuick

WheelHandler {
    id: root

    /** Localiza a área rolável, pois o Flickable coloca o handler no contentItem.
        O ancestral mais próximo preserva a rolagem de listas dentro de painéis. */
    property var flickable: {
        let item = parent
        while (item) {
            if (item instanceof Flickable)
                return item
            item = item.parent
        }
        return null
    }
    /** Fator aplicado ao passo padrão do Qt e ao pixelDelta de touchpads. */
    property real speedMultiplier: 1.5

    acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
    orientation: Qt.Vertical
    blocking: true
    enabled: flickable !== null && flickable.interactive

    onWheel: function(event) {
        if (!root.flickable)
            return

        // Touchpads enviam deslocamento em pixels; a roda tradicional envia ângulos.
        const delta = event.pixelDelta.y !== 0
                ? event.pixelDelta.y * root.speedMultiplier
                : (event.angleDelta.y / 120) * 72 * root.speedMultiplier

        // contentY aceita valores fora dos limites, então o clamp é feito aqui.
        // ListView pode deslocar a origem após remover ou reutilizar delegates.
        const minY = root.flickable.originY - root.flickable.topMargin
        const maxY = Math.max(minY, root.flickable.originY + root.flickable.contentHeight
                              - root.flickable.height + root.flickable.bottomMargin)
        root.flickable.cancelFlick()
        root.flickable.contentY = Math.max(minY, Math.min(maxY, root.flickable.contentY - delta))
    }
}
