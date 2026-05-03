import { Gamepad2 } from "lucide-react";

export function GameCardPlaceholder() {
  return (
    <div className="card-placeholder">
      <div className="gamepad-icon">
        <Gamepad2 aria-hidden="true" size={28} />
      </div>
    </div>
  );
}
