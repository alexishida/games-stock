/** Lê imagens locais somente quando o arquivo aberto pertence ao perfil permitido. */
#pragma once
#include <QImage>
#include <QSize>
#include <QString>

namespace gamestock {
/** Abre e valida o mesmo arquivo antes de decodificar a imagem; retorna imagem vazia em falha.
 *  Quando `targetSize` é válido, o decodificador já entrega a imagem reduzida (sem escala extra). */
QImage readProfileImage(const QString& profile, const QString& requested, const QSize& targetSize = QSize());
}
