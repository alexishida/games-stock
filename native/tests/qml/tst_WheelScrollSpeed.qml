/* Exercita eventos reais de roda para preservar a rolagem dos painéis e coleções. */
import QtQuick
import QtTest
import "../../qml/components" as Components

Item {
    width: 400
    height: 300
    Flickable {
        id: panel
        width: 180; height: 200
        contentWidth: width; contentHeight: 1000
        clip: true
        Components.WheelScrollSpeed { id: panelWheel }
        Rectangle { width: 180; height: 1000; color: "gray" }
    }
    ListView {
        id: list
        x: 200; width: 180; height: 200
        clip: true
        model: 40
        delegate: Rectangle { width: 180; height: 40; color: "gray" }
        Components.WheelScrollSpeed {}
    }
    TestCase {
        name: "WheelScrollSpeed"
        when: windowShown

        function init() {
            panel.contentY = 0
            list.positionViewAtBeginning()
        }

        function test_panel_wheel() {
            mouseWheel(panel, 90, 100, 0, -120)
            tryVerify(function() { return panel.contentY > 0 })
            verify(isFinite(panel.contentY))
            mouseWheel(panel, 90, 100, 0, 120)
            tryCompare(panel, "contentY", 0)
        }

        function test_list_wheel() {
            mouseWheel(list, 90, 100, 0, -120)
            tryVerify(function() { return list.contentY > 0 })
        }
    }
}
