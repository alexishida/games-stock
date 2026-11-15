/* Verifica orientação e resolução das capas sem depender de imagens do usuário. */
import QtQuick
import QtTest
import "../../qml/components" as Components

Item {
    width: 300; height: 300
    Components.GameCard { id: card; width: 212; height: 260 }
    TestCase {
        name: "GameCardCover"
        when: windowShown

        function test_orientationAndSize() {
            const cover = findChild(card, "gameCardCoverImage")
            verify(cover !== null)
            card.coverSource = Qt.resolvedUrl("fixtures/capa-horizontal.svg")
            tryCompare(cover, "status", Image.Ready)
            tryCompare(cover, "landscape", true)
            compare(cover.fillMode, Image.PreserveAspectFit)
            verify(cover.sourceSize.width >= 260)
            card.coverSource = Qt.resolvedUrl("fixtures/capa-vertical.svg")
            tryCompare(cover, "status", Image.Ready)
            tryCompare(cover, "landscape", false)
            compare(cover.fillMode, Image.PreserveAspectCrop)
            verify(cover.implicitHeight > cover.implicitWidth)
        }

        /* O gradiente não pode voltar a usar camada/máscara e a sombra fica isolada do conteúdo. */
        function test_layerBudget() {
            const gradient = findChild(card, "libraryCardGradient")
            const shadow = findChild(card, "libraryCardShadow")
            verify(gradient !== null && shadow !== null)
            compare(gradient.layer.enabled, false)
            compare(shadow.layer.enabled, true)
            verify(findChild(card, "gradientMask") === null)
        }
    }
}
