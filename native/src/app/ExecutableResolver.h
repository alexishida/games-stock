/** Resolve executáveis configurados sem depender de shell ou de Node.js. */
#pragma once

#include <QString>

namespace gamestock {
/** Resultado da resolução de um executável; erro vazio indica sucesso. */
struct ExecutableResolution {
    QString configuredValue;
    QString resolvedPath;
    /** `filesystem` para caminho local e `path` para comando encontrado no PATH. */
    QString source;
    QString error;
    /** `NOT_FOUND` ou `NOT_EXECUTABLE`; vazio em sucesso. */
    QString code;
};

/** Aceita caminho absoluto, relativo ou nome de comando resolvido pelo PATH. */
ExecutableResolution resolveConfiguredExecutable(const QString& configured);
} // namespace gamestock
