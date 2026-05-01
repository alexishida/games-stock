export function GameCardPlaceholder({ platformName }: { platformName?: string | null }) {
  return (
    <div className="card-placeholder">
      <div className="gamepad-icon">
        <span className="material-symbols-outlined" aria-hidden="true">videogame_asset</span>
      </div>
      <span>{platformName ?? "Sem plataforma"}</span>
    </div>
  );
}
