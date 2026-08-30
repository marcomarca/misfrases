import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow, app, shell } from 'electron';
import { AppDatabase } from '../database/Database';
import { HotkeyRepository } from '../database/repositories/HotkeyRepository';
import { SnippetRepository } from '../database/repositories/SnippetRepository';
import { UsageRepository } from '../database/repositories/UsageRepository';
import { SettingsRepository } from '../database/repositories/SettingsRepository';
import { HotkeyService } from '../hotkeys/HotkeyService';
import { WindowsInputService } from '../windows/WindowsInputService';
import { ClipboardGuard } from '../windows/ClipboardGuard';
import { StatisticsService } from '../statistics/StatisticsService';
import { SelectorWindowService } from '../popup/SelectorWindowService';
import { ExpansionService } from '../expansion/ExpansionService';
import { SnippetService } from '../snippets/SnippetService';
import { TrayService } from '../tray/TrayService';
import { SingleInstanceService } from './SingleInstanceService';
import { LoginItemService } from './LoginItemService';
import { AdministratorService } from '../windows/AdministratorService';
import { registerIpcHandlers } from '../ipc/handlers';
import { LoggerService } from '../logging/LoggerService';

export class AppLifecycleService {
  private logger = LoggerService.getInstance();
  private db!: AppDatabase;
  private hotkeyRepo!: HotkeyRepository;
  private snippetRepo!: SnippetRepository;
  private usageRepo!: UsageRepository;
  private settingsRepo!: SettingsRepository;

  private hotkeyService!: HotkeyService;
  private windowsInput!: WindowsInputService;
  private clipboardGuard!: ClipboardGuard;
  private statsService!: StatisticsService;
  private selectorService!: SelectorWindowService;
  private expansionService!: ExpansionService;
  private snippetService!: SnippetService;
  private trayService!: TrayService;

  private mainWindow: BrowserWindow | null = null;
  private isQuitting = false;

  public async bootstrap(): Promise<void> {
    this.logger.info('startup', 'Application starting');

    // 1. Single instance check
    const hasLock = SingleInstanceService.acquireLock(() => {
      this.logger.info('startup', 'Focusing existing instance on second launch attempt');
      this.showMainWindow();
    });

    if (!hasLock) {
      this.logger.info('startup', 'Another instance is running, exiting');
      return;
    }

    // 2. Wait for electron app ready
    await app.whenReady();

    // 3. Initialize persistence
    this.db = new AppDatabase();
    this.hotkeyRepo = new HotkeyRepository(this.db.getRawDb());
    this.snippetRepo = new SnippetRepository(this.db.getRawDb());
    this.usageRepo = new UsageRepository(this.db.getRawDb());
    this.settingsRepo = new SettingsRepository(this.db.getRawDb());

    const settings = this.settingsRepo.getSettings();

    // 4. Admin elevation check
    if (settings.administratorMode && !AdministratorService.isElevated()) {
      if (app.isPackaged) {
        this.logger.info('startup', 'Relaunching with elevated administrator privileges');
        AdministratorService.relaunchAsAdmin();
        return;
      } else {
        this.logger.info('startup', 'Running in development mode: elevation relaunch bypassed');
      }
    }

    // 5. Apply login item settings
    LoginItemService.apply(settings);

    // 6. Initialize services
    this.hotkeyService = new HotkeyService(this.hotkeyRepo, this.snippetRepo);
    this.windowsInput = new WindowsInputService();
    this.clipboardGuard = new ClipboardGuard();
    this.statsService = new StatisticsService(this.usageRepo);
    this.selectorService = new SelectorWindowService();

    this.expansionService = new ExpansionService(
      this.windowsInput,
      this.clipboardGuard,
      this.statsService,
      this.snippetRepo,
      this.selectorService
    );

    this.snippetService = new SnippetService(
      this.snippetRepo,
      this.hotkeyRepo,
      this.hotkeyService
    );

    this.trayService = new TrayService();

    // 7. Hotkey trigger wiring
    this.hotkeyService.setTriggerCallback((accelerator) => {
      this.expansionService.handleHotkeyTrigger(accelerator);
    });

    if (settings.hotkeysEnabled) {
      this.hotkeyService.rebuildAll();
    } else {
      this.hotkeyService.setSuspended(true);
      this.expansionService.setState('PAUSED');
    }

    // 8. Register IPC handlers
    registerIpcHandlers({
      snippetService: this.snippetService,
      hotkeyService: this.hotkeyService,
      statsService: this.statsService,
      settingsRepo: this.settingsRepo,
      expansionService: this.expansionService,
      selectorService: this.selectorService,
      trayService: this.trayService,
      onQuit: () => this.quit()
    });

    // 9. Init Tray
    this.trayService.init(settings, {
      onOpen: (tab) => this.showMainWindow(tab),
      onToggleHotkeys: (enabled) => {
        this.settingsRepo.saveSettings({ hotkeysEnabled: enabled });
        this.hotkeyService.setSuspended(!enabled);
        this.expansionService.setState(enabled ? 'READY' : 'PAUSED');
        this.trayService.updateMenu(enabled);
      },
      onQuit: () => this.quit()
    });

    // 10. Create Main Window
    this.createMainWindow();

    const isStartupLaunch = process.argv.includes('--hidden') || settings.startHidden;
    if (!isStartupLaunch) {
      this.showMainWindow();
    }

    // Handle app termination signals
    app.on('before-quit', () => {
      this.isQuitting = true;
    });

    app.on('will-quit', () => {
      this.shutdown();
    });
  }

  private createMainWindow(): void {
    const possibleIconPaths = [
      path.join(__dirname, '../../../src/assets/icon.ico'),
      path.join(__dirname, '../../assets/icon.ico'),
      path.join(__dirname, '../../../src/assets/app_png/icon-256x256.png'),
      path.join(__dirname, '../../assets/app_png/icon-256x256.png'),
      path.join(process.resourcesPath, 'assets/icon.ico')
    ];
    let appIconPath: string | undefined;
    for (const p of possibleIconPaths) {
      if (fs.existsSync(p)) {
        appIconPath = p;
        break;
      }
    }

    this.mainWindow = new BrowserWindow({
      width: 960,
      height: 680,
      minWidth: 780,
      minHeight: 520,
      show: false,
      title: 'Mis Frases',
      icon: appIconPath,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, '../../preload/preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    const mainHtmlPath = path.join(__dirname, '../../renderer/main/index.html');
    this.mainWindow.loadFile(mainHtmlPath);

    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });

    // Handle dev tools shortcut in development or when launched with --debug
    if (!app.isPackaged || process.argv.includes('--debug')) {
      this.mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' && input.type === 'keyDown') {
          this.mainWindow?.webContents.toggleDevTools();
          event.preventDefault();
        }
      });
    }

    // Handle external links securely
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https:') || url.startsWith('http:')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });
  }

  public showMainWindow(tab?: string): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      this.createMainWindow();
    }

    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();

      if (tab) {
        this.mainWindow.webContents.send('app:navigate-tab', tab);
      }
    }
  }

  public quit(): void {
    this.isQuitting = true;
    this.shutdown();
    app.quit();
  }

  public shutdown(): void {
    this.logger.info('shutdown', 'Application shutting down');
    this.expansionService?.setState('SHUTTING_DOWN');
    this.selectorService?.close();
    this.hotkeyService?.unregisterAll();
    this.trayService?.destroy();
    this.db?.close();
    this.logger.close();
  }
}
