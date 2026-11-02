/** Verifica dados externos e mudanças de monitores sem abrir janelas. */
#include "app/WindowState.h"
#include <QFile>
#include <QTemporaryDir>
#include <QtTest>

/** Casos de compatibilidade com o JSON de janela produzido pelo Electron. */
class WindowStateTest : public QObject {
    Q_OBJECT
private slots:
    /** Primeiro uso centraliza a geometria documentada. */
    void defaults() {
        const QRect result = gamestock::loadWindowGeometry("inexistente", {{0, 0, 1920, 1080}});
        QCOMPARE(result.size(), QSize(1122, 957));
        QCOMPARE(result.topLeft(), QPoint(399, 61));
    }
    /** A barra nativa não deve aumentar o tamanho externo salvo pelo Electron. */
    void frameToContent() {
        QCOMPARE(gamestock::contentSizeForFrame({1122, 957}, {0, 31, 0, 0}), QSize(1122, 926));
        QCOMPARE(gamestock::contentSizeForFrame({2, 2}, {4, 4, 4, 4}), QSize(1, 1));
    }
    /** Monitor removido não deixa a janela fora da área de trabalho. */
    void disconnectedMonitor() {
        const QRect result = gamestock::visibleWindowGeometry({2400, 80, 1122, 957}, {{0, 0, 1920, 1080}});
        QVERIFY(QRect(0, 0, 1920, 1080).contains(result));
    }
    /** Coordenadas negativas são válidas quando um monitor à esquerda ainda existe. */
    void negativeCoordinates() {
        const QRect stored(-1800, 50, 1122, 957);
        QCOMPARE(gamestock::visibleWindowGeometry(stored, {{0, 0, 1920, 1080}, {-1920, 0, 1920, 1080}}), stored);
    }
    /** A geometria legada pequena respeita o mínimo da janela quando o monitor permite. */
    void minimumSize() {
        QCOMPARE(gamestock::visibleWindowGeometry({50, 50, 400, 300}, {{0, 0, 1920, 1080}}).size(), QSize(1024, 768));
    }
    /** Um JSON produzido pelo Electron é aceito sem alteração de formato. */
    void legacyJson() {
        QTemporaryDir folder;
        QFile file(folder.filePath("window-bounds.json"));
        QVERIFY(file.open(QIODevice::WriteOnly));
        file.write(R"({"x":120,"y":90,"width":1200,"height":800})");
        file.close();
        QCOMPARE(gamestock::loadWindowGeometry(file.fileName(), {{0, 0, 1920, 1080}}), QRect(120, 90, 1200, 800));
    }
    /** Gravação atômica conserva as chaves e valores usados no formato legado. */
    void roundtrip() {
        QTemporaryDir folder;
        QVERIFY(folder.isValid());
        const QString file = folder.filePath("window-bounds.json");
        const QRect stored(100, 80, 1122, 957);
        QVERIFY(gamestock::saveWindowGeometry(file, stored));
        QCOMPARE(gamestock::loadWindowGeometry(file, {{0, 0, 1920, 1080}}), stored);
    }
    /** JSON truncado ou números fora de faixa usam defaults em vez de conversão insegura. */
    void invalidJson() {
        QTemporaryDir folder;
        const QString name = folder.filePath("window-bounds.json");
        QFile file(name);
        QVERIFY(file.open(QIODevice::WriteOnly));
        file.write(R"({"width":1e300,"height":"invalido","x":null,"y":2})");
        file.close();
        QCOMPARE(gamestock::loadWindowGeometry(name, {{0, 0, 1920, 1080}}).size(), QSize(1122, 957));
    }
};

QTEST_GUILESS_MAIN(WindowStateTest)
#include "WindowStateTest.moc"
