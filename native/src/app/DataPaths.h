/** Resolve o perfil legado e valida arquivos de mídia antes de expô-los à interface. */
#pragma once

#include <QProcessEnvironment>
#include <QString>

namespace gamestock {
/** Resolve o perfil sem criar diretórios nem alterar dados existentes. */
QString userDataPath(const QProcessEnvironment& environment, const QString& home, bool windows);

/** Retorna o caminho canônico de um arquivo dentro do perfil, ou vazio quando recusado. */
QString validatedMediaPath(const QString& profile, const QString& requested);
} // namespace gamestock
