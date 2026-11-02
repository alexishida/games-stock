/* Formulário de criação/edição do inventário, com galeria de fotos e detalhes opcionais. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs
import GameStock
import "."

DragDialog {
    id: form
    objectName: "hardwareItemFormDialog"
    property var inventoryService: null
    property var platforms: []
    property var editingItem: null
    property var photos: []
    property string formError: ""
    property string photoError: ""
    readonly property bool createMode: !editingItem

    signal saved(var item)

    width: Math.min(900, parent.width - 48)
    height: Math.min(760, parent.height - 48)
    heading: createMode ? "Novo item de hardware" : "Editar item de hardware"
    onOpened: populate()
    onClosed: formError = ""

    /** Nome da opção sentinela; nunca vira plataforma na biblioteca. */
    readonly property string multiplatformLabel: "Multiplataforma"

    /** Expõe a criação inline de tipo usada pela captura e pelo fluxo do formulário. */
    function showTypeInline() {
        typeSelector.showInline()
    }

    /** Preenche os campos a partir do item ou limpa tudo para criação. */
    function populate() {
        formError = ""
        photoError = ""
        extraOpen.checked = false
        photos = []
        const item = editingItem
        nameRow.text = item ? (item.name || "") : ""
        descriptionArea.text = item ? (item.description || "") : ""
        acquisitionDateRow.text = item ? (item.acquisition_date || "") : ""
        acquisitionUrlRow.text = item ? (item.acquisition_url || "") : ""
        colorRow.text = item ? (item.color || "") : ""
        valueRow.text = item && item.value !== null && item.value !== undefined ? String(item.value) : ""
        serialRow.text = item ? (item.serial_number || "") : ""
        regionRow.text = item ? (item.region || "") : ""
        storageRow.text = item ? (item.storage_location || "") : ""
        loanRow.text = item ? (item.loan_to || "") : ""
        typeSelector.currentValue = item ? Number(item.item_type_id || 0) : 0
        stateSelector.currentValue = item ? Number(item.conservation_state_id || 0) : 0
        platformBox.currentIndex = platformIndexFor(item)
        if (item && item.id) refreshPhotos()
    }

    /** Índice 0 = vazio, 1 = Multiplataforma, 2+ = plataformas reais. */
    function platformIndexFor(item) {
        if (!item) return 0
        if (Number(item.is_multiplatform) === 1) return 1
        for (let index = 0; index < platforms.length; index++) {
            if (Number(platforms[index].id) === Number(item.platform_id)) return index + 2
        }
        return 0
    }

    /** Recarrega a galeria pela fronteira do serviço. */
    function refreshPhotos() {
        if (!inventoryService || !editingItem || !editingItem.id) {
            photos = []
            return
        }
        photos = inventoryService.listPhotos(Number(editingItem.id))
    }

    /** Converte URL do seletor nativo em caminho local. */
    function localPath(url) {
        let value = String(url)
        if (value.indexOf("file:///") === 0) value = value.substring(8)
        return decodeURIComponent(value)
    }

    /** Persiste criação ou edição; só fecha após receber o registro. */
    function save() {
        formError = ""
        if (!inventoryService) {
            formError = "Inventário indisponível."
            return
        }
        const name = nameRow.text.trim()
        if (!name.length) {
            formError = "Nome obrigatório."
            nameRow.fieldItem.forceActiveFocus()
            return
        }
        if (platformBox.currentIndex <= 0) {
            formError = "Plataforma obrigatória."
            platformBox.forceActiveFocus()
            return
        }
        if (typeSelector.currentValue <= 0) {
            formError = "Tipo obrigatório."
            typeSelector.forceActiveFocus()
            return
        }
        if (stateSelector.currentValue <= 0) {
            formError = "Condição obrigatória."
            stateSelector.forceActiveFocus()
            return
        }
        const isMultiplatform = platformBox.currentIndex === 1
        const platformId = isMultiplatform ? null : Number(platforms[platformBox.currentIndex - 2].id)
        const rawValue = valueRow.text.trim().replace(",", ".")
        const parsedValue = rawValue.length ? Number(rawValue) : null
        if (rawValue.length && Number.isNaN(parsedValue)) {
            formError = "Valor pago inválido."
            return
        }
        const data = {
            name: name,
            platform_id: platformId,
            is_multiplatform: isMultiplatform,
            item_type_id: typeSelector.currentValue,
            conservation_state_id: stateSelector.currentValue,
            description: descriptionArea.text.trim(),
            acquisition_date: acquisitionDateRow.text.trim(),
            acquisition_url: acquisitionUrlRow.text.trim(),
            color: colorRow.text.trim(),
            value: parsedValue,
            serial_number: serialRow.text.trim(),
            region: regionRow.text.trim(),
            storage_location: storageRow.text.trim(),
            loan_to: loanRow.text.trim()
        }
        let savedItem = ({})
        if (form.createMode) savedItem = inventoryService.create(data)
        else if (inventoryService.update(Number(editingItem.id), data)) savedItem = inventoryService.get(Number(editingItem.id))
        if (!savedItem || !savedItem.id) {
            formError = inventoryService.error || "Não foi possível salvar o item."
            return
        }
        form.saved(savedItem)
        form.close()
    }

    /** Abre o seletor nativo somente depois de o item existir. */
    function addPhoto() {
        photoError = ""
        if (!editingItem || !editingItem.id) {
            photoError = "Salve o item antes de adicionar fotos."
            return
        }
        photoDialog.open()
    }

    component LabeledField: ColumnLayout {
        property alias label: labelText.text
        property alias text: field.text
        property alias placeholder: field.placeholderText
        property alias fieldObjectName: field.objectName
        property alias fieldItem: field
        Layout.fillWidth: true
        spacing: 4
        Text { id: labelText; visible: false }
        Text {
            text: labelText.text.toUpperCase()
            color: Theme.muted
            font.pixelSize: 10
            font.weight: Font.ExtraBold
            font.letterSpacing: 0.6
        }
        FormField {
            id: field
            Layout.fillWidth: true
            placeholderTextColor: Theme.muted
        }
    }

    ActionButton {
        objectName: "closeHardwareForm"
        iconName: "x-danger"
        toolbar: true
        dangerOutline: true
        anchors.top: parent.top
        anchors.right: parent.right
        anchors.margins: 16
        z: 10
        Accessible.name: "Fechar"
        onClicked: form.close()
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 12

        RowLayout {
            Layout.fillWidth: true
            ColumnLayout {
                Layout.fillWidth: true
                spacing: 4
                Text { text: "INVENTÁRIO FÍSICO"; color: Theme.accent; font.pixelSize: 12; font.weight: Font.ExtraBold; font.letterSpacing: 1 }
                Text { text: form.createMode ? "Novo item de hardware" : "Editar item de hardware"; color: Theme.text; font.pixelSize: 22; font.weight: Font.Black }
            }
        }

        Flickable {
            id: bodyFlick
            Layout.fillWidth: true
            Layout.fillHeight: true
            contentWidth: width
            contentHeight: bodyContainer.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }

            ColumnLayout {
                id: bodyContainer
                width: bodyFlick.width
                spacing: 14
                RowLayout {
                    id: body
                    width: parent.width
                    Layout.fillWidth: true
                    Layout.alignment: Qt.AlignTop
                    spacing: 14

                /* Coluna esquerda: campos centrais em cartão, como o renderer. */
                Rectangle {
                    Layout.preferredWidth: Math.max(420, body.width - 314)
                    Layout.minimumWidth: Math.max(420, body.width - 314)
                    Layout.maximumWidth: Math.max(420, body.width - 314)
                    Layout.alignment: Qt.AlignTop
                    implicitHeight: fields.implicitHeight + 32
                    radius: 12
                    color: "#e61b1b1b"
                    border.color: "#38849495"

                    GridLayout {
                        id: fields
                        anchors.fill: parent
                        anchors.margins: 16
                        columns: 2
                        columnSpacing: 14
                        rowSpacing: 14
                        LabeledField {
                            id: nameRow
                            Layout.columnSpan: 2
                            label: "Nome *"
                            placeholder: "Ex: Super Nintendo original"
                            fieldObjectName: "hardwareItemName"
                            objectName: "hardwareItemNameRow"
                        }
                        ColumnLayout {
                            Layout.columnSpan: 2
                            Layout.fillWidth: true
                            spacing: 4
                            Text { text: "PLATAFORMA *"; color: Theme.muted; font.pixelSize: 10; font.weight: Font.ExtraBold; font.letterSpacing: 0.6 }
                            ComboBox {
                                id: platformBox
                                objectName: "hardwareItemPlatform"
                                Layout.fillWidth: true
                                implicitHeight: Theme.controlHeight
                                font.pixelSize: Theme.formControlFontSize
                                leftPadding: 8
                                rightPadding: 26
                                model: {
                                    const values = ["Selecione uma plataforma...", form.multiplatformLabel]
                                    for (let index = 0; index < form.platforms.length; index++) values.push(form.platforms[index].name)
                                    return values
                                }
                                background: Rectangle {
                                    radius: 6
                                    color: platformBox.hovered ? Theme.controlHover : Theme.control
                                    border.color: platformBox.activeFocus ? Theme.accent : Theme.border
                                }
                                contentItem: Text {
                                    text: platformBox.displayText
                                    font: platformBox.font
                                    color: platformBox.currentIndex > 0 ? Theme.text : Theme.muted
                                    verticalAlignment: Text.AlignVCenter
                                    elide: Text.ElideRight
                                }
                                indicator: Text {
                                    x: platformBox.width - width - 10
                                    y: (platformBox.height - height) / 2
                                    text: "▾"; color: Theme.secondary; font.pixelSize: 12
                                }
                            }
                        }
                        HardwareCatalogSelector {
                            id: typeSelector
                            Layout.fillWidth: true
                            service: form.inventoryService
                            mode: "type"
                            label: "Tipo *"
                        }
                        HardwareCatalogSelector {
                            id: stateSelector
                            Layout.fillWidth: true
                            service: form.inventoryService
                            mode: "state"
                            label: "Condição *"
                        }
                        ColumnLayout {
                            Layout.columnSpan: 2
                            Layout.fillWidth: true
                            spacing: 4
                            Text { text: "DESCRIÇÃO"; color: Theme.muted; font.pixelSize: 10; font.weight: Font.ExtraBold; font.letterSpacing: 0.6 }
                            TextArea {
                                id: descriptionArea
                                objectName: "hardwareItemDescription"
                                Layout.fillWidth: true
                                Layout.preferredHeight: 190
                                padding: 8
                                placeholderText: "Descreva o item, histórico, observações..."
                                placeholderTextColor: Theme.muted
                                color: Theme.text
                                font.pixelSize: Theme.formControlFontSize
                                wrapMode: TextArea.Wrap
                                background: Rectangle { radius: 6; color: Theme.control; border.color: descriptionArea.activeFocus ? Theme.accent : Theme.border }
                            }
                        }
                    }
                }

                /* Coluna direita: fotos, alternância e detalhes adicionais. */
                ColumnLayout {
                    Layout.preferredWidth: 300
                    Layout.minimumWidth: 300
                    Layout.maximumWidth: 300
                    Layout.alignment: Qt.AlignTop
                    spacing: 14

                    Rectangle {
                        Layout.fillWidth: true
                        visible: !form.createMode
                        implicitHeight: photoColumn.implicitHeight
                        radius: 12
                        color: "#e61b1b1b"
                        border.color: "#38849495"
                        ColumnLayout {
                            id: photoColumn
                            anchors.fill: parent
                            anchors.margins: 12
                            spacing: 8
                            RowLayout {
                                Layout.fillWidth: true
                                Text { text: "FOTOS (" + form.photos.length + ")"; color: Theme.secondary; font.pixelSize: 11; font.weight: Font.ExtraBold; font.letterSpacing: 0.8 }
                                Item { Layout.fillWidth: true }
                                ActionButton {
                                    objectName: "addHardwarePhoto"
                                    text: "Adicionar foto"
                                    iconName: "image"
                                    onClicked: form.addPhoto()
                                }
                            }
                            Text { visible: form.photoError.length > 0; text: form.photoError; color: "#fca5a5"; font.pixelSize: 12; wrapMode: Text.WordWrap; Layout.fillWidth: true }
                            Text { visible: form.photos.length === 0; text: "Nenhuma foto adicionada"; color: Theme.muted; font.pixelSize: 12; font.italic: true }
                            Flow {
                                Layout.fillWidth: true
                                spacing: 8
                                Repeater {
                                    model: form.photos
                                    delegate: Rectangle {
                                        id: photoTile
                                        required property var modelData
                                        required property int index
                                        width: 104
                                        height: 78
                                        radius: 8
                                        color: "#14ffffff"
                                        border.color: Theme.border
                                        clip: true
                                        Image {
                                            anchors.fill: parent
                                            source: photoTile.modelData.fileUrl || ""
                                            fillMode: Image.PreserveAspectCrop
                                            asynchronous: true
                                        }
                                        Rectangle {
                                            visible: photoTile.index === 0
                                            anchors.left: parent.left
                                            anchors.top: parent.top
                                            anchors.margins: 6
                                            radius: 9
                                            color: Theme.accent
                                            width: coverText.implicitWidth + 12
                                            height: 18
                                            Text { id: coverText; anchors.centerIn: parent; text: "CAPA"; color: Theme.accentForeground; font.pixelSize: 9; font.weight: Font.ExtraBold }
                                        }
                                        MouseArea {
                                            anchors.fill: parent
                                            hoverEnabled: true
                                            acceptedButtons: Qt.NoButton
                                            Rectangle {
                                                anchors.fill: parent
                                                visible: parent.containsMouse
                                                color: "#9e000000"
                                                Row {
                                                    anchors.centerIn: parent
                                                    spacing: 4
                                                    ActionButton {
                                                        visible: photoTile.index > 0
                                                        text: "↑"
                                                        toolbar: true
                                                        Accessible.name: "Mover para cima"
                                                        onClicked: if (form.inventoryService.reorderPhotos(Number(photoTile.modelData.id), Number(form.photos[photoTile.index - 1].id))) form.refreshPhotos()
                                                    }
                                                    ActionButton {
                                                        visible: photoTile.index < form.photos.length - 1
                                                        text: "↓"
                                                        toolbar: true
                                                        Accessible.name: "Mover para baixo"
                                                        onClicked: if (form.inventoryService.reorderPhotos(Number(photoTile.modelData.id), Number(form.photos[photoTile.index + 1].id))) form.refreshPhotos()
                                                    }
                                                    ActionButton {
                                                        text: "✕"
                                                        toolbar: true
                                                        Accessible.name: "Remover foto"
                                                        onClicked: if (form.inventoryService.removePhoto(Number(photoTile.modelData.id))) form.refreshPhotos()
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Text { visible: form.createMode; text: "Salve o item primeiro para adicionar fotos."; color: Theme.muted; font.pixelSize: 12; font.italic: true; wrapMode: Text.WordWrap; Layout.fillWidth: true }

                    Rectangle {
                        objectName: "toggleHardwareDetails"
                        Layout.fillWidth: true
                        implicitHeight: 46
                        radius: 10
                        color: extraOpen.checked ? Theme.accentSoft : "#d1121212"
                        border.color: extraOpen.checked ? Theme.accent : Theme.border
                        RowLayout {
                            anchors.fill: parent
                            anchors.margins: 12
                            Text {
                                text: extraOpen.checked ? "⌄" : "›"
                                color: Theme.accent
                                font.pixelSize: 16
                                font.bold: true
                            }
                            Text {
                                text: "Detalhes adicionais"
                                color: Theme.text
                                font.pixelSize: 13
                                font.weight: Font.Bold
                                Layout.fillWidth: true
                            }
                        }
                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: extraOpen.checked = !extraOpen.checked
                        }
                    }

                    Rectangle {
                        id: extraPanel
                        Layout.fillWidth: true
                        visible: extraOpen.checked
                        implicitHeight: extraColumn.implicitHeight + 32
                        radius: 12
                        color: "#e61b1b1b"
                        border.color: "#38849495"
                        ColumnLayout {
                            id: extraColumn
                            anchors.fill: parent
                            anchors.margins: 16
                            spacing: 14
                            GridLayout {
                                Layout.fillWidth: true
                                columns: 2
                                columnSpacing: 12
                                rowSpacing: 12
                                LabeledField { id: acquisitionDateRow; label: "Data de aquisição"; placeholder: "AAAA-MM-DD"; fieldObjectName: "hardwareAcquisitionDate" }
                                LabeledField { id: valueRow; label: "Valor pago (R$)"; placeholder: "0.00"; fieldObjectName: "hardwareValue" }
                                LabeledField { id: colorRow; label: "Cor"; placeholder: "Ex: Cinza"; fieldObjectName: "hardwareColor" }
                                LabeledField { id: regionRow; label: "Região"; placeholder: "Ex: NTSC-U/C"; fieldObjectName: "hardwareRegion" }
                                LabeledField { id: serialRow; label: "Número de série"; fieldObjectName: "hardwareSerial" }
                                LabeledField { id: storageRow; label: "Local de armazenamento"; placeholder: "Ex: Prateleira 3"; fieldObjectName: "hardwareStorage" }
                            }
                            LabeledField { id: acquisitionUrlRow; label: "URL de aquisição"; placeholder: "https://..."; fieldObjectName: "hardwareAcquisitionUrl" }
                            LabeledField { id: loanRow; label: "Emprestado para"; placeholder: "Nome da pessoa"; fieldObjectName: "hardwareLoan" }
                        }
                    }
                }
                }
            }
        }

        Text {
            objectName: "hardwareFormError"
            visible: form.formError.length > 0
            text: form.formError
            color: "#ffb4ab"
            font.pixelSize: 12
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            ActionButton { objectName: "cancelHardwareItem"; text: "Cancelar"; iconName: "x-danger"; dangerOutline: true; onClicked: form.close() }
            Item { Layout.fillWidth: true }
            ActionButton {
                objectName: "saveHardwareItem"
                text: form.createMode ? "Criar item" : "Salvar alterações"
                iconName: form.createMode ? "plus" : "save"
                primary: form.createMode
                accentOutline: !form.createMode
                onClicked: form.save()
            }
        }
    }

    /* Estado da seção expansível controlado por um único checkbox invisível. */
    CheckBox {
        id: extraOpen
        visible: false
        checked: false
    }

    FileDialog {
        id: photoDialog
        objectName: "hardwarePhotoDialog"
        title: "Selecionar foto"
        nameFilters: ["Imagens (*.jpg *.jpeg *.png *.webp)"]
        onAccepted: {
            const photo = form.inventoryService.addPhoto(Number(form.editingItem.id), form.localPath(selectedFile))
            if (!photo || !photo.id) {
                form.photoError = form.inventoryService.error || "Erro ao adicionar foto."
                return
            }
            form.refreshPhotos()
        }
    }
}
