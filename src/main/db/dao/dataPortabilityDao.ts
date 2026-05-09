import type Database from "better-sqlite3";
import { DataPortabilityConflictCounts, DataPortabilityRomFolderEntry, PlayStatus } from "../../../shared/types";

export type PortableMediaField = "box_art_path" | "background_path" | "screenshot_path";

export interface PortableGameMetadata {
  title: string;
  platformName: string;
  platformCategory: string;
  publisher: string | null;
  year: number | null;
  genre: string | null;
  rating: string | null;
  favorite: boolean;
  play_status: PlayStatus;
  notes: string | null;
  launchbox_id: string | null;
}

export interface PortableMediaReference {
  title: string;
  platformName: string;
  launchbox_id: string | null;
  field: PortableMediaField;
  sourcePath: string;
}

export interface PortableMediaEntry extends PortableMediaReference {
  packagePath: string;
  originalPath: string;
  size: number;
}

export interface PortablePlatform {
  name: string;
  category: string;
  is_default: number;
}

export interface PortablePlatformAlias {
  platformName: string;
  alias: string;
}

export interface PortableRomExtension {
  platformName: string;
  extension: string;
  kind: string;
  is_primary: number;
}

export interface PortableEmulator {
  name: string;
  executable: string;
  args: string;
  is_retroarch: number;
}

export interface PortablePlatformEmulator {
  platformName: string;
  emulatorName: string;
  is_default: number;
  core_path: string | null;
}

export interface PortableRomLocation {
  title: string;
  platformName: string;
  launchbox_id: string | null;
  rom_path: string;
}

export interface PortablePlatformBundle {
  platforms: PortablePlatform[];
  aliases: PortablePlatformAlias[];
  romExtensions: PortableRomExtension[];
  emulators: PortableEmulator[];
  platformEmulators: PortablePlatformEmulator[];
}

export interface PortablePlatformImportSummary {
  created: number;
  updated: number;
  mappings: number;
  emulators: number;
  links: number;
}

export interface PortableGameImportSummary {
  created: number;
  updated: number;
  skipped: number;
}

export interface PortableRomLocationImportSummary {
  updated: number;
  skipped: number;
  romFolderEntries: number;
}

export class DataPortabilityDao {
  constructor(private readonly database: Database.Database) {}

  listGameMetadata(): PortableGameMetadata[] {
    const rows = this.database
      .prepare(`
        SELECT
          games.title,
          platforms.name as platformName,
          platforms.category as platformCategory,
          games.publisher,
          games.year,
          games.genre,
          games.rating,
          games.favorite,
          games.play_status,
          games.notes,
          games.launchbox_id
        FROM games
        JOIN platforms ON platforms.id = games.platform_id
        ORDER BY platforms.name COLLATE NOCASE, games.title COLLATE NOCASE
      `)
      .all() as Array<Omit<PortableGameMetadata, "favorite" | "play_status"> & { favorite: number; play_status: string }>;

    return rows.map((row) => ({
      ...row,
      favorite: row.favorite === 1,
      play_status: normalizePlayStatus(row.play_status)
    }));
  }

  listMediaReferences(): PortableMediaReference[] {
    const rows = this.database
      .prepare(`
        SELECT
          games.title,
          platforms.name as platformName,
          games.launchbox_id,
          games.box_art_path,
          games.background_path,
          games.screenshot_path
        FROM games
        JOIN platforms ON platforms.id = games.platform_id
        WHERE (games.box_art_path IS NOT NULL AND games.box_art_path != '')
           OR (games.background_path IS NOT NULL AND games.background_path != '')
           OR (games.screenshot_path IS NOT NULL AND games.screenshot_path != '')
        ORDER BY platforms.name COLLATE NOCASE, games.title COLLATE NOCASE
      `)
      .all() as Array<{
        title: string;
        platformName: string;
        launchbox_id: string | null;
        box_art_path: string | null;
        background_path: string | null;
        screenshot_path: string | null;
      }>;

    const refs: PortableMediaReference[] = [];
    for (const row of rows) {
      for (const field of ["box_art_path", "background_path", "screenshot_path"] as const) {
        const sourcePath = row[field]?.trim();
        if (!sourcePath) continue;
        refs.push({
          title: row.title,
          platformName: row.platformName,
          launchbox_id: row.launchbox_id,
          field,
          sourcePath
        });
      }
    }
    return refs;
  }

  listPlatforms(): PortablePlatform[] {
    return this.database
      .prepare("SELECT name, category, is_default FROM platforms ORDER BY name COLLATE NOCASE")
      .all() as PortablePlatform[];
  }

  listPlatformAliases(): PortablePlatformAlias[] {
    return this.database
      .prepare(`
        SELECT platforms.name as platformName, platform_launchbox_aliases.alias
        FROM platform_launchbox_aliases
        JOIN platforms ON platforms.id = platform_launchbox_aliases.platform_id
        ORDER BY platforms.name COLLATE NOCASE, platform_launchbox_aliases.alias COLLATE NOCASE
      `)
      .all() as PortablePlatformAlias[];
  }

  listRomExtensions(): PortableRomExtension[] {
    return this.database
      .prepare(`
        SELECT
          platforms.name as platformName,
          platform_rom_extensions.extension,
          platform_rom_extensions.kind,
          platform_rom_extensions.is_primary
        FROM platform_rom_extensions
        JOIN platforms ON platforms.id = platform_rom_extensions.platform_id
        ORDER BY platforms.name COLLATE NOCASE, platform_rom_extensions.extension COLLATE NOCASE
      `)
      .all() as PortableRomExtension[];
  }

  listEmulators(): PortableEmulator[] {
    return this.database
      .prepare("SELECT name, executable, args, is_retroarch FROM emulators ORDER BY name COLLATE NOCASE")
      .all() as PortableEmulator[];
  }

  listPlatformEmulators(): PortablePlatformEmulator[] {
    return this.database
      .prepare(`
        SELECT
          platforms.name as platformName,
          emulators.name as emulatorName,
          platform_emulators.is_default,
          platform_emulators.core_path
        FROM platform_emulators
        JOIN platforms ON platforms.id = platform_emulators.platform_id
        JOIN emulators ON emulators.id = platform_emulators.emulator_id
        ORDER BY platforms.name COLLATE NOCASE, emulators.name COLLATE NOCASE
      `)
      .all() as PortablePlatformEmulator[];
  }

  listRomLocations(): PortableRomLocation[] {
    return this.database
      .prepare(`
        SELECT
          games.title,
          platforms.name as platformName,
          games.launchbox_id,
          games.rom_path
        FROM games
        JOIN platforms ON platforms.id = games.platform_id
        WHERE games.rom_path IS NOT NULL AND games.rom_path != ''
        ORDER BY platforms.name COLLATE NOCASE, games.title COLLATE NOCASE
      `)
      .all() as PortableRomLocation[];
  }

  countGameConflicts(records: PortableGameMetadata[]): DataPortabilityConflictCounts {
    const result: DataPortabilityConflictCounts = { create: 0, update: 0 };
    for (const record of records) {
      if (!record.title?.trim() || !record.platformName?.trim()) {
        result.create += 1;
        continue;
      }
      const platformId = this.getPlatformIdByName(record.platformName);
      if (!platformId) {
        result.create += 1;
        continue;
      }
      if (this.findGameIdByIdentity(record, platformId)) result.update += 1;
      else result.create += 1;
    }
    return result;
  }

  countPlatformConflicts(records: PortablePlatform[]): DataPortabilityConflictCounts {
    const result: DataPortabilityConflictCounts = { create: 0, update: 0 };
    for (const record of records) {
      if (!record.name?.trim()) continue;
      if (this.getPlatformIdByName(record.name)) result.update += 1;
      else result.create += 1;
    }
    return result;
  }

  countEmulatorConflicts(records: PortableEmulator[]): DataPortabilityConflictCounts {
    const result: DataPortabilityConflictCounts = { create: 0, update: 0 };
    for (const record of records) {
      if (!record.name?.trim()) continue;
      if (this.getEmulatorIdByName(record.name)) result.update += 1;
      else result.create += 1;
    }
    return result;
  }

  importPlatforms(bundle: PortablePlatformBundle): PortablePlatformImportSummary {
    const summary: PortablePlatformImportSummary = { created: 0, updated: 0, mappings: 0, emulators: 0, links: 0 };
    const platformNames = new Set<string>();

    for (const platform of bundle.platforms) {
      if (!platform.name?.trim()) continue;
      const result = this.ensurePlatform(platform.name, platform.category);
      if (result.created) summary.created += 1;
      else if (result.updated) summary.updated += 1;
      platformNames.add(normalizeName(platform.name));
    }

    for (const item of [...bundle.aliases, ...bundle.romExtensions]) {
      if (!item.platformName?.trim()) continue;
      platformNames.add(normalizeName(item.platformName));
      this.ensurePlatform(item.platformName, "Importadas");
    }

    for (const platformName of platformNames) {
      const platformId = this.getPlatformIdByNormalizedName(platformName);
      if (!platformId) continue;
      this.database.prepare("DELETE FROM platform_launchbox_aliases WHERE platform_id = ?").run(platformId);
      this.database.prepare("DELETE FROM platform_rom_extensions WHERE platform_id = ?").run(platformId);
    }

    const insertAlias = this.database.prepare("INSERT OR IGNORE INTO platform_launchbox_aliases (platform_id, alias) VALUES (?, ?)");
    for (const alias of bundle.aliases) {
      const platformId = this.getPlatformIdByName(alias.platformName);
      const value = alias.alias?.trim();
      if (!platformId || !value) continue;
      insertAlias.run(platformId, value);
      summary.mappings += 1;
    }

    const insertExtension = this.database.prepare(`
      INSERT OR IGNORE INTO platform_rom_extensions (platform_id, extension, kind, is_primary)
      VALUES (?, ?, ?, ?)
    `);
    for (const extension of bundle.romExtensions) {
      const platformId = this.getPlatformIdByName(extension.platformName);
      const value = normalizeExtension(extension.extension);
      if (!platformId || !value) continue;
      insertExtension.run(platformId, value, extension.kind?.trim() ?? "", extension.is_primary ? 1 : 0);
      summary.mappings += 1;
    }

    for (const emulator of bundle.emulators) {
      if (!emulator.name?.trim()) continue;
      this.upsertEmulator(emulator);
      summary.emulators += 1;
    }

    const link = this.database.prepare(`
      INSERT INTO platform_emulators (platform_id, emulator_id, is_default, core_path)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(platform_id, emulator_id) DO UPDATE SET
        is_default = excluded.is_default,
        core_path = excluded.core_path
    `);
    for (const platformEmulator of bundle.platformEmulators) {
      const platformId = this.getPlatformIdByName(platformEmulator.platformName);
      const emulatorId = this.getEmulatorIdByName(platformEmulator.emulatorName);
      if (!platformId || !emulatorId) continue;
      link.run(platformId, emulatorId, platformEmulator.is_default ? 1 : 0, platformEmulator.core_path ?? null);
      summary.links += 1;
    }

    return summary;
  }

  importGameMetadata(records: PortableGameMetadata[]): PortableGameImportSummary {
    const summary: PortableGameImportSummary = { created: 0, updated: 0, skipped: 0 };
    const insert = this.database.prepare(`
      INSERT INTO games (
        title, platform_id, publisher, year, genre, rating,
        favorite, play_status, notes, launchbox_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const update = this.database.prepare(`
      UPDATE games SET
        title = ?,
        platform_id = ?,
        publisher = ?,
        year = ?,
        genre = ?,
        rating = ?,
        favorite = ?,
        play_status = ?,
        notes = ?,
        launchbox_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    for (const record of records) {
      const title = record.title?.trim();
      const platformName = record.platformName?.trim();
      if (!title || !platformName) {
        summary.skipped += 1;
        continue;
      }
      const platform = this.ensurePlatform(platformName, record.platformCategory || "Importadas");
      const values = [
        title,
        platform.id,
        nullableText(record.publisher),
        nullableNumber(record.year),
        nullableText(record.genre),
        nullableText(record.rating),
        record.favorite ? 1 : 0,
        normalizePlayStatus(record.play_status),
        nullableText(record.notes),
        nullableText(record.launchbox_id)
      ];
      const existingId = this.findGameIdByIdentity(record, platform.id);
      if (existingId) {
        update.run(...values, existingId);
        summary.updated += 1;
      } else {
        insert.run(...values);
        summary.created += 1;
      }
    }

    return summary;
  }

  importRomLocations(records: PortableRomLocation[]): PortableRomLocationImportSummary {
    const summary: PortableRomLocationImportSummary = { updated: 0, skipped: 0, romFolderEntries: 0 };
    const update = this.database.prepare("UPDATE games SET rom_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    for (const record of records) {
      const platformId = this.getPlatformIdByName(record.platformName);
      const gameId = platformId ? this.findGameIdByIdentity(record, platformId) : null;
      if (!gameId || !record.rom_path?.trim()) {
        summary.skipped += 1;
        continue;
      }
      update.run(record.rom_path, gameId);
      summary.updated += 1;
    }
    return summary;
  }

  findGameId(entry: { title: string; platformName: string; launchbox_id: string | null }): number | null {
    const platformId = this.getPlatformIdByName(entry.platformName);
    return platformId ? this.findGameIdByIdentity(entry, platformId) : null;
  }

  updateGameMedia(gameId: number, field: PortableMediaField, filePath: string): void {
    this.database.prepare(`UPDATE games SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(filePath, gameId);
  }

  countRomFolderEntries(entries: DataPortabilityRomFolderEntry[]): number {
    return entries.filter((entry) => entry.folderPath?.trim()).length;
  }

  private ensurePlatform(name: string, category: string): { id: number; created: boolean; updated: boolean } {
    const existing = this.database.prepare("SELECT id, category FROM platforms WHERE LOWER(name) = LOWER(?)").get(name.trim()) as
      | { id: number; category: string }
      | undefined;
    const normalizedCategory = category?.trim() || "Importadas";
    if (existing) {
      const updated = existing.category !== normalizedCategory;
      if (updated) {
        this.database.prepare("UPDATE platforms SET category = ? WHERE id = ?").run(normalizedCategory, existing.id);
      }
      return { id: existing.id, created: false, updated };
    }

    const result = this.database
      .prepare("INSERT INTO platforms (name, category) VALUES (?, ?)")
      .run(name.trim(), normalizedCategory);
    return { id: Number(result.lastInsertRowid), created: true, updated: false };
  }

  private upsertEmulator(emulator: PortableEmulator): void {
    const existingId = this.getEmulatorIdByName(emulator.name);
    if (existingId) {
      this.database
        .prepare("UPDATE emulators SET executable = ?, args = ?, is_retroarch = ? WHERE id = ?")
        .run(emulator.executable?.trim() ?? "", emulator.args?.trim() ?? "", emulator.is_retroarch ? 1 : 0, existingId);
      return;
    }

    this.database
      .prepare("INSERT INTO emulators (name, executable, args, is_retroarch) VALUES (?, ?, ?, ?)")
      .run(emulator.name.trim(), emulator.executable?.trim() ?? "", emulator.args?.trim() ?? "", emulator.is_retroarch ? 1 : 0);
  }

  private getPlatformIdByName(name: string): number | null {
    return this.getPlatformIdByNormalizedName(normalizeName(name));
  }

  private getPlatformIdByNormalizedName(normalizedName: string): number | null {
    const row = this.database
      .prepare("SELECT id FROM platforms WHERE LOWER(name) = LOWER(?)")
      .get(normalizedName) as { id: number } | undefined;
    if (row) return row.id;

    const rows = this.database.prepare("SELECT id, name FROM platforms").all() as Array<{ id: number; name: string }>;
    return rows.find((item) => normalizeName(item.name) === normalizedName)?.id ?? null;
  }

  private getEmulatorIdByName(name: string): number | null {
    const row = this.database
      .prepare("SELECT id FROM emulators WHERE LOWER(name) = LOWER(?)")
      .get(name.trim()) as { id: number } | undefined;
    return row?.id ?? null;
  }

  private findGameIdByIdentity(entry: { title: string; platformName?: string; launchbox_id: string | null }, platformId: number): number | null {
    const launchboxId = entry.launchbox_id?.trim();
    if (launchboxId) {
      const row = this.database
        .prepare("SELECT id FROM games WHERE launchbox_id = ? AND platform_id = ? ORDER BY id LIMIT 1")
        .get(launchboxId, platformId) as { id: number } | undefined;
      if (row) return row.id;
    }

    const row = this.database
      .prepare("SELECT id FROM games WHERE LOWER(title) = LOWER(?) AND platform_id = ? ORDER BY id LIMIT 1")
      .get(entry.title.trim(), platformId) as { id: number } | undefined;
    return row?.id ?? null;
  }
}

function normalizePlayStatus(value: string): PlayStatus {
  if (value === "playing" || value === "completed") return value;
  return "unplayed";
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeExtension(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
