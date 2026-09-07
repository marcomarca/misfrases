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
import { ContextBlockRepository } from '../../src/main/database/repositories/ContextBlockRepository';
import type { ClipboardSnapshot, ContextBlock, Snippet, WindowHandle } from '../../src/shared/types';

class FakeWindowsInput implements IWindowsInputService {
  public foregroundHwnd: WindowHandle = 1001;
  public restoredHwnd: WindowHandle | null = null;
  public pasteCalled = false;
  public unicodeSent: string[] = [];
  public forceReleaseModifiersCalled = false;

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
  public async waitForModifiersReleased(_timeoutMs?: number): Promise<void> {
    return;
  }
  public forceReleaseModifiers(): void {
    this.forceReleaseModifiersCalled = true;
  }
  public pasteSuccess = true;
  public sendPaste(): boolean {
    this.pasteCalled = true;
    return this.pasteSuccess;
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
  public openedWith: { targetHwnd: WindowHandle; snippets: Snippet[]; contextBlocks?: ContextBlock[] } | null = null;
  private onSelect: ((snippet: Snippet, targetHwnd: WindowHandle) => void) | null = null;
  private onCancel: (() => void) | null = null;
  private onPasteContext: ((blockId: string, targetHwnd: WindowHandle) => Promise<boolean>) | null = null;

  public setCallbacks(
    onSelect: (snippet: Snippet, targetHwnd: WindowHandle) => void,
    onCancel: () => void,
    onPasteContext?: (blockId: string, targetHwnd: WindowHandle) => Promise<boolean>
  ): void {
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.onPasteContext = onPasteContext || null;
  }

  public open(targetHwnd: WindowHandle, snippets: Snippet[], contextBlocks?: ContextBlock[]): void {
    this.openedWith = { targetHwnd, snippets, contextBlocks };
  }

  public triggerSelect(snippet: Snippet, targetHwnd: WindowHandle): void {
    this.onSelect?.(snippet, targetHwnd);
  }

  public triggerPasteContext(blockId: string, targetHwnd: WindowHandle): Promise<boolean> | undefined {
    return this.onPasteContext?.(blockId, targetHwnd);
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

  test('always uses clipboard paste and restores original clipboard for maximum performance', async () => {
    const group = hotkeyRepo.create('Control+Alt+2');
    snippetRepo.create({
      hotkeyGroupId: group.id,
      title: 'Prompt Gigante',
      content: 'Contenido extenso de prompt que debe ser pegado instantáneamente'
    });

    await expansionService.handleHotkeyTrigger('Control+Alt+2');

    expect(clipboardGuard.tempText).toBe('Contenido extenso de prompt que debe ser pegado instantáneamente');
    expect(windowsInput.pasteCalled).toBe(true);
    expect(clipboardGuard.restoredSnapshot).not.toBeNull();
    expect(clipboardGuard.restoredSnapshot?.text).toBe('previous clipboard');

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

  test('restores clipboard and releases modifiers when sendPaste fails', async () => {
    windowsInput.pasteSuccess = false; // Simulates SendInput/UIPI failure

    const group = hotkeyRepo.create('Control+Alt+F');
    snippetRepo.create({
      hotkeyGroupId: group.id,
      title: 'Fallback Test',
      content: 'Resilient fallback snippet'
    });

    await expansionService.handleHotkeyTrigger('Control+Alt+F');

    // Paste was attempted
    expect(windowsInput.pasteCalled).toBe(true);
    // Clipboard snapshot was restored immediately
    expect(clipboardGuard.restoredSnapshot).not.toBeNull();
    expect(clipboardGuard.restoredSnapshot?.text).toBe('previous clipboard');
    // Modifiers were force-released
    expect(windowsInput.forceReleaseModifiersCalled).toBe(true);
    expect(expansionService.getState()).toBe('READY');
  });

  test('pastes context block directly into targetHwnd when triggered from selector', async () => {
    const contextBlockRepo = new ContextBlockRepository(db.getRawDb());
    expansionService = new ExpansionService(
      windowsInput as any,
      clipboardGuard as any,
      statsService,
      snippetRepo,
      selectorService as any,
      contextBlockRepo
    );

    const group = hotkeyRepo.create('Control+Alt+K');
    snippetRepo.create({ hotkeyGroupId: group.id, title: 'F1', content: 'C1', slot: 1 });
    snippetRepo.create({ hotkeyGroupId: group.id, title: 'F2', content: 'C2', slot: 2 });

    await expansionService.handleHotkeyTrigger('Control+Alt+K');
    expect(selectorService.openedWith).not.toBeNull();
    expect(selectorService.openedWith?.contextBlocks?.length).toBe(4);

    const perfil = contextBlockRepo.getByKey('perfil_base');
    expect(perfil).not.toBeNull();

    const success = await selectorService.triggerPasteContext(perfil!.id, 4444 as any);
    expect(success).toBe(true);
    expect(clipboardGuard.tempText).toContain('Ingeniero Electrónico');
    expect(clipboardGuard.tempText.endsWith('\n')).toBe(true);
    expect(windowsInput.pasteCalled).toBe(true);
  });
});

