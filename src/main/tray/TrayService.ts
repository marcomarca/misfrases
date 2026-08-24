import fs from 'node:fs';
import path from 'node:path';
import { Menu, Tray, nativeImage } from 'electron';
import type { AppSettings } from '../../shared/types';

export class TrayService {
  private tray: Tray | null = null;
  private onOpenCallback: ((tab?: string) => void) | null = null;
  private onToggleHotkeysCallback: ((enabled: boolean) => void) | null = null;
  private onQuitCallback: (() => void) | null = null;

  public init(
    settings: AppSettings,
    callbacks: {
      onOpen: (tab?: string) => void;
      onToggleHotkeys: (enabled: boolean) => void;
      onQuit: () => void;
    }
  ): void {
    this.onOpenCallback = callbacks.onOpen;
    this.onToggleHotkeysCallback = callbacks.onToggleHotkeys;
    this.onQuitCallback = callbacks.onQuit;

    const icon = this.createTrayIcon();
    this.tray = new Tray(icon);
    this.tray.setToolTip('Mis Frases - Gestor de Snippets');

    this.updateMenu(settings.hotkeysEnabled);

    this.tray.on('double-click', () => {
      if (this.onOpenCallback) {
        this.onOpenCallback();
      }
    });
  }

  public updateMenu(hotkeysEnabled: boolean): void {
    if (!this.tray) {
      return;
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir Mis Frases',
        click: () => this.onOpenCallback?.()
      },
      { type: 'separator' },
      {
        label: 'Hotkeys activos',
        type: 'checkbox',
        checked: hotkeysEnabled,
        click: (item) => this.onToggleHotkeysCallback?.(item.checked)
      },
      { type: 'separator' },
      {
        label: 'Estadísticas',
        click: () => this.onOpenCallback?.('stats')
      },
      {
        label: 'Configuración',
        click: () => this.onOpenCallback?.('settings')
      },
      { type: 'separator' },
      {
        label: 'Salir',
        click: () => this.onQuitCallback?.()
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  private createTrayIcon(): Electron.NativeImage {
    // 1. Try Windows tray icon paths
    const possiblePaths = [
      path.join(__dirname, '../../../windows/tray/tray.ico'),
      path.join(__dirname, '../../windows/tray/tray.ico'),
      path.join(__dirname, '../../../windows/tray/electron_scale_assets/tray.png'),
      path.join(__dirname, '../../windows/tray/electron_scale_assets/tray.png'),
      path.join(__dirname, '../../../windows/app_png/icon-32x32.png'),
      path.join(__dirname, '../../windows/app_png/icon-32x32.png'),
      path.join(process.resourcesPath, 'windows/tray/tray.ico'),
      path.join(process.resourcesPath, 'windows/tray/electron_scale_assets/tray.png')
    ];

    for (const iconPath of possiblePaths) {
      try {
        if (fs.existsSync(iconPath)) {
          const img = nativeImage.createFromPath(iconPath);
          if (!img.isEmpty()) {
            return img;
          }
        }
      } catch {
        // Continue to fallback
      }
    }

    // Fallback SVG
    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
        <rect width="16" height="16" rx="4" fill="#3B82F6"/>
        <path d="M4 3.5h7v2.2H6.6v2.3h4v2.2h-4v3.3H4z" fill="#FFFFFF"/>
      </svg>
    `;
    return nativeImage.createFromBuffer(Buffer.from(svgIcon));
  }
}
