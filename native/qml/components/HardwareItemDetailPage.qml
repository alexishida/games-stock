/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Composicao do hero e paineis laterais segue HardwareItemDetail.css. */
/* Detalhe do item físico: hero com foto, chips, dados, galeria e lightbox. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Effects
import QtQuick.Dialogs
import GameStock

Item {
    id: detail
    objectName: "hardwareItemDetail"
    property var inventoryService: null
    property var item: null
    property var items: []
    property var photos: []
    property int lightboxIndex: -1
    signal closeRequested()
    signal editRequested(var item)
    signal deleteRequested(var item)
    signal navigateRequested(var item)

    /** Recarrega a galeria quando o item exibido muda ou é editado. */
    function reload() {
        lightboxIndex = -1
        photos = inventoryService && item && item.id ? inventoryService.listPhotos(Number(item.id)) : []
    }

    onItemChanged: reload()

    readonly property var mainPhoto: photos.length > 0 ? photos[0] : null
    readonly property string heroUrl: mainPhoto ? (mainPhoto.fileUrl || "") : ""
    readonly property int currentIndex: {
        for (let index = 0; index < items.length; index++) {
            if (items[index].id === (item ? item.id : -1)) return index
        }
        return -1
    }

    /** Formata valor monetário; ausência vira texto neutro. */
    function formatCurrency(value) {
        if (value === null || value === undefined || value === "") return null
        return "R$ " + Qt.locale("pt_BR").toString(Number(value), "f", 2)
    }

    /** Data ISO sem deslocamento de fuso. */
    function formatDate(value) {
        if (!value) return null
        const parts = String(value).split("-")
        return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : String(value)
    }

    /** Rótulo curto do host para a origem da aquisição. */
    function formatUrlLabel(value) {
        if (!value) return null
        const match = String(value).match(/^https?:\/\/([^/]+)/)
        return match ? match[1].replace(/^www\./, "") : String(value)
    }

    component DetailRow: RowLayout {
        Layout.topMargin: 8
        Layout.bottomMargin: 8
        property string label: ""
        property string value: ""
        Layout.fillWidth: true
        spacing: 12
        UiText { text: parent.label; color: Theme.muted; font.pixelSize: 12; Layout.preferredWidth: 112; elide: Text.ElideRight }
        UiText {
            Layout.fillWidth: true
            text: parent.value && parent.value.length ? parent.value : "Não informado"
            color: parent.value && parent.value.length ? Theme.text : Theme.muted
            font.pixelSize: 13
            font.italic: !parent.value || !parent.value.length
            opacity: parent.value && parent.value.length ? 1 : 0.68
            wrapMode: Text.WordWrap
        }
    }

    component SummaryItem: ColumnLayout {
        property string label: ""
        property string value: ""
        Layout.fillWidth: true
        spacing: 6
        UiText { text: parent.label; color: Theme.muted; font.pixelSize: 11; textWeight: Font.ExtraBold }
        UiText {
            Layout.fillWidth: true
            text: parent.value && parent.value.length ? parent.value : "Não informado"
            color: parent.value && parent.value.length ? Theme.text : Theme.muted
            font.pixelSize: 14
            textWeight: Font.Black
            font.italic: !parent.value || !parent.value.length
            opacity: parent.value && parent.value.length ? 1 : 0.68
            elide: Text.ElideRight
        }
    }

    Flickable {
        id: inventoryDetailViewport
        anchors.fill: parent
        contentWidth: width - (contentHeight > height ? 6 : 0)
        contentHeight: content.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        ScrollBar.vertical: CollectionScrollBar { policy: ScrollBar.AsNeeded }

        ColumnLayout {
            id: content
            width: inventoryDetailViewport.contentWidth
            spacing: 0

            Rectangle {
                id: hero
                Layout.fillWidth: true
                Layout.preferredHeight: 320
                clip: true
                color: Theme.background

                Image {
                    id: heroSource
                    anchors.fill: parent
                    source: detail.heroUrl
                    fillMode: Image.PreserveAspectCrop
                    visible: false
                }
                MultiEffect {
                    anchors.fill: parent
                    source: heroSource
                    visible: heroSource.status === Image.Ready
                    blurEnabled: true
                    blur: 0.9
                    blurMax: 32
                    saturation: -0.15
                    brightness: -0.3
                    autoPaddingEnabled: false
                }
                Rectangle {
                    anchors.fill: parent
                    visible: heroSource.status !== Image.Ready
                    gradient: Gradient {
                        GradientStop { position: 0.0; color: "#2400dbe7" }
                        GradientStop { position: 0.46; color: "transparent" }
                        GradientStop { position: 1.0; color: Theme.panel }
                    }
                }
                Rectangle {
                    anchors.fill: parent
                    gradient: Gradient {
                        GradientStop { position: 0.0; color: "#1e131313" }
                        GradientStop { position: 0.38; color: "#bf131313" }
                        GradientStop { position: 1.0; color: Theme.background }
                    }
                }
                Rectangle {
                    anchors.fill: parent
                    gradient: Gradient {
                        orientation: Gradient.Horizontal
                        GradientStop { position: 0.0; color: "#e0131313" }
                        GradientStop { position: 0.58; color: "transparent" }
                    }
                }

                /* Ações de navegação ficam sobre o hero, como no detalhe de referência. */
                RowLayout {
                    anchors.top: parent.top
                    anchors.right: parent.right
                    anchors.topMargin: 16
                    anchors.rightMargin: 20
                    spacing: 8
                    z: 2
                    ActionButton {
                        objectName: "backToInventory"
                        text: "Inventário"
                        iconName: "cpu"
                        onClicked: detail.closeRequested()
                    }
                    ActionButton {
                        iconName: "chevron-left"
                        visible: enabled
                        implicitWidth: 40
                        enabled: detail.currentIndex > 0
                        Accessible.name: "Item anterior"
                        onClicked: detail.navigateRequested(detail.items[detail.currentIndex - 1])
                    }
                    ActionButton {
                        iconName: "chevron-right"
                        visible: enabled
                        implicitWidth: 40
                        enabled: detail.currentIndex >= 0 && detail.currentIndex < detail.items.length - 1
                        Accessible.name: "Próximo item"
                        onClicked: detail.navigateRequested(detail.items[detail.currentIndex + 1])
                    }
                }

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 20
                    anchors.rightMargin: 20
                    anchors.topMargin: 52
                    anchors.bottomMargin: 20
                    spacing: 28

                    Rectangle {
                        Layout.preferredWidth: 320
                        Layout.preferredHeight: 200
                        Layout.alignment: Qt.AlignBottom
                        radius: 10
                        color: Theme.card
                        border.color: "#1fffffff"
                        clip: true
                        Image {
                            anchors.fill: parent
                            source: detail.heroUrl
                            fillMode: Image.PreserveAspectCrop
                            asynchronous: true
                        }
                        Image {
                            anchors.centerIn: parent
                            visible: heroSource.status !== Image.Ready
                            source: "qrc:/icons/cpu.svg"
                            sourceSize: Qt.size(38, 38)
                        }
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        Layout.alignment: Qt.AlignBottom
                        spacing: 10
                        RowLayout {
                            spacing: 8
                            Repeater {
                                model: detail.item
                                    ? [detail.item.platform_name, detail.item.item_type_name, detail.item.conservation_state_name].filter(function(value) { return String(value || "").length > 0 })
                                    : []
                                delegate: Rectangle {
                                    required property var modelData
                                    width: chipText.implicitWidth + 18
                                    height: 22
                                    radius: 999
                                    color: "#2400f2ff"
                                    border.color: "#4d00f2ff"
                                    UiText {
                                        id: chipText
                                        anchors.centerIn: parent
                                        text: String(modelData || "").toUpperCase()
                                        color: Theme.accent
                                        font.pixelSize: 10
                                        textWeight: Font.Black
                                    }
                                }
                            }
                        }
                        UiText {
                            Layout.fillWidth: true
                            text: detail.item ? (detail.item.name || "") : ""
                            color: Theme.text
                            font.pixelSize: 28
                            textWeight: Font.Black
                            wrapMode: Text.WordWrap
                        }
                    }
                        RowLayout {
                            spacing: 8
                            Layout.alignment: Qt.AlignBottom
                            Layout.bottomMargin: 8
                            ActionButton {
                                objectName: "addHardwarePhotoDetail"
                                iconName: "image"
                                implicitWidth: 38; implicitHeight: 38
                                Accessible.name: "Adicionar foto"
                                onClicked: photoDialog.open()
                            }
                            ActionButton {
                                objectName: "editHardwareItem"
                                iconName: "pencil"
                                implicitWidth: 38; implicitHeight: 38
                                Accessible.name: "Editar"
                                onClicked: detail.editRequested(detail.item)
                            }
                            ActionButton {
                                objectName: "deleteHardwareItem"
                                iconName: "trash-2-danger"
                                dangerOutline: true
                                implicitWidth: 38; implicitHeight: 38
                                Accessible.name: "Deletar"
                                onClicked: detail.deleteRequested(detail.item)
                            }
                        }
                }
            }

            GridLayout {
                Layout.fillWidth: true
                Layout.leftMargin: 24
                Layout.rightMargin: 24
                Layout.bottomMargin: 48
                Layout.topMargin: 20
                id: detailPanels
                columns: detail.width < 680 ? 1 : 2
                columnSpacing: 16
                rowSpacing: 16
                Layout.alignment: Qt.AlignTop

                Rectangle {
                    /* Larguras derivadas do viewport evitam a autorreferência nas restrições do grid. */
                    readonly property real panelWidth: detailPanels.columns === 1 ? inventoryDetailViewport.contentWidth - 48 : inventoryDetailViewport.contentWidth - 384
                    objectName: "hardwareInfoPanel"
                    Layout.fillWidth: false
                    Layout.alignment: Qt.AlignTop
                    Layout.minimumWidth: panelWidth
                    Layout.preferredWidth: panelWidth
                    Layout.maximumWidth: panelWidth
                    implicitHeight: infoColumn.implicitHeight + 32
                    radius: 16
                    color: "#dc201f1f"
                    border.color: Theme.border

                    ColumnLayout {
                        id: infoColumn
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 16

                        UiText { text: "Dados do item"; color: Theme.text; font.pixelSize: 18; textWeight: Font.Bold }

                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 12
                        SummaryItem { label: "Plataforma"; value: detail.item ? (detail.item.platform_name || "") : "" }
                        Rectangle { Layout.preferredWidth: 1; Layout.fillHeight: true; color: Theme.border }
                        SummaryItem { label: "Tipo"; value: detail.item ? (detail.item.item_type_name || "") : "" }
                        Rectangle { Layout.preferredWidth: 1; Layout.fillHeight: true; color: Theme.border }
                        SummaryItem { label: "Condição"; value: detail.item ? (detail.item.conservation_state_name || "") : "" }
                        Rectangle { Layout.preferredWidth: 1; Layout.fillHeight: true; color: Theme.border }
                        SummaryItem { label: "Valor pago"; value: detail.item ? (detail.formatCurrency(detail.item.value) || "") : "" }
                    }

                    GridLayout {
                        Layout.fillWidth: true
                        columns: 2
                        columnSpacing: 24
                        rowSpacing: 18
                        ColumnLayout {
                            Layout.fillWidth: true
                            Layout.alignment: Qt.AlignTop
                            spacing: 10
                            UiText { text: "Identificação"; color: Theme.accent; font.pixelSize: 12; textWeight: Font.Black }
                            DetailRow { label: "Plataforma"; value: detail.item ? (detail.item.platform_name || "") : "" }
                            DetailRow { label: "Tipo"; value: detail.item ? (detail.item.item_type_name || "") : "" }
                            DetailRow { label: "Condição"; value: detail.item ? (detail.item.conservation_state_name || "") : "" }
                            DetailRow { label: "Cor"; value: detail.item ? (detail.item.color || "") : "" }
                            DetailRow { label: "Região"; value: detail.item ? (detail.item.region || "") : "" }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            Layout.alignment: Qt.AlignTop
                            spacing: 10
                            UiText { text: "Aquisição"; color: Theme.accent; font.pixelSize: 12; textWeight: Font.Black }
                            DetailRow { label: "Data"; value: detail.item ? (detail.formatDate(detail.item.acquisition_date) || "") : "" }
                            DetailRow { label: "Valor pago"; value: detail.item ? (detail.formatCurrency(detail.item.value) || "") : "" }
                            DetailRow { label: "Origem"; value: detail.item ? (detail.formatUrlLabel(detail.item.acquisition_url) || "") : "" }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            Layout.alignment: Qt.AlignTop
                            spacing: 10
                            UiText { text: "Controle físico"; color: Theme.accent; font.pixelSize: 12; textWeight: Font.Black }
                            DetailRow { label: "Número de série"; value: detail.item ? (detail.item.serial_number || "") : "" }
                            DetailRow { label: "Local"; value: detail.item ? (detail.item.storage_location || "") : "" }
                            DetailRow { label: "Emprestado para"; value: detail.item ? (detail.item.loan_to || "") : "" }
                        }
                        Item { Layout.fillWidth: true }
                        ColumnLayout {
                            Layout.columnSpan: 2
                            Layout.fillWidth: true
                            spacing: 10
                            visible: detail.item && String(detail.item.description || "").trim().length > 0
                            UiText { text: "Descrição"; color: Theme.accent; font.pixelSize: 12; textWeight: Font.Black }
                            UiText {
                                Layout.fillWidth: true
                                text: detail.item ? (detail.item.description || "") : ""
                                color: Theme.secondary
                                font.pixelSize: 13
                                lineHeight: 1.55
                                wrapMode: Text.WordWrap
                            }
                        }
                    }
                }
                }

                Rectangle {
                    Layout.fillWidth: detailPanels.columns === 1
                    objectName: "hardwarePhotoPanel"
                    Layout.preferredWidth: detailPanels.columns === 1 ? -1 : 320
                    Layout.minimumWidth: detailPanels.columns === 1 ? inventoryDetailViewport.contentWidth - 48 : 320
                    Layout.maximumWidth: detailPanels.columns === 1 ? inventoryDetailViewport.contentWidth - 48 : 320
                    Layout.alignment: Qt.AlignTop
                    implicitHeight: Math.max(171, galleryColumn.implicitHeight + 32)
                    radius: 16
                    color: "#dc201f1f"
                    border.color: Theme.border

                    ColumnLayout {
                        id: galleryColumn
                        anchors.fill: parent
                        anchors.margins: 16
                        spacing: 12
                    UiText { text: "Fotos"; color: Theme.text; font.pixelSize: 18; textWeight: Font.Bold }
                    Image { visible: detail.photos.length === 0; source: "qrc:/icons/cpu.svg"; sourceSize: Qt.size(24, 24); Layout.alignment: Qt.AlignHCenter; Layout.topMargin: 16 }
                    UiText { visible: detail.photos.length === 0; text: "Nenhuma foto adicionada"; color: Theme.muted; font.pixelSize: 13 }
                    Flow {
                        Layout.fillWidth: true
                        spacing: 10
                        Repeater {
                            model: detail.photos
                            delegate: ColumnLayout {
                                id: galleryItem
                                required property var modelData
                                required property int index
                                Layout.preferredWidth: 150
                                spacing: 4
                                Rectangle {
                                    Layout.preferredWidth: 150
                                    Layout.preferredHeight: 112
                                    radius: 8
                                    color: Theme.panel
                                    border.color: thumbArea.containsMouse ? Theme.accent : Theme.border
                                    clip: true
                                    Image {
                                        anchors.fill: parent
                                        source: galleryItem.modelData.fileUrl || ""
                                        fillMode: Image.PreserveAspectCrop
                                        asynchronous: true
                                    }
                                    Rectangle {
                                        visible: galleryItem.index === 0
                                        anchors.left: parent.left
                                        anchors.top: parent.top
                                        anchors.margins: 5
                                        radius: 3
                                        color: Theme.accent
                                        width: coverText2.implicitWidth + 10
                                        height: 18
                                        UiText { id: coverText2; anchors.centerIn: parent; text: "CAPA"; color: "#002022"; font.pixelSize: 9; textWeight: Font.Bold }
                                    }
                                    ActionButton {
                                        anchors.right: parent.right
                                        anchors.top: parent.top
                                        anchors.margins: 4
                                        text: "✕"
                                        toolbar: true
                                        visible: thumbArea.containsMouse
                                        Accessible.name: "Remover foto"
                                        onClicked: {
                                            if (detail.inventoryService.removePhoto(Number(galleryItem.modelData.id))) detail.reload()
                                        }
                                    }
                                    MouseArea {
                                        id: thumbArea
                                        anchors.fill: parent
                                        hoverEnabled: true
                                        cursorShape: Qt.PointingHandCursor
                                        onClicked: detail.lightboxIndex = galleryItem.index
                                    }
                                }
                                RowLayout {
                                    Layout.fillWidth: true
                                    spacing: 4
                                    ActionButton {
                                        text: "←"
                                        toolbar: true
                                        visible: galleryItem.index > 0
                                        Accessible.name: "Mover esquerda"
                                        onClicked: if (detail.inventoryService.reorderPhotos(Number(galleryItem.modelData.id), Number(detail.photos[galleryItem.index - 1].id))) detail.reload()
                                    }
                                    ActionButton {
                                        text: "→"
                                        toolbar: true
                                        visible: galleryItem.index < detail.photos.length - 1
                                        Accessible.name: "Mover direita"
                                        onClicked: if (detail.inventoryService.reorderPhotos(Number(galleryItem.modelData.id), Number(detail.photos[galleryItem.index + 1].id))) detail.reload()
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    }

    /* Lightbox cobre o detalhe sem desmontar a galeria. */
    Rectangle {
        visible: detail.lightboxIndex >= 0 && detail.photos.length > 0
        anchors.fill: parent
        color: "#f2000000"
        z: 20
        Image {
            anchors.centerIn: parent
            width: Math.min(parent.width - 120, implicitWidth)
            height: Math.min(parent.height - 120, implicitHeight)
            source: detail.lightboxIndex >= 0 && detail.photos.length > 0 ? (detail.photos[detail.lightboxIndex].fileUrl || "") : ""
            fillMode: Image.PreserveAspectFit
        }
        ActionButton {
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.margins: 20
            iconName: "x"
            toolbar: true
            Accessible.name: "Fechar"
            onClicked: detail.lightboxIndex = -1
        }
        RowLayout {
            anchors.bottom: parent.bottom
            anchors.horizontalCenter: parent.horizontalCenter
            anchors.bottomMargin: 20
            spacing: 12
            ActionButton { iconName: "chevron-left"; enabled: detail.photos.length > 1; Accessible.name: "Foto anterior"; onClicked: detail.lightboxIndex = (detail.lightboxIndex - 1 + detail.photos.length) % detail.photos.length }
            UiText { text: (detail.lightboxIndex + 1) + " / " + detail.photos.length; color: Theme.secondary; font.pixelSize: 13 }
            ActionButton { iconName: "chevron-right"; enabled: detail.photos.length > 1; Accessible.name: "Próxima foto"; onClicked: detail.lightboxIndex = (detail.lightboxIndex + 1) % detail.photos.length }
        }
    }

    FileDialog {
        id: photoDialog
        title: "Selecionar foto"
        nameFilters: ["Imagens (*.jpg *.jpeg *.png *.webp)"]
        onAccepted: {
            let value = String(selectedFile)
            if (value.indexOf("file:///") === 0) value = value.substring(8)
            const photo = detail.inventoryService.addPhoto(Number(detail.item.id), decodeURIComponent(value))
            if (photo && photo.id) detail.reload()
        }
    }
}
