import type { IDatabase } from '../Database';
import { randomUUID } from 'node:crypto';
import type { HotkeyGroup } from '../../../shared/types';

export class HotkeyRepository {
  constructor(private db: IDatabase) {}

  public findByAccelerator(accelerator: string): HotkeyGroup | null {
    const row = this.db
      .prepare('SELECT id, accelerator, created_at as createdAt, updated_at as updatedAt FROM hotkey_groups WHERE accelerator = ?')
      .get(accelerator) as HotkeyGroup | undefined;
    return row || null;
  }

  public findById(id: string): HotkeyGroup | null {
    const row = this.db
      .prepare('SELECT id, accelerator, created_at as createdAt, updated_at as updatedAt FROM hotkey_groups WHERE id = ?')
      .get(id) as HotkeyGroup | undefined;
    return row || null;
  }

  public listAll(): HotkeyGroup[] {
    return this.db
      .prepare('SELECT id, accelerator, created_at as createdAt, updated_at as updatedAt FROM hotkey_groups ORDER BY accelerator ASC')
      .all() as HotkeyGroup[];
  }

  public create(accelerator: string): HotkeyGroup {
    const now = Date.now();
    const group: HotkeyGroup = {
      id: randomUUID(),
      accelerator,
      createdAt: now,
      updatedAt: now
    };

    this.db
      .prepare('INSERT INTO hotkey_groups (id, accelerator, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(group.id, group.accelerator, group.createdAt, group.updatedAt);

    return group;
  }

  public getOrCreate(accelerator: string): HotkeyGroup {
    const existing = this.findByAccelerator(accelerator);
    if (existing) {
      return existing;
    }
    return this.create(accelerator);
  }

  public deleteIfEmpty(groupId: string): boolean {
    const countRow = this.db
      .prepare('SELECT COUNT(*) as count FROM snippets WHERE hotkey_group_id = ? AND deleted_at IS NULL')
      .get(groupId) as { count: number };

    if (countRow.count === 0) {
      this.db.prepare('DELETE FROM hotkey_groups WHERE id = ?').run(groupId);
      return true;
    }
    return false;
  }
}
