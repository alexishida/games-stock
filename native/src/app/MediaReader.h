/** Lê imagens locais somente quando o arquivo aberto pertence ao perfil permitido. */
#pragma once
#include <QImage>
#include <QString>

namespace gamestock {
/** Abre e valida o mesmo arquivo antes de decodificar a imagem; retorna imagem vazia em falha. */
QImage readProfileImage(const QString& profile, const QString& requested);
}
