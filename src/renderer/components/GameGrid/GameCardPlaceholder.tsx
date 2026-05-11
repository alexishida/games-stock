/**
 * GameCardPlaceholder.tsx
 *
 * Componente de placeholder exibido no lugar da capa (box art) quando o jogo
 * não possui imagem cadastrada. Renderiza um ícone de controle centralizado
 * dentro do espaço reservado para a capa.
 */

import { Gamepad2 } from "lucide-react";

/**
 * Exibe um ícone de controle como substituto visual da capa do jogo.
 * Usado pelo GameCard quando `box_art_path` está ausente ou inválido.
 */
export function GameCardPlaceholder() {
  return (
    // Container que ocupa o mesmo espaço da imagem de capa
    <div className="card-placeholder">
      {/* Ícone centralizado de controle de videogame */}
      <div className="gamepad-icon">
        <Gamepad2 aria-hidden="true" size={28} />
      </div>
    </div>
  );
}
