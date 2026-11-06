/* Verifica que respostas assíncronas antigas não substituem o jogo atual. */
import QtQuick
import QtTest
import "../../qml/components" as Ui
Item {
    width: 1024; height: 768
    QtObject {
        id: service
        property int nextRequest: 0
        signal detailLoaded(var request, var result)
        function loadDetail(id) { return ++nextRequest }
    }
    Ui.GameDetailPage { id: detail; anchors.fill: parent; gameService: service; serviceMode: true }
    TestCase {
        name: "GameDetailAsync"; when: windowShown
        function test_staleResponse() {
            detail.libraryGame = {id: 1, title: "Primeiro"}
            const first = detail.detailRequest
            detail.libraryGame = {id: 2, title: "Segundo"}
            const second = detail.detailRequest
            verify(first !== second)
            compare(detail.detailLoading, true)
            service.detailLoaded(first, {game: {id: 1, title: "Primeiro"}, versions: [], media: []})
            compare(detail.detailLoading, true)
            service.detailLoaded(second, {game: {id: 2, title: "Segundo"}, versions: [], media: []})
            compare(detail.game.id, 2)
            compare(detail.detailLoading, false)
        }
        function test_errorKeepsSelectedGame() {
            detail.libraryGame = {id: 3, title: "Terceiro"}
            service.detailLoaded(detail.detailRequest, {error: "Falha de leitura"})
            compare(detail.game.id, 3)
            compare(detail.actionError, "Falha de leitura")
            compare(detail.detailLoading, false)
        }
    }
}
