export type ViewMode = "grid" | "list";
export type PlayStatus = "unplayed" | "playing" | "completed";
export type CollectionFilter = "all" | "favorites" | "playing" | "completed" | "unplayed";

export interface CollectionCounts {
  favorites: number;
  playing: number;
  completed: number;
}

export interface CoverSyncStats {
  total: number;
  downloaded: number;
  missing: number;
  syncable: number;
  metadataSyncable: number;
  metadataDownloadedAt: string | null;
}

export interface CoverSyncResult extends CoverSyncStats {
  attempted: number;
  downloadedNow: number;
  failed: number;
  skipped: number;
  metadataUpdated: number;
  metadataSkipped: number;
}
export type GameSortBy = "title" | "year" | "recent";

export interface Platform {
  id: number;
  name: string;
  category: string;
  is_default: number;
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
  background_path: string | null;
  screenshot_path: string | null;
  rom_path: string | null;
  favorite: boolean;
  play_status: PlayStatus;
  notes: string | null;
  launchbox_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameFilters {
  platformId?: number | null;
  search?: string;
  collectionFilter?: CollectionFilter;
  sortBy?: GameSortBy;
  page?: number;
  pageSize?: number;
}

export type GameCreateInput = Omit<Game, "id" | "platform_name" | "created_at" | "updated_at">;
export type GameUpdateInput = Partial<GameCreateInput>;

export interface GameListResult {
  items: Game[];
  total: number;
  filtered: number;
}

export interface GameMediaItem {
  path: string;
  label: string;
  kind: "box-art" | "cart" | "background" | "screenshot" | "cover" | "other";
}

export type LaunchBoxImageType =
  | "Box - 3D"
  | "Box - Front"
  | "Box - Front - Reconstructed"
  | "Box - Back"
  | "Box - Back - Reconstructed"
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

export type RomFolderImportStage =
  | "preparing_metadata"
  | "matching"
  | "downloading"
  | "skipped"
  | "saving"
  | "done"
  | "error";

export type RomFolderMatchStatus = "matched" | "unmatched" | "ambiguous";

export interface RomFolderImportCandidate {
  folderPath: string;
  romPath: string;
  filename: string;
  titleCandidate: string;
  platformId: number;
  platformName: string;
}

export interface RomFolderIgnoredItem {
  folderPath: string;
  romPath: string;
  filename: string;
  reason: string;
}

export interface RomFolderScanRequest {
  folderPaths: string[];
  romFilePaths?: string[];
  platformId: number;
}

export interface RomFolderScanResult {
  folderPaths: string[];
  romFilePaths: string[];
  platformId: number;
  platformName: string;
  candidates: RomFolderImportCandidate[];
  ignored: number;
  ignoredItems: RomFolderIgnoredItem[];
}

export interface RomFolderMatchedCandidate extends RomFolderImportCandidate {
  status: RomFolderMatchStatus;
  match: LaunchBoxGame | null;
  alternatives: LaunchBoxGame[];
}

export interface RomFolderImportRequest {
  folderPaths: string[];
  romFilePaths?: string[];
  platformId: number;
}

export interface RomFolderImportItemResult {
  candidate: RomFolderImportCandidate;
  status: "created" | "updated" | "unmatched" | "failed";
  gameId?: number;
  launchboxGameId?: string;
  error?: string;
  failedDownloads?: number;
}

export interface RomFolderImportSummary {
  created: number;
  updated: number;
  skipped: number;
  unmatched: number;
  failedDownloads: number;
  processed: number;
}

export interface RomFolderImportResult {
  jobId?: string;
  folderPaths: string[];
  romFilePaths: string[];
  platformId: number;
  platformName: string;
  items: RomFolderImportItemResult[];
  summary: RomFolderImportSummary;
}

export interface RomFolderImportProgress {
  jobId?: string;
  current: number;
  total: number;
  folderPath?: string;
  filename?: string;
  imageFilename?: string;
  stage: RomFolderImportStage;
  message?: string;
}

export interface RomFolderImportJob {
  jobId: string;
  folderPaths: string[];
  romFilePaths: string[];
  platformId: number;
  platformName: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  progress: RomFolderImportProgress;
  result?: RomFolderImportResult;
  error?: string;
}
