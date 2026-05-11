/**
 * Hook que encapsula toda a lógica do fluxo de importação do LaunchBox:
 * garantia de metadados, busca de jogos e importação com seleção de tipos de imagem.
 *
 * Gerencia estados locais de formulário (query, plataforma, resultados, seleção),
 * progresso de download e flag de loading, expondo ações assíncronas para o componente.
 */
import { useState } from "react";
import { LaunchBoxGame, LaunchBoxImageType, LaunchBoxProgress } from "../../shared/types";
import { useGameStockStore } from "../store";

/** Tipos de imagem selecionados por padrão ao importar um jogo do LaunchBox. */
const defaultImageTypes: LaunchBoxImageType[] = [
  "Box - Back",
  "Box - Front",
  "Cart - Front",
  "Fanart - Background",
  "Screenshot - Gameplay"
];

/**
 * Gerencia o estado e as ações do modal de importação do LaunchBox.
 *
 * @returns Estado de formulário, resultados de busca, progresso e ações assíncronas.
 */
export function useLaunchBoxImporter() {
  // Ações do store para forçar recarga após importação bem-sucedida
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);

  /** Texto digitado no campo de busca. */
  const [query, setQuery] = useState("");
  /** Nome da plataforma para filtrar a busca (opcional). */
  const [platformName, setPlatformName] = useState("");
  /** Lista de jogos retornados pela busca. */
  const [results, setResults] = useState<LaunchBoxGame[]>([]);
  /** Jogo selecionado pelo usuário para importar. */
  const [selectedGame, setSelectedGame] = useState<LaunchBoxGame | null>(null);
  /** Tipos de imagem que serão baixados junto com o jogo. */
  const [selectedTypes, setSelectedTypes] = useState<LaunchBoxImageType[]>(defaultImageTypes);
  /** Progresso do download/extração de imagens (null quando inativo). */
  const [progress, setProgress] = useState<LaunchBoxProgress | null>(null);
  /** Indica se há operação assíncrona em andamento. */
  const [loading, setLoading] = useState(false);

  /**
   * Garante que o Metadata.zip do LaunchBox esteja baixado e extraído.
   * Necessário antes de realizar buscas.
   */
  async function ensure(): Promise<void> {
    setLoading(true);
    try {
      await window.gameStockAPI.launchbox.ensureMetadata();
    } finally {
      setLoading(false);
    }
  }

  /**
   * Busca jogos no índice do LaunchBox conforme query e plataforma atuais,
   * atualizando a lista de resultados no estado local.
   */
  async function search(): Promise<void> {
    setLoading(true);
    try {
      // Passa null para platformName quando vazio, para busca sem filtro de plataforma
      const found = await window.gameStockAPI.launchbox.searchGames({ query, platformName: platformName || null });
      setResults(found);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Importa o jogo selecionado para a biblioteca local,
   * baixando os tipos de imagem escolhidos e recarregando jogos e plataformas.
   */
  async function importSelected(): Promise<void> {
    if (!selectedGame) return;
    setLoading(true);
    try {
      await window.gameStockAPI.launchbox.importGame({ launchboxGameId: selectedGame.id, imageTypes: selectedTypes });
      // Força recarga do store para refletir o novo jogo na biblioteca
      reloadGames();
      reloadPlatforms();
    } finally {
      setLoading(false);
    }
  }

  return {
    query,
    setQuery,
    platformName,
    setPlatformName,
    results,
    selectedGame,
    setSelectedGame,
    selectedTypes,
    setSelectedTypes,
    progress,
    setProgress,
    loading,
    ensure,
    search,
    importSelected
  };
}
