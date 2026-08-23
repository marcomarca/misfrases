import path from 'node:path';
import fs from 'node:fs';
import { runMigrations } from './migrations';

export interface IDatabase {
  prepare(sql: string): {
    get(...params: any[]): any;
    all(...params: any[]): any[];
    run(...params: any[]): any;
  };
  exec(sql: string): void;
  pragma(sql: string): any;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
  close(): void;
}

export class AppDatabase {
  private db: IDatabase;

  constructor(dbPath?: string) {
    let finalPath = dbPath;
    if (!finalPath) {
      const { app } = require('electron');
      const userDataPath = app?.getPath
        ? app.getPath('userData')
        : path.join(
            process.env.APPDATA ||
              (process.platform === 'darwin'
                ? `${process.env.HOME}/Library/Application Support`
                : `${process.env.HOME}/.config`),
            'MisFrases'
          );
      const dir = path.join(userDataPath, 'database');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      finalPath = path.join(dir, 'app.sqlite3');
    } else if (finalPath !== ':memory:') {
      const dir = path.dirname(finalPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Check if running under Bun runtime (e.g. bun test)
    if (typeof (process.versions as any).bun !== 'undefined') {
      const { Database: BunDb } = require('bun:sqlite');
      const rawBunDb = new BunDb(finalPath);

      // Wrap bun:sqlite to match IDatabase interface
      this.db = {
        prepare: (sql: string) => {
          const stmt = rawBunDb.prepare(sql);
          return {
            get: (...params: any[]) => stmt.get(...params),
            all: (...params: any[]) => stmt.all(...params),
            run: (...params: any[]) => stmt.run(...params)
          };
        },
        exec: (sql: string) => rawBunDb.exec(sql),
        pragma: (sql: string) => rawBunDb.exec(`PRAGMA ${sql}`),
        transaction: <T extends (...args: any[]) => any>(fn: T): T => {
          return rawBunDb.transaction(fn) as T;
        },
        close: () => rawBunDb.close()
      };
    } else {
      const BetterSqlite3 = require('better-sqlite3');
      this.db = new BetterSqlite3(finalPath);
    }

    this.initPragmas();
    runMigrations(this.db);
  }

  private initPragmas(): void {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
  }

  public getRawDb(): IDatabase {
    return this.db;
  }

  public close(): void {
    this.db.close();
  }
}
