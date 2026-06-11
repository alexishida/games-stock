/**
 * Sidebar.tsx
 *
 * Barra lateral principal da aplicação com suporte a dois modos de navegação:
 * - `library`: exibe filtros de coleção e árvore de plataformas (comportamento original).
 * - `inventory`: exibe filtros de inventário (plataformas com itens, tipos, estados).
 *
 * Botões "Biblioteca" e "Inventário" ficam fixos no topo em ambos os modos.
 * Botão "Configurar" permanece fixo no rodapé em ambos os modos.
 */

import { type ReactNode, useEffect, useState } from "react";
import { BarChart3, Cpu, Gamepad2, Library, Plus, Settings, Star, Trophy } from "lucide-react";
import logoSrc from "../../assets/logo.png";
import { CollectionCounts, CollectionFilter } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { PlatformTree } from "./PlatformTree";
import "./Sidebar.css";

/** Definição de um filtro de coleção exibido no nav da sidebar */
type FilterDef = { value: CollectionFilter; label: string; icon: ReactNode; countKey: keyof CollectionCounts };

/** Filtros de coleção disponíveis no modo biblioteca. */
const COLLECTION_FILTERS: FilterDef[] = [
  { value: "mostPlayed", label: "Mais Jogados", icon: <BarChart3 aria-hidden="true" size={15} />, countKey: "mostPlayed" },
  { value: "favorites", label: "Favoritos", icon: <Star aria-hidden="true" size={15} />, countKey: "favorites" },
  { value: "playing", label: "Jogando", icon: <Gamepad2 aria-hidden="true" size={15} />, countKey: "playing" },
  { value: "completed", label: "Concluído", icon: <Trophy aria-hidden="true" size={15} />, countKey: "completed" }
];

/**
 * Componente de sidebar principal.
 * Alterna entre modo biblioteca e modo inventário via `sidebarMode` no store.
 */
export function Sidebar() {
  const openSettings          = useGameStockStore((state) => state.openSettings);
  const collectionFilter      = useGameStockStore((state) => state.collectionFilter);
  const collectionCounts      = useGameStockStore((state) => state.collectionCounts);
  const setCollectionFilter   = useGameStockStore((state) => state.setCollectionFilter);
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);
  const sidebarMode             = useGameStockStore((state) => state.sidebarMode);
  const setSidebarMode          = useGameStockStore((state) => state.setSidebarMode);
  const inventoryFilters        = useGameStockStore((state) => state.inventoryFilters);
  const setInventoryFilters     = useGameStockStore((state) => state.setInventoryFilters);
  const setInventoryCreateOpen  = useGameStockStore((state) => state.setInventoryCreateOpen);

  const [appVersion, setAppVersion] = useState("");

  // Dados para os filtros do modo inventário
  const [itemTypes, setItemTypes] = useState<Array<{ id: number; name: string; count: number }>>([]);
  const [conservationStates, setConservationStates] = useState<Array<{ id: number; name: string; count: number }>>([]);
  const totalItems = itemTypes.reduce((acc, t) => acc + t.count, 0);

  // Carrega versão do app
  useEffect(() => {
    let mounted = true;
    void window.gameStockAPI.app.getVersion().then((v) => { if (mounted) setAppVersion(v); });
    return () => { mounted = false; };
  }, []);

  // Carrega dados dos filtros do inventário ao entrar no modo inventory
  useEffect(() => {
    if (sidebarMode !== "inventory") return;
    let canceled = false;

    void Promise.all([
      window.gameStockAPI.hardwareInventory.typesListWithCounts(),
      window.gameStockAPI.hardwareInventory.statesListWithCounts()
    ]).then(([types, states]) => {
      if (canceled) return;
      setItemTypes(types);
      setConservationStates(states);
    });

    return () => { canceled = true; };
  }, [sidebarMode]);

  function handleSwitchToLibrary() {
    setSidebarMode("library");
    setSelectedPlatformId(null);
  }

  function handleSwitchToInventory() {
    setSidebarMode("inventory");
  }

  return (
    <aside className="sidebar">
      {/* Marca do app */}
      <div className="brand-lockup">
        <img src={logoSrc} alt="GameStock" className="brand-logo" />
        <div className="brand-meta">
          <span>Games Management</span>
          {appVersion ? <small className="brand-version">v{appVersion}</small> : null}
        </div>
      </div>

      {/* Navegação principal: Biblioteca | Inventário — sempre visível */}
      <nav className="sidebar-nav" aria-label="Navegação principal">
        <button
          type="button"
          className={sidebarMode === "library" ? "nav-item active" : "nav-item"}
          onClick={handleSwitchToLibrary}
        >
          <Library aria-hidden="true" size={18} />
          Biblioteca
        </button>
        <button
          type="button"
          className={sidebarMode === "inventory" ? "nav-item active" : "nav-item"}
          onClick={handleSwitchToInventory}
        >
          <Cpu aria-hidden="true" size={18} />
          Inventário
        </button>
      </nav>

      <div className="sidebar-separator" />

      {/* Área central rolável: cresce até ocupar o espaço livre sem empurrar ações do rodapé. */}
      <div className="sidebar-content">
        {/* Conteúdo contextual dependente do modo */}
        {sidebarMode === "library"
          ? (
              <>
                {/* Filtros de coleção */}
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
                      <span className="nav-item-count">{collectionCounts[item.countKey]}</span>
                    </button>
                  ))}
                </nav>
                <div className="sidebar-separator" />
                {/* Árvore de plataformas */}
                <PlatformTree />
              </>
            )
          : (
              /* Filtros do inventário de hardware */
              <div className="hw-sidebar-filters">
                {/* Filtro por tipo */}
                {itemTypes.length > 0 && (
                  <section>
                    <div className="sidebar-label">Tipo</div>
                    {/* Opcao "Todos" limpa apenas o filtro de tipo e preserva os demais filtros do inventario. */}
                    <button
                      type="button"
                      className={inventoryFilters.itemTypeId === null ? "tree-item selected" : "tree-item"}
                      onClick={() => setInventoryFilters({ itemTypeId: null })}
                    >
                      Todos
                      <span className="nav-item-count">{totalItems}</span>
                    </button>
                    {itemTypes.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={inventoryFilters.itemTypeId === t.id ? "tree-item selected" : "tree-item"}
                        onClick={() => setInventoryFilters({ itemTypeId: inventoryFilters.itemTypeId === t.id ? null : t.id })}
                      >
                        {t.name}
                        <span className="nav-item-count">{t.count}</span>
                      </button>
                    ))}
                  </section>
                )}

                {/* Filtro por condição */}
                {conservationStates.length > 0 && (
                  <section>
                    <div className="sidebar-label">Condição</div>
                    {/* Opção "Todas" mostra total geral */}
                    <button
                      type="button"
                      className={inventoryFilters.conservationStateId === null ? "tree-item selected" : "tree-item"}
                      onClick={() => setInventoryFilters({ conservationStateId: null })}
                    >
                      Todas
                      <span className="nav-item-count">{totalItems}</span>
                    </button>
                    {conservationStates.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={inventoryFilters.conservationStateId === s.id ? "tree-item selected" : "tree-item"}
                        onClick={() => setInventoryFilters({ conservationStateId: s.id })}
                      >
                        {s.name}
                        <span className="nav-item-count">{s.count}</span>
                      </button>
                    ))}
                  </section>
                )}

                {itemTypes.length === 0 && (
                  <p className="hw-sidebar-empty">Nenhum item no inventário ainda.</p>
                )}
              </div>
            )
        }
      </div>

      {/* Rodapé fixo da sidebar: ações nunca saem da área visível. */}
      <div className="sidebar-actions">
        {/* Botão "Novo item" — visível só no modo inventário, acima de Configurações */}
        {sidebarMode === "inventory" && (
          <button
            type="button"
            className="scan-button"
            onClick={() => setInventoryCreateOpen(true)}
          >
            <Plus aria-hidden="true" size={18} />
            Novo item
          </button>
        )}

        {/* Botão de configurações — sempre visível em ambos os modos */}
        <button type="button" className="scan-button" onClick={() => openSettings("biblioteca")}>
          <Settings aria-hidden="true" size={18} />
          Configurações
        </button>
      </div>
    </aside>
  );
}
