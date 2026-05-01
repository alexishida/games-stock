import { useEffect } from "react";
import { LaunchBoxProgress } from "../../../shared/types";

export function ProgressBar({ progress, onProgress }: { progress: LaunchBoxProgress | null; onProgress(progress: LaunchBoxProgress): void }) {
  useEffect(() => window.gameStockAPI.launchbox.onProgress(onProgress), [onProgress]);
  const total = progress?.total || 1;
  const current = progress?.current || 0;
  const percent = Math.min(100, Math.round((current / total) * 100));

  return (
    <div className="progress">
      <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      <div>{progress ? `${current}/${total} ${progress.filename ?? ""}` : "Aguardando"}</div>
    </div>
  );
}
