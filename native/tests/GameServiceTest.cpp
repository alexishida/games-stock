/** Verifica a fachada de biblioteca e o modelo exposto ao QML. */
#include "db/Database.h"
#include "db/dao/GameWriteDao.h"
#include "services/GameService.h"

#include <QDir>
#include <QFile>
#include <QSqlQuery>
#include <QTemporaryDir>
#include <QtTest>

namespace {
qint64 platformId(QSqlDatabase& database, const QString& name) {
    QSqlQuery query(database);
    query.prepare(QStringLiteral("SELECT id FROM platforms WHERE name = ?"));
    query.bindValue(0, name);
    if (!query.exec() || !query.next()) return 0;
    return query.value(0).toLongLong();
}
} // namespace

/** Cobre filtros, contadores, papéis do modelo e paginação sem QML. */
class GameServiceTest : public QObject {
    Q_OBJECT
private slots:
    /** Serviço lista, filtra e conta a partir do SQLite real, sem SQL na UI. */
    void libraryService() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
            const qint64 platform = platformId(database.handle(), QStringLiteral("Super Nintendo"));
            QVERIFY(platform > 0);
            gamestock::GameWriteDao dao(database.handle());
            qint64 id = 0;
            QVERIFY(dao.create({{"title", "Aventura"}, {"platform_id", platform}, {"favorite", true},
                {"play_status", "playing"}, {"rom_path", "C:/roms/Aventura (USA).sfc"}}, &id, &error));
            QVERIFY(dao.create({{"title", "Concluído"}, {"platform_id", platform},
                {"play_status", "completed"}}, &id, &error));
            QVERIFY(dao.create({{"title", "Com capa"}, {"platform_id", platform},
                {"box_art_path", "C:/capas/capa.jpg"}}, &id, &error));
        }

        gamestock::GameService service;
        QString error;
        QVERIFY2(service.open(path, &error), qPrintable(error));
        QVERIFY(service.isOpen());
        QCOMPARE(service.total(), static_cast<qint64>(3));
        QCOMPARE(service.filtered(), static_cast<qint64>(3));
        QCOMPARE(service.model()->rowCount(), 3);
        QCOMPARE(service.favoritesCount(), static_cast<qint64>(1));
        QCOMPARE(service.playingCount(), static_cast<qint64>(1));
        QCOMPARE(service.completedCount(), static_cast<qint64>(1));
        QCOMPARE(service.mostPlayedCount(), static_cast<qint64>(0));

        // Papéis usados pelos delegates, incluindo a URL do provider de mídia.
        const QModelIndex first = service.model()->index(0, 0);
        QCOMPARE(service.model()->data(first, gamestock::GameListModel::TitleRole).toString(), QString("Aventura"));
        QCOMPARE(service.model()->data(first, gamestock::GameListModel::PlatformNameRole).toString(),
            QString("Super Nintendo"));
        QVERIFY(service.model()->data(first, gamestock::GameListModel::FavoriteRole).toBool());
        const QModelIndex coverIndex = service.model()->index(1, 0);
        QCOMPARE(service.model()->data(coverIndex, gamestock::GameListModel::TitleRole).toString(), QString("Com capa"));
        QVERIFY(service.model()->data(coverIndex, gamestock::GameListModel::CoverUrlRole).toString()
            .startsWith(QStringLiteral("image://profilemedia/")));
        // A lista para QML já contém a URL pronta e mantém a ordem do modelo.
        QCOMPARE(service.items().size(), 3);
        QCOMPARE(service.items().at(0).toMap().value("title").toString(), QString("Aventura"));
        QCOMPARE(service.items().at(1).toMap().value("coverUrl").toString().startsWith(QStringLiteral("image://profilemedia/")), true);
        QVERIFY(service.available());

        service.setCollection("favorites");
        QCOMPARE(service.filtered(), static_cast<qint64>(1));
        QCOMPARE(service.model()->rowCount(), 1);
        service.setCollection("all");
        service.setSearch("conclu");
        QCOMPARE(service.filtered(), static_cast<qint64>(1));
        service.setSearch("");
        service.setPageSize(2);
        QCOMPARE(service.model()->rowCount(), 2);
        service.goToPage(2);
        QCOMPARE(service.model()->rowCount(), 1);
    }

    /** CRUD tipado, validação e filtros combinados usam o mesmo contrato do Electron. */
    void crudAndCombinedFilters() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        qint64 snes = 0;
        qint64 nes = 0;
        qint64 primary = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, dir.filePath("db/images"), &error), qPrintable(error));
            snes = platformId(database.handle(), QStringLiteral("Super Nintendo"));
            nes = platformId(database.handle(), QStringLiteral("Nintendo NES"));
            QVERIFY(snes > 0 && nes > 0);
            gamestock::GameWriteDao dao(database.handle());
            QVERIFY2(dao.create({{"title", "Ação Total"}, {"platform_id", snes},
                {"genre", "Ação; Plataforma"}, {"favorite", true}}, &primary, &error), qPrintable(error));
            qint64 id = 0;
            QVERIFY2(dao.create({{"title", "Ação Secundária"}, {"platform_id", snes},
                {"genre", "Ação"}, {"play_status", "playing"}}, &id, &error), qPrintable(error));
            QVERIFY2(dao.create({{"title", "Outro Jogo"}, {"platform_id", nes}}, &id, &error), qPrintable(error));
        }

        gamestock::GameService service;
        QString error;
        QVERIFY2(service.open(path, &error), qPrintable(error));
        QCOMPARE(service.total(), static_cast<qint64>(3));

        // O mapa completo mantém o booleano e a URL segura de mídia.
        const QVariantMap game = service.get(primary);
        QCOMPARE(game.value("title").toString(), QString("Ação Total"));
        QCOMPARE(game.value("favorite").toBool(), true);
        QVERIFY(game.value("coverUrl").toString().isEmpty());

        // Filtros combinados: plataforma + busca + gênero + coleção.
        service.setPlatformId(snes);
        service.setSearch("ação");
        service.setGenre("Ação");
        service.setCollection("favorites");
        QCOMPARE(service.filtered(), static_cast<qint64>(1));
        QCOMPARE(service.model()->rowCount(), 1);
        // Gênero composto é comparado por token, preservando o rótulo exibido.
        service.setGenre("Plataforma");
        QCOMPARE(service.filtered(), static_cast<qint64>(1));
        QVERIFY(service.genres().contains("Ação"));
        QVERIFY(service.genres().contains("Plataforma"));
        service.setGenre("");
        service.setCollection("all");
        service.setSearch("");

        // Validação do serviço devolve erro acionável, sem gravar registro.
        QVERIFY(service.create({{"title", "   "}, {"platform_id", snes}}).isEmpty());
        QVERIFY(service.error().contains(QStringLiteral("Título")));
        QVERIFY(service.create({{"title", "Sem plataforma"}}).isEmpty());
        QVERIFY(service.error().contains(QStringLiteral("Plataforma")));

        const QVariantMap created = service.create({{"title", "Novo Jogo"}, {"platform_id", snes},
            {"genre", "Aventura"}, {"favorite", true}, {"play_status", "completed"}});
        QVERIFY(!created.isEmpty());
        const qint64 createdId = created.value("id").toLongLong();
        QCOMPARE(service.total(), static_cast<qint64>(4));
        QCOMPARE(service.get(createdId).value("title").toString(), QString("Novo Jogo"));
        QCOMPARE(service.favoritesCount(), static_cast<qint64>(2));
        QCOMPARE(service.completedCount(), static_cast<qint64>(1));

        QVERIFY(service.update(createdId, {{"title", "Jogo Editado"}, {"favorite", false}}));
        QCOMPARE(service.get(createdId).value("title").toString(), QString("Jogo Editado"));
        QCOMPARE(service.favoritesCount(), static_cast<qint64>(1));
        QVERIFY(!service.update(createdId, {{"campo_invalido", 1}}));
        QVERIFY(service.error().contains(QStringLiteral("Campo não editável")));
        QVERIFY(!service.update(999999, {{"title", "Nada"}}));

        QVERIFY(service.remove(createdId));
        QVERIFY(service.get(createdId).isEmpty());
        QCOMPARE(service.total(), static_cast<qint64>(3));
        // Ausência não é erro no contrato de exclusão do Electron.
        QVERIFY(service.remove(createdId));
    }

    /** Variantes, mídias e estatísticas são expostas sem SQL na interface. */
    void variantsMediaAndStats() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString path = dir.filePath("db/gamestock.db");
        const QString images = dir.filePath("db/images");
        const QString mediaDir = images + QStringLiteral("/Super Nintendo/Aventura");
        QVERIFY(QDir().mkpath(mediaDir));
        for (const QString& name : {QStringLiteral("cover.jpg"), QStringLiteral("box-front-01.png"),
                 QStringLiteral("cart-front.jpg"), QStringLiteral("fanart-background.jpg"),
                 QStringLiteral("screenshot-01.png"), QStringLiteral("notas.txt")}) {
            QFile file(mediaDir + QLatin1Char('/') + name);
            QVERIFY(file.open(QIODevice::WriteOnly));
            file.write("x");
        }
        qint64 platform = 0;
        {
            gamestock::Database database;
            QString error;
            QVERIFY2(database.open(path, images, &error), qPrintable(error));
            platform = platformId(database.handle(), QStringLiteral("Super Nintendo"));
            QVERIFY(platform > 0);
        }

        gamestock::GameService service;
        QString error;
        QVERIFY2(service.open(path, &error), qPrintable(error));
        // A raiz padrão é o diretório do banco, que contém `images/`.
        QCOMPARE(QDir::cleanPath(service.mediaRoot()), QDir::cleanPath(dir.filePath("db")));

        const QVariantMap usa = service.create({{"title", "Aventura"}, {"platform_id", platform},
            {"rom_path", "C:/roms/Aventura (USA).sfc"}, {"launch_count", 0},
            {"box_art_path", mediaDir + QStringLiteral("/cover.jpg")}});
        QVERIFY(!usa.isEmpty());
        const QVariantMap europe = service.create({{"title", "Aventura"}, {"platform_id", platform},
            {"rom_path", "C:/roms/Aventura (Europe).sfc"}, {"launch_count", 2}});
        QVERIFY(!europe.isEmpty());
        // Mesmo título-base permanece em um card e as variantes aparecem no seletor.
        QCOMPARE(service.total(), static_cast<qint64>(1));
        QCOMPARE(service.model()->rowCount(), 1);
        const QVariantList versions = service.listVersions(usa.value("id").toLongLong());
        QCOMPARE(versions.size(), 2);
        QCOMPARE(versions.at(0).toMap().value("launchCount").toInt(), 2);
        QCOMPARE(versions.at(0).toMap().value("regionLabel").toString(), QString("EUR"));
        QCOMPARE(versions.at(1).toMap().value("regionLabel").toString(), QString("USA"));

        // Galeria exclui a capa principal e arquivos não suportados, na ordem do Electron.
        const QVariantList media = service.listMedia(usa.value("id").toLongLong());
        QCOMPARE(media.size(), 4);
        QCOMPARE(media.at(0).toMap().value("kind").toString(), QString("box-art"));
        QCOMPARE(media.at(1).toMap().value("kind").toString(), QString("cart"));
        QCOMPARE(media.at(2).toMap().value("kind").toString(), QString("background"));
        QCOMPARE(media.at(3).toMap().value("kind").toString(), QString("screenshot"));
        QCOMPARE(media.at(0).toMap().value("label").toString(), QString("Box Front"));
        for (const QVariant& entry : media) QVERIFY(entry.toMap().value("kind").toString() != QString("cover"));
        QVERIFY(service.listMedia(999999).isEmpty());

        // Estatísticas agregadas acompanham criação, contagem e reset.
        QCOMPARE(service.totalLaunches(), static_cast<qint64>(2));
        QCOMPARE(service.playedGames(), static_cast<qint64>(1));
        QCOMPARE(service.coverTotal(), static_cast<qint64>(2));
        QCOMPARE(service.coverDownloaded(), static_cast<qint64>(1));
        QCOMPARE(service.coverMissing(), static_cast<qint64>(1));
        const QVariantMap reset = service.resetLaunchStats();
        QCOMPARE(reset.value("updated").toLongLong(), static_cast<qint64>(1));
        QCOMPARE(service.totalLaunches(), static_cast<qint64>(0));
        QCOMPARE(service.mostPlayedCount(), static_cast<qint64>(0));
        const QVariantMap collections = service.collectionCounts();
        QCOMPARE(collections.value("favorites").toLongLong(), static_cast<qint64>(0));
    }

    /** A exportação restringe a origem ao perfil e preserva bytes/destino em falhas. */
    void saveProfileImage() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString profile = dir.filePath("perfil");
        QVERIFY(QDir().mkpath(profile));
        const QByteArray png = QByteArray::fromBase64("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
        const QString source = QDir(profile).filePath("origem.png");
        QFile input(source);
        QVERIFY(input.open(QIODevice::WriteOnly));
        QCOMPARE(input.write(png), png.size());
        input.close();
        gamestock::GameService service;
        service.setMediaRoot(profile);
        const QString target = dir.filePath("imagem salva.png");
        QVERIFY(service.saveImage(source, QUrl::fromLocalFile(target)).value("success").toBool());
        QFile saved(target);
        QVERIFY(saved.open(QIODevice::ReadOnly));
        QCOMPARE(saved.readAll(), png);
        saved.close();
        // Um arquivo fora do perfil não pode ser exportado, mesmo que seja imagem válida.
        QVERIFY(!service.saveImage(target, QUrl::fromLocalFile(source)).value("success").toBool());
        QVERIFY(!service.saveImage(source, QUrl("https://example.invalid/image.png")).value("success").toBool());
        const QString textPath = QDir(profile).filePath("arquivo.png");
        QFile text(textPath);
        QVERIFY(text.open(QIODevice::WriteOnly));
        text.write("não é imagem");
        text.close();
        QVERIFY(!service.saveImage(textPath, QUrl::fromLocalFile(target)).value("success").toBool());
        QVERIFY(saved.open(QIODevice::ReadOnly));
        QCOMPARE(saved.readAll(), png);
        saved.close();
        QVERIFY(service.saveImage(source, QUrl::fromLocalFile(source)).value("success").toBool());
        // Uma capa externa selecionada é copiada para dentro do perfil, sem mudar a origem.
        const QVariantMap imported = service.importImage(QUrl::fromLocalFile(target));
        QVERIFY(imported.value("success").toBool());
        QVERIFY(imported.value("path").toString().startsWith(profile));
        QFile importedImage(imported.value("path").toString());
        QVERIFY(importedImage.open(QIODevice::ReadOnly));
        QCOMPARE(importedImage.readAll(), png);
        QVERIFY(!service.importImage(QUrl::fromLocalFile(textPath)).value("success").toBool());
        const QString rom = dir.filePath(QString::fromUtf8("ROM com ação.nes"));
        QCOMPARE(service.localFilePath(QUrl::fromLocalFile(rom)), rom);
        // O cadastro por caminho também internaliza a capa, como o seletor do Electron.
        gamestock::Database database;
        QString error;
        const QString databasePath = QDir(profile).filePath("gamestock.db");
        QVERIFY2(database.open(databasePath, QDir(profile).filePath("images"), &error), qPrintable(error));
        QVERIFY2(service.open(databasePath, &error), qPrintable(error));
        const QVariantMap game = service.create({{"title", "Capa local"},
            {"platform_id", platformId(database.handle(), "Super Nintendo")}, {"box_art_path", target}});
        QVERIFY2(!game.isEmpty(), qPrintable(service.error()));
        QVERIFY(game.value("box_art_path").toString().startsWith(profile));
    }

    /** A massa de 5.000 jogos mantém total e primeira página iguais aos do Electron. */
    void electronFixture() {
        const QString path = qEnvironmentVariable("GAMESTOCK_TEST_DATABASE");
        if (path.isEmpty()) QSKIP("Fixture de benchmark não informada.");
        gamestock::GameService service;
        QString error;
        QVERIFY2(service.open(path, &error), qPrintable(error));
        QCOMPARE(service.total(), static_cast<qint64>(2502));
        QCOMPARE(service.model()->rowCount(), 36);
        QCOMPARE(service.model()->data(service.model()->index(0, 0),
            gamestock::GameListModel::TitleRole).toString(), QString("Aventura Legada"));
        QCOMPARE(service.favoritesCount(), static_cast<qint64>(1668));
        QCOMPARE(service.mostPlayedCount(), static_cast<qint64>(2501));
        service.goToPage(2);
        QCOMPARE(service.model()->rowCount(), 36);
    }
};

QTEST_GUILESS_MAIN(GameServiceTest)
#include "GameServiceTest.moc"
