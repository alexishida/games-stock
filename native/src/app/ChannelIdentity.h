/** Identidade do canal instalado/portátil usada pela distribuição e atualização. */
#pragma once

#include <QProcessEnvironment>
#include <QString>

class QSqlDatabase;

namespace gamestock {
/** Canal detectado a partir de marcadores/env, com diretório do executável. */
struct ChannelInfo {
    QString channel;
    QString executableDir;
    QString markerPath;
};

/**
 * Detecta `portable`, `installed` ou `development`.
 * Precedência: override explícito, PORTABLE_EXECUTABLE_DIR, portable.marker,
 * install.marker/uninstall.exe e, por fim, development.
 */
ChannelInfo detectChannel(const QString& executablePath, const QProcessEnvironment& environment,
    const QString& overrideChannel = {});

/** Persiste a identidade em `app_state` para não depender apenas do diretório atual. */
bool saveChannelIdentity(QSqlDatabase& database, const ChannelInfo& info, QString* error);
/** Retorna o canal persistido, ou vazio quando ainda não registrado. */
QString persistedChannel(QSqlDatabase& database, QString* error = nullptr);
} // namespace gamestock
