/**
 * HardwareItemDetail.tsx
 *
 * Painel de detalhe de um item de hardware em tela cheia, seguindo o padrão visual
 * do GameDetail: hero com foto de fundo, card de capa, chips de metadados, galeria
 * e painel de campos adicionais.
 */

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Cpu, Edit2, ImagePlus, Trash2, X } from "lucide-react";
import { HardwareItem, HardwareItemPhoto } from "../../../shared/types";
import { localMediaUrl } from "../../utils/media";
import "./HardwareItemDetail.css";

interface Props {
  item: HardwareItem;
  /** Lista completa dos itens para navegação entre eles com setas */
  allItems: HardwareItem[];
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onNavigate: (item: HardwareItem) => void;
}

interface DetailRowProps {
  label: string;
  value: string | null | undefined;
  href?: string | null;
}

interface DetailSummaryItemProps {
  label: string;
  value: string | null | undefined;
}

/** Linha de detalhe label + valor com estado vazio consistente. */
function DetailRow({ label, value, href }: DetailRowProps) {
  const displayValue = value?.trim();
  const isEmpty = !displayValue;

  return (
    <div className="hw-detail-row">
      <dt className="hw-detail-label">{label}</dt>
      <dd className={`hw-detail-value${isEmpty ? " hw-detail-value--empty" : ""}`}>
        {displayValue && href
          ? <a href={href} target="_blank" rel="noopener noreferrer" className="hw-detail-link" title={href}>{displayValue}</a>
          : displayValue || "Não informado"
        }
      </dd>
    </div>
  );
}

/** Item do resumo superior, usado para dados mais escaneaveis do inventario. */
function DetailSummaryItem({ label, value }: DetailSummaryItemProps) {
  const displayValue = value?.trim();

  return (
    <div className="hw-detail-summary-item">
      <dt>{label}</dt>
      <dd className={!displayValue ? "hw-detail-value--empty" : undefined}>{displayValue || "Não informado"}</dd>
    </div>
  );
}

/** Formata valor monetario em real sem espalhar regra de exibicao pelo JSX. */
function formatCurrency(value: number | null | undefined): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Formata data ISO simples sem deslocamento de fuso horario. */
function formatDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Reduz URL longa para host quando possivel, mantendo o link completo no href. */
function formatUrlLabel(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

/**
 * Detalhe de item de hardware em tela cheia.
 */
export function HardwareItemDetail({ item, allItems, onEdit, onDelete, onClose, onNavigate }: Props) {
  const [photos, setPhotos] = useState<HardwareItemPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);

  useEffect(() => {
    setLightboxIndex(null);
    void window.gameStockAPI.hardwareInventory.photosList(item.id).then(setPhotos);
  }, [item.id]);

  const currentIndex = allItems.findIndex((i) => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allItems.length - 1;

  // Foto principal (sort_order menor) usada no hero e na capa
  const mainPhoto = photos[0] ?? null;
  const heroBgUrl = localMediaUrl(mainPhoto?.file_path);
  const coverUrl = heroBgUrl;

  // Itens da galeria (todas as fotos)
  const galleryPhotos = photos;

  const lightboxPhoto = lightboxIndex !== null ? galleryPhotos[lightboxIndex] ?? null : null;
  // Valores formatados ficam centralizados para manter o JSX de dados mais legivel.
  const acquisitionDate = formatDate(item.acquisition_date);
  const paidValue = formatCurrency(item.value);
  const acquisitionUrlLabel = formatUrlLabel(item.acquisition_url);

  async function handleDeleteConfirmed() {
    setDeleting(true);
    try {
      await window.gameStockAPI.hardwareInventory.itemsDelete(item.id);
      onDelete();
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddPhoto() {
    setAddingPhoto(true);
    try {
      const sourcePath = await window.gameStockAPI.dialogs.openImageFile();
      if (!sourcePath) return;
      const photo = await window.gameStockAPI.hardwareInventory.photosAdd(item.id, sourcePath);
      setPhotos((prev) => [...prev, photo]);
    } finally {
      setAddingPhoto(false);
    }
  }

  async function handleRemovePhoto(photo: HardwareItemPhoto) {
    await window.gameStockAPI.hardwareInventory.photosRemove(photo.id);
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== photo.id);
      setLightboxIndex(null);
      return next;
    });
  }

  async function handleReorder(idA: number, idB: number) {
    await window.gameStockAPI.hardwareInventory.photosReorder(idA, idB);
    setPhotos(await window.gameStockAPI.hardwareInventory.photosList(item.id));
  }

  function showNextLightbox() {
    if (!galleryPhotos.length) return;
    setLightboxIndex((i) => i === null ? 0 : (i + 1) % galleryPhotos.length);
  }

  function showPrevLightbox() {
    if (!galleryPhotos.length) return;
    setLightboxIndex((i) => i === null ? 0 : (i - 1 + galleryPhotos.length) % galleryPhotos.length);
  }

  return (
    <section className="hw-detail">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div className="hw-detail-hero">
        {heroBgUrl
          ? <img className="hw-detail-hero-bg" src={heroBgUrl} alt="" aria-hidden="true" />
          : <div className="hw-detail-hero-bg hw-detail-hero-fallback" />
        }
        <div className="hw-detail-hero-shade" />

        {/* Botões de navegação: voltar + prev/next */}
        <div className="hw-detail-top-actions">
          <button type="button" className="detail-top-button" onClick={onClose}>
            <Cpu aria-hidden="true" size={16} />
            Inventário
          </button>
          {hasPrev && (
            <button
              type="button"
              className="detail-top-button"
              onClick={() => onNavigate(allItems[currentIndex - 1])}
              aria-label="Item anterior"
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              className="detail-top-button"
              onClick={() => onNavigate(allItems[currentIndex + 1])}
              aria-label="Próximo item"
            >
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Conteúdo do hero: capa + bloco de título + ações */}
        <div className="detail-hero-content">
          {/* Card da foto principal */}
          <div className="hw-detail-cover-card">
            {coverUrl
              ? <img src={coverUrl} alt="" draggable={false} />
              : <Cpu aria-hidden="true" size={38} />
            }
          </div>

          {/* Bloco de título */}
          <div className="detail-title-block">
            <div className="detail-chips">
              {item.platform_name && <span>{item.platform_name}</span>}
              {item.item_type_name && <span>{item.item_type_name}</span>}
              {item.conservation_state_name && <span>{item.conservation_state_name}</span>}
            </div>
            <h1>{item.name}</h1>
            {item.description && <p>{item.description}</p>}
          </div>

          {/* Ações */}
          <div className="detail-hero-actions">
            <button
              type="button"
              className="detail-hero-icon-button"
              onClick={() => void handleAddPhoto()}
              disabled={addingPhoto}
              title="Adicionar foto"
            >
              <ImagePlus size={18} aria-hidden="true" />
            </button>
            <button type="button" className="detail-hero-icon-button" onClick={onEdit} title="Editar">
              <Edit2 size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="detail-hero-icon-button danger"
              onClick={() => setConfirmDelete(true)}
              title="Deletar"
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Conteúdo abaixo do hero ──────────────────────────────────── */}
      <div className="hw-detail-content-grid">
        {/* Painel: dados organizados por decisao de consulta do inventario. */}
        <section className="detail-panel hw-detail-info-panel">
          <h2>Dados do item</h2>

          <dl className="hw-detail-summary-strip" aria-label="Resumo do item">
            <DetailSummaryItem label="Plataforma" value={item.platform_name} />
            <DetailSummaryItem label="Tipo" value={item.item_type_name} />
            <DetailSummaryItem label="Condição" value={item.conservation_state_name} />
            <DetailSummaryItem label="Valor pago" value={paidValue} />
          </dl>

          <div className="hw-detail-section-grid">
            <section className="hw-detail-section">
              <h3>Identificação</h3>
              <dl className="hw-detail-dl">
                <DetailRow label="Plataforma" value={item.platform_name} />
                <DetailRow label="Tipo" value={item.item_type_name} />
                <DetailRow label="Condição" value={item.conservation_state_name} />
                <DetailRow label="Cor" value={item.color} />
                <DetailRow label="Região" value={item.region} />
              </dl>
            </section>

            <section className="hw-detail-section">
              <h3>Aquisição</h3>
              <dl className="hw-detail-dl">
                <DetailRow label="Data" value={acquisitionDate} />
                <DetailRow label="Valor pago" value={paidValue} />
                <DetailRow label="Origem" value={acquisitionUrlLabel} href={item.acquisition_url} />
              </dl>
            </section>

            <section className="hw-detail-section">
              <h3>Controle físico</h3>
              <dl className="hw-detail-dl">
                <DetailRow label="Número de série" value={item.serial_number} />
                <DetailRow label="Local" value={item.storage_location} />
                <DetailRow label="Emprestado para" value={item.loan_to} />
              </dl>
            </section>

            {item.description?.trim() && (
              <section className="hw-detail-section hw-detail-section-wide">
                <h3>Descrição</h3>
                <p className="hw-detail-description">{item.description.trim()}</p>
              </section>
            )}
          </div>
        </section>

        {/* Painel: galeria de fotos */}
        <section className="detail-panel hw-detail-gallery-panel">
          <h2>Fotos</h2>
          {galleryPhotos.length > 0
            ? (
                <div className="hw-detail-gallery">
                  {galleryPhotos.map((photo, idx) => {
                    const url = localMediaUrl(photo.file_path);
                    return (
                      <div key={photo.id} className="hw-detail-gallery-item">
                        <button
                          type="button"
                          className="hw-detail-gallery-thumb"
                          onClick={() => setLightboxIndex(idx)}
                          aria-label={`Foto ${idx + 1}`}
                        >
                          {url && <img src={url} alt="" draggable={false} />}
                          {idx === 0 && <span className="hw-gallery-cover-badge">Capa</span>}
                          {/* Botão de remover sobreposto no canto superior direito */}
                          <button
                            type="button"
                            className="hw-gallery-thumb-remove"
                            title="Remover foto"
                            onClick={(e) => { e.stopPropagation(); void handleRemovePhoto(photo); }}
                          >
                            <Trash2 size={12} aria-hidden="true" />
                          </button>
                        </button>
                        {(idx > 0 || idx < galleryPhotos.length - 1) && (
                          <div className="hw-gallery-thumb-actions">
                            {idx > 0 && (
                              <button type="button" title="Mover esquerda" onClick={() => void handleReorder(photo.id, galleryPhotos[idx - 1].id)}>←</button>
                            )}
                            {idx < galleryPhotos.length - 1 && (
                              <button type="button" title="Mover direita" onClick={() => void handleReorder(photo.id, galleryPhotos[idx + 1].id)}>→</button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            : (
                <div className="hw-gallery-empty">
                  <Cpu size={24} aria-hidden="true" />
                  <span>Nenhuma foto adicionada</span>
                </div>
              )
          }
        </section>
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────────── */}
      {lightboxPhoto && (
        <div className="detail-lightbox" role="dialog" aria-modal="true" aria-label="Visualizar foto">
          <button type="button" className="detail-lightbox-close icon-button modal-close-button" onClick={() => setLightboxIndex(null)} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
          {galleryPhotos.length > 1 && (
            <>
              <button type="button" className="detail-lightbox-nav detail-lightbox-prev icon-button" onClick={(e) => { e.stopPropagation(); showPrevLightbox(); }} aria-label="Foto anterior">
                <ArrowLeft size={24} aria-hidden="true" />
              </button>
              <button type="button" className="detail-lightbox-nav detail-lightbox-next icon-button" onClick={(e) => { e.stopPropagation(); showNextLightbox(); }} aria-label="Próxima foto">
                <ArrowRight size={24} aria-hidden="true" />
              </button>
            </>
          )}
          <img
            src={localMediaUrl(lightboxPhoto.file_path) ?? ""}
            alt={`Foto ${(lightboxIndex ?? 0) + 1}`}
            onClick={(e) => { e.stopPropagation(); showNextLightbox(); }}
            title="Próxima foto"
          />
        </div>
      )}

      {/* ── Confirmação de deleção ────────────────────────────────────── */}
      {confirmDelete && (
        <div className="detail-edit-backdrop" onMouseDown={() => setConfirmDelete(false)} role="presentation">
          <div className="hw-confirm-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <p><strong>Deletar "{item.name}"?</strong></p>
            <span>Esta ação removerá o item e todas as suas fotos permanentemente.</span>
            <div className="hw-confirm-actions">
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancelar</button>
              <button type="button" className="hw-confirm-delete-btn" onClick={() => void handleDeleteConfirmed()} disabled={deleting}>
                {deleting ? "Deletando…" : "Deletar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
