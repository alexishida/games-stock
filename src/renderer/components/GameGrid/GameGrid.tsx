import { useEffect, useRef, useState } from "react";
import { FixedSizeGrid, GridChildComponentProps } from "react-window";
import { useGameStockStore } from "../../store";
import { GameCard } from "./GameCard";
import "./GameGrid.css";

const CARD_WIDTH = 220;
const CARD_HEIGHT = 326;
const GAP = 24;

export function GameGrid() {
  const games = useGameStockStore((state) => state.games);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const columnCount = Math.max(1, Math.floor((size.width + GAP) / (CARD_WIDTH + GAP)));
  const rowCount = Math.ceil(games.length / columnCount);

  if (!games.length) return <div className="empty-state">Nenhum jogo encontrado</div>;

  return (
    <div ref={containerRef} className="game-grid-wrap">
      <FixedSizeGrid
        columnCount={columnCount}
        columnWidth={CARD_WIDTH + GAP}
        height={size.height}
        rowCount={rowCount}
        rowHeight={CARD_HEIGHT}
        width={size.width}
      >
        {({ columnIndex, rowIndex, style }: GridChildComponentProps) => {
          const game = games[rowIndex * columnCount + columnIndex];
          if (!game) return null;
          return <GameCard game={game} style={{ ...style, width: CARD_WIDTH, height: CARD_HEIGHT - GAP }} />;
        }}
      </FixedSizeGrid>
    </div>
  );
}
