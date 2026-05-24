/**
 * PlatformManager.tsx
 *
 * Tela de gerenciamento de plataformas dentro das configurações.
 * Permite criar, editar e remover plataformas, além de configurar aliases
 * e extensões de ROM associadas a cada uma (vínculos de plataforma).
 *
 * Composto por três componentes principais:
 *  - PlatformFormModal: formulário de criação/edição de plataforma
 *  - PlatformMappingsModal: formulário de aliases e extensões de ROM
 *  - PlatformManager: lista com ações e abertura dos modais acima
 */

import { FormEvent, useEffect, useState } from "react";
import { Link2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Platform, PlatformEmulator, PlatformMappingsInput } from "../../../shared/types";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { loadDefaultPlatformEmulators } from "../../lib/defaultEmulators";
import { useGameStockStore } from "../../store";
import { SectionIntro } from "../SectionIntro/SectionIntro";

/** Discrimina entre criação de nova plataforma e edição de existente */
type ModalMode = { kind: "create" } | { kind: "edit"; platform: Platform };

/** Linha de alias (nome alternativo) no formulário de vínculos */
type MappingRow = {
  id: string;    // Identificador local único para controle de lista
  value: string; // Texto do alias
};

/** Linha de extensão de ROM no formulário de vínculos */
type ExtensionRow = {
  id: string;        // Identificador local único para controle de lista
  extension: string; // Ex.: ".iso", ".zip"
  kind: string;      // Descrição do tipo (ex.: "Imagem de disco")
  isPrimary: boolean; // Se deve ser usada como filtro primário no importador
};

/**
 * Modal arrastável para criação ou edição de uma plataforma.
 * Campos: nome e categoria (Console / Portátil / PC).
 * Após salvar, recarrega plataformas e jogos no store.
 */
function PlatformFormModal({ mode, onClose }: { mode: ModalMode; onClose: () => void }) {
  // Recarrega a lista de plataformas no store após salvar
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  // Recarrega jogos (pode mudar contagem por plataforma)
  const reloadGames = useGameStockStore((state) => state.reloadGames);

  // Pré-popula os campos ao editar; vazio ao criar
  const [name, setName] = useState(mode.kind === "edit" ? mode.platform.name : "");
  const [category, setCategory] = useState(mode.kind === "edit" ? normalizeCategory(mode.platform.category) : "Console");

  // Mensagem de erro de API
  const [error, setError] = useState("");
  // Indica que a requisição está em andamento
  const [saving, setSaving] = useState(false);

  // Hook para tornar o modal arrastável
  const draggable = useDraggableDialog<HTMLElement>();

  /**
   * Envia criação ou atualização da plataforma via IPC.
   * Em caso de erro, exibe a mensagem e mantém o modal aberto.
   */
  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (mode.kind === "edit") {
        await window.gameStockAPI.platforms.update(mode.platform.id, { name, category });
      } else {
        await window.gameStockAPI.platforms.create({ name, category });
      }
      reloadPlatforms();
      reloadGames();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a plataforma");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      {/* Container arrastável do modal */}
      <section
        ref={draggable.dialogRef}
        className="management-modal platform-form-modal draggable-modal"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
      >
        <header>
          {/* Título dinâmico: "Editar" ou "Nova" plataforma */}
          <h2>{mode.kind === "edit" ? "Editar plataforma" : "Nova plataforma"}</h2>
          <button type="button" className="icon-button modal-close-button" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <form className="management-form" onSubmit={save}>
          {/* Campo: nome da plataforma */}
          <label>
            Nome
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: PlayStation 2"
            />
          </label>
          {/* Campo: categoria da plataforma */}
          <label>
            Categoria
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="Console">Console</option>
              <option value="Portatil">Portátil</option>
              <option value="PC">PC</option>
            </select>
          </label>
          {/* Erro de API exibido quando presente */}
          {error && <p className="form-error">{error}</p>}
          <footer>
            <button type="button" className="text-button danger form-action-button" onClick={onClose} disabled={saving}>
              <X size={14} aria-hidden="true" />
              Cancelar
            </button>
            {/* Botão de salvar desabilitado enquanto salva ou quando o nome está vazio */}
            <button type="submit" className="text-button active form-action-button" disabled={saving || !name.trim()}>
              <Save size={14} aria-hidden="true" />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

/**
 * Modal arrastável para gerenciar aliases e extensões de ROM de uma plataforma.
 * Carrega os vínculos existentes via IPC ao montar.
 * Permite adicionar, editar e remover linhas de aliases e extensões.
 * Garante no mínimo uma linha em cada lista para evitar listas vazias.
 */
function PlatformMappingsModal({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  // Estado de carregamento inicial dos vínculos
  const [loading, setLoading] = useState(true);
  // Indica que a requisição de salvamento está em andamento
  const [saving, setSaving] = useState(false);
  // Mensagem de erro de API
  const [error, setError] = useState("");
  // Lista de linhas de aliases editáveis
  const [aliases, setAliases] = useState<MappingRow[]>([]);
  // Lista de linhas de extensões de ROM editáveis
  const [extensions, setExtensions] = useState<ExtensionRow[]>([]);

  // Hook para tornar o modal arrastável
  const draggable = useDraggableDialog<HTMLElement>();

  /**
   * Busca os vínculos atuais da plataforma via IPC ao montar o componente.
   * Pré-popula aliases com o nome da plataforma se nenhum alias existir.
   * Pré-popula extensões com uma linha vazia se nenhuma extensão existir.
   * Usa flag `cancelled` para ignorar atualizações após desmontagem.
   */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void window.gameStockAPI.platforms.getMappings(platform.id)
      .then((mappings) => {
        if (cancelled) return;
        setAliases(
          mappings.aliases.length
            ? mappings.aliases.map((entry, index) => ({ id: `alias-${index}-${entry.alias}`, value: entry.alias }))
            : [{ id: "alias-default", value: platform.name }] // fallback com o nome da plataforma
        );
        setExtensions(
          mappings.romExtensions.length
            ? mappings.romExtensions.map((entry, index) => ({
              id: `ext-${index}-${entry.extension}`,
              extension: entry.extension,
              kind: entry.kind,
              isPrimary: entry.is_primary === 1
            }))
            : [{ id: "ext-default", extension: "", kind: "", isPrimary: true }] // fallback com linha vazia
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar os vínculos");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // Cleanup: cancela atualizações de estado se o componente desmontar antes de concluir
    return () => {
      cancelled = true;
    };
  }, [platform.id, platform.name]);

  /** Atualiza o valor de um alias específico pelo id da linha */
  function updateAlias(id: string, value: string): void {
    setAliases((current) => current.map((item) => item.id === id ? { ...item, value } : item));
  }

  /** Adiciona uma nova linha de alias vazia ao final da lista */
  function addAlias(): void {
    setAliases((current) => [...current, { id: createRowId("alias"), value: "" }]);
  }

  /** Remove um alias pelo id, mantendo no mínimo uma linha */
  function removeAlias(id: string): void {
    setAliases((current) => current.length <= 1 ? current : current.filter((item) => item.id !== id));
  }

  /** Aplica um patch parcial em uma linha de extensão pelo id */
  function updateExtension(id: string, patch: Partial<ExtensionRow>): void {
    setExtensions((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  /** Adiciona uma nova linha de extensão vazia ao final da lista */
  function addExtension(): void {
    setExtensions((current) => [...current, { id: createRowId("ext"), extension: "", kind: "", isPrimary: true }]);
  }

  /** Remove uma extensão pelo id, mantendo no mínimo uma linha */
  function removeExtension(id: string): void {
    setExtensions((current) => current.length <= 1 ? current : current.filter((item) => item.id !== id));
  }

  /**
   * Serializa as listas de aliases e extensões para o formato esperado pela API
   * e envia o salvamento via IPC.
   */
  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError("");

    // Monta o payload no formato PlatformMappingsInput esperado pelo IPC
    const payload: PlatformMappingsInput = {
      aliases: aliases.map((item) => item.value),
      romExtensions: extensions.map((item) => ({
        extension: item.extension,
        kind: item.kind,
        is_primary: item.isPrimary
      }))
    };

    try {
      await window.gameStockAPI.platforms.saveMappings(platform.id, payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar os vínculos");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      {/* Container arrastável do modal de vínculos */}
      <section
        ref={draggable.dialogRef}
        className="management-modal platform-mappings-modal draggable-modal"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
      >
        <header>
          <div>
            <h2>Vínculos de plataforma</h2>
            {/* Subtítulo com o nome da plataforma em edição */}
            <p className="platform-mappings-subtitle">{platform.name}</p>
          </div>
          <button type="button" className="icon-button modal-close-button" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {/* Exibe indicador de carregamento enquanto busca os vínculos via IPC */}
        {loading ? (
          <div className="platform-mappings-loading">Carregando...</div>
        ) : (
          <form className="management-form platform-mappings-form" onSubmit={save}>
            {/* Seção de aliases */}
            <section className="platform-mappings-section">
              <div className="platform-mappings-section-head">
                <div>
                  <strong>Aliases</strong>
                  <p>Nomes equivalentes usados na busca e no casamento automático de metadados.</p>
                </div>
                <button type="button" className="text-button" onClick={addAlias}>
                  <Plus size={14} aria-hidden="true" />
                  Alias
                </button>
              </div>
              <div className="platform-mappings-list">
                {aliases.map((alias, index) => (
                  <div className="platform-mappings-row" key={alias.id}>
                    <input
                      value={alias.value}
                      onChange={(event) => updateAlias(alias.id, event.target.value)}
                      // Primeiro alias usa o nome da plataforma como placeholder
                      placeholder={index === 0 ? platform.name : "Ex: Sony Playstation"}
                    />
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() => removeAlias(alias.id)}
                      disabled={aliases.length <= 1} // Impede remoção da última linha
                      title="Remover alias"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Seção de extensões de ROM */}
            <section className="platform-mappings-section">
              <div className="platform-mappings-section-head">
                <div>
                  <strong>Extensões de ROM</strong>
                  <p>Definem o filtro do importador de pasta para esta plataforma.</p>
                </div>
                <button type="button" className="text-button" onClick={addExtension}>
                  <Plus size={14} aria-hidden="true" />
                  Extensão
                </button>
              </div>
              {/* Cabeçalho das colunas da tabela de extensões */}
              <div className="platform-extension-header">
                <span>Extensão</span>
                <span>Descrição</span>
                <span>Usar</span>
                <span />
              </div>
              <div className="platform-mappings-list">
                {extensions.map((extension) => (
                  <div className="platform-extension-row" key={extension.id}>
                    {/* Campo: extensão de arquivo (ex.: .iso) */}
                    <input
                      value={extension.extension}
                      onChange={(event) => updateExtension(extension.id, { extension: event.target.value })}
                      placeholder=".iso"
                    />
                    {/* Campo: descrição legível do tipo de arquivo */}
                    <input
                      value={extension.kind}
                      onChange={(event) => updateExtension(extension.id, { kind: event.target.value })}
                      placeholder="Imagem de disco"
                    />
                    {/* Checkbox: marca a extensão como primária para o importador */}
                    <label className="platform-extension-check">
                      <input
                        type="checkbox"
                        checked={extension.isPrimary}
                        onChange={(event) => updateExtension(extension.id, { isPrimary: event.target.checked })}
                      />
                      <span>{extension.isPrimary ? "Sim" : "Não"}</span>
                    </label>
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() => removeExtension(extension.id)}
                      disabled={extensions.length <= 1} // Impede remoção da última linha
                      title="Remover extensão"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Erro de API exibido quando presente */}
            {error && <p className="form-error">{error}</p>}

            <footer>
              <button type="button" className="text-button danger form-action-button" onClick={onClose} disabled={saving}>
                <X size={14} aria-hidden="true" />
                Cancelar
              </button>
              <button type="submit" className="text-button active form-action-button" disabled={saving}>
                <Save size={14} aria-hidden="true" />
                {saving ? "Salvando..." : "Salvar mapeamentos"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}

/**
 * Componente principal de gerenciamento de plataformas.
 * Lista todas as plataformas com nome, categoria, contagem de jogos e emulador padrão.
 * Oferece ações de editar vínculos, editar dados e remover (apenas para não-padrão).
 * Carrega o emulador padrão de cada plataforma via IPC ao montar ou quando a lista muda.
 */
export function PlatformManager() {
  // Lista de plataformas cadastradas no banco
  const platforms = useGameStockStore((state) => state.platforms);
  // ID da plataforma selecionada na sidebar (para limpar ao remover)
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  // Atualiza a plataforma selecionada no store
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);
  // Recarrega a lista de plataformas do banco
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  // Recarrega a lista de jogos (atualiza contagens)
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  // Token usado para invalidar cache quando vinculos plataforma/emulador mudam
  const platformsReloadToken = useGameStockStore((state) => state.platformsReloadToken);

  // Controla qual modal de formulário está aberto (criação ou edição)
  const [modal, setModal] = useState<ModalMode | null>(null);
  // Plataforma atualmente sendo editada no modal de vínculos; null = fechado
  const [mappingPlatform, setMappingPlatform] = useState<Platform | null>(null);
  // Mensagem de erro de remoção
  const [error, setError] = useState("");
  // Mapa de plataformId → emulador padrão (null se não configurado)
  const [defaultEmulators, setDefaultEmulators] = useState<Record<number, PlatformEmulator | null>>({});

  /**
   * Carrega o emulador padrão de cada plataforma ao montar ou quando a lista
   * de plataformas mudar, reutilizando cache compartilhado com a grade.
   */
  useEffect(() => {
    let canceled = false;
    if (!platforms.length) {
      setDefaultEmulators({});
      return undefined;
    }

    void loadDefaultPlatformEmulators(platforms.map((platform) => platform.id), platformsReloadToken)
      .then((nextEmulators) => {
        if (!canceled) setDefaultEmulators(nextEmulators);
      });

    return () => {
      canceled = true;
    };
  }, [platforms, platformsReloadToken]);

  /**
   * Remove uma plataforma após confirmação do usuário.
   * Se a plataforma removida estava selecionada na sidebar, limpa a seleção.
   */
  async function remove(platform: Platform): Promise<void> {
    if (!window.confirm(`Remover a plataforma "${platform.name}"?`)) return;
    setError("");
    try {
      await window.gameStockAPI.platforms.delete(platform.id);
      // Limpa seleção de plataforma se era a removida
      if (selectedPlatformId === platform.id) setSelectedPlatformId(null);
      reloadPlatforms();
      reloadGames();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover a plataforma");
    }
  }

  return (
    <div className="platform-manager">
      <SectionIntro title="Plataformas" description="Plataformas cadastradas para organizar biblioteca, aliases de busca e extensões aceitas no importador." />

      {/* Lista de plataformas cadastradas */}
      <div className="platform-list">
        {platforms.length === 0 && (
          <p className="platform-list-empty">Nenhuma plataforma cadastrada.</p>
        )}
        {platforms.map((platform) => (
          <div className="platform-row" key={platform.id}>
            {/* Informações da plataforma: nome, categoria, contagem e emulador */}
            <div className="platform-row-info">
              <strong>{platform.name}</strong>
              <span>
                {platform.category} · {platform.gameCount ?? 0} jogos
                {" · "}
                {/* Exibe nome do emulador padrão ou aviso quando não configurado */}
                {defaultEmulators[platform.id]?.emulator?.name ?? <em>Sem emulador</em>}
              </span>
            </div>

            {/* Botões de ação por linha */}
            <div className="platform-row-actions">
              {/* Abre o modal de vínculos (aliases + extensões) */}
              <button
                type="button"
                className="icon-button"
                title="Editar aliases e extensões"
                onClick={() => setMappingPlatform(platform)}
              >
                <Link2 size={14} aria-hidden="true" />
              </button>
              {/* Abre o modal de edição de nome/categoria */}
              <button
                type="button"
                className="icon-button"
                title="Editar"
                onClick={() => setModal({ kind: "edit", platform })}
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
              {/* Botão de remoção disponível apenas para plataformas não-padrão */}
              {!platform.is_default && (
                <button
                  type="button"
                  className="icon-button danger"
                  title="Remover"
                  onClick={() => remove(platform)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Barra inferior com erro e botão de nova plataforma */}
      <div className="platform-manager-toolbar">
        {error && <p className="form-error">{error}</p>}
        <button
          type="button"
          className="text-button active platform-add-button"
          onClick={() => setModal({ kind: "create" })}
        >
          <Plus size={14} aria-hidden="true" />
          Nova plataforma
        </button>
      </div>

      {/* Modal de criação/edição: renderizado apenas quando `modal` está definido */}
      {modal && <PlatformFormModal mode={modal} onClose={() => setModal(null)} />}

      {/* Modal de vínculos: renderizado apenas quando uma plataforma está selecionada */}
      {mappingPlatform && <PlatformMappingsModal platform={mappingPlatform} onClose={() => {
        reloadPlatforms(); // Atualiza a lista após salvar vínculos
        setMappingPlatform(null);
      }} />}
    </div>
  );
}

/**
 * Normaliza a string de categoria vinda do banco para o valor canônico
 * usado no select do formulário ("Console", "Portatil" ou "PC").
 * Remove acentos e faz comparação case-insensitive.
 */
function normalizeCategory(category: string): string {
  const normalized = category
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // Remove diacríticos (acentos)
  if (normalized === "pc") return "PC";
  if (normalized.includes("port")) return "Portatil";
  return "Console";
}

/**
 * Gera um id único para uma nova linha de alias ou extensão.
 * Combina prefixo, timestamp e um fragmento aleatório para evitar colisões.
 */
function createRowId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
