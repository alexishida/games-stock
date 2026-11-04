/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Overlay interno com limites de arraste; controles filhos mantêm seus próprios eventos. */
import QtQuick
import QtQuick.Controls
import QtQuick.Effects
import GameStock

Popup {
    id: dialog
    property string heading: ""
    /* Formulários simples compartilham cabeçalho; telas com cabeçalho próprio não o duplicam. */
    property bool showHeading: false
    /* Variantes do renderer compartilham interação e escolhem apenas a superfície do painel. */
    property int cornerRadius: showHeading ? 12 : 16
    property color panelColor: Theme.panel
    property color panelBorder: showHeading ? Theme.borderStrong : Theme.border
    /* Formulários secundários do Electron usam scrim 0.68; pilhas genéricas mantêm 0.46. */
    property color secondaryScrim: showHeading ? Theme.scrim : Theme.stackedScrim
    property bool backdropBlurEnabled: true
    /* Limite do MultiEffect para a sombra do painel; diagnóstico permite medir o perfil. */
    property int modalShadowBlurMax: Theme.shadowModalBlurMax
    /* O fundo é desfocado na própria superfície; o overlay apenas escurece e hospeda o painel. */
    signal backdropBlurRequested(bool active)
    /* Outros diálogos empilhados reduzem o escurecimento como no CSS. */
    readonly property bool stacked: openedDepth > 0
    /* A profundidade é registrada antes de abrir: filhos do Overlay são PopupItems, não Popups. */
    property int openedDepth: 0
    readonly property var hostWindow: parent ? parent.Window.window : null
    readonly property bool covered: hostWindow && hostWindow.blurDepth > openedDepth + 1
    contentItem.layer.enabled: covered
    contentItem.layer.effect: MultiEffect { blurEnabled: true; blur: 1; blurMax: Theme.stackedBackdropBlurMax; autoPaddingEnabled: false }
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
    /* Header de 26 px seguido pelo gap de título de 28 px do management-modal. */
    topPadding: showHeading ? padding + 26 + Theme.modalTitleGap : padding
    closePolicy: Popup.CloseOnEscape
    onOpened: {
        offsetX = 0
        offsetY = 0
        openedDepth = hostWindow ? hostWindow.blurDepth : 0
        if (backdropBlurEnabled) dialog.backdropBlurRequested(true)
    }
    onClosed: {
        // A camada só é liberada quando nenhum outro diálogo ainda depende dela.
        dialog.backdropBlurRequested(false)
    }
    Overlay.modal: Rectangle {
        color: dialog.stacked ? dialog.secondaryScrim : Theme.scrim
    }
    background: Rectangle {
        color: dialog.panelColor
        radius: dialog.cornerRadius
        border.color: dialog.panelBorder
        UiText {
            visible: dialog.showHeading
            x: dialog.padding; y: dialog.padding
            width: parent.width - dialog.padding * 2 - 40
            text: dialog.heading
            color: Theme.text; font.family: Theme.fontFamily; font.pixelSize: 22; textWeight: Font.Black
            elide: Text.ElideRight
        }
        ActionButton {
            visible: dialog.showHeading
            x: parent.width - width - dialog.padding; y: dialog.padding
            iconName: "x-danger"; toolbar: true; dangerOutline: true
            Accessible.name: "Fechar"
            onClicked: dialog.close()
        }
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
