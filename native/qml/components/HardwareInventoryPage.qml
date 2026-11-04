/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Tela do inventário: topo fixo, cards/lista paginados, detalhe e formulário. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Effects
import GameStock
import "."

Item {
    id: page
    objectName: "hardwareInventoryPage"
    property var inventoryService: null
    property var preferences: null
    property var platforms: []
    property bool blurEnabled: true
    property int shadowBlurMax: Theme.shadowElevatedBlurMax
    property int modalShadowBlurMax: Theme.shadowModalBlurMax
    property var selectedItem: null
    property var formItem: null
    readonly property bool listMode: preferences ? preferences.viewMode === "list" : false
    readonly property bool serviceMode: inventoryService !== null && inventoryService !== undefined && inventoryService.available === true
    readonly property int pageSize: 36
    readonly property int currentPage: page.serviceMode ? inventoryService.page : 1
    readonly property int filteredCount: page.serviceMode ? inventoryService.filtered : 0

    signal backdropBlurRequested(bool active)
    signal itemSelected(var item)

    function nextSort(current) {
        return current === "name" ? "type" : current === "type" ? "recent" : "name"
    }

    function sortTitle(current) {
        return current === "name" ? "Ordenar por tipo" : current === "type" ? "Ordenar por recentes" : "Ordenar por nome"
    }

    /** Abre o formulário em modo criação; a sidebar usa esta função. */
    function openCreate() {
        if (!serviceMode) return
        formItem = null
        form.open()
    }

    /** Expõe a criação inline de tipo para a captura visual e para o formulário. */
    function showTypeInline() {
        form.showTypeInline()
    }

    /** Abre a edição de um item sem depender do clique no detalhe. */
    function openEdit(item) {
        if (!item) return
        formItem = item
        form.open()
    }

    /** Abre a confirmação de exclusão do item selecionado. */
    function openDelete(item) {
        if (!item) return
        deleteConfirm.message = "Deletar \"" + (item.name || "") + "\"?"
        deleteConfirm.detail = "Esta ação removerá o item e todas as suas fotos permanentemente."
        deleteConfirm.confirmText = "Deletar"
        deleteConfirm.error = ""
        deleteConfirm.target = item
        deleteConfirm.open()
    }

    /** Abre o detalhe e recarrega a galeria pela fronteira do serviço. */
    function openItem(item) {
        if (!item) return
        selectedItem = item
        itemSelected(item)
        detail.reload()
    }

    function closeItem() {
        selectedItem = null
    }

    /** Confirma a exclusão somente depois de o serviço remover item e fotos. */
    function confirmDelete() {
        if (!serviceMode || !selectedItem) {
            deleteConfirm.close()
            return
        }
        if (!inventoryService.remove(Number(selectedItem.id))) {
            deleteConfirm.error = inventoryService.error
            return
        }
        selectedItem = null
        deleteConfirm.close()
    }

    Component.onCompleted: {
        if (!preferences || !serviceMode) return
        inventoryService.search = preferences.search
        inventoryService.sortBy = preferences.sortBy
        searchField.text = preferences.search
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        /* TopBar do inventário replica altura, busca e ações da biblioteca. */
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 52
            color: "#e0131313"
            layer.enabled: true
            layer.effect: MultiEffect {
                shadowEnabled: true
                blurMax: Theme.shadowTopbarBlurMax
                shadowColor: Theme.shadowTopbarColor
                shadowBlur: 1.0
                shadowHorizontalOffset: 0
                shadowVerticalOffset: Theme.shadowTopbarOffsetY
                autoPaddingEnabled: true
            }
            Rectangle { anchors.bottom: parent.bottom; height: 1; width: parent.width; color: Theme.border }

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: 20
                anchors.rightMargin: 20
                spacing: 12
                FormField {
                    id: searchField
                    objectName: "inventorySearch"
                    Layout.fillWidth: true
                    Layout.maximumWidth: 480
                    Layout.preferredHeight: Theme.controlHeight
                    placeholderText: "Buscar inventário"
                    enabled: page.serviceMode
                    onTextChanged: if (page.serviceMode) inventorySearchDelay.restart()
                    leftPadding: 36
                    rightPadding: 36
                    Image { x: 10; anchors.verticalCenter: parent.verticalCenter; source: "qrc:/icons/search.svg"; sourceSize: Qt.size(16, 16) }
                    ToolButton {
                        anchors.right: parent.right
                        anchors.rightMargin: 6
                        anchors.verticalCenter: parent.verticalCenter
                        width: 24; height: 24
                        padding: 4
                        visible: searchField.text.length > 0
                        Accessible.name: "Limpar busca"
                        background: Rectangle { radius: 4; color: parent.hovered ? Theme.controlHover : "transparent" }
                        contentItem: Image { source: "qrc:/icons/x.svg"; sourceSize: Qt.size(16, 16); fillMode: Image.PreserveAspectFit }
                        onClicked: {
                            searchField.clear()
                            inventorySearchDelay.stop()
                            page.applySearch("")
                            searchField.forceActiveFocus()
                        }
                    }
                }
                Timer {
                    id: inventorySearchDelay
                    interval: 300
                    repeat: false
                    onTriggered: page.applySearch(searchField.text)
                }
                Item { Layout.fillWidth: true; Layout.minimumWidth: 0 }
                RowLayout {
                    visible: page.selectedItem === null
                    spacing: 6
                    ActionButton {
                        objectName: "inventorySort"
                        iconName: "arrow-up-down"
                        toolbar: true
                        enabled: page.serviceMode
                        Accessible.name: page.sortTitle(page.preferences ? page.preferences.sortBy : "name")
                        onClicked: page.cycleSort()
                    }
                    RowLayout {
                        spacing: 3
                        ActionButton {
                            objectName: "inventoryGridView"
                            iconName: "grid-2x2"
                            toolbar: true
                            primary: !page.listMode
                            Accessible.name: "Cards"
                            onClicked: if (page.preferences) page.preferences.viewMode = "grid"
                        }
                        ActionButton {
                            objectName: "inventoryListView"
                            iconName: "list"
                            toolbar: true
                            primary: page.listMode
                            Accessible.name: "Lista"
                            onClicked: if (page.preferences) page.preferences.viewMode = "list"
                        }
                    }
                }
                UiText {
                    visible: page.selectedItem === null
                    text: page.serviceMode ? "Exibindo " + inventoryService.filtered + " de " + inventoryService.total + " itens" : "Inventário indisponível"
                    color: Theme.secondary
                    font.pixelSize: 11
                    textWeight: Font.Bold
                }
            }
        }

        /* Detalhe substitui a coleção; a busca continua fixa acima. */
        HardwareItemDetailPage {
            id: detail
            visible: page.selectedItem !== null
            Layout.fillWidth: true
            Layout.fillHeight: true
            inventoryService: page.inventoryService
            item: page.selectedItem
            items: page.serviceMode ? inventoryService.items : []
            onCloseRequested: page.closeItem()
            onEditRequested: function(item) { page.formItem = item; page.form.open() }
            onDeleteRequested: function(item) {
                page.selectedItem = item
                deleteConfirm.message = "Deletar \"" + (item ? item.name : "") + "\"?"
                deleteConfirm.detail = "Esta ação removerá o item e todas as suas fotos permanentemente."
                deleteConfirm.confirmText = "Deletar"
                deleteConfirm.error = ""
                deleteConfirm.target = item
                deleteConfirm.open()
            }
            onNavigateRequested: function(item) { page.openItem(item) }
        }

        Item {
            visible: page.selectedItem === null
            Layout.fillWidth: true
            Layout.fillHeight: true

            ColumnLayout {
                anchors.fill: parent
                anchors.leftMargin: 16
                anchors.rightMargin: 16
                anchors.topMargin: 12
                anchors.bottomMargin: 16
                spacing: 16

                /* Grade de cards com a mesma largura do renderer atual. */
                Flickable {
                    id: gridScroll
                    visible: !page.listMode && page.serviceMode && inventoryService.items.length > 0
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    contentWidth: width
                    contentHeight: gridFlow.height + 8
                    clip: true
                    boundsBehavior: Flickable.StopAtBounds
                    ScrollBar.vertical: CollectionScrollBar {
                        policy: ScrollBar.AsNeeded
                        width: 6
                        background: Rectangle { implicitWidth: 6; color: Theme.background }
                        contentItem: Rectangle { implicitWidth: 6; radius: 3; color: parent.pressed ? Theme.borderStrong : Theme.elevated }
                    }
                    Flow {
                        id: gridFlow
                        readonly property real cardWidth: 180
                        readonly property real gap: 16
                        readonly property int columns: Math.max(1, Math.floor((parent.width - 8 + gap) / (cardWidth + gap)))
                        width: columns * cardWidth + (columns - 1) * gap
                        x: 4
                        y: 2
                        spacing: gap
                        Repeater {
                            model: page.serviceMode ? inventoryService.items : []
                            delegate: HardwareItemCard {
                                required property var modelData
                                objectName: "hardwareItemCard"
                                width: gridFlow.cardWidth
                                item: modelData
                                onClicked: page.openItem(modelData)
                            }
                        }
                    }
                }

                /* Lista tabular com as mesmas colunas do renderer. */
                ColumnLayout {
                    visible: page.listMode && page.serviceMode && inventoryService.items.length > 0
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    spacing: 0
                    InventoryListLine { header: true; Layout.fillWidth: true }
                    ListView {
                        id: inventoryList
                        Layout.fillWidth: true
                        Layout.fillHeight: true
                        clip: true
                        model: page.serviceMode ? inventoryService.items : []
                        delegate: InventoryListLine {
                            required property var modelData
                            width: ListView.view.width
                            item: modelData
                            onClicked: page.openItem(modelData)
                        }
                    }
                }

                /* Estado vazio equivalente ao do módulo Electron. */
                Item {
                    visible: page.serviceMode && inventoryService.items.length === 0
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    ColumnLayout {
                        anchors.centerIn: parent
                        spacing: 8
                        UiText { Layout.alignment: Qt.AlignHCenter; text: "Nenhum item encontrado"; color: Theme.text; font.pixelSize: 16; textWeight: Font.Medium }
                        UiText { Layout.alignment: Qt.AlignHCenter; text: "Ajuste os filtros ou adicione itens ao inventário."; color: Theme.secondary; font.pixelSize: 13 }
                    }
                }

                UiText {
                    objectName: "inventoryError"
                    visible: page.serviceMode && inventoryService.error.length > 0
                    text: page.serviceMode ? inventoryService.error : ""
                    color: "#ffb4ab"
                    font.pixelSize: 12
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }

                /* Paginação de 36 itens, igual aos cards e à lista. */
                RowLayout {
                    visible: page.serviceMode && page.filteredCount > page.pageSize
                    Layout.alignment: Qt.AlignHCenter
                    spacing: 12
                    UiText {
                        text: ((page.currentPage - 1) * page.pageSize + 1) + "–"
                            + Math.min(page.currentPage * page.pageSize, page.filteredCount)
                            + " de " + page.filteredCount
                        color: Theme.secondary
                        font.pixelSize: 12
                        Layout.minimumWidth: 100
                        horizontalAlignment: Text.AlignRight
                    }
                    RowLayout {
                        spacing: 4
                        ActionButton { objectName: "firstInventoryPage"; iconName: "chevrons-left"; pagination: true; enabled: page.currentPage > 1; Accessible.name: "Primeira página"; onClicked: page.goToPage(1) }
                        ActionButton { objectName: "previousInventoryPage"; iconName: "chevron-left"; pagination: true; enabled: page.currentPage > 1; Accessible.name: "Página anterior"; onClicked: page.goToPage(page.currentPage - 1) }
                        UiText { text: page.currentPage + " / " + Math.ceil(page.filteredCount / page.pageSize); color: Theme.text; font.pixelSize: 13; Layout.minimumWidth: 56; horizontalAlignment: Text.AlignHCenter }
                        ActionButton { objectName: "nextInventoryPage"; iconName: "chevron-right"; pagination: true; enabled: page.currentPage * page.pageSize < page.filteredCount; Accessible.name: "Próxima página"; onClicked: page.goToPage(page.currentPage + 1) }
                        ActionButton { objectName: "lastInventoryPage"; iconName: "chevrons-right"; pagination: true; enabled: page.currentPage * page.pageSize < page.filteredCount; Accessible.name: "Última página"; onClicked: page.goToPage(Math.ceil(page.filteredCount / page.pageSize)) }
                    }
                }
            }
        }
    }

    /** Aplica a busca ao serviço e preserva a preferência independente. */
    function applySearch(value) {
        if (!page.serviceMode) return
        inventoryService.search = value
        if (page.preferences) page.preferences.search = value
    }

    /** Ciclo nome → tipo → recentes, como a TopBar do inventário. */
    function cycleSort() {
        if (!page.serviceMode) return
        const next = page.nextSort(inventoryService.sortBy)
        inventoryService.sortBy = next
        if (page.preferences) page.preferences.sortBy = next
    }

    /** Troca a página e devolve as duas visualizações ao topo. */
    function goToPage(target) {
        if (!page.serviceMode) return
        inventoryService.goToPage(target)
        gridScroll.contentY = 0
        inventoryList.positionViewAtBeginning()
    }

    HardwareItemFormDialog {
        id: form
        inventoryService: page.inventoryService
        platforms: page.platforms
        editingItem: page.formItem
        backdropBlurEnabled: page.blurEnabled
        modalShadowBlurMax: page.modalShadowBlurMax
        onBackdropBlurRequested: function(active) { page.backdropBlurRequested(active) }
        onClosed: page.formItem = null
        onSaved: function(item) { page.openItem(item) }
    }

    ConfirmDialog {
        id: deleteConfirm
        objectName: "hardwareDeleteConfirm"
        backdropBlurEnabled: page.blurEnabled
        modalShadowBlurMax: page.modalShadowBlurMax
        onBackdropBlurRequested: function(active) { page.backdropBlurRequested(active) }
        onConfirmed: page.confirmDelete()
    }
}
