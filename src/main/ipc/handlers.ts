import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import {
  CreateSnippetSchema,
  ReorderSnippetsSchema,
  UpdateSettingsSchema,
  UpdateSnippetSchema,
  ValidateHotkeySchema
} from '../../shared/schemas';
import type { SnippetService } from '../snippets/SnippetService';
import type { HotkeyService } from '../hotkeys/HotkeyService';
import type { StatisticsService } from '../statistics/StatisticsService';
import type { SettingsRepository } from '../database/repositories/SettingsRepository';
import type { ExpansionService } from '../expansion/ExpansionService';
import type { SelectorWindowService } from '../popup/SelectorWindowService';
import type { TrayService } from '../tray/TrayService';

export interface IpcServices {
  snippetService: SnippetService;
  hotkeyService: HotkeyService;
  statsService: StatisticsService;
  settingsRepo: SettingsRepository;
  expansionService: ExpansionService;
  selectorService: SelectorWindowService;
  trayService: TrayService;
  onQuit: () => void;
}

export function registerIpcHandlers(services: IpcServices): void {
  // Snippets
  ipcMain.handle(IPC_CHANNELS.SNIPPETS_LIST, async () => {
    return services.snippetService.listAll();
  });

  ipcMain.handle(IPC_CHANNELS.SNIPPETS_GET_BY_ID, async (_, id: string) => {
    return services.snippetService.getById(id);
  });

  ipcMain.handle(IPC_CHANNELS.SNIPPETS_CREATE, async (_, rawInput: unknown) => {
    const validated = CreateSnippetSchema.parse(rawInput);
    return services.snippetService.create(validated);
  });

  ipcMain.handle(IPC_CHANNELS.SNIPPETS_UPDATE, async (_, rawInput: unknown) => {
    const validated = UpdateSnippetSchema.parse(rawInput);
    return services.snippetService.update(validated);
  });

  ipcMain.handle(IPC_CHANNELS.SNIPPETS_REMOVE, async (_, id: string) => {
    services.snippetService.remove(id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SNIPPETS_DUPLICATE, async (_, id: string) => {
    return services.snippetService.duplicate(id);
  });

  ipcMain.handle(IPC_CHANNELS.SNIPPETS_REORDER, async (_, rawInput: unknown) => {
    const validated = ReorderSnippetsSchema.parse(rawInput);
    services.snippetService.reorder(validated);
    return { success: true };
  });

  // Hotkeys
  ipcMain.handle(IPC_CHANNELS.HOTKEYS_VALIDATE, async (_, rawInput: unknown) => {
    const validated = ValidateHotkeySchema.parse(rawInput);
    return services.hotkeyService.validateHotkey(validated.accelerator);
  });

  ipcMain.handle(IPC_CHANNELS.HOTKEYS_START_RECORDING, async () => {
    services.hotkeyService.setSuspended(true);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.HOTKEYS_STOP_RECORDING, async () => {
    const settings = services.settingsRepo.getSettings();
    services.hotkeyService.setSuspended(!settings.hotkeysEnabled);
    return { success: true };
  });

  // Stats
  ipcMain.handle(IPC_CHANNELS.STATS_SUMMARY, async () => {
    return services.statsService.getSummary();
  });

  ipcMain.handle(IPC_CHANNELS.STATS_BY_SNIPPET, async () => {
    return services.statsService.getStatsBySnippet();
  });

  // Settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    return services.settingsRepo.getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, async (_, rawInput: unknown) => {
    const validated = UpdateSettingsSchema.parse(rawInput);
    const updated = services.settingsRepo.saveSettings(validated);

    if (validated.hotkeysEnabled !== undefined) {
      services.hotkeyService.setSuspended(!validated.hotkeysEnabled);
      services.expansionService.setState(validated.hotkeysEnabled ? 'READY' : 'PAUSED');
      services.trayService.updateMenu(validated.hotkeysEnabled);
    }

    if (validated.launchAtLogin !== undefined || validated.startHidden !== undefined) {
      try {
        const { app } = require('electron');
        app.setLoginItemSettings({
          openAtLogin: updated.launchAtLogin,
          openAsHidden: updated.startHidden
        });
      } catch (err) {
        console.warn('Could not update login item settings:', err);
      }
    }

    return updated;
  });

  // Runtime
  ipcMain.handle(IPC_CHANNELS.RUNTIME_PAUSE, async () => {
    services.settingsRepo.saveSettings({ hotkeysEnabled: false });
    services.hotkeyService.setSuspended(true);
    services.expansionService.setState('PAUSED');
    services.trayService.updateMenu(false);
    return { state: 'PAUSED' };
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_RESUME, async () => {
    services.settingsRepo.saveSettings({ hotkeysEnabled: true });
    services.hotkeyService.setSuspended(false);
    services.expansionService.setState('READY');
    services.trayService.updateMenu(true);
    return { state: 'READY' };
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_GET_STATE, async () => {
    return { state: services.expansionService.getState() };
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_QUIT, async () => {
    services.onQuit();
    return { success: true };
  });

  // Selector
  ipcMain.handle(IPC_CHANNELS.SELECTOR_GET_DATA, async () => {
    return services.selectorService.getCurrentSnippets();
  });

  ipcMain.handle(IPC_CHANNELS.SELECTOR_SELECT, async (_, slot: number) => {
    services.selectorService.selectSlot(slot);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SELECTOR_CANCEL, async () => {
    services.selectorService.cancel();
    return { success: true };
  });
}
