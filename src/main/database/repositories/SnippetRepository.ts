import type { IDatabase } from '../Database';
import { randomUUID } from 'node:crypto';
import type { SlotNumber, Snippet } from '../../../shared/types';
import { MAX_SLOTS } from '../../../shared/constants';

interface SnippetRow {
  id: string;
  hotkey_group_id: string;
  title: string;
  content: string;
  slot: number;
  enabled: number;
  usage_count: number;
  last_used_at: number | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  accelerator?: string;
}

function mapRow(row: SnippetRow): Snippet {
  return {
    id: row.id,
    hotkeyGroupId: row.hotkey_group_id,
    title: row.title,
    content: row.content,
    slot: row.slot as SlotNumber,
    enabled: Boolean(row.enabled),
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    accelerator: row.accelerator
  };
}

export class SnippetRepository {
  constructor(private db: IDatabase) {}

  public findById(id: string): Snippet | null {
    const row = this.db
      .prepare(`
        SELECT s.*, hg.accelerator
        FROM snippets s
        JOIN hotkey_groups hg ON s.hotkey_group_id = hg.id
        WHERE s.id = ?
      `)
      .get(id) as SnippetRow | undefined;

    return row ? mapRow(row) : null;
  }

  public listAll(includeDeleted = false): Snippet[] {
    const query = `
      SELECT s.*, hg.accelerator
      FROM snippets s
      JOIN hotkey_groups hg ON s.hotkey_group_id = hg.id
      ${includeDeleted ? '' : 'WHERE s.deleted_at IS NULL'}
      ORDER BY hg.accelerator ASC, s.slot ASC
    `;
    const rows = this.db.prepare(query).all() as SnippetRow[];
    return rows.map(mapRow);
  }

  public listByGroupId(groupId: string, onlyActive = true): Snippet[] {
    const query = `
      SELECT s.*, hg.accelerator
      FROM snippets s
      JOIN hotkey_groups hg ON s.hotkey_group_id = hg.id
      WHERE s.hotkey_group_id = ?
      ${onlyActive ? 'AND s.deleted_at IS NULL' : ''}
      ORDER BY s.slot ASC
    `;
    const rows = this.db.prepare(query).all(groupId) as SnippetRow[];
    return rows.map(mapRow);
  }

  public listEnabledByAccelerator(accelerator: string): Snippet[] {
    const query = `
      SELECT s.*, hg.accelerator
      FROM snippets s
      JOIN hotkey_groups hg ON s.hotkey_group_id = hg.id
      WHERE hg.accelerator = ?
        AND s.enabled = 1
        AND s.deleted_at IS NULL
      ORDER BY s.slot ASC
    `;
    const rows = this.db.prepare(query).all(accelerator) as SnippetRow[];
    return rows.map(mapRow);
  }

  public getNextAvailableSlot(groupId: string): SlotNumber | null {
    const activeRows = this.db
      .prepare('SELECT slot FROM snippets WHERE hotkey_group_id = ? AND deleted_at IS NULL')
      .all(groupId) as { slot: number }[];

    const occupiedSlots = new Set(activeRows.map((r) => r.slot));
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
      if (!occupiedSlots.has(slot)) {
        return slot as SlotNumber;
      }
    }
    return null;
  }

  public create(params: {
    hotkeyGroupId: string;
    title: string;
    content: string;
    slot?: SlotNumber;
    enabled?: boolean;
  }): Snippet {
    let targetSlot = params.slot;
    if (!targetSlot) {
      const nextSlot = this.getNextAvailableSlot(params.hotkeyGroupId);
      if (!nextSlot) {
        throw new Error('Este atajo de teclado ya tiene 10 acciones ocupadas. Libera un slot o utiliza otra combinación.');
      }
      targetSlot = nextSlot;
    } else {
      // Check if slot is occupied
      const existing = this.db
        .prepare('SELECT id FROM snippets WHERE hotkey_group_id = ? AND slot = ? AND deleted_at IS NULL')
        .get(params.hotkeyGroupId, targetSlot);
      if (existing) {
        throw new Error(`El slot ${targetSlot} ya está ocupado en este grupo de atajos.`);
      }
    }

    const now = Date.now();
    const snippet: Snippet = {
      id: randomUUID(),
      hotkeyGroupId: params.hotkeyGroupId,
      title: params.title,
      content: params.content,
      slot: targetSlot,
      enabled: params.enabled !== undefined ? params.enabled : true,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };

    this.db
      .prepare(`
        INSERT INTO snippets (
          id, hotkey_group_id, title, content, slot, enabled, usage_count, last_used_at, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        snippet.id,
        snippet.hotkeyGroupId,
        snippet.title,
        snippet.content,
        snippet.slot,
        snippet.enabled ? 1 : 0,
        snippet.usageCount,
        snippet.lastUsedAt,
        snippet.createdAt,
        snippet.updatedAt,
        snippet.deletedAt
      );

    return this.findById(snippet.id)!;
  }

  public update(params: {
    id: string;
    hotkeyGroupId?: string;
    title?: string;
    content?: string;
    slot?: SlotNumber;
    enabled?: boolean;
  }): Snippet {
    const current = this.findById(params.id);
    if (!current || current.deletedAt) {
      throw new Error('Snippet no encontrado');
    }

    const targetGroupId = params.hotkeyGroupId ?? current.hotkeyGroupId;
    const targetSlot = params.slot ?? current.slot;

    // Check slot collision if slot or group changed
    if (targetGroupId !== current.hotkeyGroupId || targetSlot !== current.slot) {
      const collision = this.db
        .prepare('SELECT id FROM snippets WHERE hotkey_group_id = ? AND slot = ? AND id != ? AND deleted_at IS NULL')
        .get(targetGroupId, targetSlot, current.id);
      if (collision) {
        throw new Error(`El slot ${targetSlot} ya está ocupado.`);
      }
    }

    const title = params.title !== undefined ? params.title : current.title;
    const content = params.content !== undefined ? params.content : current.content;
    const enabled = params.enabled !== undefined ? params.enabled : current.enabled;
    const now = Date.now();

    this.db
      .prepare(`
        UPDATE snippets
        SET hotkey_group_id = ?,
            title = ?,
            content = ?,
            slot = ?,
            enabled = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(targetGroupId, title, content, targetSlot, enabled ? 1 : 0, now, current.id);

    return this.findById(current.id)!;
  }

  public softDelete(id: string): void {
    const now = Date.now();
    this.db
      .prepare('UPDATE snippets SET deleted_at = ?, enabled = 0, updated_at = ? WHERE id = ?')
      .run(now, now, id);
  }

  public reorderSlots(groupId: string, orderedSnippetIds: string[]): void {
    if (orderedSnippetIds.length > MAX_SLOTS) {
      throw new Error(`No se pueden reordenar más de ${MAX_SLOTS} slots.`);
    }

    const reorderTx = this.db.transaction(() => {
      // 1. Temporarily set deleted_at = 1 to bypass the partial unique index
      for (const id of orderedSnippetIds) {
        this.db
          .prepare('UPDATE snippets SET deleted_at = 1 WHERE id = ? AND hotkey_group_id = ?')
          .run(id, groupId);
      }

      // 2. Assign target slot numbers 1..N and restore deleted_at = NULL
      const now = Date.now();
      for (let i = 0; i < orderedSnippetIds.length; i++) {
        const newSlot = (i + 1) as SlotNumber;
        this.db
          .prepare('UPDATE snippets SET slot = ?, deleted_at = NULL, updated_at = ? WHERE id = ? AND hotkey_group_id = ?')
          .run(newSlot, now, orderedSnippetIds[i], groupId);
      }
    });

    reorderTx();
  }
}
