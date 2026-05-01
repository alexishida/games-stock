export type ViewMode = "grid" | "list";

export enum PhysicalCondition {
  Mint = "Mint",
  NearMint = "Near Mint",
  Good = "Good",
  Fair = "Fair",
  Poor = "Poor"
}

export interface Platform {
  id: number;
  name: string;
  category: string;
  created_at: string;
  gameCount?: number;
}

export interface Game {
  id: number;
  title: string;
  platform_id: number;
  platform_name?: string;
  publisher: string | null;
  year: number | null;
  genre: string | null;
  rating: string | null;
  box_art_path: string | null;
  rom_path: string | null;
  owned_physical: boolean;
  physical_condition: PhysicalCondition | null;
  notes: string | null;
  launchbox_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameFilters {
  platformId?: number | null;
  search?: string;
  ownedPhysical?: boolean;
}

export type GameCreateInput = Omit<Game, "id" | "platform_name" | "created_at" | "updated_at">;
export type GameUpdateInput = Partial<GameCreateInput>;

export interface GameListResult {
  items: Game[];
  total: number;
  filtered: number;
}

export type LaunchBoxImageType =
  | "Box - Front"
  | "Box - Back"
  | "Box - Spine"
  | "Screenshot - Gameplay"
  | "Fanart - Background"
  | "Banner"
  | "Clear Logo"
  | "Disc"
  | "Cart - Front"
  | "Screenshot - Game Title";

export interface LaunchBoxImage {
  filename: string;
  type: LaunchBoxImageType;
  region: string | null;
  url?: string;
}

export interface LaunchBoxGame {
  id: string;
  name: string;
  platform: string;
  release: string;
  developer: string;
  publisher: string;
  genres: string;
  overview: string;
  players: string;
  rating: string;
  cooperative: string;
  images: LaunchBoxImage[];
}

export interface LaunchBoxSearchParams {
  query: string;
  platformKey?: string | null;
}

export interface LaunchBoxDownloadParams {
  game: LaunchBoxGame;
  types: LaunchBoxImageType[];
}

export interface LaunchBoxDownloadResult {
  success: number;
  skipped: number;
  failed: number;
  files: string[];
}

export interface LaunchBoxProgress {
  current: number;
  total: number;
  filename?: string;
  status: "downloading" | "skipped" | "done" | "error";
}

export interface LaunchBoxImportParams {
  launchboxGameId: string;
  platformId?: number | null;
  imageTypes: LaunchBoxImageType[];
}

export interface LaunchBoxImportResult {
  gameId: number;
  created: boolean;
  boxArtPath: string | null;
}
