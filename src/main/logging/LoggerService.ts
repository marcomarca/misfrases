import fs from 'node:fs';
import path from 'node:path';

export class LoggerService {
  private static instance: LoggerService;
  private logFilePath: string;
  private logStream: fs.WriteStream | null = null;

  constructor() {
    let userDataPath: string;
    try {
      const electron = require('electron');
      userDataPath = electron?.app?.getPath ? electron.app.getPath('userData') : '';
    } catch {
      userDataPath = '';
    }

    if (!userDataPath) {
      userDataPath = path.join(
        process.env.APPDATA ||
          (process.platform === 'darwin'
            ? `${process.env.HOME}/Library/Application Support`
            : `${process.env.HOME}/.config`),
        'MisFrases'
      );
    }

    const logsDir = path.join(userDataPath, 'logs');
    const backupsDir = path.join(userDataPath, 'backups');
    const dbDir = path.join(userDataPath, 'database');

    for (const dir of [logsDir, backupsDir, dbDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.logFilePath = path.join(logsDir, 'app.log');

    try {
      this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a', encoding: 'utf8' });
    } catch (err) {
      console.error('Failed to create log stream:', err);
    }
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  public log(category: string, message: string, meta?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    let metaStr = '';

    if (meta) {
      // NEVER log snippet content or clipboard contents (Section 46 rule)
      const sanitized = { ...meta };
      delete sanitized.content;
      delete sanitized.snippetContent;
      delete sanitized.text;
      delete sanitized.clipboardText;
      delete sanitized.clipboard;
      metaStr = ` | ${JSON.stringify(sanitized)}`;
    }

    const line = `[${timestamp}] [${category.toUpperCase()}] ${message}${metaStr}\n`;

    if (this.logStream) {
      this.logStream.write(line);
    }
    console.log(line.trim());
  }

  public info(category: string, message: string, meta?: Record<string, any>): void {
    this.log(category, message, meta);
  }

  public warn(category: string, message: string, meta?: Record<string, any>): void {
    this.log(`WARN:${category}`, message, meta);
  }

  public error(category: string, message: string, error?: any, meta?: Record<string, any>): void {
    const errDetails = error instanceof Error ? { errorName: error.name, errorMessage: error.message } : { error };
    this.log(category, message, { ...errDetails, ...meta });
  }

  public close(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}
