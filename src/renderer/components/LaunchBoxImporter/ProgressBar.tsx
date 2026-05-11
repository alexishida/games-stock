/**
 * ProgressBar.tsx
 *
 * Componente de barra de progresso usado no LaunchBoxImporter.
 * Registra um listener IPC para receber atualizações de progresso em tempo real
 * durante o download e processamento de imagens. Exibe percentual visual e
 * contador de arquivos processados com o nome do arquivo atual.
 */

import { useEffect } from "react";
import { LaunchBoxProgress } from "../../../shared/types";

/**
 * Renderiza a barra de progresso da importação do LaunchBox.
 *
 * @param progress  - Estado atual do progresso recebido via IPC, ou null se ainda não iniciado.
 * @param onProgress - Callback invocado pelo listener IPC a cada atualização de progresso.
 */
export function ProgressBar({ progress, onProgress }: { progress: LaunchBoxProgress | null; onProgress(progress: LaunchBoxProgress): void }) {
  /**
   * Registra o listener de progresso via IPC ao montar o componente.
   * A função retornada pelo `onProgress` do IPC serve como cleanup (cancela o listener)
   * quando o componente é desmontado ou o callback muda.
   */
  useEffect(() => window.gameStockAPI.launchbox.onProgress(onProgress), [onProgress]);

  // Garante denominador mínimo de 1 para evitar divisão por zero antes do progresso chegar
  const total = progress?.total || 1;
  const current = progress?.current || 0;
  // Percentual calculado e limitado a 100% para evitar overflow visual
  const percent = Math.min(100, Math.round((current / total) * 100));

  return (
    <div className="progress">
      {/* Trilho da barra de progresso; o span interno expande proporcionalmente ao percentual */}
      <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      {/* Texto descritivo: contador de arquivos e nome do arquivo atual, ou "Aguardando" */}
      <div>{progress ? `${current}/${total} ${progress.filename ?? ""}` : "Aguardando"}</div>
    </div>
  );
}
