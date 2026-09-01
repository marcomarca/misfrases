import fs from 'node:fs';
import type { BrowserWindow } from 'electron';
import type { HotkeyRepository } from '../database/repositories/HotkeyRepository';
import type { SnippetRepository } from '../database/repositories/SnippetRepository';
import type { HotkeyService } from '../hotkeys/HotkeyService';
import type {
  BackupData,
  BackupSnippetData,
  ExportBackupResult,
  ImportBackupResult
} from '../../shared/types';
import { BackupDataSchema } from '../../shared/schemas';
import { LoggerService } from '../logging/LoggerService';

export interface IHotkeyRebuilder {
  rebuildAll(): void;
}

export class BackupService {
  private logger = LoggerService.getInstance();

  constructor(
    private snippetRepo: SnippetRepository,
    private hotkeyRepo: HotkeyRepository,
    private hotkeyService: IHotkeyRebuilder
  ) {}

  public exportData(): BackupData {
    const snippets = this.snippetRepo.listAll();
    const backupSnippets: BackupSnippetData[] = snippets.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description || '',
      content: s.content,
      slot: s.slot,
      enabled: s.enabled,
      accelerator: s.accelerator || 'Control+Alt+P',
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));

    return {
      version: '1.0',
      exportedAt: Date.now(),
      snippets: backupSnippets
    };
  }

  public importData(rawInput: unknown, mode: 'merge' | 'replace' = 'merge'): ImportBackupResult {
    const parseResult = BackupDataSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      this.logger.error('backup import error', `Formato de backup inválido: ${errorMsg}`);
      return {
        success: false,
        error: `Formato de archivo no válido: ${errorMsg}`
      };
    }

    const backup = parseResult.data;
    let importedCount = 0;

    try {
      if (mode === 'replace') {
        // Remove all existing snippets
        const existing = this.snippetRepo.listAll();
        for (const s of existing) {
          this.snippetRepo.softDelete(s.id);
        }
      }

      for (const item of backup.snippets) {
        const group = this.hotkeyRepo.getOrCreate(item.accelerator);
        const groupSnippets = this.snippetRepo.listByGroupId(group.id);

        if (groupSnippets.length >= 10) {
          // Max slots reached for this accelerator group, skip or log
          continue;
        }

        this.snippetRepo.create({
          hotkeyGroupId: group.id,
          title: item.title,
          description: item.description,
          content: item.content,
          slot: item.slot,
          enabled: item.enabled
        });

        importedCount++;
      }

      this.hotkeyService.rebuildAll();
      this.logger.info('backup import', `Importación exitosa: ${importedCount} frases importadas (modo: ${mode})`);

      return {
        success: true,
        importedCount
      };
    } catch (err: any) {
      this.logger.error('backup import error', err.message || String(err));
      return {
        success: false,
        error: `Error al procesar la importación: ${err.message || err}`
      };
    }
  }

  public async exportToFile(targetWindow?: BrowserWindow | null): Promise<ExportBackupResult> {
    try {
      const { dialog } = require('electron');
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const defaultFilename = `misfrases-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.json`;

      const options = {
        title: 'Guardar Copia de Seguridad de Frases',
        defaultPath: defaultFilename,
        filters: [{ name: 'Archivos JSON (*.json)', extensions: ['json'] }]
      };

      const { canceled, filePath } = targetWindow
        ? await dialog.showSaveDialog(targetWindow, options)
        : await dialog.showSaveDialog(options);

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      const data = this.exportData();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

      this.logger.info('backup export', `Copia de seguridad guardada en: ${filePath}`);
      return {
        success: true,
        filePath,
        snippetCount: data.snippets.length
      };
    } catch (err: any) {
      this.logger.error('backup export error', err.message || String(err));
      return {
        success: false,
        error: err.message || String(err)
      };
    }
  }

  public async importFromFile(
    targetWindow?: BrowserWindow | null,
    mode: 'merge' | 'replace' = 'merge'
  ): Promise<ImportBackupResult> {
    try {
      const { dialog } = require('electron');
      const options = {
        title: 'Seleccionar Copia de Seguridad para Restaurar',
        filters: [{ name: 'Archivos JSON (*.json)', extensions: ['json'] }],
        properties: ['openFile'] as ('openFile')[]
      };

      const { canceled, filePaths } = targetWindow
        ? await dialog.showOpenDialog(targetWindow, options)
        : await dialog.showOpenDialog(options);

      if (canceled || !filePaths || filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const content = fs.readFileSync(filePaths[0], 'utf-8');
      const parsed = JSON.parse(content);

      return this.importData(parsed, mode);
    } catch (err: any) {
      this.logger.error('backup import file error', err.message || String(err));
      return {
        success: false,
        error: `No se pudo leer el archivo de respaldo: ${err.message || err}`
      };
    }
  }
}
