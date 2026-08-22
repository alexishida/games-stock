/**
 * DAO de emuladores.
 *
 * Gerencia operações CRUD sobre a tabela `emulators` no SQLite.
 * Cada emulador representa um programa capaz de executar ROMs de uma ou mais plataformas.
 * O RetroArch recebe tratamento especial: não pode ser removido pelo usuário.
 */

import type Database from "better-sqlite3";
import { Emulator } from "../../../shared/types";

/**
 * Dados de entrada para criação ou atualização de um emulador.
 * Subconjunto dos campos de `Emulator` — exclui campos gerados pelo banco (id, created_at).
 */
export type EmulatorInput = Pick<Emulator, "name" | "executable" | "args" | "is_retroarch">;

export class EmulatorDao {
  constructor(private readonly database: Database.Database) {}

  /**
   * Lista todos os emuladores cadastrados, ordenados pelo nome (case-insensitive).
   */
  list(): Emulator[] {
    return this.database
      .prepare("SELECT * FROM emulators ORDER BY name COLLATE NOCASE")
      .all() as Emulator[];
  }

  /**
   * Busca um emulador pelo ID SQLite.
   * Retorna `undefined` se o registro não existir.
   */
  get(id: number): Emulator | undefined {
    return this.database.prepare("SELECT * FROM emulators WHERE id = ?").get(id) as Emulator | undefined;
  }

  /**
   * Cria um novo emulador no banco de dados.
   *
   * @throws {Error} Se o nome estiver vazio.
   * @throws {Error} Se já existir um emulador com o mesmo nome (violação UNIQUE).
   */
  create(data: EmulatorInput): Emulator {
    if (!data.name?.trim()) throw new Error("Nome do emulador é obrigatório");
    try {
      const result = this.database
        .prepare("INSERT INTO emulators (name, executable, args, is_retroarch) VALUES (?, ?, ?, ?)")
        .run(data.name.trim(), data.executable.trim(), data.args?.trim() ?? "", data.is_retroarch ? 1 : 0);
      // Retorna o registro recém-criado com os campos gerados pelo banco
      return this.get(Number(result.lastInsertRowid))!;
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new Error("Emulador já existe");
      throw error;
    }
  }

  /**
   * Atualiza campos de um emulador existente.
   * Mantém os valores atuais para campos não informados em `data`.
   *
   * @throws {Error} Se o emulador não for encontrado.
   * @throws {Error} Se o novo nome colidir com outro emulador existente.
   */
  update(id: number, data: Partial<EmulatorInput>): Emulator {
    const current = this.get(id);
    if (!current) throw new Error("Emulador não encontrado");
    try {
      this.database
        .prepare("UPDATE emulators SET name = ?, executable = ?, args = ?, is_retroarch = ? WHERE id = ?")
        .run(
          data.name?.trim() ?? current.name,         // Mantém o nome atual se não informado
          data.executable?.trim() ?? current.executable,
          data.args?.trim() ?? current.args,
          data.is_retroarch !== undefined ? (data.is_retroarch ? 1 : 0) : current.is_retroarch,
          id
        );
      return this.get(id)!;
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new Error("Emulador já existe");
      throw error;
    }
  }

  /**
   * Remove um emulador do banco de dados.
   *
   * @throws {Error} Se o emulador não for encontrado.
   * @throws {Error} Se o emulador for o RetroArch (proteção contra remoção acidental).
   */
  delete(id: number): { success: true } {
    const emulator = this.get(id);
    if (!emulator) throw new Error("Emulador não encontrado");
    // RetroArch não pode ser removido pois é gerenciado de forma especial pelo sistema
    if (emulator.is_retroarch) throw new Error("RetroArch não pode ser removido");
    this.database.prepare("DELETE FROM emulators WHERE id = ?").run(id);
    return { success: true };
  }
}
