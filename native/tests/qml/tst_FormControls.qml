/* Exercita seletores reais para evitar regressões de menu, teclado e modelos com textRole. */
import QtQuick
import QtQuick.Controls
import QtTest
import "../../qml/components" as Components

Item {
    width: 420
    height: 320
    /* O runner isolado carrega as mesmas variantes locais incorporadas no executável. */
    FontLoader { source: "../../assets/fonts/Inter-Regular.ttf" }
    FontLoader { source: "../../assets/fonts/Inter-Bold.ttf" }
    FontLoader { source: "../../assets/fonts/Inter-ExtraBold.ttf" }
    FontLoader { source: "../../assets/fonts/Inter-Black.ttf" }
    Components.FormSelect {
        id: select
        x: 20; y: 20; width: 240
        textRole: "name"
        valueRole: "id"
        model: [
            { id: 10, name: "Console" },
            { id: 20, name: "Plataforma com nome suficientemente longo para truncar" },
            { id: 30, name: "PC" }
        ]
    }
    Components.ActionButton {
        id: action
        x: 20; y: 80
        iconName: "save"
        text: "Salvar configurações"
    }
    Components.UiText {
        id: strongText
        x: 20; y: 130
        text: "Título da coleção"
        font.pixelSize: 22
        textWeight: Font.Black
    }
    /* Pesos fortes devem permanecer na família Inter, sem fallback para outra fonte. */
    Components.UiText {
        id: extraBoldText
        x: 20; y: 180
        text: "Rótulo da plataforma"
        font.pixelSize: 11
        textWeight: Font.ExtraBold
    }
    TestCase {
        name: "FormControls"
        when: windowShown

        /* Verifica a fonte efetiva para impedir fallback silencioso de Black para outra família. */
        function test_fontResolution() {
            if (Qt.platform.os !== "windows") skip("Referência tipográfica específica do Windows")
            compare(strongText.fontInfo.family, "Inter")
            compare(strongText.fontInfo.styleName, "Black")
            compare(extraBoldText.fontInfo.styleName, "ExtraBold")
        }

        /* A seleção deve manter os IDs, renderizar delegates e devolver foco ao fechar. */
        function test_selectKeyboardAndPopup() {
            select.currentIndex = 0
            select.forceActiveFocus()
            keyClick(Qt.Key_Down)
            compare(select.currentValue, 20)
            mouseClick(select)
            tryCompare(select.popup, "opened", true)
            tryVerify(function() { return select.popup.contentItem.count === 3 })
            /* ListView instancia os delegates no próximo polish, depois de abrir o popup. */
            tryVerify(function() { return select.popup.contentItem.itemAtIndex(2) !== null })
            const option = select.popup.contentItem.itemAtIndex(2)
            mouseClick(option)
            tryCompare(select.popup, "visible", false)
            compare(select.currentValue, 30)
            compare(select.displayText, "PC")
        }

        /* Texto longo e ícone devem caber no botão sem depender de largura fixa da tela. */
        function test_buttonContentFits() {
            const group = action.contentItem.children[0]
            verify(group.width <= action.availableWidth)
            verify(group.implicitWidth <= action.availableWidth)
            verify(group.height <= action.availableHeight)
        }
    }
}
