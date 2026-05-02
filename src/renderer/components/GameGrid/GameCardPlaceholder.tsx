import { Gamepad2 } from "lucide-react";

export function GameCardPlaceholder({ platformName }: { platformName?: string | null }) {
  return (
    <div className="card-placeholder">
      <div className="gamepad-icon">
        <Gamepad2 aria-hidden="true" size={28} />
      </div>
      <span>{platformName ?? "Sem plataforma"}</span>
    </div>
  );
}
