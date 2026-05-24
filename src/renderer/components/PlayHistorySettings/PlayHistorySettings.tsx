/**
 * Seção de Configurações dedicada ao histórico de partidas.
 *
 * Exibe o total agregado de launches registrados e permite limpar
 * manualmente os contadores persistidos no SQLite.
 */

import { RefreshCcw, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionIntro } from "../SectionIntro/SectionIntro";
import { useGameStockStore } from "../../store";
import "./PlayHistorySettings.css";

/** Formata total de partidas com pluralização simples em pt-br. */
function formatLaunchTotal(total: number): string {
  return `${total} ${total === 1 ? "partida jogada" : "partidas jogadas"}`;
}

/** Formata total de jogos com histórico salvo. */
function formatPlayedGames(total: number): string {
  return `${total} ${total === 1 ? "jogo com histórico" : "jogos com histórico"}`;
}

export function PlayHistorySettings() {
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const [stats, setStats] = useState<{ totalLaunches: number; playedGames: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  /** Carrega estatísticas atuais do contador persistido. */
  async function loadStats(): Promise<void> {
    setLoading(true);
    try {
      setStats(await window.gameStockAPI.games.launchStats());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStats();
  }, []);

  /** Limpa todo o histórico após confirmação explícita do usuário. */
  async function handleReset(): Promise<void> {
    if (resetting) return;
    if (!window.confirm("Resetar todo o contador de partidas jogadas?")) return;
    setResetting(true);
    try {
      await window.gameStockAPI.games.resetLaunchStats();
      reloadGames();
      await loadStats();
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="play-history-settings">
      <SectionIntro
        title="Contador de partidas"
        description="Acompanhe quantas vezes seus jogos foram iniciados e limpe o histórico quando quiser."
      />

      <div className="play-history-stats" aria-busy={loading}>
        <article className="play-history-card">
          <span className="play-history-label">Total acumulado</span>
          <strong>{loading || !stats ? "Carregando..." : formatLaunchTotal(stats.totalLaunches)}</strong>
        </article>
        <article className="play-history-card">
          <span className="play-history-label">Jogos alcançados</span>
          <strong>{loading || !stats ? "Carregando..." : formatPlayedGames(stats.playedGames)}</strong>
        </article>
      </div>

      <div className="play-history-actions">
        <button type="button" className="text-button form-action-button" onClick={() => void loadStats()} disabled={loading || resetting}>
          <RefreshCcw aria-hidden="true" size={14} />
          Atualizar
        </button>
        <button type="button" className="text-button danger form-action-button" onClick={() => void handleReset()} disabled={resetting}>
          <RotateCcw aria-hidden="true" size={14} />
          {resetting ? "Resetando..." : "Resetar contador"}
        </button>
      </div>
    </section>
  );
}
