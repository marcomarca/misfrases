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
          description TEXT NOT NULL DEFAULT '',
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
  },
  {
    version: 2,
    up: (db: IDatabase) => {
      // Check if column exists before altering to support both fresh v1 and upgrade
      const tableInfo = db.prepare("PRAGMA table_info('snippets')").all() as { name: string }[];
      const hasDescription = tableInfo.some((col) => col.name === 'description');
      if (!hasDescription) {
        db.exec(`
          ALTER TABLE snippets ADD COLUMN description TEXT NOT NULL DEFAULT '';
        `);
      }
    }
  },
  {
    version: 3,
    up: (db: IDatabase) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS context_blocks (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_context_blocks_key ON context_blocks(key);
      `);

      const countRow = db.prepare('SELECT COUNT(*) as count FROM context_blocks').get() as { count: number };
      if (countRow.count === 0) {
        const now = Date.now();
        const insertStmt = db.prepare(
          'INSERT INTO context_blocks (id, key, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        );

        const defaultBlocks = [
          {
            id: 'cb-default-perfil-base',
            key: 'perfil_base',
            title: 'Perfil Base',
            content:
              'Rol: Ingeniero Electrónico y Desarrollador de Software.\nEstilo de respuesta: Directo, técnico y conciso. Sin introducciones, sin felicitaciones ni relleno.\nExigencia de código: Producción, tipado fuerte, manejo explícito de errores y casos de borde.'
          },
          {
            id: 'cb-default-stack-software',
            key: 'stack_software',
            title: 'Stack de Software',
            content:
              'Runtimes: Bun (preferido para scripts y tooling), Node.js (LTS), Python 3.11+.\nLenguajes: TypeScript (estricto), Python (mypy, tipado PEP 484).\nDesktop: Electron (arquitectura de procesos aislados), Win32 FFI (Koffi/ctypes).\nBases de datos: SQLite con modo WAL y transacciones explícitas.'
          },
          {
            id: 'cb-default-stack-hardware',
            key: 'stack_hardware',
            title: 'Stack de Hardware',
            content:
              'Microcontroladores: ESP32 (FreeRTOS), STM32 (C/C++), RP2040.\nProtocolos: UART, I2C, SPI, Modbus, MQTT, Bluetooth LE.\nEnfoque de firmware: Concurrencia no bloqueante, colas de mensajes, bajo consumo y control de interrupciones.'
          },
          {
            id: 'cb-default-principios-arq',
            key: 'principios_arquitectura',
            title: 'Principios de Arquitectura',
            content:
              '1. Simplicidad: Preferir APIs nativas del SO o del lenguaje antes que añadir dependencias de terceros.\n2. Robusto y mantenible: Código modular con separación clara de capas (dominio, infraestructura, UI).\n3. Testing: Toda lógica central debe tener tests unitarios automatizados deterministas.\n4. Rendimiento en Windows: No bloquear hilos de UI; cuidar latencia en colas de mensajes y portapapeles.'
          }
        ];

        for (const b of defaultBlocks) {
          insertStmt.run(b.id, b.key, b.title, b.content, now, now);
        }
      }
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
