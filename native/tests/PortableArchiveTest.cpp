/** Verifica ZIP/ZIP64, leitura STORED/DEFLATED e manifesto schemaVersion 1. */
#include "portability/PortableManifest.h"
#include "portability/ZipArchive.h"

#include <QFile>
#include <QTemporaryDir>
#include <QtTest>

namespace {
/** Conteúdo binário previsível para comparar extração sem compressão. */
QByteArray patternBytes(int size) {
    QByteArray bytes(size, Qt::Uninitialized);
    for (int index = 0; index < size; ++index) bytes[index] = static_cast<char>((index * 31) % 251);
    return bytes;
}

/** Lê o arquivo inteiro para procurar assinaturas de estrutura ZIP64. */
QByteArray readAll(const QString& path) {
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly)) return {};
    return file.readAll();
}
} // namespace

class PortableArchiveTest : public QObject {
    Q_OBJECT
private slots:
    void writeAndReadStoredAndDeflated() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString archivePath = dir.filePath("backup.gamestock-backup");
        const QString deflatedPath = dir.filePath("deflated.gamestock-backup");
        const QByteArray json = QByteArrayLiteral("{\"schemaVersion\":1}");
        const QByteArray text = QByteArrayLiteral("conteudo comprimido com deflate");
        const QByteArray binary = patternBytes(1024 * 1024);
        const QString sourcePath = dir.filePath("midia.bin");
        {
            QFile source(sourcePath);
            QVERIFY(source.open(QIODevice::WriteOnly));
            QCOMPARE(source.write(binary), qint64(binary.size()));
        }

        gamestock::ZipWriter writer;
        QString error;
        QVERIFY2(writer.open(archivePath, false, gamestock::ZipWriter::Compression::Store, &error), qPrintable(error));
        QVERIFY2(writer.addData(QStringLiteral("manifest.json"), json, &error), qPrintable(error));
        QVERIFY2(writer.addFile(QStringLiteral("media/jogo/cover.bin"), sourcePath, &error), qPrintable(error));
        QVERIFY2(writer.finish(&error), qPrintable(error));

        gamestock::ZipWriter deflated;
        QVERIFY2(deflated.open(deflatedPath, false, gamestock::ZipWriter::Compression::Deflate, &error), qPrintable(error));
        QVERIFY2(deflated.addData(QStringLiteral("data/games.json"), text, &error), qPrintable(error));
        QVERIFY2(deflated.finish(&error), qPrintable(error));

        gamestock::ZipReader reader;
        QVERIFY2(reader.open(archivePath, &error), qPrintable(error));
        QCOMPARE(reader.entries().size(), 2);
        QVERIFY(reader.contains(QStringLiteral("manifest.json")));
        QVERIFY(reader.contains(QStringLiteral("media/jogo/cover.bin")));

        QByteArray read;
        QVERIFY2(reader.readEntry(QStringLiteral("manifest.json"), 1024, &read, &error), qPrintable(error));
        QCOMPARE(read, json);
        QVERIFY2(reader.readEntry(QStringLiteral("media/jogo/cover.bin"), 2 * 1024 * 1024, &read, &error), qPrintable(error));
        QCOMPARE(read, binary);

        gamestock::ZipReader deflatedReader;
        QVERIFY2(deflatedReader.open(deflatedPath, &error), qPrintable(error));
        QVERIFY2(deflatedReader.readEntry(QStringLiteral("data/games.json"), 1024, &read, &error), qPrintable(error));
        QCOMPARE(read, text);

        const QString extracted = dir.filePath("extraido.bin");
        QVERIFY2(reader.extractEntry(QStringLiteral("media/jogo/cover.bin"), extracted, 2 * 1024 * 1024, &error),
            qPrintable(error));
        QCOMPARE(readAll(extracted), binary);
        QVERIFY(!reader.contains(QStringLiteral("nao-existe.json")));
        QVERIFY(!reader.readEntry(QStringLiteral("nao-existe.json"), 1024, &read, &error));
        QVERIFY(error.contains(QStringLiteral("não encontrada")));
    }

    void limitsAndTraversal() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString archivePath = dir.filePath("limites.gamestock-backup");
        const QByteArray large = patternBytes(64 * 1024);
        gamestock::ZipWriter writer;
        QString error;
        QVERIFY2(writer.open(archivePath, false, gamestock::ZipWriter::Compression::Store, &error), qPrintable(error));
        QVERIFY2(writer.addData(QStringLiteral("media/grande.bin"), large, &error), qPrintable(error));
        QVERIFY2(writer.addData(QStringLiteral("../escape.txt"), QByteArrayLiteral("x"), &error), qPrintable(error));
        QVERIFY2(writer.finish(&error), qPrintable(error));

        gamestock::ZipReader reader;
        QVERIFY2(reader.open(archivePath, &error), qPrintable(error));
        QByteArray data;
        QVERIFY(!reader.readEntry(QStringLiteral("media/grande.bin"), 1024, &data, &error));
        QVERIFY2(error.contains(QStringLiteral("limite")), qPrintable(error));
        const QString outside = dir.filePath("fora.txt");
        QVERIFY(!reader.extractEntry(QStringLiteral("../escape.txt"), outside, 1024, &error));
        QVERIFY2(error.contains(QStringLiteral("inválido")), qPrintable(error));
        QVERIFY(!QFile::exists(outside));
        QVERIFY(!gamestock::ZipReader::isSafeEntryPath(QStringLiteral("../escape.txt")));
        QVERIFY(!gamestock::ZipReader::isSafeEntryPath(QStringLiteral("C:/temp/x")));
        QVERIFY(gamestock::ZipReader::isSafeEntryPath(QStringLiteral("media/jogo/cover.jpg")));
    }

    void zip64StructureAndRoundTrip() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString archivePath = dir.filePath("zip64.gamestock-backup");
        const QByteArray data = patternBytes(2048);
        gamestock::ZipWriter writer;
        QString error;
        QVERIFY2(writer.open(archivePath, true, gamestock::ZipWriter::Compression::Deflate, &error), qPrintable(error));
        QVERIFY2(writer.addData(QStringLiteral("data/games.json"), data, &error), qPrintable(error));
        QVERIFY2(writer.finish(&error), qPrintable(error));

        // ZIP64 EOCD (PK\x06\x06) e localizador (PK\x06\x07) são obrigatórios no modo forçado.
        const QByteArray bytes = readAll(archivePath);
        QVERIFY(bytes.contains(QByteArray::fromHex("504b0606")));
        QVERIFY(bytes.contains(QByteArray::fromHex("504b0607")));

        gamestock::ZipReader reader;
        QVERIFY2(reader.open(archivePath, &error), qPrintable(error));
        QByteArray read;
        QVERIFY2(reader.readEntry(QStringLiteral("data/games.json"), 4096, &read, &error), qPrintable(error));
        QCOMPARE(read, data);
    }

    void largeZip64RoundTrip() {
        // Geração real acima de 4 GiB é opt-in para não pesar no CI padrão.
        if (!qEnvironmentVariableIsSet("GAMESTOCK_ZIP64_LARGE_TEST")) {
            QSKIP("Defina GAMESTOCK_ZIP64_LARGE_TEST=1 para gerar o pacote >4 GiB.");
        }
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const qint64 size = 4LL * 1024 * 1024 * 1024 + 1024;
        const QString sourcePath = dir.filePath("grande.bin");
        {
            QFile source(sourcePath);
            QVERIFY(source.open(QIODevice::ReadWrite));
            QVERIFY(source.resize(size));
        }
        const QString archivePath = dir.filePath("grande.gamestock-backup");
        gamestock::ZipWriter writer;
        QString error;
        QVERIFY2(writer.open(archivePath, false, gamestock::ZipWriter::Compression::Store, &error), qPrintable(error));
        QVERIFY2(writer.addFile(QStringLiteral("media/grande.bin"), sourcePath, &error), qPrintable(error));
        QVERIFY2(writer.finish(&error), qPrintable(error));
        QVERIFY(QFileInfo(archivePath).size() > size);

        gamestock::ZipReader reader;
        QVERIFY2(reader.open(archivePath, &error), qPrintable(error));
        QCOMPARE(reader.entries().size(), 1);
        QCOMPARE(reader.entries().first().size, size);
        const QString extracted = dir.filePath("extraido.bin");
        QVERIFY2(reader.extractEntry(QStringLiteral("media/grande.bin"), extracted, size + 1, &error),
            qPrintable(error));
        QCOMPARE(QFileInfo(extracted).size(), size);
    }

    void manifestValidation() {
        gamestock::PortableManifest manifest;
        manifest.schemaVersion = 1;
        manifest.appVersion = QStringLiteral("1.1.4");
        manifest.createdAt = QStringLiteral("2026-11-02T10:00:00.000Z");
        manifest.categories = {QStringLiteral("metadata"), QStringLiteral("images"), QStringLiteral("inventoryImages")};
        manifest.counts = {{QStringLiteral("games"), 2}, {QStringLiteral("inventoryItems"), 1}};
        QByteArray json;
        QString error;
        QVERIFY2(gamestock::writePortableManifest(manifest, &json, &error), qPrintable(error));
        gamestock::PortableManifest parsed;
        QVERIFY2(gamestock::readPortableManifest(json, &parsed, &error), qPrintable(error));
        QCOMPARE(parsed.schemaVersion, 1);
        QCOMPARE(parsed.appVersion, QString("1.1.4"));
        QCOMPARE(parsed.categories, QStringList({QStringLiteral("metadata"), QStringLiteral("images"),
            QStringLiteral("inventoryImages")}));
        QCOMPARE(parsed.counts.value(QStringLiteral("games")).toInt(), 2);

        // Schema futuro é recusado antes de qualquer leitura de dados.
        QByteArray future = json;
        future.replace("\"schemaVersion\":1", "\"schemaVersion\":2");
        QVERIFY(!gamestock::readPortableManifest(future, &parsed, &error));
        QVERIFY2(error.contains(QStringLiteral("não suportada")), qPrintable(error));

        gamestock::PortableManifest empty;
        empty.schemaVersion = 1;
        QVERIFY(!gamestock::writePortableManifest(empty, &json, &error));
        QVERIFY2(error.contains(QStringLiteral("categoria")), qPrintable(error));

        QVERIFY(!gamestock::readPortableManifest(QByteArrayLiteral("nao e json"), &parsed, &error));
        QVERIFY2(error.contains(QStringLiteral("inválido")), qPrintable(error));
    }

    void extractionRejectsTraversalAndSymlinks() {
        const QString fixtures = QString::fromUtf8(GAMESTOCK_TEST_FIXTURES);
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        gamestock::ZipReader traversal;
        QString error;
        QVERIFY2(traversal.open(QDir(fixtures).filePath("traversal.gamestock-backup"), &error), qPrintable(error));
        const QString traversalRoot = dir.filePath("saida-traversal");
        QList<QPair<QString, QString>> extracted;
        QVERIFY(!traversal.extractPrefix(QStringLiteral("media/"), traversalRoot, 1024, 4096, &extracted, &error));
        QVERIFY2(error.contains(QStringLiteral("inválido")), qPrintable(error));
        QVERIFY(!QFile::exists(dir.filePath("escape.txt")));
        QVERIFY(!QFile::exists(dir.filePath("saida-traversal/safe.txt")));

        gamestock::ZipReader symlink;
        QVERIFY2(symlink.open(QDir(fixtures).filePath("symlink.gamestock-backup"), &error), qPrintable(error));
        const QString symlinkRoot = dir.filePath("saida-symlink");
        QVERIFY2(symlink.extractPrefix(QStringLiteral("media/"), symlinkRoot, 1024, 4096, &extracted, &error),
            qPrintable(error));
        QVERIFY(QFile::exists(QDir(symlinkRoot).filePath("safe.txt")));
        QVERIFY(!QFileInfo(QDir(symlinkRoot).filePath("link.txt")).isSymLink());
        QVERIFY(!QFile::exists(QDir(symlinkRoot).filePath("link.txt")));
    }

    void electronFixtureReadsWhenAvailable() {
        // Fixtures locais do harness; o teste é omitido em checkouts limpos.
        const QString fixture = qEnvironmentVariable("GAMESTOCK_BACKUP_FIXTURE");
        if (fixture.isEmpty() || !QFile::exists(fixture)) QSKIP("Fixture de backup não configurada.");
        gamestock::ZipReader reader;
        QString error;
        QVERIFY2(reader.open(fixture, &error), qPrintable(error));
        QVERIFY(reader.contains(QStringLiteral("manifest.json")));
        QByteArray json;
        QVERIFY2(reader.readEntry(QStringLiteral("manifest.json"), 1024 * 1024, &json, &error), qPrintable(error));
        gamestock::PortableManifest manifest;
        QVERIFY2(gamestock::readPortableManifest(json, &manifest, &error), qPrintable(error));
        QCOMPARE(manifest.schemaVersion, 1);
    }
};

QTEST_GUILESS_MAIN(PortableArchiveTest)
#include "PortableArchiveTest.moc"
