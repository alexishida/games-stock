/* Progresso de metadados renderizado na tela, no lugar de uma notificação flutuante. */
import QtQuick
import QtTest
import "../../qml/components" as Ui

Item {
    id: root
    width: 1024; height: 600

    QtObject {
        id: jobs
        property var list: [{jobId: "j1", kind: "metadata-search", status: "running",
            title: "Buscando \"Sonic\"", subtitle: "Sega Mega Drive",
            progress: {current: 2, total: 5, message: "Construindo índice", stage: "indexing"}}]
        signal changed()
        function jobs() { return list }
        function update(next) {
            list = next
            changed()
        }
    }

    Ui.MetadataJobStatus {
        id: status
        width: 400
        jobManager: jobs
    }

    TestCase {
        name: "MetadataJobStatus"; when: windowShown
        /* Cada teste parte do mesmo job em execução. */
        function init() {
            jobs.update([{jobId: "j1", kind: "metadata-search", status: "running",
                title: "Buscando \"Sonic\"", subtitle: "Sega Mega Drive",
                progress: {current: 2, total: 5, message: "Construindo índice", stage: "indexing"}}])
        }
        /* O job em execução mostra título, percentual e etapa no próprio componente. */
        function test_showsRunningJob() {
            compare(status.visible, true)
            compare(status.percent, 40)
            compare(findChild(status, "metadataJobTitle").text, "Buscando \"Sonic\"")
            verify(findChild(status, "metadataJobStatus").text.indexOf("Construindo índice") === 0)
        }
        /* O progresso acompanha o retrato do JobManager. */
        function test_followsProgress() {
            jobs.update([{jobId: "j1", kind: "metadata-search", status: "running",
                title: "Buscando \"Sonic\"", progress: {current: 5, total: 5, message: "Concluído"}}])
            compare(status.percent, 100)
            verify(findChild(status, "metadataJobStatus").text.indexOf("Concluído") === 0)
        }
        /* Jobs terminais de outra operação não voltam a aparecer na tela. */
        function test_ignoresFinishedJobs() {
            jobs.update([{jobId: "j2", kind: "metadata-import", status: "completed",
                title: "Importando Sonic", progress: {current: 1, total: 1}}])
            compare(status.visible, false)
        }
        /* Sem job de metadados em execução o componente não ocupa espaço. */
        function test_hidesWithoutRunningJob() {
            jobs.update([])
            compare(status.visible, false)
            compare(status.implicitHeight, 0)
        }
    }
}
