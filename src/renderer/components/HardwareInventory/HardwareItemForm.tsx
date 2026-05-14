/**
 * HardwareItemForm.tsx
 *
 * Formulário de criação e edição de itens do inventário de hardware.
 * Campos obrigatórios ficam sempre visíveis; campos opcionais ficam em
 * seção expansível "Detalhes adicionais". Galeria de fotos no rodapé.
 *
 * Usado em modo modal (draggável) tanto para criar quanto para editar.
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ImagePlus, Trash2, X } from "lucide-react";
import { HardwareItem, HardwareItemCreateInput, HardwareItemPhoto, Platform } from "../../../shared/types";
import { localMediaUrl } from "../../utils/media";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { HardwareItemTypeSelector } from "./HardwareItemTypeSelector";
import { ConservationStateSelector } from "./ConservationStateSelector";
import "./HardwareItemForm.css";

/** Valor sentinela usado apenas no formulario para representar item multiplataforma. */
const MULTIPLATFORM_OPTION_VALUE = "__multiplatform__";

interface Props {
  /** Item a editar; null para criação. */
  item?: HardwareItem | null;
  onSave: (item: HardwareItem) => void;
  onClose: () => void;
}

/** Estado interno do formulário mapeando todos os campos editáveis. */
interface FormState {
  name: string;
  platformChoice: string;
  item_type_id: number | null;
  conservation_state_id: number | null;
  description: string;
  acquisition_date: string;
  acquisition_url: string;
  color: string;
  value: string;
  serial_number: string;
  region: string;
  storage_location: string;
  loan_to: string;
}

/** Inicializa o estado do formulário com os dados do item (edição) ou valores em branco (criação). */
function buildInitialState(item?: HardwareItem | null): FormState {
  return {
    name:                 item?.name ?? "",
    platformChoice:       item?.is_multiplatform ? MULTIPLATFORM_OPTION_VALUE : item?.platform_id ? String(item.platform_id) : "",
    item_type_id:         item?.item_type_id ?? null,
    conservation_state_id: item?.conservation_state_id ?? null,
    description:          item?.description ?? "",
    acquisition_date:     item?.acquisition_date ?? "",
    acquisition_url:      item?.acquisition_url ?? "",
    color:                item?.color ?? "",
    value:                item?.value != null ? String(item.value) : "",
    serial_number:        item?.serial_number ?? "",
    region:               item?.region ?? "",
    storage_location:     item?.storage_location ?? "",
    loan_to:              item?.loan_to ?? ""
  };
}

/**
 * Formulário arrastável de criação/edição de item de hardware.
 */
export function HardwareItemForm({ item, onSave, onClose }: Props) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(item));
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [photos, setPhotos] = useState<HardwareItemPhoto[]>([]);
  const [extraOpen, setExtraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [photoError, setPhotoError] = useState("");

  const draggable = useDraggableDialog<HTMLDivElement>();

  const isEdit = Boolean(item);

  useEffect(() => {
    void window.gameStockAPI.platforms.list().then(setPlatforms);
    if (item) {
      void window.gameStockAPI.hardwareInventory.photosList(item.id).then(setPhotos);
    }
  }, [item]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) newErrors.name = "Nome obrigatório.";
    if (!form.platformChoice) newErrors.platformChoice = "Plataforma obrigatória.";
    if (!form.item_type_id) newErrors.item_type_id = "Tipo obrigatório.";
    if (!form.conservation_state_id) newErrors.conservation_state_id = "Condição obrigatória.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      // Multiplataforma fica como marcador interno do inventario, nao como plataforma real.
      const isMultiplatform = form.platformChoice === MULTIPLATFORM_OPTION_VALUE;
      const platformId = isMultiplatform ? null : Number(form.platformChoice) || null;
      const payload: HardwareItemCreateInput = {
        name:                 form.name.trim(),
        platform_id:          platformId,
        is_multiplatform:     isMultiplatform,
        item_type_id:         form.item_type_id,
        conservation_state_id: form.conservation_state_id,
        description:          form.description.trim(),
        acquisition_date:     form.acquisition_date.trim() || null,
        acquisition_url:      form.acquisition_url.trim() || null,
        color:                form.color.trim() || null,
        value:                form.value.trim() ? parseFloat(form.value) : null,
        serial_number:        form.serial_number.trim() || null,
        region:               form.region.trim() || null,
        storage_location:     form.storage_location.trim() || null,
        loan_to:              form.loan_to.trim() || null
      };

      let saved: HardwareItem;
      if (isEdit && item) {
        saved = await window.gameStockAPI.hardwareInventory.itemsUpdate(item.id, payload);
      } else {
        saved = await window.gameStockAPI.hardwareInventory.itemsCreate(payload);
      }
      onSave(saved);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPhoto() {
    setPhotoError("");
    const itemId = item?.id;
    if (!itemId) {
      setPhotoError("Salve o item antes de adicionar fotos.");
      return;
    }
    const sourcePath = await window.gameStockAPI.dialogs.openImageFile();
    if (!sourcePath) return;
    try {
      const photo = await window.gameStockAPI.hardwareInventory.photosAdd(itemId, sourcePath);
      setPhotos((prev) => [...prev, photo]);
    } catch {
      setPhotoError("Erro ao adicionar foto.");
    }
  }

  async function handleRemovePhoto(photoId: number, filePath: string) {
    void filePath;
    await window.gameStockAPI.hardwareInventory.photosRemove(photoId);
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }

  async function handleReorder(idA: number, idB: number) {
    await window.gameStockAPI.hardwareInventory.photosReorder(idA, idB);
    // Recarrega a lista para refletir o sort_order atualizado
    if (item) setPhotos(await window.gameStockAPI.hardwareInventory.photosList(item.id));
  }

  return (
    <div className="hw-form-overlay">
      <div
        ref={draggable.dialogRef}
        className="hw-form-dialog"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
      >
        {/* Cabeçalho arrastável */}
        <div className="hw-form-header">
          <h2>{isEdit ? "Editar item" : "Novo item de hardware"}</h2>
          <button type="button" className="hw-form-close" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="hw-form-body">
          {/* ── Campos obrigatórios ─────────────────────────────────────── */}
          <div className="hw-form-field">
            <label>Nome *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Ex: Super Nintendo original"
            />
            {errors.name && <span className="hw-form-error">{errors.name}</span>}
          </div>

          <div className="hw-form-field">
            <label>Plataforma *</label>
            <select
              value={form.platformChoice}
              onChange={(e) => setField("platformChoice", e.target.value)}
            >
              <option value="">Selecione uma plataforma...</option>
              <option value={MULTIPLATFORM_OPTION_VALUE}>Multiplataforma</option>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {errors.platformChoice && <span className="hw-form-error">{errors.platformChoice}</span>}
          </div>

          <div className="hw-form-field">
            <label>Tipo *</label>
            <HardwareItemTypeSelector
              value={form.item_type_id}
              onChange={(id) => setField("item_type_id", id)}
            />
            {errors.item_type_id && <span className="hw-form-error">{errors.item_type_id}</span>}
          </div>

          <div className="hw-form-field">
            <label>Condição *</label>
            <ConservationStateSelector
              value={form.conservation_state_id}
              onChange={(id) => setField("conservation_state_id", id)}
            />
            {errors.conservation_state_id && <span className="hw-form-error">{errors.conservation_state_id}</span>}
          </div>

          <div className="hw-form-field">
            <label>Descrição</label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Descreva o item, histórico, observações..."
              rows={3}
            />
          </div>

          {/* ── Campos opcionais (expansível) ──────────────────────────── */}
          <button
            type="button"
            className="hw-form-toggle"
            onClick={() => setExtraOpen((v) => !v)}
          >
            {extraOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
            Detalhes adicionais
          </button>

          {extraOpen && (
            <div className="hw-form-extra">
              <div className="hw-form-row">
                <div className="hw-form-field">
                  <label>Data de aquisição</label>
                  <input
                    type="date"
                    value={form.acquisition_date}
                    onChange={(e) => setField("acquisition_date", e.target.value)}
                  />
                </div>
                <div className="hw-form-field">
                  <label>Valor pago (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.value}
                    onChange={(e) => setField("value", e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="hw-form-field">
                <label>URL de aquisição</label>
                <input
                  type="url"
                  value={form.acquisition_url}
                  onChange={(e) => setField("acquisition_url", e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="hw-form-row">
                <div className="hw-form-field">
                  <label>Cor</label>
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setField("color", e.target.value)}
                    placeholder="Ex: Cinza"
                  />
                </div>
                <div className="hw-form-field">
                  <label>Região</label>
                  <input
                    type="text"
                    value={form.region}
                    onChange={(e) => setField("region", e.target.value)}
                    placeholder="Ex: NTSC-U/C"
                  />
                </div>
              </div>

              <div className="hw-form-row">
                <div className="hw-form-field">
                  <label>Número de série</label>
                  <input
                    type="text"
                    value={form.serial_number}
                    onChange={(e) => setField("serial_number", e.target.value)}
                  />
                </div>
                <div className="hw-form-field">
                  <label>Local de armazenamento</label>
                  <input
                    type="text"
                    value={form.storage_location}
                    onChange={(e) => setField("storage_location", e.target.value)}
                    placeholder="Ex: Prateleira 3"
                  />
                </div>
              </div>

              <div className="hw-form-field">
                <label>Emprestado para</label>
                <input
                  type="text"
                  value={form.loan_to}
                  onChange={(e) => setField("loan_to", e.target.value)}
                  placeholder="Nome da pessoa"
                />
              </div>
            </div>
          )}

          {/* ── Galeria de fotos (só exibida em modo edição) ────────────── */}
          {isEdit && (
            <div className="hw-form-photos">
              <div className="hw-form-photos-header">
                <span>Fotos ({photos.length})</span>
                <button type="button" className="hw-form-photo-add-btn" onClick={() => void handleAddPhoto()}>
                  <ImagePlus size={14} aria-hidden="true" />
                  Adicionar foto
                </button>
              </div>

              {photoError && <span className="hw-form-error">{photoError}</span>}

              {photos.length > 0 && (
                <div className="hw-form-photo-list">
                  {photos.map((photo, idx) => (
                    <div key={photo.id} className="hw-form-photo-item">
                      <img
                        src={localMediaUrl(photo.file_path) ?? ""}
                        alt={`Foto ${idx + 1}`}
                        draggable={false}
                      />
                      <div className="hw-form-photo-actions">
                        {idx > 0 && (
                          <button
                            type="button"
                            title="Mover para cima"
                            onClick={() => void handleReorder(photo.id, photos[idx - 1].id)}
                          >↑</button>
                        )}
                        {idx < photos.length - 1 && (
                          <button
                            type="button"
                            title="Mover para baixo"
                            onClick={() => void handleReorder(photo.id, photos[idx + 1].id)}
                          >↓</button>
                        )}
                        <button
                          type="button"
                          className="hw-photo-remove-btn"
                          title="Remover foto"
                          onClick={() => void handleRemovePhoto(photo.id, photo.file_path)}
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      </div>
                      {idx === 0 && <span className="hw-photo-cover-badge">Capa</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isEdit && (
            <p className="hw-form-photo-hint">Salve o item primeiro para adicionar fotos.</p>
          )}
        </div>

        {/* Rodapé com botões de ação */}
        <div className="hw-form-footer">
          <button type="button" className="hw-btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="hw-btn-primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar item"}
          </button>
        </div>
      </div>
    </div>
  );
}
