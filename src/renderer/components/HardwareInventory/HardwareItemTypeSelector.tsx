/**
 * HardwareItemTypeSelector.tsx
 *
 * Seletor de tipo de item para o formulário de inventário de hardware.
 * Exibe a lista de tipos cadastrados e permite criar um novo tipo inline
 * sem precisar sair do formulário.
 */

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { HardwareItemType } from "../../../shared/types";

interface Props {
  /** ID do tipo atualmente selecionado (ou null se nenhum). */
  value: number | null;
  onChange: (id: number | null) => void;
}

/**
 * Seletor de tipo de item com criação inline.
 * Carrega os tipos via IPC ao montar e atualiza a lista ao criar um novo.
 */
export function HardwareItemTypeSelector({ value, onChange }: Props) {
  const [types, setTypes] = useState<HardwareItemType[]>([]);
  const [newTypeName, setNewTypeName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void window.gameStockAPI.hardwareInventory.typesList().then(setTypes);
  }, []);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  async function handleCreate() {
    const name = newTypeName.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    try {
      const created = await window.gameStockAPI.hardwareInventory.typesCreate(name);
      setTypes((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTypeName("");
      setShowInput(false);
      onChange(created.id);
    } catch {
      setError("Erro ao criar tipo. Verifique se o nome já existe.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="hw-selector">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        aria-label="Tipo de item"
      >
        <option value="">Selecione um tipo...</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      {!showInput && (
        <button
          type="button"
          className="hw-selector-add-btn"
          onClick={() => setShowInput(true)}
          title="Criar novo tipo"
        >
          <Plus size={14} aria-hidden="true" />
          Novo tipo
        </button>
      )}

      {showInput && (
        <div className="hw-selector-new">
          <input
            ref={inputRef}
            type="text"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder="Nome do novo tipo"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") { setShowInput(false); setNewTypeName(""); }
            }}
            disabled={creating}
          />
          <button type="button" onClick={() => void handleCreate()} disabled={creating || !newTypeName.trim()}>
            {creating ? "…" : "Criar"}
          </button>
          <button type="button" onClick={() => { setShowInput(false); setNewTypeName(""); }}>Cancelar</button>
        </div>
      )}

      {error && <span className="hw-selector-error">{error}</span>}
    </div>
  );
}
