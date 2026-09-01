import { beforeEach, describe, expect, test } from 'bun:test';
import { AppDatabase } from '../../src/main/database/Database';
import { HotkeyRepository } from '../../src/main/database/repositories/HotkeyRepository';
import { SnippetRepository } from '../../src/main/database/repositories/SnippetRepository';
import { BackupService, type IHotkeyRebuilder } from '../../src/main/backup/BackupService';

class MockHotkeyRebuilder implements IHotkeyRebuilder {
  public rebuildCount = 0;
  public rebuildAll(): void {
    this.rebuildCount++;
  }
}

describe('BackupService', () => {
  let db: AppDatabase;
  let hotkeyRepo: HotkeyRepository;
  let snippetRepo: SnippetRepository;
  let mockRebuilder: MockHotkeyRebuilder;
  let backupService: BackupService;

  beforeEach(() => {
    db = new AppDatabase(':memory:');
    hotkeyRepo = new HotkeyRepository(db.getRawDb());
    snippetRepo = new SnippetRepository(db.getRawDb());
    mockRebuilder = new MockHotkeyRebuilder();
    backupService = new BackupService(snippetRepo, hotkeyRepo, mockRebuilder);
  });

  test('exports empty backup when database has no snippets', () => {
    const backup = backupService.exportData();
    expect(backup.version).toBe('1.0');
    expect(Array.isArray(backup.snippets)).toBe(true);
    expect(backup.snippets.length).toBe(0);
  });

  test('exports and imports snippets with all metadata', () => {
    const group = hotkeyRepo.create('Control+Alt+T');
    snippetRepo.create({
      hotkeyGroupId: group.id,
      title: 'Frase 1',
      description: 'Desc 1',
      content: 'Contenido 1',
      slot: 1
    });
    snippetRepo.create({
      hotkeyGroupId: group.id,
      title: 'Frase 2',
      description: 'Desc 2',
      content: 'Contenido 2',
      slot: 2
    });

    const backup = backupService.exportData();
    expect(backup.snippets.length).toBe(2);
    expect(backup.snippets[0].title).toBe('Frase 1');
    expect(backup.snippets[0].accelerator).toBe('Control+Alt+T');

    // Create a new fresh database and import
    const db2 = new AppDatabase(':memory:');
    const hotkeyRepo2 = new HotkeyRepository(db2.getRawDb());
    const snippetRepo2 = new SnippetRepository(db2.getRawDb());
    const rebuilder2 = new MockHotkeyRebuilder();
    const backupService2 = new BackupService(snippetRepo2, hotkeyRepo2, rebuilder2);

    const importRes = backupService2.importData(backup, 'replace');
    expect(importRes.success).toBe(true);
    expect(importRes.importedCount).toBe(2);

    const importedSnippets = snippetRepo2.listAll();
    expect(importedSnippets.length).toBe(2);
    expect(importedSnippets[0].title).toBe('Frase 1');
    expect(importedSnippets[1].title).toBe('Frase 2');
  });

  test('import in replace mode clears previous snippets', () => {
    const g1 = hotkeyRepo.create('Control+Alt+X');
    snippetRepo.create({
      hotkeyGroupId: g1.id,
      title: 'Vieja Frase',
      content: 'Old',
      slot: 1
    });

    const backupData = {
      version: '1.0',
      exportedAt: Date.now(),
      snippets: [
        {
          id: 'new-1',
          title: 'Nueva Frase',
          description: 'Nueva desc',
          content: 'New content',
          slot: 1 as const,
          enabled: true,
          accelerator: 'Control+Alt+Y'
        }
      ]
    };

    const res = backupService.importData(backupData, 'replace');
    expect(res.success).toBe(true);

    const list = snippetRepo.listAll();
    expect(list.length).toBe(1);
    expect(list[0].title).toBe('Nueva Frase');
  });

  test('rejects invalid backup schema with descriptive error', () => {
    const invalidData = {
      version: '1.0',
      snippets: [
        {
          id: 'bad-1',
          // missing title and content
          slot: 99
        }
      ]
    };

    const res = backupService.importData(invalidData);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});
