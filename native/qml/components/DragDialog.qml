/* Overlay interno com limites de arraste; controles filhos mantêm seus próprios eventos. */
import QtQuick
import QtQuick.Controls
import QtQuick.Effects
import GameStock

Popup {
    id: dialog
    property string heading: ""
    property bool backdropBlurEnabled: true
    /* Limite do MultiEffect para a sombra do painel; diagnóstico permite medir o perfil. */
    property int modalShadowBlurMax: Theme.shadowModalBlurMax
    /* O fundo é desfocado na própria superfície; o overlay apenas escurece e hospeda o painel. */
    signal backdropBlurRequested(bool active)
    /* Outros diálogos empilhados reduzem o escurecimento como no CSS. */
    readonly property bool stacked: stackDepth > 0
    readonly property int stackDepth: {
        if (!Overlay.overlay) return 0
        let depth = 0
        const siblings = Overlay.overlay.children
        for (let index = 0; index < siblings.length; ++index) {
            const item = siblings[index]
            if (item && item !== dialog && item.isDragDialog === true && item.visible) ++depth
        }
        return depth
    }
    /* Marca a instância para o cálculo de camada; Popup comum não deve contar. */
    readonly property bool isDragDialog: true
    property real offsetX: 0
    property real offsetY: 0
    parent: Overlay.overlay
    modal: true
    focus: true
    width: Math.min(600, parent.width - 48)
    height: Math.min(400, parent.height - 48)
    x: Math.max(0, Math.min(parent.width - width, (parent.width - width) / 2 + offsetX))
    y: Math.max(0, Math.min(parent.height - height, (parent.height - height) / 2 + offsetY))
    padding: 24
    closePolicy: Popup.CloseOnEscape
    onOpened: {
        offsetX = 0
        offsetY = 0
        if (backdropBlurEnabled) dialog.backdropBlurRequested(true)
    }
    onClosed: {
        // A camada só é liberada quando nenhum outro diálogo ainda depende dela.
        dialog.backdropBlurRequested(false)
    }
    Overlay.modal: Rectangle {
        color: dialog.stacked ? Theme.stackedScrim : Theme.scrim
    }
    background: Rectangle {
        color: Theme.panel
        radius: 16
        border.color: Theme.border
        /* A sombra usa o mesmo token do CSS e mantém o painel fora do desfoque. */
        layer.enabled: true
        layer.effect: MultiEffect {
            shadowEnabled: true
            shadowColor: Theme.shadowModalColor
            blurMax: dialog.modalShadowBlurMax
            shadowBlur: 1.0
            shadowHorizontalOffset: 0
            shadowVerticalOffset: Theme.shadowModalOffsetY
            autoPaddingEnabled: true
        }
    }
    /* O handler observa o conteúdo; não toma o grab de controles interativos. */
    DragHandler {
        parent: dialog.contentItem
        target: null
        acceptedButtons: Qt.LeftButton
        grabPermissions: PointerHandler.TakeOverForbidden
        property real startX: 0
        property real startY: 0
        onActiveChanged: if (active) { startX = dialog.offsetX; startY = dialog.offsetY }
        onTranslationChanged: if (active) {
            dialog.offsetX = startX + translation.x
            dialog.offsetY = startY + translation.y
        }
    }
}
