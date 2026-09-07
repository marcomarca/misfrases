import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow, screen } from 'electron';
import type { ContextBlock, SelectorPayload, Snippet, WindowHandle } from '../../shared/types';

export class SelectorWindowService {
  private window: BrowserWindow | null = null;
  private currentSnippets: Snippet[] = [];
  private currentContextBlocks: ContextBlock[] = [];
  private targetHwnd: WindowHandle = 0;
  private isPastingContext = false;
  private onSelectCallback: ((snippet: Snippet, targetHwnd: WindowHandle) => void) | null = null;
  private onCancelCallback: (() => void) | null = null;
  private onPasteContextCallback: ((blockId: string, targetHwnd: WindowHandle) => Promise<boolean>) | null = null;

  public setCallbacks(
    onSelect: (snippet: Snippet, targetHwnd: WindowHandle) => void,
    onCancel: () => void,
    onPasteContext?: (blockId: string, targetHwnd: WindowHandle) => Promise<boolean>
  ): void {
    this.onSelectCallback = onSelect;
    this.onCancelCallback = onCancel;
    this.onPasteContextCallback = onPasteContext || null;
  }

  public isOpen(): boolean {
    return this.window !== null && !this.window.isDestroyed() && this.window.isVisible();
  }

  public getCurrentSnippets(): Snippet[] {
    return this.currentSnippets;
  }

  public getData(): SelectorPayload {
    return {
      snippets: this.currentSnippets,
      contextBlocks: this.currentContextBlocks
    };
  }

  public open(targetHwnd: WindowHandle, snippets: Snippet[], contextBlocks: ContextBlock[] = []): void {
    this.targetHwnd = targetHwnd;
    this.currentSnippets = snippets;
    this.currentContextBlocks = contextBlocks;

    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }

    const popupWidth = 440;
    // Calculate approximate height: header + memory bar + item height * count + padding
    const hasDescriptions = snippets.some((s) => Boolean(s.description));
    const itemHeight = hasDescriptions ? 54 : 44;
    const headerHeight = 44;
    const memoryBarHeight = contextBlocks.length > 0 ? 36 : 0;
    const popupHeight = Math.min(headerHeight + memoryBarHeight + snippets.length * itemHeight + 24, 600);

    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const area = display.workArea;

    let x = cursor.x + 12;
    let y = cursor.y + 12;

    // Check if it fits below
    if (y + popupHeight > area.y + area.height) {
      y = cursor.y - popupHeight - 12;
    }

    // Clamp inside workArea
    x = Math.max(area.x, Math.min(x, area.x + area.width - popupWidth));
    y = Math.max(area.y, Math.min(y, area.y + area.height - popupHeight));

    const possibleIconPaths = [
      path.join(__dirname, '../../../src/assets/icon.ico'),
      path.join(__dirname, '../../assets/icon.ico'),
      path.join(__dirname, '../../../src/assets/app_png/icon-256x256.png'),
      path.join(__dirname, '../../assets/app_png/icon-256x256.png'),
      path.join(process.resourcesPath, 'assets/icon.ico')
    ];
    let iconPath: string | undefined;
    for (const p of possibleIconPaths) {
      if (fs.existsSync(p)) {
        iconPath = p;
        break;
      }
    }

    this.window = new BrowserWindow({
      width: popupWidth,
      height: popupHeight,
      x: Math.round(x),
      y: Math.round(y),
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      show: false,
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, '../../preload/preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    const selectorHtmlPath = path.join(__dirname, '../../renderer/selector/index.html');
    this.window.loadFile(selectorHtmlPath);

    this.window.once('ready-to-show', () => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.show();
        this.window.focus();
      }
    });

    this.window.on('blur', () => {
      // Close popup if user clicks elsewhere, but not during an active context block paste
      if (!this.isPastingContext) {
        this.cancel();
      }
    });
  }

  public async pasteContextBlock(blockId: string): Promise<boolean> {
    if (!this.isOpen() || !this.onPasteContextCallback) {
      return false;
    }

    this.isPastingContext = true;
    try {
      const success = await this.onPasteContextCallback(blockId, this.targetHwnd);
      return success;
    } finally {
      // Restore focus back to the selector window so user can immediately press [1..9] or another key
      if (this.window && !this.window.isDestroyed()) {
        this.window.show();
        this.window.focus();
      }
      setTimeout(() => {
        this.isPastingContext = false;
      }, 150);
    }
  }

  public selectSlot(slotNumber: number): void {
    const snippet = this.currentSnippets.find((s) => s.slot === slotNumber);
    if (snippet) {
      const hwnd = this.targetHwnd;
      this.close();
      if (this.onSelectCallback) {
        this.onSelectCallback(snippet, hwnd);
      }
    }
  }

  public cancel(): void {
    if (this.isOpen()) {
      this.close();
      if (this.onCancelCallback) {
        this.onCancelCallback();
      }
    }
  }

  public close(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.removeAllListeners('blur');
      this.window.destroy();
      this.window = null;
    }
  }
}
