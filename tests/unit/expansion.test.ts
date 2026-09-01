import { beforeEach, describe, expect, test } from 'bun:test';
import { AppDatabase } from '../../src/main/database/Database';
import { HotkeyRepository } from '../../src/main/database/repositories/HotkeyRepository';
import { SnippetRepository } from '../../src/main/database/repositories/SnippetRepository';
import { UsageRepository } from '../../src/main/database/repositories/UsageRepository';
import { StatisticsService } from '../../src/main/statistics/StatisticsService';
import { ExpansionService } from '../../src/main/expansion/ExpansionService';
import type { IWindowsInputService } from '../../src/main/windows/WindowsInputService';
import type { IClipboardGuard } from '../../src/main/windows/ClipboardGuard';
import type { SelectorWindowService } from '../../src/main/popup/SelectorWindowService';
import type { ClipboardSnapshot, Snippet, WindowHandle } from '../../src/shared/types';

class FakeWindowsInput implements IWindowsInputService {
  public foregroundHwnd: WindowHandle = 1001;
  public restoredHwnd: WindowHandle | null = null;
  public pasteCalled = false;
  public unicodeSent: string[] = [];

  public getForegroundWindow(): WindowHandle {
    return this.foregroundHwnd;
  }
  public isWindow(_hwnd: WindowHandle): boolean {
    return true;
  }
  public async restoreForegroundWindow(hwnd: WindowHandle): Promise<boolean> {
    this.restoredHwnd = hwnd;
    return true;
  }
  public async waitForModifiersReleased(): Promise<void> {
    return;
  }
  public sendPaste(): boolean {
    this.pasteCalled = true;
    return true;
  }
  public sendUnicode(text: string): boolean {
    this.unicodeSent.push(text);
    return true;
  }
}

class FakeClipboardGuard implements IClipboardGuard {
  public safe = true;
  public tempText: string | null = null;
  public restoredSnapshot: ClipboardSnapshot | null = null;

  public canSnapshotSafely(): boolean {
    return this.safe;
  }
  public snapshot(): ClipboardSnapshot {
    return {
      hasText: true,
      text: 'previous clipboard',
      hasHtml: false,
      hasImage: false,
      formats: ['text/plain']
    };
  }
  public setTemporaryText(text: string): void {
    this.tempText = text;
  }
  public restore(snapshot: ClipboardSnapshot): void {
    this.restoredSnapshot = snapshot;
  }
}

class FakeSelectorService {
  public openedWith: { targetHwnd: WindowHandle; snippets: Snippet[] } | null = null;
  private onSelect: ((snippet: Snippet, targetHwnd: WindowHandle) => void) | null = null;
  private onCancel: (() => void) | null = null;

  public setCallbacks(
    onSelect: (snippet: Snippet, targetHwnd: WindowHandle) => void,
    onCancel: () => void
  ): void {
    this.onSelect = onSelect;
    this.onCancel = onCancel;
  }

  public open(targetHwnd: WindowHandle, snippets: Snippet[]): void {
    this.openedWith = { targetHwnd, snippets };
  }

  public triggerSelect(snippet: Snippet, targetHwnd: WindowHandle): void {
    this.onSelect?.(snippet, targetHwnd);
  }

  public triggerCancel(): void {
    this.onCancel?.();
  }

  public close(): void {
    this.openedWith = null;
  }
}

describe('ExpansionService', () => {
  let db: AppDatabase;
  let hotkeyRepo: HotkeyRepository;
  let snippetRepo: SnippetRepository;
  let usageRepo: UsageRepository;
  let statsService: StatisticsService;
  let windowsInput: FakeWindowsInput;
  let clipboardGuard: FakeClipboardGuard;
  let selectorService: FakeSelectorService;
  let expansionService: ExpansionService;

  beforeEach(() => {
    db = new AppDatabase(':memory:');
    hotkeyRepo = new HotkeyRepository(db.getRawDb());
    snippetRepo = new SnippetRepository(db.getRawDb());
    usageRepo = new UsageRepository(db.getRawDb());
    statsService = new StatisticsService(usageRepo);
    windowsInput = new FakeWindowsInput();
    clipboardGuard = new FakeClipboardGuard();
    selectorService = new FakeSelectorService();

    expansionService = new ExpansionService(
      windowsInput,
      clipboardGuard,
      statsService,
      snippetRepo,
      selectorService as unknown as SelectorWindowService
    );
  });

  test('single snippet with safe clipboard snapshots, pastes, and restores original clipboard', async () => {
    const group = hotkeyRepo.create('Control+Alt+1');
    snippetRepo.create({
      hotkeyGroupId: group.id,
      title: 'Only One',
      content: 'Auto expanded text'
    });

    await expansionService.handleHotkeyTrigger('Control+Alt+1');

    expect(selectorService.openedWith).toBeNull();
    expect(windowsInput.restoredHwnd).toBe(1001);
    expect(windowsInput.pasteCalled).toBe(true);
    expect(clipboardGuard.tempText).toBe('Auto expanded text');
    expect(clipboardGuard.restoredSnapshot).not.toBeNull();
    expect(clipboardGuard.restoredSnapshot?.text).toBe('previous clipboard');

    const stats = statsService.getSummary();
    expect(stats.totalExpansions).toBe(1);
  });

  test('unsafe clipboard (e.g. image) bypasses clipboard mutation and uses direct Unicode input', async () => {
    clipboardGuard.safe = false; // simulates image or non-text format in clipboard

    const group = hotkeyRepo.create('Control+Alt+2');
    snippetRepo.create({
      hotkeyGroupId: group.id,
      title: 'Image Preserved',
      content: 'Unicode direct fallback'
    });

    await expansionService.handleHotkeyTrigger('Control+Alt+2');

    expect(clipboardGuard.tempText).toBeNull(); // Clipboard was not modified
    expect(windowsInput.pasteCalled).toBe(false);
    expect(windowsInput.unicodeSent).toContain('Unicode direct fallback');

    const stats = statsService.getSummary();
    expect(stats.totalExpansions).toBe(1);
  });

  test('multiple snippets open selector popup and expand upon slot selection', async () => {
    const group = hotkeyRepo.create('Control+Alt+M');
    const s1 = snippetRepo.create({ hotkeyGroupId: group.id, title: 'Item 1', content: 'Text 1' });
    const s2 = snippetRepo.create({ hotkeyGroupId: group.id, title: 'Item 2', content: 'Text 2' });

    await expansionService.handleHotkeyTrigger('Control+Alt+M');

    expect(selectorService.openedWith).not.toBeNull();
    expect(selectorService.openedWith?.snippets.length).toBe(2);
    expect(expansionService.getState()).toBe('SELECTOR_OPEN');

    // Simulate selecting snippet 2
    selectorService.triggerSelect(s2, 1001);
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(windowsInput.pasteCalled).toBe(true);
    expect(clipboardGuard.tempText).toBe('Text 2');
    expect(clipboardGuard.restoredSnapshot).not.toBeNull();

    const stats = statsService.getSummary();
    expect(stats.totalExpansions).toBe(1);
    expect(expansionService.getState()).toBe('READY');
  });

  test('ignores hotkey when app state is not READY (e.g. PAUSED or EXPANDING)', async () => {
    const group = hotkeyRepo.create('Control+Alt+P');
    snippetRepo.create({ hotkeyGroupId: group.id, title: 'P', content: 'C' });

    expansionService.setState('PAUSED');
    await expansionService.handleHotkeyTrigger('Control+Alt+P');

    expect(windowsInput.pasteCalled).toBe(false);
    expect(windowsInput.unicodeSent.length).toBe(0);
    expect(statsService.getSummary().totalExpansions).toBe(0);
  });
});
