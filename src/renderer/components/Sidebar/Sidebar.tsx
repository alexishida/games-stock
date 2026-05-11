/**
 * Sidebar.tsx
 *
 * Barra lateral principal da aplicação.
 * Contém o logo/marca do app, navegação principal (Biblioteca / Inventário),
 * filtros de coleção (Favoritos, Jogando, Concluído) e a árvore de plataformas.
 * No rodapé, exibe o botão de acesso às configurações.
 *
 * A versão do app é carregada via IPC ao montar e exibida abaixo do nome.
 * O Inventário está previsto na UI mas ainda não tem funcionalidade implementada.
 */

import { type ReactNode, useEffect, useState } from "react";
import { Gamepad2, Library, Settings, Star, Trophy } from "lucide-react";
import { CollectionCounts, CollectionFilter } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { PlatformTree } from "./PlatformTree";
import "./Sidebar.css";

/** Definição de um filtro de coleção exibido no nav da sidebar */
type FilterDef = { value: CollectionFilter; label: string; icon: ReactNode; countKey: keyof CollectionCounts };

/**
 * Filtros de coleção disponíveis na sidebar.
 * Cada filtro tem um valor (CollectionFilter), label, ícone e chave de contagem
 * correspondente no objeto collectionCounts do store.
 */
const COLLECTION_FILTERS: FilterDef[] = [
  { value: "favorites", label: "Favoritos", icon: <Star aria-hidden="true" size={15} />, countKey: "favorites" },
  { value: "playing", label: "Jogando", icon: <Gamepad2 aria-hidden="true" size={15} />, countKey: "playing" },
  { value: "completed", label: "Concluído", icon: <Trophy aria-hidden="true" size={15} />, countKey: "completed" }
];

/**
 * Componente de sidebar principal.
 * Gerencia a versão do app (carregada via IPC), o filtro de coleção ativo
 * e a navegação para configurações.
 */
export function Sidebar() {
  // Abre o modal de configurações na seção especificada
  const openSettings = useGameStockStore((state) => state.openSettings);
  // Filtro de coleção ativo (ex.: "favorites", "playing", "completed", "all")
  const collectionFilter = useGameStockStore((state) => state.collectionFilter);
  // Contagens de jogos por filtro de coleção para exibir badges nos botões
  const collectionCounts = useGameStockStore((state) => state.collectionCounts);
  // Atualiza o filtro de coleção no store
  const setCollectionFilter = useGameStockStore((state) => state.setCollectionFilter);
  // Limpa a seleção de plataforma ao navegar para "Biblioteca"
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);

  // Versão do app exibida abaixo do nome na marca
  const [appVersion, setAppVersion] = useState("");

  // Toda navegação atual pertence a Biblioteca.
  // Só deve perder estado ativo quando existir fluxo real de Inventário.
  const isLibraryActive = true;

  /**
   * Busca a versão do app via IPC ao montar a sidebar.
   * Usa flag `mounted` para ignorar atualização após desmontagem.
   */
  useEffect(() => {
    let mounted = true;

    void window.gameStockAPI.app.getVersion().then((version) => {
      if (mounted) setAppVersion(version);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <aside className="sidebar">
      {/* Marca do app: ícone, nome, subtítulo e versão */}
      <div className="brand-lockup">
        <div className="brand-mark">
          <Gamepad2 aria-hidden="true" size={22} />
        </div>
        <div>
          <strong>GameStock</strong>
          <span>Games Management</span>
          {/* Exibe a versão apenas quando carregada */}
          {appVersion ? <small className="brand-version">v{appVersion}</small> : null}
        </div>
      </div>

      {/* Navegação principal: Biblioteca e Inventário */}
      <nav className="sidebar-nav" aria-label="Navegação principal">
        {/* Biblioteca: limpa seleção de plataforma ao clicar */}
        <button type="button" className={isLibraryActive ? "nav-item active" : "nav-item"} onClick={() => setSelectedPlatformId(null)}>
          <Library aria-hidden="true" size={18} />
          Biblioteca
        </button>
        {/* Inventário: item de navegação previsto, sem funcionalidade ainda */}
        <button type="button" className="nav-item">
          <Gamepad2 aria-hidden="true" size={18} />
          Inventário
        </button>
      </nav>

      <div className="sidebar-separator" />

      {/* Filtros de coleção: Favoritos, Jogando, Concluído */}
      <nav className="sidebar-nav" aria-label="Filtros de coleção">
        {COLLECTION_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={collectionFilter === item.value ? "nav-item nav-item-sub active" : "nav-item nav-item-sub"}
            onClick={() => setCollectionFilter(item.value)}
          >
            {item.icon}
            {item.label}
            {/* Badge com contagem de jogos no filtro */}
            <span className="nav-item-count">{collectionCounts[item.countKey]}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-separator" />

      {/* Árvore de plataformas com filtragem por categoria */}
      <PlatformTree />

      {/* Botão de configurações no rodapé da sidebar */}
      <button type="button" className="scan-button" onClick={() => openSettings("biblioteca")}>
        <Settings aria-hidden="true" size={18} />
        Configurações
      </button>
    </aside>
  );
}
