import { useEffect, useRef, useState } from "react";
import { FixedSizeList, ListChildComponentProps } from "react-window";
import { useGameStockStore } from "../../store";
import { GameListRow } from "./GameListRow";
import "./GameList.css";

export function GameList() {
  const games = useGameStockStore((state) => state.games);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(520);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!games.length) return <div className="empty-state">Nenhum jogo encontrado</div>;

  return (
    <div ref={containerRef} className="game-list">
      <div className="game-list-header">
        <span></span>
        <span>Titulo</span>
        <span>Plataforma</span>
        <span>Publisher</span>
        <span>Ano</span>
        <span>Inventario</span>
      </div>
      <FixedSizeList height={Math.max(120, height - 32)} itemCount={games.length} itemSize={54} width="100%">
        {({ index, style }: ListChildComponentProps) => <GameListRow game={games[index]} style={style} />}
      </FixedSizeList>
    </div>
  );
}
