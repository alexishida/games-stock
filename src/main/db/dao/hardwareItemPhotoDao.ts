/**
 * DAO para fotos de itens de hardware do inventário físico.
 *
 * Gerencia a tabela `hardware_item_photos`: listagem por item, criação, exclusão
 * e reordenação de fotos via troca de sort_order.
 */

import type Database from "better-sqlite3";

/** Foto de um item de hardware conforme retornada pelo banco. */
export interface HardwareItemPhoto {
  id: number;
  item_id: number;
  file_path: string;
  sort_order: number;
  created_at: string;
}

export class HardwareItemPhotoDao {
  constructor(private readonly database: Database.Database) {}

  /**
   * Lista todas as fotos de um item, ordenadas por sort_order crescente.
   */
  listByItem(itemId: number): HardwareItemPhoto[] {
    return this.database
      .prepare("SELECT id, item_id, file_path, sort_order, created_at FROM hardware_item_photos WHERE item_id = ? ORDER BY sort_order ASC, id ASC")
      .all(itemId) as HardwareItemPhoto[];
  }

  /**
   * Cria uma nova entrada de foto.
   * O sort_order é atribuído como (máximo atual + 1) para adicionar ao final da galeria.
   */
  create(itemId: number, filePath: string): HardwareItemPhoto {
    const maxRow = this.database
      .prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM hardware_item_photos WHERE item_id = ?")
      .get(itemId) as { max_order: number };
    const sortOrder = maxRow.max_order + 1;

    const result = this.database
      .prepare("INSERT INTO hardware_item_photos (item_id, file_path, sort_order) VALUES (?, ?, ?)")
      .run(itemId, filePath, sortOrder);

    return this.database
      .prepare("SELECT id, item_id, file_path, sort_order, created_at FROM hardware_item_photos WHERE id = ?")
      .get(result.lastInsertRowid) as HardwareItemPhoto;
  }

  /**
   * Remove uma foto pelo ID.
   * Não remove o arquivo de disco — isso é responsabilidade do handler IPC.
   */
  delete(id: number): void {
    this.database.prepare("DELETE FROM hardware_item_photos WHERE id = ?").run(id);
  }

  /**
   * Troca o sort_order de duas fotos (sobe/desce na galeria).
   * Ambas as fotos devem pertencer ao mesmo item.
   */
  reorder(idA: number, idB: number): void {
    const a = this.database
      .prepare("SELECT id, sort_order FROM hardware_item_photos WHERE id = ?")
      .get(idA) as { id: number; sort_order: number } | undefined;
    const b = this.database
      .prepare("SELECT id, sort_order FROM hardware_item_photos WHERE id = ?")
      .get(idB) as { id: number; sort_order: number } | undefined;

    if (!a || !b) return;

    this.database.transaction(() => {
      this.database.prepare("UPDATE hardware_item_photos SET sort_order = ? WHERE id = ?").run(b.sort_order, a.id);
      this.database.prepare("UPDATE hardware_item_photos SET sort_order = ? WHERE id = ?").run(a.sort_order, b.id);
    })();
  }

  /**
   * Remove todas as fotos de um item.
   * Usado no handler de delete de item antes de excluir os arquivos do disco.
   */
  deleteAllByItem(itemId: number): HardwareItemPhoto[] {
    const photos = this.listByItem(itemId);
    this.database.prepare("DELETE FROM hardware_item_photos WHERE item_id = ?").run(itemId);
    return photos;
  }
}
