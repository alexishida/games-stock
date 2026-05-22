/**
 * Splash screen exibida durante o fluxo de atualização automática.
 *
 * Ela escuta os eventos do updater via preload e exibe progresso, versão local
 * e modal de fallback offline quando não há conexão.
 */

import { useEffect, useMemo, useState } from "react";
import { Download, Gamepad2, RefreshCw, TriangleAlert, WifiOff } from "lucide-react";
import type { UpdaterAppInfo, UpdaterStatus } from "../shared/updater";
import splashHero from "../renderer/assets/gamestock-splash.png";

/** Estado inicial exibido enquanto o main ainda não enviou progresso real. */
const INITIAL_STATUS: UpdaterStatus = {
  phase: "checking",
  message: "Verificando atualizações..."
};

/** Estado inicial da build instalada antes de consultar o main. */
const INITIAL_APP_INFO: UpdaterAppInfo = {
  version: "0.0.0",
  buildNumber: "local"
};

/**
 * Componente visual da splash.
 */
export function SplashScreen() {
  const [appInfo, setAppInfo] = useState<UpdaterAppInfo>(INITIAL_APP_INFO);
  const [status, setStatus] = useState<UpdaterStatus>(INITIAL_STATUS);
  const [skipping, setSkipping] = useState(false);

  // Busca versão/build instalados localmente para exibir no rodapé da splash.
  useEffect(() => {
    let canceled = false;

    void window.gameStockAPI.updater.getAppInfo().then((nextInfo) => {
      if (!canceled) setAppInfo(nextInfo);
    }).catch(() => undefined);

    return () => {
      canceled = true;
    };
  }, []);

  // Reage a todas as mudanças de fase emitidas pelo main process.
  useEffect(() => window.gameStockAPI.updater.onStatus((nextStatus) => {
    setStatus(nextStatus);
    if (!nextStatus.requiresAction) {
      setSkipping(false);
    }
  }), []);

  // Escolhe ícone e percentual visual padrão para estados sem valor explícito.
  const presentation = useMemo(() => {
    switch (status.phase) {
      case "checking":
        return {
          icon: <RefreshCw aria-hidden="true" className="spin" size={18} />,
          percent: 18
        };
      case "downloading":
        return {
          icon: <Download aria-hidden="true" size={18} />,
          percent: status.percent ?? 0
        };
      case "applying":
        return {
          icon: <RefreshCw aria-hidden="true" className="spin" size={18} />,
          percent: null
        };
      case "up-to-date":
        return {
          icon: <Gamepad2 aria-hidden="true" size={18} />,
          percent: 100
        };
      case "no-connection":
        return {
          icon: <WifiOff aria-hidden="true" size={18} />,
          percent: 0
        };
      case "error":
        return {
          icon: <TriangleAlert aria-hidden="true" size={18} />,
          percent: 100
        };
    }
  }, [status]);

  /**
   * Continua o boot sem update quando o usuário opta por modo offline.
   */
  async function handleSkipOffline(): Promise<void> {
    try {
      setSkipping(true);
      await window.gameStockAPI.updater.skip();
    } catch {
      setSkipping(false);
    }
  }

  return (
    <div className="splash-shell">
      <div className="splash-card" role="status" aria-live="polite" style={{ backgroundImage: `url(${splashHero})` }}>

        <div className="splash-version-strip" aria-hidden="true">
          <span>{`v${appInfo.version}`}</span>
          <span>{`build ${appInfo.buildNumber}`}</span>
        </div>

        <section className="splash-body">
          <div className="splash-status-row">
            <span className={`splash-status-icon phase-${status.phase}`}>
              {presentation.icon}
            </span>
            <div className="splash-status-copy">
              <strong>{status.message}</strong>
              <small>{status.error ?? "Preparando ambiente do GameStock."}</small>
            </div>
          </div>

          {status.phase === "downloading" && typeof presentation.percent === "number" && (
            <div className="splash-progress-block">
              <div className="splash-progress-meta">
                <span>Download</span>
                <span>{`${Math.max(0, Math.min(100, presentation.percent))}%`}</span>
              </div>
              <div className="splash-progress-track">
                <span style={{ width: `${Math.max(0, Math.min(100, presentation.percent))}%` }} />
              </div>
            </div>
          )}
        </section>

        {status.phase === "no-connection" && (
          <div className="splash-overlay">
            <div className="splash-offline-dialog">
              <div className="splash-offline-title">
                <WifiOff size={18} aria-hidden="true" />
                <strong>Sem conexão com a internet</strong>
              </div>
              <p>
                Não foi possível verificar atualizações agora. Você ainda pode abrir o GameStock
                com a versão instalada neste computador.
              </p>
              <div className="splash-offline-actions">
                <button
                  type="button"
                  className="text-button active"
                  onClick={() => void handleSkipOffline()}
                  disabled={skipping}
                >
                  Continuar em modo offline
                </button>
              </div>
            </div>
          </div>
        )}

        {status.phase === "error" && status.requiresAction && (
          <div className="splash-overlay">
            <div className="splash-offline-dialog">
              <div className="splash-offline-title">
                <TriangleAlert size={18} aria-hidden="true" />
                <strong>Falha ao aplicar atualização</strong>
              </div>
              <p>
                O GameStock não conseguiu concluir download, extração ou aplicação do pacote.
                Você pode abrir o app mesmo assim e consultar o log salvo no computador.
              </p>
              {status.error && (
                <p>{status.error}</p>
              )}
              {status.errorLogPath && (
                <p>{`Log: ${status.errorLogPath}`}</p>
              )}
              <div className="splash-offline-actions">
                <button
                  type="button"
                  className="text-button active"
                  onClick={() => void handleSkipOffline()}
                  disabled={skipping}
                >
                  Abrir mesmo assim
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
