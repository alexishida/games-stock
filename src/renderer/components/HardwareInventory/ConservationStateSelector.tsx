/**
 * ConservationStateSelector.tsx
 *
 * Seletor de estado de conservação para o formulário de inventário de hardware.
 * Lista os estados cadastrados e permite criar um novo estado inline.
 */

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ConservationState } from "../../../shared/types";

interface Props {
  /** ID do estado atualmente selecionado (ou null se nenhum). */
  value: number | null;
  onChange: (id: number | null) => void;
}

/**
 * Seletor de estado de conservação com criação inline.
 * Carrega os estados via IPC ao montar e atualiza ao criar novo.
 */
export function ConservationStateSelector({ value, onChange }: Props) {
  const [states, setStates] = useState<ConservationState[]>([]);
  const [newStateName, setNewStateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void window.gameStockAPI.hardwareInventory.statesList().then(setStates);
  }, []);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  async function handleCreate() {
    const name = newStateName.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    try {
      const created = await window.gameStockAPI.hardwareInventory.statesCreate(name);
      setStates((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewStateName("");
      setShowInput(false);
      onChange(created.id);
    } catch {
      setError("Erro ao criar estado. Verifique se o nome já existe.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="hw-selector">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        aria-label="Estado de conservação"
      >
        <option value="">Selecione um estado...</option>
        {states.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      {!showInput && (
        <button
          type="button"
          className="hw-selector-add-btn"
          onClick={() => setShowInput(true)}
          title="Criar novo estado"
        >
          <Plus size={14} aria-hidden="true" />
          Novo estado
        </button>
      )}

      {showInput && (
        <div className="hw-selector-new">
          <input
            ref={inputRef}
            type="text"
            value={newStateName}
            onChange={(e) => setNewStateName(e.target.value)}
            placeholder="Nome do novo estado"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") { setShowInput(false); setNewStateName(""); }
            }}
            disabled={creating}
          />
          <button type="button" onClick={() => void handleCreate()} disabled={creating || !newStateName.trim()}>
            {creating ? "…" : "Criar"}
          </button>
          <button type="button" onClick={() => { setShowInput(false); setNewStateName(""); }}>Cancelar</button>
        </div>
      )}

      {error && <span className="hw-selector-error">{error}</span>}
    </div>
  );
}
