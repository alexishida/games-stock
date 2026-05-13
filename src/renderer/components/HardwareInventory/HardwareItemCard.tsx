/**
 * HardwareItemCard.tsx
 *
 * Card individual da grade do inventário de hardware.
 * Exibe foto de capa (ou placeholder com ícone), nome do item,
 * badge de plataforma, nome do tipo e badge de condição.
 */

import { Cpu } from "lucide-react";
import { HardwareItem } from "../../../shared/types";
import { localMediaUrl } from "../../utils/media";
import "./HardwareItemCard.css";

interface Props {
  item: HardwareItem;
  selected: boolean;
  onSelect: () => void;
}

/**
 * Retorna uma classe CSS representando a condição do item para colorir o badge.
 * Condições piores recebem cores de aviso; "Novo" recebe destaque positivo.
 */
function conditionClass(stateName: string | null): string {
  if (!stateName) return "";
  const lower = stateName.toLowerCase();
  if (lower === "novo") return "condition-new";
  if (lower === "ótimo") return "condition-great";
  if (lower === "bom") return "condition-good";
  if (lower === "ruim") return "condition-bad";
  if (lower.includes("reparo")) return "condition-repair";
  return "";
}

/**
 * Card de item de hardware para a grade do inventário.
 *
 * @param item     - Dados do item a exibir.
 * @param selected - true quando este card está selecionado (destaca borda).
 * @param onSelect - Callback acionado ao clicar no card.
 */
export function HardwareItemCard({ item, selected, onSelect }: Props) {
  const coverUrl = localMediaUrl(item.cover_photo_path);

  return (
    <div
      role="button"
      tabIndex={0}
      className={`hw-card${selected ? " selected" : ""}`}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
    >
      <div className="hw-card-cover">
        {coverUrl
          ? <img src={coverUrl} alt="" loading="lazy" decoding="async" draggable={false} />
          : (
              <div className="hw-card-placeholder">
                <Cpu size={28} aria-hidden="true" />
                <span>{item.item_type_name ?? "Hardware"}</span>
              </div>
            )
        }
        <div className="hw-card-gradient" />
        <div className="hw-card-copy">
          {item.platform_name && (
            <span className="hw-card-platform">{item.platform_name}</span>
          )}
          <strong>{item.name}</strong>
        </div>
      </div>

      <div className="hw-card-meta">
        {item.item_type_name && (
          <span className="hw-card-type">{item.item_type_name}</span>
        )}
        {item.conservation_state_name && (
          <span className={`hw-card-condition ${conditionClass(item.conservation_state_name)}`}>
            {item.conservation_state_name}
          </span>
        )}
      </div>
    </div>
  );
}
