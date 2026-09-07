import { randomUUID } from 'node:crypto';
import type { IDatabase } from '../Database';
import type {
  BackupContextBlockData,
  ContextBlock,
  CreateContextBlockInput,
  UpdateContextBlockInput
} from '../../../shared/types';

export class ContextBlockRepository {
  constructor(private db: IDatabase) {}

  public listAll(): ContextBlock[] {
    return this.db
      .prepare(
        `SELECT id, key, title, content, created_at as createdAt, updated_at as updatedAt
         FROM context_blocks
         ORDER BY title ASC`
      )
      .all() as ContextBlock[];
  }

  public getById(id: string): ContextBlock | null {
    const row = this.db
      .prepare(
        `SELECT id, key, title, content, created_at as createdAt, updated_at as updatedAt
         FROM context_blocks
         WHERE id = ?`
      )
      .get(id) as ContextBlock | undefined;
    return row || null;
  }

  public getByKey(key: string): ContextBlock | null {
    const normalizedKey = key.trim().toLowerCase();
    const row = this.db
      .prepare(
        `SELECT id, key, title, content, created_at as createdAt, updated_at as updatedAt
         FROM context_blocks
         WHERE key = ?`
      )
      .get(normalizedKey) as ContextBlock | undefined;
    return row || null;
  }

  public getAllAsMap(): Record<string, string> {
    const rows = this.listAll();
    const map: Record<string, string> = {};
    for (const b of rows) {
      map[b.key.toLowerCase()] = b.content;
    }
    return map;
  }

  public create(input: CreateContextBlockInput): ContextBlock {
    const normalizedKey = input.key.trim().toLowerCase();
    const existing = this.getByKey(normalizedKey);
    if (existing) {
      throw new Error(`Ya existe un bloque de contexto con la clave "${normalizedKey}"`);
    }

    const now = Date.now();
    const block: ContextBlock = {
      id: randomUUID(),
      key: input.key.trim().toLowerCase(),
      title: input.title.trim(),
      content: input.content,
      createdAt: now,
      updatedAt: now
    };

    this.db
      .prepare(
        `INSERT INTO context_blocks (id, key, title, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(block.id, block.key, block.title, block.content, block.createdAt, block.updatedAt);

    return block;
  }

  public update(input: UpdateContextBlockInput): ContextBlock {
    const current = this.getById(input.id);
    if (!current) {
      throw new Error(`No se encontró el bloque de contexto con ID: ${input.id}`);
    }

    let nextKey = current.key;
    if (input.key !== undefined) {
      const normalized = input.key.trim().toLowerCase();
      if (normalized !== current.key) {
        const existing = this.getByKey(normalized);
        if (existing && existing.id !== current.id) {
          throw new Error(`Ya existe un bloque de contexto con la clave "${normalized}"`);
        }
        nextKey = normalized;
      }
    }

    const now = Date.now();
    const nextTitle = input.title !== undefined ? input.title.trim() : current.title;
    const nextContent = input.content !== undefined ? input.content : current.content;

    this.db
      .prepare(
        `UPDATE context_blocks
         SET key = ?, title = ?, content = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(nextKey, nextTitle, nextContent, now, current.id);

    return {
      id: current.id,
      key: nextKey,
      title: nextTitle,
      content: nextContent,
      createdAt: current.createdAt,
      updatedAt: now
    };
  }

  public remove(id: string): boolean {
    const result = this.db.prepare('DELETE FROM context_blocks WHERE id = ?').run(id);
    return result?.changes ? result.changes > 0 : true;
  }

  public bulkUpsert(blocks: BackupContextBlockData[]): void {
    const now = Date.now();
    const stmt = this.db.prepare(
      `INSERT INTO context_blocks (id, key, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         key = excluded.key,
         title = excluded.title,
         content = excluded.content,
         updated_at = excluded.updated_at
       ON CONFLICT(key) DO UPDATE SET
         title = excluded.title,
         content = excluded.content,
         updated_at = excluded.updated_at`
    );

    for (const b of blocks) {
      const id = b.id || randomUUID();
      const key = b.key.trim().toLowerCase();
      const title = b.title.trim();
      const createdAt = b.createdAt || now;
      const updatedAt = b.updatedAt || now;
      stmt.run(id, key, title, b.content, createdAt, updatedAt);
    }
  }
}
