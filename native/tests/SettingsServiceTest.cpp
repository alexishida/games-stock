/** Verifica logs, estatísticas e manutenção expostos por SettingsService. */
#include "db/Database.h"
#include "services/SettingsService.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QtTest>

namespace {
/** Escreve o mesmo formato do handler de mensagens nativo. */
bool writeLog(const QString& path, const QStringList& lines) {
    QFile file(path);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate)) return false;
    for (const QString& line : lines) file.write((line + QLatin1Char('\n')).toUtf8());
    return true;
}
} // namespace

class SettingsServiceTest : public QObject {
    Q_OBJECT
private slots:
    void logsLifecycle() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString logPath = dir.filePath("native-prototype.log");
        QVERIFY(writeLog(logPath, {
            QStringLiteral("2026-11-02T10:00:00.000Z 4 Iniciando protótipo Qt."),
            QStringLiteral("2026-11-02T10:00:01.000Z 1 Provider não carregou a capa."),
            QStringLiteral("linha sem formato reconhecido")
        }));
        gamestock::SettingsService service;
        service.configure(dir.path(), logPath, QString());
        service.refreshLogs();
        QCOMPARE(service.logEntries().size(), 2);
        const QVariantMap first = service.logEntries().first().toMap();
        QCOMPARE(first.value("level").toString(), QString("info"));
        QCOMPARE(first.value("message").toString(), QString("Iniciando protótipo Qt."));
        QVERIFY(first.value("timestamp").toString().startsWith(QStringLiteral("2026-11-02T10:00")));
        QCOMPARE(service.logEntries().at(1).toMap().value("level").toString(), QString("warning"));
        QVERIFY(service.error().isEmpty());

        QVERIFY(service.clearLogs());
        QVERIFY(service.logEntries().isEmpty());
        QCOMPARE(QFileInfo(logPath).size(), qint64(0));

        // Arquivo ausente não é erro fatal: a interface mostra o estado vazio.
        QFile::remove(logPath);
        service.refreshLogs();
        QVERIFY(service.logEntries().isEmpty());
        QVERIFY(service.error().isEmpty());
    }

    void statsAndCache() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString profile = dir.filePath("profile");
        QVERIFY(QDir().mkpath(profile));
        const QString path = QDir(profile).filePath("gamestock.db");
        qint64 platformId = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, QDir(profile).filePath("images"), &error), qPrintable(error));
            QSqlQuery platform(database.handle());
            QVERIFY(platform.exec(QStringLiteral("SELECT id FROM platforms LIMIT 1")) && platform.next());
            platformId = platform.value(0).toLongLong();
            QSqlQuery game(database.handle());
            game.prepare(QStringLiteral("INSERT INTO games (title, platform_id) VALUES ('Jogo sintético', ?)"));
            game.addBindValue(platformId);
            QVERIFY(game.exec());
        }

        gamestock::SettingsService service;
        service.configure(profile, QDir(profile).filePath("native-prototype.log"), path);
        service.refreshStats();
        QCOMPARE(service.totalGames(), qint64(1));
        QCOMPARE(service.totalInventoryItems(), qint64(0));
        QVERIFY(service.dataDirSizeMb() >= 0);
        QCOMPARE(service.statsLoading(), false);
        QVERIFY(service.error().isEmpty());

        // O cache temporário é isolado por variável de ambiente para o teste.
        const QString cacheRoot = dir.filePath("rom-cache");
        QVERIFY(QDir().mkpath(QDir(cacheRoot).filePath("entrada")));
        QFile cached(QDir(cacheRoot).filePath("entrada/jogo.nes"));
        QVERIFY(cached.open(QIODevice::WriteOnly));
        cached.write("x");
        cached.close();
        qputenv("GAMESTOCK_EXTRACTION_DIR", cacheRoot.toUtf8());
        QVERIFY(service.clearRomCache());
        qunsetenv("GAMESTOCK_EXTRACTION_DIR");
        QVERIFY(service.cacheFeedback().length() > 0);
        QVERIFY(!QFileInfo::exists(QDir(cacheRoot).filePath("entrada/jogo.nes")));

        // Banco inexistente mantém os contadores desconhecidos, sem exceção.
        service.configure(profile, QString(), dir.filePath("ausente.db"));
        service.refreshStats();
        QCOMPARE(service.totalGames(), qint64(-1));
        QCOMPARE(service.totalInventoryItems(), qint64(-1));
    }
};

QTEST_GUILESS_MAIN(SettingsServiceTest)
#include "SettingsServiceTest.moc"
