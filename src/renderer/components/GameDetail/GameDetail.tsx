/**
 * GameDetail.tsx
 *
 * Painel de detalhe de um jogo selecionado na biblioteca.
 * Exibe informações completas do jogo (capa, metadados, galeria de imagens, ROM),
 * permite navegar entre jogos, alterar status (favorito, jogando, concluído),
 * lançar o jogo via emulador padrão da plataforma e abrir o formulário de edição.
 *
 * Integra-se com o store Zustand para leitura e atualização reativa do jogo selecionado.
 */

import { type MouseEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Download, Gamepad2, Image, Library, Monitor, Pencil, Play, Star, Trash2, Trophy, X } from "lucide-react";
import { GameMediaItem, PlatformEmulator } from "../../../shared/types";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";
import { GameForm } from "./GameForm";
import "./GameDetail.css";

/**
 * Componente principal de detalhe do jogo.
 * Lê o jogo selecionado do store e carrega dados adicionais (mídia e emulador) via IPC.
 */
export function GameDetail() {
  // Lista completa de jogos (usada para navegação entre jogos)
  const games = useGameStockStore((state) => state.games);

  // ID do jogo atualmente selecionado
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);

  // Dados completos do jogo selecionado (pode ser null enquanto carrega)
  const selectedGame = useGameStockStore((state) => state.selectedGame);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const setSelectedGame = useGameStockStore((state) => state.setSelectedGame);
  const upsertGame = useGameStockStore((state) => state.upsertGame);
  const removeGameFromStore = useGameStockStore((state) => state.removeGame);
  const reloadGames = useGameStockStore((state) => state.reloadGames);

  // Token que incrementa quando a lista de jogos é recarregada (força busca de dados frescos)
  const reloadToken = useGameStockStore((state) => state.reloadToken);

  // Token que incrementa quando as plataformas mudam (força recarga do emulador padrão)
  const platformsReloadToken = useGameStockStore((state) => state.platformsReloadToken);

  const game = selectedGame;

  // URLs de mídia local resolvidas para o jogo atual
  const coverUrl = localMediaUrl(game?.box_art_path);
  const screenshotUrl = localMediaUrl(game?.screenshot_path);
  const backgroundUrl = localMediaUrl(game?.background_path);

  // Usa background como imagem de herói; fallback para capa quando não há background
  const heroBgUrl = backgroundUrl ?? coverUrl;

  // Índice da imagem aberta no lightbox (null = lightbox fechado)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Controla a abertura do modal de edição do jogo
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Detecta se a capa é landscape (largura > altura) para ajuste de layout
  const [isCoverLandscape, setIsCoverLandscape] = useState(false);

  // Itens de mídia (galeria) do jogo, carregados via IPC
  const [mediaItems, setMediaItems] = useState<GameMediaItem[]>([]);

  // Emulador padrão associado à plataforma do jogo
  const [defaultEmulator, setDefaultEmulator] = useState<PlatformEmulator | null>(null);
  const [emulatorLoading, setEmulatorLoading] = useState(false);

  // Estado do lançamento do jogo (loading e erro)
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");

  // Hook de drag para o modal de edição arrastável
  const editModalDraggable = useDraggableDialog<HTMLElement>();

  /**
   * Reseta estados visuais dependentes do jogo ao trocar o jogo selecionado:
   * orientação da capa, lightbox aberto, erro de lançamento e flag de lançando.
   */
  useEffect(() => {
    setIsCoverLandscape(false);
    setLightboxIndex(null);
    setLaunchError("");
    setLaunching(false);
  }, [selectedGameId]);

  /**
   * Busca os dados completos do jogo via IPC sempre que o ID selecionado ou o reloadToken mudam.
   * Usa flag `canceled` para evitar atualizar estado após desmontagem ou troca de jogo.
   */
  useEffect(() => {
    let canceled = false;
    if (!selectedGameId) {
      setSelectedGame(null);
      return undefined;
    }

    window.gameStockAPI.games
      .get(selectedGameId)
      .then((nextGame) => {
        if (!canceled) setSelectedGame(nextGame);
      })
      .catch(() => {});

    return () => {
      canceled = true;
    };
  }, [reloadToken, selectedGameId, setSelectedGame]);

  /**
   * Busca a galeria de mídia (imagens extras) do jogo via IPC ao selecionar um jogo.
   * Limpa os itens ao iniciar para evitar exibir mídia do jogo anterior.
   */
  useEffect(() => {
    let canceled = false;
    setMediaItems([]);
    if (!selectedGameId) return undefined;

    window.gameStockAPI.games
      .listMedia(selectedGameId)
      .then((items) => {
        if (!canceled) setMediaItems(items);
      })
      .catch(() => {
        if (!canceled) setMediaItems([]);
      });

    return () => {
      canceled = true;
    };
  }, [selectedGameId]);

  /**
   * Busca o emulador padrão da plataforma do jogo via IPC.
   * Roda ao trocar de jogo ou quando as plataformas são recarregadas.
   */
  useEffect(() => {
    let canceled = false;
    setDefaultEmulator(null);
    if (!game?.platform_id) {
      setEmulatorLoading(false);
      return undefined;
    }

    setEmulatorLoading(true);
    window.gameStockAPI.emulators
      .listByPlatform(game.platform_id)
      .then((items) => {
        if (!canceled) setDefaultEmulator(items.find((item) => item.is_default === 1) ?? null);
      })
      .catch(() => {
        if (!canceled) setDefaultEmulator(null);
      })
      .finally(() => {
        if (!canceled) setEmulatorLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [game?.platform_id, platformsReloadToken]);

  // Estado vazio: exibe botão de voltar para a biblioteca
  if (!game) {
    return (
      <section className="game-detail">
        <div className="detail-empty">
          <button type="button" className="detail-back-inline" onClick={() => setSelectedGameId(null)}>
            Voltar para biblioteca
          </button>
        </div>
      </section>
    );
  }

  // Referência estável ao jogo atual para uso em closures das funções assíncronas
  const currentGame = game;

  // Metadados com fallback para textos padrão quando não informados
  const publisher = game.publisher || "Publisher não informado";
  const genre = game.genre || "Gênero não informado";
  const year = game.year?.toString() ?? "Ano não informado";
  const overview = game.notes?.trim() || "Sem descrição cadastrada para este jogo.";

  // Nome do arquivo da ROM (extrai apenas o nome do caminho completo)
  const fileName = game.rom_path?.split(/[\\/]/).pop() ?? "ROM não associada";
  const hasRom = Boolean(game.rom_path?.trim());
  const hasDefaultEmulator = Boolean(defaultEmulator);

  /** O jogo pode ser lançado somente se tiver ROM, emulador padrão e não estiver carregando */
  const canLaunchGame = hasRom && hasDefaultEmulator && !emulatorLoading;

  /** Título do tooltip do botão de jogar, variando conforme o estado atual */
  const playButtonTitle = launchError || getPlayButtonTitle(hasRom, emulatorLoading, defaultEmulator);

  // Flags de status de jogo ativo para highlight dos botões de status
  const completedActive = game.play_status === "completed";
  const playingActive = game.play_status === "playing";

  /**
   * Itens de fallback para a galeria quando a API de mídia não retorna itens.
   * Usa o background do jogo se disponível.
   */
  const fallbackMediaItems = [
    backgroundUrl ? { path: game.background_path!, label: "Background", kind: "background" as const } : null
  ].filter(Boolean) as GameMediaItem[];

  // Exclui screenshots da galeria (screenshot é exibido separadamente acima da galeria)
  const galleryItems = (mediaItems.length ? mediaItems : fallbackMediaItems).filter((item) => item.kind !== "screenshot");

  // Prefixo de nome de arquivo para download de imagens (plataforma - título)
  const saveNamePrefix = `${sanitizeFileNamePart(game.platform_name ?? "Sem plataforma")} - ${sanitizeFileNamePart(game.title)}`;

  /**
   * Lista de imagens disponíveis no lightbox:
   * screenshot primeiro (se disponível), seguido dos itens da galeria.
   */
  const lightboxImages = [
    screenshotUrl && game.screenshot_path ? { url: screenshotUrl, path: game.screenshot_path, label: "Screenshot", fileName: buildSaveFileName(saveNamePrefix, getFileName(game.screenshot_path, "screenshot")) } : null,
    ...galleryItems.map((item) => {
      const url = localMediaUrl(item.path);
      return url ? { url, path: item.path, label: item.label, fileName: buildSaveFileName(saveNamePrefix, getFileName(item.path, item.label)) } : null;
    })
  ].filter(Boolean) as Array<{ url: string; path: string; label: string; fileName: string }>;

  // Imagem atualmente aberta no lightbox (null se fechado)
  const lightboxItem = lightboxIndex === null ? null : lightboxImages[lightboxIndex] ?? null;

  /** Exclui o jogo da biblioteca após confirmação e atualiza o store e a lista. */
  async function deleteGame(): Promise<void> {
    if (!game) return;
    if (!window.confirm(`Excluir "${game.title}" da biblioteca?`)) return;
    await window.gameStockAPI.games.delete(game.id);
    removeGameFromStore(game.id);
    reloadGames();
  }

  /** Alterna o status de favorito do jogo e atualiza o store. */
  async function toggleFavorite(): Promise<void> {
    const updated = await window.gameStockAPI.games.update(currentGame.id, { favorite: !currentGame.favorite });
    upsertGame(updated);
    reloadGames();
  }

  /**
   * Alterna o status de jogo (playing/completed).
   * Se o status já estiver ativo, reverte para "unplayed".
   */
  async function togglePlayStatus(status: typeof currentGame.play_status): Promise<void> {
    const updated = await window.gameStockAPI.games.update(currentGame.id, { play_status: currentGame.play_status === status ? "unplayed" : status });
    upsertGame(updated);
    reloadGames();
  }

  /**
   * Lança o jogo via emulador padrão da plataforma.
   * Exibe o erro por 4 segundos se o lançamento falhar.
   */
  async function launchGame(): Promise<void> {
    if (!canLaunchGame || launching) return;
    setLaunchError("");
    setLaunching(true);
    try {
      await window.gameStockAPI.games.launch(currentGame.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao lançar jogo";
      setLaunchError(message);
      setTimeout(() => setLaunchError(""), 4000);
    } finally {
      setLaunching(false);
    }
  }

  /** Navega para o jogo anterior na lista filtrada atual (navegação circular). */
  function selectPreviousGame(): void {
    const currentIndex = games.findIndex((item) => item.id === currentGame.id);
    const prevGame = games[(currentIndex - 1 + games.length) % games.length];
    if (prevGame) setSelectedGameId(prevGame.id);
  }

  /** Navega para o próximo jogo na lista filtrada atual (navegação circular). */
  function selectNextGame(): void {
    const currentIndex = games.findIndex((item) => item.id === currentGame.id);
    const nextGame = games[(currentIndex + 1) % games.length];
    if (nextGame) setSelectedGameId(nextGame.id);
  }

  /**
   * Abre o lightbox na imagem correspondente à URL clicada.
   * Usa índice 0 como fallback se a URL não for encontrada na lista.
   */
  function openLightbox(url: string): void {
    const index = lightboxImages.findIndex((item) => item.url === url);
    setLightboxIndex(index >= 0 ? index : 0);
  }

  /** Avança para a próxima imagem no lightbox (circular). */
  function showNextLightboxImage(): void {
    if (!lightboxImages.length) return;
    setLightboxIndex((current) => current === null ? 0 : (current + 1) % lightboxImages.length);
  }

  /** Volta para a imagem anterior no lightbox (circular). */
  function showPreviousLightboxImage(): void {
    if (!lightboxImages.length) return;
    setLightboxIndex((current) => current === null ? 0 : (current - 1 + lightboxImages.length) % lightboxImages.length);
  }

  /**
   * Salva a imagem atualmente aberta no lightbox via diálogo nativo do sistema.
   * Usa o nome de arquivo gerado a partir do prefixo do jogo.
   */
  async function downloadLightboxImage(event: MouseEvent<HTMLButtonElement>): Promise<void> {
    event.stopPropagation();
    if (!lightboxItem) return;

    await window.gameStockAPI.dialogs.saveImageFile(lightboxItem.path, lightboxItem.fileName);
  }

  return (
    <section className="game-detail">
      {/* Hero com imagem de fundo, informações principais e ações do jogo */}
      <div className="detail-hero">
        {/* Imagem de fundo com overlay de sombra para legibilidade do texto */}
        {heroBgUrl ? <img className="detail-hero-bg" src={heroBgUrl} alt="" aria-hidden="true" /> : <div className="detail-hero-bg detail-hero-fallback" />}
        <div className="detail-hero-shade" />
        {/* Botões de navegação: voltar para biblioteca e ir entre jogos */}
        <div className="detail-top-actions">
          <button type="button" className="detail-top-button" onClick={() => setSelectedGameId(null)}>
            <Library aria-hidden="true" size={18} />
            Biblioteca
          </button>
          {/* Botão de jogo anterior — oculto se já for o primeiro */}
          {games.findIndex((item) => item.id === currentGame.id) > 0 && (
            <button type="button" className="detail-top-button" onClick={selectPreviousGame} aria-label="Jogo anterior" title="Jogo anterior">
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
          )}
          {/* Botão de próximo jogo — oculto se já for o último */}
          {games.findIndex((item) => item.id === currentGame.id) < games.length - 1 && (
            <button type="button" className="detail-top-button" onClick={selectNextGame} aria-label="Próximo jogo" title="Próximo jogo">
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          )}
        </div>
        <div className="detail-hero-content">
          {/* Card da capa: detecta orientação landscape no onLoad para ajuste de CSS */}
          <div className={"detail-cover-card" + (isCoverLandscape ? " landscape" : "")}>
            {coverUrl
              ? <img
                  src={coverUrl}
                  alt=""
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    // Marca como landscape se largura > altura para ajuste de aspect-ratio no CSS
                    setIsCoverLandscape(img.naturalWidth > img.naturalHeight);
                  }}
                />
              : <Gamepad2 aria-hidden="true" size={38} />}
          </div>
          {/* Bloco de título com chips de metadados (plataforma, ano, rating) */}
          <div className="detail-title-block">
            <div className="detail-chips" aria-label="Metadados principais">
              <span>{game.platform_name ?? "Sem plataforma"}</span>
              <span>{year}</span>
              {game.rating && <span>{game.rating}</span>}
            </div>
            <h1>{game.title}</h1>
            <p>{publisher} · {genre}</p>
          </div>
          {/* Barra de ações do jogo: jogar, favoritar, status, editar, excluir */}
          <div className="detail-hero-actions" aria-label="Acoes do jogo">
            <button
              type="button"
              className="detail-hero-play-button"
              disabled={!canLaunchGame || launching}
              onClick={() => void launchGame()}
              title={playButtonTitle}
            >
              <Play aria-hidden="true" size={18} />
              {launching ? "Abrindo..." : "Jogar"}
            </button>
            {/* Mensagem de erro de lançamento exibida temporariamente */}
            {launchError && <span className="detail-hero-launch-error" role="status">{launchError}</span>}
            {/* Botão de favorito com ícone preenchido quando ativo */}
            <button type="button" className={"detail-hero-icon-button detail-favorite-button" + (game.favorite ? " active" : "")} onClick={toggleFavorite} aria-label={game.favorite ? "Remover favorito" : "Marcar favorito"} title={game.favorite ? "Remover favorito" : "Marcar favorito"}>
              <Star aria-hidden="true" size={18} fill={game.favorite ? "#facc15" : "none"} color={game.favorite ? "#facc15" : undefined} />
            </button>
            {/* Botão de status "concluído" */}
            <button type="button" className={"detail-hero-icon-button detail-completed-button" + (completedActive ? " active" : "")} onClick={() => togglePlayStatus("completed")} aria-label="Concluído" title="Concluído">
              <Trophy aria-hidden="true" size={18} />
            </button>
            {/* Botão de status "jogando" */}
            <button type="button" className={"detail-hero-icon-button detail-playing-button" + (playingActive ? " active" : "")} onClick={() => togglePlayStatus("playing")} aria-label="Jogando" title="Jogando">
              <Gamepad2 aria-hidden="true" size={18} />
            </button>
            {/* Botão de edição — abre modal de formulário */}
            <button type="button" className="detail-hero-icon-button" onClick={() => setIsEditModalOpen(true)} aria-label="Editar" title="Editar">
              <Pencil aria-hidden="true" size={18} />
            </button>
            {/* Botão de exclusão com estilo de perigo */}
            <button type="button" className="detail-hero-icon-button danger" onClick={deleteGame} aria-label="Excluir" title="Excluir">
              <Trash2 aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Grade de conteúdo: descrição, informações de arquivo e galeria de imagens */}
      <div className="detail-content-grid">
        {/* Painel de descrição/sinopse do jogo */}
        <section className="detail-panel detail-about">
          <h2>Descrição</h2>
          <p>{overview}</p>
        </section>

        {/* Painel de informações do arquivo (ROM e box art) */}
        <section className="detail-panel">
          {/* Screenshot exibido acima da lista de informações do arquivo */}
          {screenshotUrl && (
            <div className="detail-file-screenshot">
              <h3>Screenshot</h3>
              <button type="button" className="detail-file-screenshot-button" onClick={() => openLightbox(screenshotUrl)} aria-label="Visualizar screenshot">
                <img src={screenshotUrl} alt="Screenshot" />
              </button>
            </div>
          )}
          <h2>Arquivo</h2>
          <dl className="detail-info-list">
            <div className="detail-info-row-wrap">
              <dt>ROM</dt>
              <dd>{fileName}</dd>
            </div>
            <div>
              <dt>Box Art</dt>
              <dd>{game.box_art_path ? "Associada" : "Não associada"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              {/* Classe "detail-ok" adiciona cor verde quando ROM está configurada */}
              <dd className={game.rom_path ? "detail-ok" : ""}>{game.rom_path ? "Pronto" : "Pendente"}</dd>
            </div>
          </dl>
        </section>

        {/* Painel de galeria de imagens do jogo (box art, fanart, backgrounds) */}
        <section className="detail-panel detail-gallery-panel">
          <h2>Galeria</h2>
          <div className="detail-gallery">
            {galleryItems.length ? galleryItems.map((item) => {
              const itemUrl = localMediaUrl(item.path);
              return (
                <button
                  type="button"
                  key={item.path}
                  className={"detail-gallery-thumb" + (item.kind === "background" ? " detail-gallery-wide" : "")}
                  onClick={() => itemUrl && openLightbox(itemUrl)}
                  aria-label={item.label}
                >
                  {itemUrl ? <img src={itemUrl} alt={item.label} /> : <Image aria-hidden="true" size={24} />}
                  <span className="detail-gallery-label">{item.label}</span>
                </button>
              );
            }) : (
              // Estado vazio da galeria quando nenhuma imagem foi baixada
              <div className="detail-gallery-empty-state">
                <Monitor aria-hidden="true" size={24} />
                <span>Nenhuma imagem baixada</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Lightbox para visualização ampliada das imagens com navegação e download */}
      {lightboxItem && (
        <div className="detail-lightbox" role="dialog" aria-modal="true" aria-label="Visualizar imagem">
          {/* Botão de download da imagem atual via diálogo nativo */}
          <button type="button" className="detail-lightbox-download text-button" onClick={downloadLightboxImage} aria-label="Salvar imagem" title="Salvar imagem">
            <Download aria-hidden="true" size={18} />
            Salvar
          </button>
          <button type="button" className="detail-lightbox-close icon-button modal-close-button" onClick={() => setLightboxIndex(null)} aria-label="Fechar">
            <X aria-hidden="true" size={20} />
          </button>
          {/* Botões de navegação entre imagens — exibidos apenas quando há mais de uma */}
          {lightboxImages.length > 1 && (
            <>
              <button type="button" className="detail-lightbox-nav detail-lightbox-prev icon-button" onClick={(event) => { event.stopPropagation(); showPreviousLightboxImage(); }} aria-label="Imagem anterior" title="Imagem anterior">
                <ArrowLeft aria-hidden="true" size={24} />
              </button>
              <button type="button" className="detail-lightbox-nav detail-lightbox-next icon-button" onClick={(event) => { event.stopPropagation(); showNextLightboxImage(); }} aria-label="Próxima imagem" title="Próxima imagem">
                <ArrowRight aria-hidden="true" size={24} />
              </button>
            </>
          )}
          {/* Clique na imagem avança para a próxima */}
          <img src={lightboxItem.url} alt={lightboxItem.label} onClick={(event) => { event.stopPropagation(); showNextLightboxImage(); }} title="Próxima imagem" />
        </div>
      )}

      {/* Modal de edição do jogo — arrastável, com backdrop que fecha ao clicar fora */}
      {isEditModalOpen && (
        <div className="detail-edit-backdrop" onMouseDown={() => setIsEditModalOpen(false)} role="presentation">
          <section
            ref={editModalDraggable.dialogRef}
            className="management-modal detail-edit-modal draggable-modal"
            style={editModalDraggable.style}
            onMouseDown={(event) => event.stopPropagation()} // evita fechar ao clicar dentro do modal
            onPointerDown={editModalDraggable.startDialogDrag}
            onPointerMove={editModalDraggable.dragDialog}
            onPointerUp={editModalDraggable.stopDialogDrag}
            onPointerCancel={editModalDraggable.stopDialogDrag}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-edit-title"
          >
            <header>
              <h2 id="detail-edit-title">Editar cadastro</h2>
              <button type="button" className="icon-button modal-close-button" onClick={() => setIsEditModalOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <GameForm game={game} onCancel={() => setIsEditModalOpen(false)} onSaved={() => setIsEditModalOpen(false)} />
          </section>
        </div>
      )}
    </section>
  );
}

/**
 * Extrai o nome do arquivo de um caminho (parte após o último separador).
 * Retorna um nome gerado a partir do fallback se o caminho não contiver separadores.
 */
function getFileName(filePath: string, fallback: string): string {
  const fileName = filePath.split(/[\\/]/).pop();
  if (fileName) return fileName;
  return `${fallback.toLowerCase().replace(/\s+/g, "-")}.jpg`;
}

/**
 * Monta o nome de arquivo final para download concatenando prefixo e nome do arquivo.
 * Exemplo: "Nintendo SNES - Super Mario World - box-front.jpg"
 */
function buildSaveFileName(prefix: string, fileName: string): string {
  return `${prefix} - ${sanitizeFileNamePart(fileName)}`;
}

/**
 * Remove caracteres inválidos para nomes de arquivo em Windows/Mac/Linux
 * e normaliza espaços extras. Retorna "imagem" se o resultado ficar vazio.
 */
function sanitizeFileNamePart(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "-").replace(/\s+/g, " ").trim() || "imagem";
}

/**
 * Gera o título do tooltip do botão de jogar conforme o estado atual.
 * Informa o motivo quando o jogo não pode ser lançado.
 */
function getPlayButtonTitle(hasRom: boolean, emulatorLoading: boolean, defaultEmulator: PlatformEmulator | null): string {
  if (!hasRom) return "ROM não configurada";
  if (emulatorLoading) return "Verificando emulador da plataforma";
  if (!defaultEmulator) return "Escolha um emulador padrão para esta plataforma";
  return `Jogar com ${defaultEmulator.emulator?.name ?? "emulador padrão"}`;
}
