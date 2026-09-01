import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';
import type {
  AppSettings,
  CreateSnippetInput,
  ExportBackupResult,
  ImportBackupResult,
  ReorderSnippetsInput,
  Snippet,
  SnippetStats,
  StatsSummary,
  UpdateCheckResult,
  UpdateSnippetInput,
  ValidateHotkeyResult
} from '../shared/types';

const appApi = {
  snippets: {
    list: (): Promise<Snippet[]> => ipcRenderer.invoke(IPC_CHANNELS.SNIPPETS_LIST),
    getById: (id: string): Promise<Snippet | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.SNIPPETS_GET_BY_ID, id),
    create: (input: CreateSnippetInput): Promise<Snippet> =>
      ipcRenderer.invoke(IPC_CHANNELS.SNIPPETS_CREATE, input),
    update: (input: UpdateSnippetInput): Promise<Snippet> =>
      ipcRenderer.invoke(IPC_CHANNELS.SNIPPETS_UPDATE, input),
    remove: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SNIPPETS_REMOVE, id),
    duplicate: (id: string): Promise<Snippet> =>
      ipcRenderer.invoke(IPC_CHANNELS.SNIPPETS_DUPLICATE, id),
    reorder: (input: ReorderSnippetsInput): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SNIPPETS_REORDER, input)
  },
  hotkeys: {
    validate: (accelerator: string): Promise<ValidateHotkeyResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.HOTKEYS_VALIDATE, { accelerator }),
    startRecording: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.HOTKEYS_START_RECORDING),
    stopRecording: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.HOTKEYS_STOP_RECORDING)
  },
  stats: {
    summary: (): Promise<StatsSummary> => ipcRenderer.invoke(IPC_CHANNELS.STATS_SUMMARY),
    bySnippet: (): Promise<SnippetStats[]> => ipcRenderer.invoke(IPC_CHANNELS.STATS_BY_SNIPPET)
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
    update: (input: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, input)
  },
  autoupdate: {
    check: (): Promise<UpdateCheckResult> => ipcRenderer.invoke(IPC_CHANNELS.AUTOUPDATE_CHECK)
  },
  backup: {
    export: (): Promise<ExportBackupResult> => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_EXPORT),
    import: (mode: 'merge' | 'replace' = 'merge'): Promise<ImportBackupResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_IMPORT, mode)
  },
  runtime: {
    pause: (): Promise<{ state: string }> => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_PAUSE),
    resume: (): Promise<{ state: string }> => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_RESUME),
    getState: (): Promise<{ state: string }> => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_GET_STATE),
    quit: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_QUIT)
  },
  selector: {
    getData: (): Promise<Snippet[]> => ipcRenderer.invoke(IPC_CHANNELS.SELECTOR_GET_DATA),
    select: (slot: number): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SELECTOR_SELECT, slot),
    cancel: (): Promise<{ success: boolean }> => ipcRenderer.invoke(IPC_CHANNELS.SELECTOR_CANCEL)
  },
  onNavigateTab: (callback: (tab: string) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, tab: string) => callback(tab);
    ipcRenderer.on('app:navigate-tab', subscription);
    return () => {
      ipcRenderer.removeListener('app:navigate-tab', subscription);
    };
  }
};

contextBridge.exposeInMainWorld('appApi', appApi);

export type AppApi = typeof appApi;
