/** Persiste a geometria no formato legado e impede restauração fora dos monitores. */
#pragma once

#include <QList>
#include <QRect>
#include <QMargins>
#include <QString>

namespace gamestock {

/** Calcula uma geometria visível, centralizando quando a posição anterior não é válida. */
QRect visibleWindowGeometry(const QRect& stored, const QList<QRect>& screens);

/** Converte tamanho externo legado em área interna Qt sem produzir dimensões negativas. */
QSize contentSizeForFrame(const QSize& frameSize, const QMargins& margins);

/** Lê JSON legado; arquivo ausente ou inválido produz os valores iniciais do app. */
QRect loadWindowGeometry(const QString& filePath, const QList<QRect>& screens);

/** Grava JSON atomicamente sem substituir arquivo válido se a gravação falhar. */
bool saveWindowGeometry(const QString& filePath, const QRect& geometry);

} // namespace gamestock
