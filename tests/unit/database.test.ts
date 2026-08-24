import { beforeEach, describe, expect, test } from 'bun:test';
import { AppDatabase } from '../../src/main/database/Database';
import { HotkeyRepository } from '../../src/main/database/repositories/HotkeyRepository';
import { SnippetRepository } from '../../src/main/database/repositories/SnippetRepository';
import { UsageRepository } from '../../src/main/database/repositories/UsageRepository';
import { SettingsRepository } from '../../src/main/database/repositories/SettingsRepository';

describe('Database Repositories', () => {
  let db: AppDatabase;
  let hotkeyRepo: HotkeyRepository;
  let snippetRepo: SnippetRepository;
  let usageRepo: UsageRepository;
  let settingsRepo: SettingsRepository;

  beforeEach(() => {
    db = new AppDatabase(':memory:');
    hotkeyRepo = new HotkeyRepository(db.getRawDb());
    snippetRepo = new SnippetRepository(db.getRawDb());
    usageRepo = new UsageRepository(db.getRawDb());
    settingsRepo = new SettingsRepository(db.getRawDb());
  });

  test('creates hotkey groups and prevents duplicate accelerator', () => {
    const group = hotkeyRepo.create('Control+Alt+P');
    expect(group.id).toBeDefined();
    expect(group.accelerator).toBe('Control+Alt+P');

    const found = hotkeyRepo.findByAccelerator('Control+Alt+P');
    expect(found?.id).toBe(group.id);

    // getOrCreate returns existing
    const group2 = hotkeyRepo.getOrCreate('Control+Alt+P');
    expect(group2.id).toBe(group.id);
  });

  test('creates snippet with description and auto slot allocation and limits to 10 slots', () => {
    const group = hotkeyRepo.create('Control+Alt+T');

    // Create 10 snippets
    const createdSnippets = [];
    for (let i = 1; i <= 10; i++) {
      const s = snippetRepo.create({
        hotkeyGroupId: group.id,
        title: `Snippet ${i}`,
        description: `Description for snippet ${i}`,
        content: `Content ${i}`
      });
      expect(s.slot).toBe(i as any);
      expect(s.description).toBe(`Description for snippet ${i}`);
      createdSnippets.push(s);
    }

    // Update snippet description
    const updated = snippetRepo.update({
      id: createdSnippets[0].id,
      description: 'Updated Description'
    });
    expect(updated.description).toBe('Updated Description');

    // 11th snippet must throw error
    expect(() => {
      snippetRepo.create({
        hotkeyGroupId: group.id,
        title: 'Snippet 11',
        content: 'Content 11'
      });
    }).toThrow(/10 acciones/);
  });

  test('soft delete releases slot for reuse without renumbering others', () => {
    const group = hotkeyRepo.create('Control+Alt+S');

    const s1 = snippetRepo.create({ hotkeyGroupId: group.id, title: 'S1', content: 'C1' }); // slot 1
    const s2 = snippetRepo.create({ hotkeyGroupId: group.id, title: 'S2', content: 'C2' }); // slot 2
    const s3 = snippetRepo.create({ hotkeyGroupId: group.id, title: 'S3', content: 'C3' }); // slot 3

    expect(s1.slot).toBe(1);
    expect(s2.slot).toBe(2);
    expect(s3.slot).toBe(3);

    // Delete slot 2
    snippetRepo.softDelete(s2.id);

    const active = snippetRepo.listByGroupId(group.id, true);
    expect(active.length).toBe(2);
    expect(active[0].slot).toBe(1);
    expect(active[1].slot).toBe(3); // slot 3 remains 3!

    // Next created snippet reuses slot 2
    const sNew = snippetRepo.create({ hotkeyGroupId: group.id, title: 'S New', content: 'C New' });
    expect(sNew.slot).toBe(2);
  });

  test('disabling a snippet does NOT free its slot', () => {
    const group = hotkeyRepo.create('Control+Alt+D');
    const s1 = snippetRepo.create({ hotkeyGroupId: group.id, title: 'S1', content: 'C1' });
    const s2 = snippetRepo.create({ hotkeyGroupId: group.id, title: 'S2', content: 'C2' });

    snippetRepo.update({ id: s1.id, enabled: false });

    // s1 is disabled but slot 1 is still occupied
    const s3 = snippetRepo.create({ hotkeyGroupId: group.id, title: 'S3', content: 'C3' });
    expect(s3.slot).toBe(3);
  });

  test('reorders slots 1..N transactionally', () => {
    const group = hotkeyRepo.create('Control+Alt+R');
    const s1 = snippetRepo.create({ hotkeyGroupId: group.id, title: 'A', content: 'A' }); // 1
    const s2 = snippetRepo.create({ hotkeyGroupId: group.id, title: 'B', content: 'B' }); // 2
    const s3 = snippetRepo.create({ hotkeyGroupId: group.id, title: 'C', content: 'C' }); // 3

    // Reverse order: C -> 1, B -> 2, A -> 3
    snippetRepo.reorderSlots(group.id, [s3.id, s2.id, s1.id]);

    const updated = snippetRepo.listByGroupId(group.id);
    expect(updated[0].id).toBe(s3.id);
    expect(updated[0].slot).toBe(1);
    expect(updated[1].id).toBe(s2.id);
    expect(updated[1].slot).toBe(2);
    expect(updated[2].id).toBe(s1.id);
    expect(updated[2].slot).toBe(3);
  });

  test('records usage event and updates usage count transactionally', () => {
    const group = hotkeyRepo.create('Control+Alt+U');
    const s = snippetRepo.create({ hotkeyGroupId: group.id, title: 'Tracked', content: 'Tracked' });

    expect(s.usageCount).toBe(0);
    expect(s.lastUsedAt).toBeNull();

    const now = Date.now();
    usageRepo.recordUsage(s.id, now);
    usageRepo.recordUsage(s.id, now + 100);

    const updated = snippetRepo.findById(s.id);
    expect(updated?.usageCount).toBe(2);
    expect(updated?.lastUsedAt).toBe(now + 100);

    const summary = usageRepo.getSummary();
    expect(summary.totalExpansions).toBe(2);
    expect(summary.todayExpansions).toBe(2);
    expect(summary.last7DaysExpansions).toBe(2);
    expect(summary.last30DaysExpansions).toBe(2);
  });

  test('persists and loads settings', () => {
    const initial = settingsRepo.getSettings();
    expect(initial.launchAtLogin).toBe(false);
    expect(initial.hotkeysEnabled).toBe(true);

    const updated = settingsRepo.saveSettings({
      hotkeysEnabled: false,
      administratorMode: false,
      launchAtLogin: true
    });

    expect(updated.hotkeysEnabled).toBe(false);
    expect(updated.administratorMode).toBe(false);
    expect(updated.launchAtLogin).toBe(true);

    const reloaded = settingsRepo.getSettings();
    expect(reloaded.hotkeysEnabled).toBe(false);
    expect(reloaded.launchAtLogin).toBe(true);
  });
});
