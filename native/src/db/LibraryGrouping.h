/** Chave de agrupamento persistida, idêntica à regra do renderer Electron. */
#pragma once

#include <QString>

namespace gamestock {
/** Retorna a chave visual de variantes; vazio significa jogo manual independente. */
QString buildStoredLibraryGroupKey(const QString& title, const QString& romPath);

/** Calcula a chave de agrupamento mesmo para jogo manual (usada pelo seletor de versões). */
QString buildVersionGroupKey(const QString& title, const QString& romPath);

/** Subtítulo real da ROM em relação ao título, ou vazio quando não há diferença útil. */
QString variantDescriptor(const QString& romFileName, const QString& title);

/** Remove tags de região, revisão e versão usadas só para comparação. */
QString stripVersionTags(const QString& value);

/** Normaliza título para comparação case-insensitive. */
QString normalizeTitleForMatch(const QString& value);
} // namespace gamestock
