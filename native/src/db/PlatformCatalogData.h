/** Catálogo de plataformas compartilhado pelos seeds e migrations nativas. */
#pragma once

#include <QList>
#include <QPair>
#include <QString>

namespace gamestock::catalog {

/** Extensão de ROM aceita por uma plataforma, com o tipo legível do formato. */
struct RomExtension {
    QString extension;
    QString kind;
    bool primary = false;
};

/** Entrada do catálogo estático; a ordem de declaração define os IDs dos seeds. */
struct PlatformEntry {
    QString name;
    QString category;
    QList<QString> launchboxAliases;
    QList<RomExtension> romExtensions;
};

/** Nomes antigos que devem ser consolidados nas plataformas canônicas. */
const QList<PlatformEntry>& platforms();
const QList<QPair<QString, QString>>& legacyAliases();

} // namespace gamestock::catalog
