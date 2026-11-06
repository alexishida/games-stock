/* Acelera a rolagem vertical da roda do mouse em um Flickable/ListView.

   O Qt rola 72 px por clique de roda (3 linhas × 24 px, padrão do Windows) e
   aplica uma animação de inércia. Aqui o deslocamento é aplicado de forma
   direta e multiplicado, mantendo o passo previsível e mais rápido sem
   alterar arraste, touch ou o comportamento da barra de rolagem. */
import QtQuick

WheelHandler {
    id: root

    /** Flickable rolado pelo handler; por padrão é o item pai. O tipo é `var`
        para o qmllint não acusar o `parent` genérico como Flickable. */
    property var flickable: parent
    /** Fator aplicado ao passo padrão do Qt e ao pixelDelta de touchpads. */
    property real speedMultiplier: 1.5

    acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
    orientation: Qt.Vertical
    blocking: true

    onWheel: function(event) {
        if (!root.flickable)
            return

        // Touchpads enviam deslocamento em pixels; a roda tradicional envia ângulos.
        const delta = event.pixelDelta.y !== 0
                ? event.pixelDelta.y * root.speedMultiplier
                : (event.angleDelta.y / 120) * 72 * root.speedMultiplier

        // contentY aceita valores fora dos limites, então o clamp é feito aqui.
        const maxY = Math.max(0, root.flickable.contentHeight - root.flickable.height)
        root.flickable.contentY = Math.max(0, Math.min(maxY, root.flickable.contentY - delta))
    }
}
