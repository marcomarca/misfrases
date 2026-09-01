export const APP_NAME = 'MisFrases';

export const IPC_CHANNELS = {
  // Snippets
  SNIPPETS_LIST: 'snippets:list',
  SNIPPETS_GET_BY_ID: 'snippets:get-by-id',
  SNIPPETS_CREATE: 'snippets:create',
  SNIPPETS_UPDATE: 'snippets:update',
  SNIPPETS_REMOVE: 'snippets:remove',
  SNIPPETS_DUPLICATE: 'snippets:duplicate',
  SNIPPETS_REORDER: 'snippets:reorder',
  
  // Hotkeys
  HOTKEYS_VALIDATE: 'hotkeys:validate',
  HOTKEYS_START_RECORDING: 'hotkeys:start-recording',
  HOTKEYS_STOP_RECORDING: 'hotkeys:stop-recording',
  HOTKEYS_LIST_GROUPS: 'hotkeys:list-groups',

  // Stats
  STATS_SUMMARY: 'stats:summary',
  STATS_BY_SNIPPET: 'stats:by-snippet',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  // Runtime
  RUNTIME_PAUSE: 'runtime:pause',
  RUNTIME_RESUME: 'runtime:resume',
  RUNTIME_GET_STATE: 'runtime:get-state',
  RUNTIME_QUIT: 'runtime:quit',

  // Selector
  SELECTOR_SELECT: 'selector:select',
  SELECTOR_CANCEL: 'selector:cancel',
  SELECTOR_GET_DATA: 'selector:get-data',

  // Auto-Update
  AUTOUPDATE_CHECK: 'autoupdate:check',

  // Backup
  BACKUP_EXPORT: 'backup:export',
  BACKUP_IMPORT: 'backup:import'
} as const;

export const DEFAULT_SETTINGS = {
  launchAtLogin: false,
  administratorMode: false,
  hotkeysEnabled: true,
  startHidden: false,
  theme: 'dark'
} as const;

export const MAX_SLOTS = 10;
