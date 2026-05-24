/**
 * Modal global de seleção de versões do jogo antes do launch.
 *
 * Quando múltiplas variantes jogáveis compartilham o mesmo título-base,
 * este componente permite escolher qual ROM iniciar sem sair da biblioteca.
 */

import { useState } from "react";
import { Globe2, Play, RotateCcw, ScrollText, Sparkles, X } from "lucide-react";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { useGameStockStore } from "../../store";
import "./GameVersionModal.css";

/** Formata o texto de histórico de partidas de uma variante. */
function formatLaunchCount(count: number): string {
  return `${count} ${count === 1 ? "jogada" : "jogadas"}`;
}

export function GameVersionModal() {
  const launchSelection = useGameStockStore((state) => state.launchSelection);
  const closeLaunchSelection = useGameStockStore((state) => state.closeLaunchSelection);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const draggable = useDraggableDialog<HTMLDivElement>();
  const [launchingId, setLaunchingId] = useState<number | null>(null);
  const [launchError, setLaunchError] = useState("");

  if (!launchSelection) return null;
  const baseTitle = launchSelection.options[0]?.baseTitle ?? "";

  /** Inicia a variante escolhida e fecha o modal em caso de sucesso. */
  async function handleLaunch(versionId: number): Promise<void> {
    if (launchingId) return;
    setLaunchError("");
    setLaunchingId(versionId);
    try {
      await window.gameStockAPI.games.launch(versionId);
      reloadGames();
      closeLaunchSelection();
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : "Erro ao lançar jogo");
    } finally {
      setLaunchingId(null);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={closeLaunchSelection}>
      <section
        ref={draggable.dialogRef}
        className="game-version-modal draggable-modal"
        style={draggable.style}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-version-modal-title"
      >
        <header className="game-version-modal-header">
          <div>
            <p className="eyebrow">Escolha versão</p>
            <h2 id="game-version-modal-title">{baseTitle || "Seleção de versão"}</h2>
          </div>
          <button type="button" className="icon-button modal-close-button" onClick={closeLaunchSelection} aria-label="Fechar">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <p className="game-version-modal-copy">
          Encontramos múltiplas variantes deste jogo. Escolha qual ROM deseja abrir agora.
        </p>

        {launchError && (
          <div className="game-version-modal-error" role="status">
            {launchError}
          </div>
        )}

        <div className="game-version-modal-list">
          {launchSelection.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="game-version-option"
              onClick={() => void handleLaunch(option.id)}
              disabled={launchingId !== null}
            >
              <div className="game-version-option-main">
                <strong>{option.title}</strong>
                <span>{option.variantLabel}</span>
              </div>
              <div className="game-version-option-meta">
                <span><Globe2 aria-hidden="true" size={14} />{option.regionLabel ?? "Região não detectada"}</span>
                <span><Sparkles aria-hidden="true" size={14} />{option.typeLabel ?? "Sem marcador especial"}</span>
                <span><ScrollText aria-hidden="true" size={14} />{option.romFileName}</span>
                <span><RotateCcw aria-hidden="true" size={14} />{formatLaunchCount(option.launchCount)}</span>
              </div>
              <span className="game-version-option-action">
                <Play aria-hidden="true" size={15} />
                {launchingId === option.id ? "Abrindo..." : "Jogar"}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
