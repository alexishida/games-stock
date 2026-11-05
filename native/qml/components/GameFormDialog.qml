/* Textos pequenos ampliados para manter a leitura em toda a interface. */
/* Tipografia e rolagem reutilizam as primitivas calibradas contra o Electron. */
/* Gaps do management-form preservam as medidas originais do Electron. */
/* Seletores usam FormSelect para manter padding, altura e menu iguais ao Electron. */
/* Respiros e superficies do editor reproduzem os cards do GameForm original. */
/* Formulário de criação manual e edição rica, com as seções do GameForm Electron. */
pragma ComponentBehavior: Bound
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Dialogs
import GameStock
import "."

DragDialog {
    id: form
    objectName: "gameFormDialog"
    property var gameService: null
    property bool serviceMode: false
    property var platforms: []
    /* Nulo cria um novo jogo; um mapa abre a edição do registro existente. */
    property var editingGame: null
    readonly property bool createMode: !editingGame
    property string formError: ""
    /* Rascunho isolado: o serviço só é chamado em Salvar. */
    property var draft: ({})
    property string metadataQuery: ""

    signal saved(var gameId)
    /* A busca de metadados abre o importador existente, como o sub-modal do Electron. */
    signal metadataRequested(string title, string platformName)

    width: Math.min(createMode ? 680 : 760, parent.width - 48)
    height: Math.min(createMode ? 700 : 620, parent.height - 48)
    padding: 16
    heading: createMode ? "Novo jogo" : "Editar cadastro"
    onOpened: populate()
    onClosed: formError = ""

    /** Rascunho vazio com os padrões usados pelo ManualGameModal. */
    function emptyDraft() {
        return {title: "", platform_id: 0, publisher: "", year: null, genre: "", rating: "",
            notes: "", rom_path: "", box_art_path: "", favorite: false, play_status: "unplayed"}
    }

    /** Copia somente os campos editáveis para evitar alterar o objeto do serviço. */
    function copyDraft(game) {
        return {id: game.id, title: game.title || "", platform_id: Number(game.platform_id || 0),
            platform_name: game.platform_name || "", publisher: game.publisher || "",
            year: game.year, genre: game.genre || "", rating: game.rating || "",
            notes: game.notes || "", rom_path: game.rom_path || "", box_art_path: game.box_art_path || "",
            launchbox_id: game.launchbox_id || "", background_path: game.background_path || "",
            screenshot_path: game.screenshot_path || "", favorite: !!game.favorite,
            play_status: game.play_status || "unplayed"}
    }

    /** Atualiza uma chave do rascunho recriando o mapa para disparar as ligações. */
    function setDraft(key, value) {
        const next = Object.assign({}, draft)
        next[key] = value
        draft = next
    }

    /** Preenche o rascunho e os campos do modo de criação. */
    function populate() {
        formError = ""
        metadataQuery = editingGame ? (editingGame.title || "") : ""
        draft = editingGame ? copyDraft(editingGame) : emptyDraft()
        if (!editingGame) {
            titleField.text = ""
            publisherField.text = ""
            yearField.text = ""
            genreField.text = ""
            ratingField.text = ""
            notesField.text = ""
            romField.text = ""
            boxArtField.text = ""
            favoriteBox.checked = false
            platformBox.currentIndex = -1
            statusBox.currentIndex = 0
            return
        }
        titleField.text = editingGame.title || ""
        publisherField.text = editingGame.publisher || ""
        yearField.text = editingGame.year ? String(editingGame.year) : ""
        genreField.text = editingGame.genre || ""
        ratingField.text = editingGame.rating || ""
        notesField.text = editingGame.notes || ""
        romField.text = editingGame.rom_path || ""
        boxArtField.text = editingGame.box_art_path || ""
        favoriteBox.checked = !!editingGame.favorite
        platformBox.currentIndex = platformIndex(editingGame.platform_id)
        const status = ["unplayed", "playing", "completed"].indexOf(editingGame.play_status)
        statusBox.currentIndex = status >= 0 ? status : 0
    }

    function platformIndex(id) {
        for (let index = 0; index < platforms.length; index++) {
            if (Number(platforms[index].id) === Number(id)) return index
        }
        return -1
    }

    /** Nome da plataforma do rascunho, usado no card de título e na busca de metadados. */
    function platformName() {
        if (draft.platform_name) return draft.platform_name
        for (let index = 0; index < platforms.length; index++) {
            if (Number(platforms[index].id) === Number(draft.platform_id)) return platforms[index].name
        }
        return "Sem plataforma definida"
    }

    /** Mesma regra do Electron: qualquer campo de metadados preenchido ativa o resumo. */
    function hasMetadata() {
        return !!(String(draft.launchbox_id || "").trim() || String(draft.publisher || "").trim()
            || String(draft.genre || "").trim() || String(draft.rating || "").trim()
            || String(draft.notes || "").trim() || draft.year)
    }

    /** Valores exibidos no resumo de quatro colunas do Electron. */
    function metadataValue(key) {
        if (key === "publisher") return String(draft.publisher || "").trim() || "Não informado"
        if (key === "genre") return String(draft.genre || "").trim() || "Não informado"
        if (key === "rating") return String(draft.rating || "").trim() || "Não informado"
        return String(draft.launchbox_id || "").trim() || "Não vinculado"
    }

    /** Persiste no serviço tipado e só fecha depois de confirmar o ID retornado. */
    function save() {
        formError = ""
        if (!serviceMode || !gameService) {
            formError = "Edição disponível apenas com o banco da biblioteca."
            return
        }
        let data = {}
        if (createMode) {
            const title = titleField.text.trim()
            if (!title.length) {
                formError = "Título é obrigatório"
                titleField.forceActiveFocus()
                return
            }
            const platformId = platformBox.currentIndex >= 0 ? Number(platformBox.currentValue || 0) : 0
            if (!platformId) {
                formError = "Plataforma é obrigatória"
                platformBox.forceActiveFocus()
                return
            }
            data = {
                title: title,
                platform_id: platformId,
                publisher: publisherField.text.trim(),
                year: yearField.text.trim().length ? Number(yearField.text) : null,
                genre: genreField.text.trim(),
                rating: ratingField.text.trim(),
                notes: notesField.text.trim(),
                rom_path: romField.text.trim(),
                box_art_path: boxArtField.text.trim(),
                favorite: favoriteBox.checked,
                play_status: ["unplayed", "playing", "completed"][statusBox.currentIndex] || "unplayed"
            }
        } else {
            const title = String(draft.title || "").trim()
            if (!title.length) {
                formError = "Título é obrigatório"
                return
            }
            if (!Number(draft.platform_id || 0)) {
                formError = "Plataforma é obrigatória"
                return
            }
            data = {
                title: title,
                platform_id: Number(draft.platform_id),
                publisher: String(draft.publisher || "").trim(),
                year: draft.year ? Number(draft.year) : null,
                genre: String(draft.genre || "").trim(),
                rating: String(draft.rating || "").trim(),
                notes: String(draft.notes || "").trim(),
                rom_path: String(draft.rom_path || "").trim(),
                box_art_path: String(draft.box_art_path || "").trim(),
                favorite: !!draft.favorite,
                play_status: draft.play_status || "unplayed"
            }
        }
        let gameId = 0
        if (createMode) {
            const created = gameService.create(data)
            gameId = created ? Number(created.id || 0) : 0
        } else if (gameService.update(Number(editingGame.id), data)) {
            gameId = Number(editingGame.id)
        }
        if (!gameId) {
            formError = gameService.error || "Não foi possível salvar o jogo"
            return
        }
        form.saved(gameId)
        form.close()
    }

    component LabeledField: ColumnLayout {
        property alias label: labelText.text
        property alias text: field.text
        property alias placeholder: field.placeholderText
        property alias fieldObjectName: field.objectName
        Layout.fillWidth: true
        spacing: Theme.formLabelGap
        UiText { id: labelText; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; textWeight: Font.ExtraBold; font.capitalization: Font.AllUppercase; font.letterSpacing: 0.55 }
        FormField { font.family: Theme.heavyFontFamily; font.weight: Theme.cssFontWeight(Font.ExtraBold); id: field; Layout.fillWidth: true }
    }

    component LabeledCombo: ColumnLayout {
        id: comboLabel
        property alias label: labelText.text
        property alias model: control.model
        property alias currentIndex: control.currentIndex
        property alias currentValue: control.currentValue
        property alias valueRole: control.valueRole
        property alias textRole: control.textRole
        property alias controlObjectName: control.objectName
        Layout.fillWidth: true
        spacing: Theme.formLabelGap
        UiText { id: labelText; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; textWeight: Font.ExtraBold; font.capitalization: Font.AllUppercase; font.letterSpacing: 0.55 }
        FormSelect {
            font.family: Theme.heavyFontFamily; font.weight: Theme.cssFontWeight(Font.ExtraBold)
            id: control
            Layout.fillWidth: true
            font.pixelSize: Theme.formControlFontSize
            contentItem: UiText {
                text: control.currentIndex >= 0 ? control.displayText : "Selecione"
                font: control.font
                color: control.currentIndex >= 0 ? Theme.text : Theme.muted
                verticalAlignment: Text.AlignVCenter
                elide: Text.ElideRight
            }
        }
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: Theme.formGroupGap

        /* Cabeçalho do modal, como o header dos modais de gerenciamento do Electron. */
        RowLayout {
            Layout.fillWidth: true
            Layout.bottomMargin: Theme.modalTitleGap - Theme.formGroupGap
            spacing: 8
            UiText {
                text: form.heading
                color: Theme.text
                font.pixelSize: 24
                textWeight: Font.Bold
                Layout.fillWidth: true
            }
            ActionButton {
                objectName: "closeGameForm"
                iconName: "x-danger"
                toolbar: true
                dangerOutline: true
                Accessible.name: "Fechar"
                onClicked: form.close()
            }
        }

    /* Criação manual replica o ManualGameModal: formulário direto de campos. */
    Flickable {
        visible: form.createMode
        Layout.fillWidth: true
        Layout.fillHeight: true
        contentWidth: width
        contentHeight: createBody.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        ColumnLayout {
            id: createBody
            width: parent.width
            spacing: Theme.formGroupGap
            LabeledField { id: titleField; objectName: "titleFieldRow"; label: "Título"; fieldObjectName: "gameTitleField" }
            LabeledCombo {
                id: platformBox
                label: "Plataforma"
                model: form.platforms
                textRole: "name"
                valueRole: "id"
                controlObjectName: "gamePlatformField"
            }
            GridLayout {
                Layout.fillWidth: true
                columns: 2
                columnSpacing: 12
                rowSpacing: 10
                LabeledField { id: publisherField; objectName: "publisherFieldRow"; label: "Publisher"; fieldObjectName: "gamePublisherField" }
                LabeledField { id: yearField; objectName: "yearFieldRow"; label: "Ano"; fieldObjectName: "gameYearField" }
                LabeledField { id: genreField; objectName: "genreFieldRow"; label: "Gênero"; fieldObjectName: "gameGenreField" }
                LabeledField { id: ratingField; objectName: "ratingFieldRow"; label: "Rating"; fieldObjectName: "gameRatingField" }
            }
            ColumnLayout {
                Layout.fillWidth: true
                spacing: Theme.formLabelGap
                UiText { text: "Notas"; color: Theme.muted; font.pixelSize: Theme.formLabelFontSize; textWeight: Font.ExtraBold; font.capitalization: Font.AllUppercase; font.letterSpacing: 0.55 }
                TextArea {
                    /* Evita alternar a rasterização ao entrar em um campo multilinha. */
                    renderType: TextEdit.QtRendering
                    antialiasing: true
                    id: notesField
                    objectName: "gameNotesField"
                    Layout.fillWidth: true
                    Layout.preferredHeight: 74
                    padding: 8
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.formControlFontSize
                    color: Theme.text
                    placeholderText: "Descrição do jogo"
                    placeholderTextColor: Theme.muted
                    wrapMode: TextArea.Wrap
                    background: Rectangle { radius: 6; color: Theme.control; border.color: notesField.activeFocus ? Theme.accent : Theme.border }
                }
            }
            LabeledField { id: romField; label: "Caminho da ROM"; fieldObjectName: "gameRomField"; placeholder: "Caminho local do arquivo" }
            LabeledField { id: boxArtField; label: "Caminho da capa"; fieldObjectName: "gameBoxArtField"; placeholder: "Caminho local da imagem" }
            RowLayout {
                Layout.fillWidth: true
                spacing: Theme.formGroupGap
                FormCheckBox {
                    id: favoriteBox
                    objectName: "gameFavoriteField"
                    text: "Favorito"
                    font.pixelSize: Theme.formControlFontSize
                    spacing: 8
                    leftPadding: 0
                    contentItem: UiText {
                        text: favoriteBox.text
                        leftPadding: favoriteBox.indicator.width + favoriteBox.spacing
                        verticalAlignment: Text.AlignVCenter
                        color: Theme.secondary
                        font: favoriteBox.font
                    }
                    indicator: Rectangle {
                        implicitWidth: 16
                        implicitHeight: 16
                        x: favoriteBox.leftPadding
                        y: (favoriteBox.height - height) / 2
                        radius: 3
                        color: favoriteBox.checked ? Theme.accent : Theme.control
                        border.color: Theme.border
                        UiText {
                            anchors.centerIn: parent
                            text: "✓"
                            font.pixelSize: 13
                            font.bold: true
                            color: Theme.accentForeground
                            visible: favoriteBox.checked
                        }
                    }
                }
                Item { Layout.fillWidth: true }
                LabeledCombo {
                    id: statusBox
                    label: "Status"
                    Layout.preferredWidth: 180
                    model: [{label: "Não jogado", value: "unplayed"}, {label: "Jogando", value: "playing"}, {label: "Concluído", value: "completed"}]
                    textRole: "label"
                    valueRole: "value"
                    controlObjectName: "gameStatusField"
                }
            }
        }
    }

    /* Edição replica o GameForm: título, hub de metadados, arquivos e rodapé. */
    Flickable {
        visible: !form.createMode
        Layout.fillWidth: true
        Layout.fillHeight: true
        contentWidth: width
        contentHeight: editBody.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        ColumnLayout {
            id: editBody
            width: parent.width
            spacing: 18

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: titleCard.implicitHeight + 32
                radius: 14
                color: "#e0121212"
                border.color: "#2e00f2ff"
                /* O gradiente diagonal do CSS é aproximado por uma camada translúcida. */
                Rectangle {
                    anchors.fill: parent
                    radius: parent.radius
                    gradient: Gradient {
                        orientation: Gradient.Horizontal
                        GradientStop { position: 0.0; color: "#1400f2ff" }
                        GradientStop { position: 0.55; color: "transparent" }
                    }
                }
                ColumnLayout {
                    id: titleCard
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 2
                    UiText {
                        objectName: "gameEditTitle"
                        text: form.draft.title || "Jogo sem título"
                        color: Theme.accent
                        font.pixelSize: 22
                        textWeight: Font.Black
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                    UiText {
                        text: form.platformName()
                        color: Theme.secondary
                        font.pixelSize: 14
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: metadataHub.implicitHeight + 32
                radius: 16
                color: "#10101010"
                border.color: form.hasMetadata() ? "#3822c55e" : "#3d78350f"
                ColumnLayout {
                    id: metadataHub
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 14
                    RowLayout {
                        Layout.fillWidth: true
                        ColumnLayout {
                            spacing: 2
                            UiText { text: "METADADOS"; color: Theme.accent; font.pixelSize: 12; textWeight: Font.Black; font.letterSpacing: 1 }
                            UiText {
                                text: form.hasMetadata() ? "Dados vinculados" : "Buscar na base"
                                color: Theme.text
                                font.pixelSize: 18
                                textWeight: Font.Bold
                            }
                        }
                        Item { Layout.fillWidth: true }
                        Rectangle {
                            implicitWidth: badgeRow.implicitWidth + 24
                            implicitHeight: 32
                            radius: 16
                            color: form.hasMetadata() ? Theme.successSoft : Theme.warningSoft
                            border.color: form.hasMetadata() ? "#5922c55e" : "#5cfbbf24"
                            RowLayout {
                                id: badgeRow
                                anchors.centerIn: parent
                                spacing: 6
                                UiText { text: form.hasMetadata() ? "✓" : "!"; color: form.hasMetadata() ? Theme.success : Theme.warning; font.pixelSize: 13; font.bold: true }
                                UiText {
                                    text: form.hasMetadata() ? "Metadados ativos" : "Sem metadados"
                                    color: form.hasMetadata() ? "#bbf7d0" : "#fde68a"
                                    font.pixelSize: 12
                                    textWeight: Font.Black
                                }
                            }
                        }
                    }

                    GridLayout {
                        visible: form.hasMetadata()
                        Layout.fillWidth: true
                        columns: 4
                        columnSpacing: 8
                        Repeater {
                            model: [
                                {key: "publisher", label: "PUBLISHER"},
                                {key: "genre", label: "GÊNERO"},
                                {key: "rating", label: "RATING"},
                                {key: "metadata", label: "METADATA ID"}
                            ]
                            delegate: Rectangle {
                                required property var modelData
                                Layout.fillWidth: true
                                implicitHeight: 56
                                radius: 8
                                color: "#06ffffff"
                                border.color: Theme.border
                                ColumnLayout {
                                    anchors.fill: parent
                                    anchors.margins: 10
                                    spacing: 2
                                    UiText { text: modelData.label; color: Theme.muted; font.pixelSize: 12; textWeight: Font.ExtraBold; font.letterSpacing: 0.6 }
                                    UiText {
                                        text: form.metadataValue(modelData.key)
                                        color: form.metadataValue(modelData.key).indexOf("Não ") === 0 ? Theme.muted : Theme.text
                                        font.pixelSize: 13
                                        textWeight: Font.Bold
                                        elide: Text.ElideRight
                                        Layout.fillWidth: true
                                    }
                                }
                            }
                        }
                    }

                    RowLayout {
                        visible: form.hasMetadata()
                        Layout.fillWidth: true
                        spacing: 8
                        Item { Layout.fillWidth: true }
                        ActionButton {
                            objectName: "openGameMetadataEditor"
                            text: "Ver metadados"
                            iconName: "scroll-text"
                            accentOutline: true
                            onClicked: metadataEditor.openFor(form.draft)
                        }
                        ActionButton {
                            objectName: "refreshGameMetadata"
                            text: "Atualizar dados e imagens"
                            iconName: "refresh-cw"
                            onClicked: form.metadataRequested(String(form.draft.title || ""), form.platformName())
                        }
                        ActionButton {
                            objectName: "searchOtherGameMetadata"
                            text: "Buscar outro título"
                            iconName: "search"
                            onClicked: form.metadataRequested(String(form.metadataQuery || form.draft.title || ""), form.platformName())
                        }
                    }

                    ColumnLayout {
                        visible: !form.hasMetadata()
                        Layout.fillWidth: true
                        spacing: 8
                        RowLayout {
                            spacing: 8
                            UiText { text: "✦"; color: Theme.accent; font.pixelSize: 16 }
                            ColumnLayout {
                                spacing: 1
                                UiText { text: "Complete o cadastro com a base de metadados"; color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold }
                                UiText {
                                    text: "Capa e campos como publisher, gênero e descrição entram quando disponíveis na fonte selecionada."
                                    color: Theme.secondary; font.pixelSize: 12; wrapMode: Text.WordWrap; Layout.fillWidth: true
                                }
                            }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            spacing: 8
                            FormField {
                                id: metadataQueryField
                                objectName: "gameMetadataQuery"
                                Layout.fillWidth: true
                                placeholderText: "Título para busca"
                                text: form.metadataQuery
                                onTextChanged: form.metadataQuery = text
                            }
                            ActionButton {
                                objectName: "searchGameMetadata"
                                text: "Buscar"
                                iconName: "search"
                                primary: true
                                onClicked: form.metadataRequested(form.metadataQuery, form.platformName())
                            }
                            ActionButton {
                                objectName: "openGameMetadataEditorEmpty"
                                text: "Manual"
                                iconName: "pencil"
                                onClicked: metadataEditor.openFor(form.draft)
                            }
                        }
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                implicitHeight: fileSection.implicitHeight + 32
                radius: 16
                color: "#10101010"
                border.color: Theme.border
                ColumnLayout {
                    id: fileSection
                    anchors.fill: parent
                    anchors.margins: 16
                    spacing: 14
                    ColumnLayout {
                        spacing: 2
                        UiText { text: "ARQUIVOS"; color: Theme.accent; font.pixelSize: 12; textWeight: Font.Black; font.letterSpacing: 1 }
                        UiText { text: "ROM e mídia local"; color: Theme.text; font.pixelSize: 18; textWeight: Font.Bold }
                    }
                    RowLayout {
                        Layout.fillWidth: true
                        spacing: 8
                        Rectangle {
                            Layout.fillWidth: true
                            implicitHeight: 76
                            radius: 10
                            color: "#06ffffff"
                            border.color: Theme.border
                            RowLayout {
                                anchors.fill: parent
                                anchors.margins: 12
                                spacing: 10
                                Image { source: "qrc:/icons/folder-open.svg"; sourceSize: Qt.size(18, 18) }
                                ColumnLayout {
                                    spacing: 1
                                    UiText { text: "Associar ROM"; color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold }
                                    UiText {
                                        text: form.draft.rom_path ? String(form.draft.rom_path).split(/[\\/]/).pop() : "Nenhuma ROM associada"
                                        color: Theme.secondary; font.pixelSize: 12; elide: Text.ElideMiddle; Layout.fillWidth: true
                                    }
                                }
                            }
                            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: romDialog.open() }
                        }
                        Rectangle {
                            Layout.fillWidth: true
                            implicitHeight: 76
                            radius: 10
                            color: "#06ffffff"
                            border.color: Theme.border
                            opacity: form.draft.rom_path ? 1 : 0.55
                            RowLayout {
                                anchors.fill: parent
                                anchors.margins: 12
                                spacing: 10
                                Image { source: "qrc:/icons/unlink.svg"; sourceSize: Qt.size(18, 18) }
                                ColumnLayout {
                                    spacing: 1
                                    UiText { text: "Remover ROM"; color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold }
                                    UiText {
                                        text: form.draft.rom_path ? "Desvincular arquivo atual" : "Sem ROM para remover"
                                        color: Theme.secondary; font.pixelSize: 12; elide: Text.ElideRight; Layout.fillWidth: true
                                    }
                                }
                            }
                            MouseArea {
                                anchors.fill: parent
                                enabled: !!form.draft.rom_path
                                cursorShape: Qt.PointingHandCursor
                                onClicked: form.setDraft("rom_path", "")
                            }
                        }
                        Rectangle {
                            Layout.fillWidth: true
                            implicitHeight: 76
                            radius: 10
                            color: "#06ffffff"
                            border.color: Theme.border
                            RowLayout {
                                anchors.fill: parent
                                anchors.margins: 12
                                spacing: 10
                                Image { source: "qrc:/icons/image.svg"; sourceSize: Qt.size(18, 18) }
                                ColumnLayout {
                                    spacing: 1
                                    UiText { text: "Box art"; color: Theme.text; font.pixelSize: 13; textWeight: Font.Bold }
                                    UiText {
                                        text: form.draft.box_art_path ? "Capa associada" : "Adicionar capa local"
                                        color: Theme.secondary; font.pixelSize: 12; elide: Text.ElideRight; Layout.fillWidth: true
                                    }
                                }
                            }
                            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: boxArtDialog.open() }
                        }
                    }
                }
            }

        }
    }
    /* Erro e rodapé compartilhados entre criação e edição. */
    UiText {
        objectName: "gameFormError"
        visible: form.formError.length > 0
        text: form.formError
        color: "#ffb4ab"
        font.pixelSize: 13
        wrapMode: Text.WordWrap
        Layout.fillWidth: true
    }
    RowLayout {
        Layout.fillWidth: true
        spacing: 8
        Item { Layout.fillWidth: true }
        ActionButton {
            objectName: "cancelGame"
            formAction: true
            text: "Cancelar"
            iconName: form.createMode ? "x" : "x-danger"
            dangerOutline: !form.createMode
            onClicked: form.close()
        }
        ActionButton {
            objectName: "saveGame"
            formAction: true
            text: "Salvar"
            iconName: "save"
            primary: form.createMode
            accentOutline: !form.createMode
            onClicked: form.save()
        }
    }
    }

    FileDialog {
        id: romDialog
        title: "Selecionar ROM"
        fileMode: FileDialog.OpenFile
        /* QUrl no serviço preserva espaços, acentos e caminhos de rede. */
        onAccepted: if (form.gameService) form.setDraft("rom_path", form.gameService.localFilePath(selectedFile))
    }
    FileDialog {
        id: boxArtDialog
        title: "Selecionar capa"
        fileMode: FileDialog.OpenFile
        nameFilters: ["Imagens (*.png *.jpg *.jpeg *.webp)"]
        onAccepted: {
            if (!form.gameService) return
            const imported = form.gameService.importImage(selectedFile)
            if (imported.success) {
                form.setDraft("box_art_path", imported.path)
                form.formError = ""
            } else form.formError = imported.error || "Não foi possível importar a capa."
        }
    }
    GameMetadataEditor {
        id: metadataEditor
        onApplied: function(values) {
            for (const key in values) form.setDraft(key, values[key])
        }
    }
}
