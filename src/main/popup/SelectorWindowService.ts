import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow, screen } from 'electron';
import type { Snippet, WindowHandle } from '../../shared/types';

export class SelectorWindowService {
  private window: BrowserWindow | null = null;
  private currentSnippets: Snippet[] = [];
  private targetHwnd: WindowHandle = 0;
  private onSelectCallback: ((snippet: Snippet, targetHwnd: WindowHandle) => void) | null = null;
  private onCancelCallback: (() => void) | null = null;

  public setCallbacks(
    onSelect: (snippet: Snippet, targetHwnd: WindowHandle) => void,
    onCancel: () => void
  ): void {
    this.onSelectCallback = onSelect;
    this.onCancelCallback = onCancel;
  }

  public isOpen(): boolean {
    return this.window !== null && !this.window.isDestroyed() && this.window.isVisible();
  }

  public getCurrentSnippets(): Snippet[] {
    return this.currentSnippets;
  }

  public open(targetHwnd: WindowHandle, snippets: Snippet[]): void {
    this.targetHwnd = targetHwnd;
    this.currentSnippets = snippets;

    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }

    const popupWidth = 390;
    // Calculate approximate height: header + item height * count + padding
    const itemHeight = 44;
    const headerHeight = 48;
    const popupHeight = Math.min(headerHeight + snippets.length * itemHeight + 16, 520);

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
      // Close popup if user clicks elsewhere
      this.cancel();
    });
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
