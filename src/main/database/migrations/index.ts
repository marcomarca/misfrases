import type { IDatabase } from '../Database';

export interface Migration {
  version: number;
  up: (db: IDatabase) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    up: (db: IDatabase) => {
      // 1. hotkey_groups
      db.exec(`
        CREATE TABLE IF NOT EXISTS hotkey_groups (
          id TEXT PRIMARY KEY,
          accelerator TEXT UNIQUE NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // 2. snippets
      db.exec(`
        CREATE TABLE IF NOT EXISTS snippets (
          id TEXT PRIMARY KEY,
          hotkey_group_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          slot INTEGER NOT NULL CHECK (slot >= 1 AND slot <= 10),
          enabled INTEGER NOT NULL DEFAULT 1,
          usage_count INTEGER NOT NULL DEFAULT 0,
          last_used_at INTEGER NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER NULL,
          FOREIGN KEY (hotkey_group_id) REFERENCES hotkey_groups(id) ON DELETE CASCADE
        );

        CREATE UNIQUE INDEX IF NOT EXISTS uq_snippets_group_slot_active
        ON snippets(hotkey_group_id, slot)
        WHERE deleted_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_snippets_group_enabled
        ON snippets(hotkey_group_id, enabled, deleted_at);
      `);

      // 3. usage_events
      db.exec(`
        CREATE TABLE IF NOT EXISTS usage_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          snippet_id TEXT NOT NULL,
          used_at INTEGER NOT NULL,
          FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_usage_events_used_at
        ON usage_events(used_at);

        CREATE INDEX IF NOT EXISTS idx_usage_events_snippet_id
        ON usage_events(snippet_id);
      `);

      // 4. settings
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
    }
  }
];

export function runMigrations(db: IDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: number }[];
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      const applyTx = db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
          migration.version,
          Date.now()
        );
      });
      applyTx();
    }
  }
}
