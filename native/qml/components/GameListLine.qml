/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Cabeçalho e linha tabular do protótipo, com medidas da lista Electron. */
import QtQuick
import QtQuick.Controls
import GameStock

AbstractButton {
    id: line
    property bool header: false
    property var game: ({})
    readonly property real flexible: Math.max(0, width - 20 - 60 - 52 - 64 - 36 - 70)
    /* Distribui os fr depois de reservar os minimos, inclusive em janelas largas. */
    readonly property var columnWidths: {
        const minimums = [160, 90, 110, 110]
        const weights = [1.5, 1, 1, 1]
        const result = [0, 0, 0, 0]
        let space = Math.max(470, flexible)
        let weight = 4.5
        const fixed = [false, false, false, false]
        for (let pass = 0; pass < 4; pass++) {
            let changed = false
            for (let i = 0; i < 4; i++) {
                if (!fixed[i] && space / weight * weights[i] < minimums[i]) {
                    result[i] = minimums[i]
                    space -= minimums[i]
                    weight -= weights[i]
                    fixed[i] = true
                    changed = true
                }
            }
            if (!changed) break
        }
        for (let i = 0; i < 4; i++) if (!fixed[i]) result[i] = space / weight * weights[i]
        return result
    }
    implicitHeight: header ? 32 : 54
    hoverEnabled: !header
    enabled: !header
    Accessible.name: header ? "Cabeçalho da lista" : (game.title || "Jogo")
    background: Rectangle {
        radius: 6
        color: !line.header && (line.hovered || line.activeFocus) ? Theme.accentSoft : "transparent"
        border.width: line.activeFocus && !line.header ? 1 : 0
        border.color: Theme.accent
    }
    contentItem: Row {
        spacing: 10
        leftPadding: 10
        rightPadding: 10
        Rectangle {
            width: 60; height: line.height; color: "transparent"
            Rectangle {
                visible: !line.header
                /* Capas horizontais mantêm a proporção prevista na lista legada. */
                readonly property bool landscape: thumbnail.status === Image.Ready && thumbnail.sourceSize.width > thumbnail.sourceSize.height
                width: landscape ? 54 : 32; height: landscape ? 36 : 42; radius: 4; anchors.verticalCenter: parent.verticalCenter
                color: Theme.card; clip: true
                Image { id: thumbnail; anchors.fill: parent; source: line.game.coverUrl || ""; fillMode: Image.PreserveAspectCrop; asynchronous: true; visible: source.toString().length > 0 }
                Image { anchors.centerIn: parent; source: "qrc:/icons/gamepad-2.svg"; sourceSize: Qt.size(22, 22); visible: !line.game.coverUrl }
            }
        }
        /* O título herda 16 px no renderer; as demais colunas usam 13 px. */
        UiText { width: line.columnWidths[0]; height: line.height; verticalAlignment: Text.AlignVCenter; elide: Text.ElideRight; text: line.header ? "Título" : (line.game.title || ""); color: line.header ? Theme.secondary : Theme.text; font.pixelSize: line.header ? 12 : 16; textWeight: line.header ? Font.ExtraBold : Font.Normal }
        UiText { width: line.columnWidths[1]; height: line.height; verticalAlignment: Text.AlignVCenter; elide: Text.ElideRight; text: line.header ? "Plataforma" : (line.game.platform_name || "—"); color: Theme.secondary; font.pixelSize: line.header ? 12 : 13; textWeight: line.header ? Font.ExtraBold : Font.Normal }
        UiText { width: line.columnWidths[2]; height: line.height; verticalAlignment: Text.AlignVCenter; elide: Text.ElideRight; text: line.header ? "Estilo" : (line.game.genre || "—"); color: Theme.secondary; font.pixelSize: line.header ? 12 : 13; textWeight: line.header ? Font.ExtraBold : Font.Normal }
        UiText { width: line.columnWidths[3]; height: line.height; verticalAlignment: Text.AlignVCenter; elide: Text.ElideRight; text: line.header ? "Publisher" : (line.game.publisher || "—"); color: Theme.secondary; font.pixelSize: line.header ? 12 : 13; textWeight: line.header ? Font.ExtraBold : Font.Normal }
        UiText { width: 52; height: line.height; verticalAlignment: Text.AlignVCenter; text: line.header ? "Ano" : (line.game.year || "—"); color: Theme.secondary; font.pixelSize: line.header ? 12 : 13; textWeight: line.header ? Font.ExtraBold : Font.Normal }
        Item {
            width: 64; height: line.height
            Row {
                anchors.verticalCenter: parent.verticalCenter
                spacing: 5
                Image { visible: !line.header && !!line.game.favorite; source: "qrc:/icons/star-favorite.svg"; sourceSize: Qt.size(13, 13) }
                Image { visible: !line.header && line.game.play_status === "playing"; source: "qrc:/icons/gamepad-playing.svg"; sourceSize: Qt.size(13, 13) }
                Image { visible: !line.header && line.game.play_status === "completed"; source: "qrc:/icons/trophy-completed.svg"; sourceSize: Qt.size(13, 13) }
            }
        }
        Item { width: 36; height: line.height }
    }
}
