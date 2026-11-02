/** Verifica a fachada de plataformas: contagens, CRUD, bloqueios e mapeamentos. */
#include "db/Database.h"
#include "db/dao/GameWriteDao.h"
#include "services/PlatformService.h"

#include <QSqlError>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QtTest>

namespace {
/** Localiza o ID de uma plataforma do catálogo de seeds. */
qint64 platformId(QSqlDatabase& database, const QString& name) {
    QSqlQuery query(database);
    query.prepare(QStringLiteral("SELECT id FROM platforms WHERE name = ?"));
    query.bindValue(0, name);
    if (!query.exec() || !query.next()) return 0;
    return query.value(0).toLongLong();
}

/** Procura uma plataforma na lista observável exposta ao QML. */
QVariantMap findPlatform(const QVariantList& items, qint64 id) {
    for (const QVariant& entry : items) {
        const QVariantMap platform = entry.toMap();
        if (platform.value(QStringLiteral("id")).toLongLong() == id) return platform;
    }
    return {};
}

/** Cria um item de inventário para comprovar o bloqueio de exclusão. */
bool insertInventoryItem(QSqlDatabase& database, qint64 platformId, QString* error) {
    QSqlQuery query(database);
    if (!query.prepare(QStringLiteral("INSERT INTO hardware_items (name, platform_id) VALUES ('Controle', ?)"))) {
        if (error) *error = query.lastError().text();
        return false;
    }
    query.addBindValue(platformId);
    if (!query.exec()) {
        if (error) *error = query.lastError().text();
        return false;
    }
    return true;
}
} // namespace

/** CRUD e leitura facetada sobre um banco temporário criado pelo próprio runtime. */
class PlatformServiceTest : public QObject {
    Q_OBJECT
private slots:
    /** Listagem inclui `gameCount`; criar/editar validam nome e duplicidade. */
    void crudAndCounts() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        qint64 snes = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
            snes = platformId(database.handle(), QStringLiteral("Super Nintendo"));
            QVERIFY(snes > 0);
            gamestock::GameWriteDao games(database.handle());
            qint64 gameId = 0;
            QVERIFY2(games.create({{"title", "Aventura"}, {"platform_id", snes}}, &gameId, &error), qPrintable(error));
        }

        gamestock::PlatformService service;
        QString error;
        QVERIFY2(service.open(path, &error), qPrintable(error));
        QVERIFY(service.available());
        QVERIFY(service.items().size() >= 34);        const QVariantMap catalogued = findPlatform(service.items(), snes);
        QCOMPARE(catalogued.value("name").toString(), QString("Super Nintendo"));
        QCOMPARE(catalogued.value("gameCount").toLongLong(), static_cast<qint64>(1));
        QCOMPARE(catalogued.value("isDefault").toBool(), true);
        QCOMPARE(service.model()->rowCount(), static_cast<int>(service.items().size()));
        QCOMPARE(service.get(snes).value("name").toString(), QString("Super Nintendo"));

        const qint64 custom = service.create(QStringLiteral("  Minha Plataforma  "), QStringLiteral("Custom"));
        QVERIFY(custom > 0);
        const QVariantMap created = service.get(custom);
        QCOMPARE(created.value("name").toString(), QString("Minha Plataforma"));
        QCOMPARE(created.value("category").toString(), QString("Custom"));
        QCOMPARE(created.value("gameCount").toLongLong(), static_cast<qint64>(0));
        QCOMPARE(created.value("isDefault").toBool(), false);
        QCOMPARE(findPlatform(service.items(), custom).value("name").toString(), QString("Minha Plataforma"));

        // Nome vazio e duplicidade usam as mensagens acionáveis do Electron.
        QCOMPARE(service.create(QStringLiteral("   "), QString()), static_cast<qint64>(-1));
        QVERIFY(service.error().contains(QStringLiteral("Nome")));
        QCOMPARE(service.create(QStringLiteral("Minha Plataforma"), QString()), static_cast<qint64>(-1));
        QVERIFY(service.error().contains(QStringLiteral("já existe")));
        const qint64 other = service.create(QStringLiteral("Outra Plataforma"), QString());
        QVERIFY(other > 0);
        QCOMPARE(service.get(other).value("category").toString(), QString("Outros"));

        // Categoria vazia preserva o valor atual, como no Electron.
        QVERIFY(service.update(other, QString(), QString()));
        QCOMPARE(service.get(other).value("category").toString(), QString("Outros"));
        QVERIFY(service.update(other, QStringLiteral("Renomeada"), QStringLiteral("Nova")));
        QCOMPARE(service.get(other).value("name").toString(), QString("Renomeada"));
        QVERIFY(!service.update(other, QStringLiteral("Super Nintendo"), QString()));
        QVERIFY(service.error().contains(QStringLiteral("já existe")));
        QVERIFY(!service.update(999999, QStringLiteral("Fantasma"), QString()));
        QVERIFY(service.error().contains(QStringLiteral("não encontrada")));

        QVERIFY(service.remove(custom));
        QVERIFY(findPlatform(service.items(), custom).isEmpty());
        QVERIFY(service.get(custom).isEmpty());
    }

    /** Exclusão bloqueia padrão, jogos e inventário, na ordem do DAO legado. */
    void deletionRules() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        qint64 snes = 0;
        qint64 gamePlatform = 0;
        qint64 inventoryPlatform = 0;
        qint64 freePlatform = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
            snes = platformId(database.handle(), QStringLiteral("Super Nintendo"));
            QVERIFY(snes > 0);

            gamestock::PlatformService service;
            QVERIFY2(service.open(path, &error), qPrintable(error));
            gamePlatform = service.create(QStringLiteral("Com Jogos"), QString());
            inventoryPlatform = service.create(QStringLiteral("Com Inventário"), QString());
            freePlatform = service.create(QStringLiteral("Sem Vínculos"), QString());
            QVERIFY(gamePlatform > 0 && inventoryPlatform > 0 && freePlatform > 0);

            gamestock::GameWriteDao games(database.handle());
            qint64 gameId = 0;
            QVERIFY2(games.create({{"title", "Jogo Vinculado"}, {"platform_id", gamePlatform}}, &gameId, &error), qPrintable(error));
            QVERIFY2(insertInventoryItem(database.handle(), inventoryPlatform, &error), qPrintable(error));

            QVERIFY(!service.remove(snes));
            QVERIFY(service.error().contains(QStringLiteral("padrão")));
            QVERIFY(!service.remove(gamePlatform));
            QVERIFY(service.error().contains(QStringLiteral("jogos associados")));
            QVERIFY(!service.remove(inventoryPlatform));
            QVERIFY(service.error().contains(QStringLiteral("inventário")));
            QVERIFY(service.remove(freePlatform));
            QVERIFY(service.get(freePlatform).isEmpty());
        }
    }

    /** Mapeamentos substituem aliases/extensões em transação e validam o mínimo. */
    void mappings() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        gamestock::PlatformService service;
        QString error;
        {
            gamestock::Database database;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
            QVERIFY2(service.open(path, &error), qPrintable(error));
        }
        const qint64 id = service.create(QStringLiteral("Plataforma de Teste"), QString());
        QVERIFY(id > 0);

        QVariantList aliases;
        aliases.append(QStringLiteral("  Alias Um  "));
        aliases.append(QStringLiteral("   "));
        aliases.append(QStringLiteral("Alias Um"));
        QVariantList extensions;
        extensions.append(QVariantMap{{QStringLiteral("extension"), QStringLiteral("NES")},
            {QStringLiteral("kind"), QStringLiteral("rom")}, {QStringLiteral("is_primary"), true}});
        // Extensão duplicada mantém a última entrada, como o Map do DAO Electron.
        extensions.append(QVariantMap{{QStringLiteral("extension"), QStringLiteral(".nes")},
            {QStringLiteral("kind"), QStringLiteral("dup")}, {QStringLiteral("isPrimary"), true}});
        QVERIFY2(service.saveMappings(id, aliases, extensions), qPrintable(service.error()));

        const QVariantMap saved = service.getMappings(id);
        const QVariantList savedAliases = saved.value("aliases").toList();
        const QVariantList savedExtensions = saved.value("romExtensions").toList();
        QCOMPARE(savedAliases.size(), 1);
        QCOMPARE(savedAliases.at(0).toMap().value("alias").toString(), QString("Alias Um"));
        QCOMPARE(savedExtensions.size(), 1);
        QCOMPARE(savedExtensions.at(0).toMap().value("extension").toString(), QString(".nes"));
        QCOMPARE(savedExtensions.at(0).toMap().value("kind").toString(), QString("dup"));
        QCOMPARE(savedExtensions.at(0).toMap().value("isPrimary").toBool(), true);

        // Validações impedem estado parcial e preservam os mapeamentos anteriores.
        QVariantList withoutAlias;
        QVERIFY(!service.saveMappings(id, withoutAlias, extensions));
        QVERIFY(service.error().contains(QStringLiteral("alias")));
        QVariantList onlyAliases;
        onlyAliases.append(QStringLiteral("Alias"));
        QVariantList withoutExtensions;
        QVERIFY(!service.saveMappings(id, onlyAliases, withoutExtensions));
        QVERIFY(service.error().contains(QStringLiteral("extensão")));
        QVariantList noPrimary;
        noPrimary.append(QVariantMap{{QStringLiteral("extension"), QStringLiteral(".sfc")},
            {QStringLiteral("is_primary"), false}});
        QVERIFY(!service.saveMappings(id, onlyAliases, noPrimary));
        QVERIFY(service.error().contains(QStringLiteral("principal")));
        QCOMPARE(service.getMappings(id).value("romExtensions").toList().size(), 1);
        QVERIFY(!service.saveMappings(999999, onlyAliases, extensions));
        QVERIFY(service.error().contains(QStringLiteral("não encontrada")));

        // A substituição remove o estado anterior em vez de acumular.
        QVariantList replacement;
        replacement.append(QStringLiteral("Novo Alias"));
        QVariantList replacementExtensions;
        replacementExtensions.append(QVariantMap{{QStringLiteral("extension"), QStringLiteral(".smc")},
            {QStringLiteral("is_primary"), true}});
        QVERIFY2(service.saveMappings(id, replacement, replacementExtensions), qPrintable(service.error()));
        const QVariantMap replaced = service.getMappings(id);
        QCOMPARE(replaced.value("aliases").toList().size(), 1);
        QCOMPARE(replaced.value("aliases").toList().at(0).toMap().value("alias").toString(), QString("Novo Alias"));
        QCOMPARE(replaced.value("romExtensions").toList().at(0).toMap().value("extension").toString(), QString(".smc"));
        QCOMPARE(replaced.value("romExtensions").toList().at(0).toMap().value("isPrimary").toBool(), true);
    }
};

QTEST_GUILESS_MAIN(PlatformServiceTest)
#include "PlatformServiceTest.moc"
