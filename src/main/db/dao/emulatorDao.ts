import type Database from "better-sqlite3";
import { Emulator } from "../../../shared/types";

export type EmulatorInput = Pick<Emulator, "name" | "executable" | "args" | "is_retroarch">;

export class EmulatorDao {
  constructor(private readonly database: Database.Database) {}

  list(): Emulator[] {
    return this.database
      .prepare("SELECT * FROM emulators ORDER BY name COLLATE NOCASE")
      .all() as Emulator[];
  }

  get(id: number): Emulator | undefined {
    return this.database.prepare("SELECT * FROM emulators WHERE id = ?").get(id) as Emulator | undefined;
  }

  create(data: EmulatorInput): Emulator {
    if (!data.name?.trim()) throw new Error("Nome do emulador é obrigatório");
    try {
      const result = this.database
        .prepare("INSERT INTO emulators (name, executable, args, is_retroarch) VALUES (?, ?, ?, ?)")
        .run(data.name.trim(), data.executable.trim(), data.args?.trim() ?? "", data.is_retroarch ? 1 : 0);
      return this.get(Number(result.lastInsertRowid))!;
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new Error("Emulador já existe");
      throw error;
    }
  }

  update(id: number, data: Partial<EmulatorInput>): Emulator {
    const current = this.get(id);
    if (!current) throw new Error("Emulador não encontrado");
    try {
      this.database
        .prepare("UPDATE emulators SET name = ?, executable = ?, args = ? WHERE id = ?")
        .run(
          data.name?.trim() ?? current.name,
          data.executable?.trim() ?? current.executable,
          data.args?.trim() ?? current.args,
          id
        );
      return this.get(id)!;
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new Error("Emulador já existe");
      throw error;
    }
  }

  delete(id: number): { success: true } {
    const emulator = this.get(id);
    if (!emulator) throw new Error("Emulador não encontrado");
    if (emulator.is_retroarch) throw new Error("RetroArch não pode ser removido");
    this.database.prepare("DELETE FROM emulators WHERE id = ?").run(id);
    return { success: true };
  }
}
