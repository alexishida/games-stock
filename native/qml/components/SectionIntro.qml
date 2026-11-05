/* Introdução de seção com as métricas efetivas de SectionIntro.css do Electron. */
import QtQuick
import QtQuick.Layouts
import GameStock

ColumnLayout {
    property alias title: titleText.text
    property alias description: descriptionText.text
    property int bottomGap: 12
    spacing: 4
    UiText {
        id: titleText
        Layout.fillWidth: true
        color: Theme.accent
        font.pixelSize: 16
        textWeight: Font.ExtraBold
        lineHeightMode: Text.FixedHeight
        lineHeight: 19.2
        /* A caixa CSS segue line-height, sem a entrelinha implícita adicional do Qt. */
        Layout.preferredHeight: 19.2
        verticalAlignment: Text.AlignVCenter
    }
    UiText {
        id: descriptionText
        Layout.fillWidth: true
        Layout.bottomMargin: parent.bottomGap
        color: Theme.text
        font.pixelSize: 13
        lineHeightMode: Text.FixedHeight
        lineHeight: 18.85
        wrapMode: Text.WordWrap
    }
}
