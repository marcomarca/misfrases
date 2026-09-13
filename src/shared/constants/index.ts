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

  // Context Blocks
  CONTEXT_BLOCKS_LIST: 'context-blocks:list',
  CONTEXT_BLOCKS_GET: 'context-blocks:get',
  CONTEXT_BLOCKS_CREATE: 'context-blocks:create',
  CONTEXT_BLOCKS_UPDATE: 'context-blocks:update',
  CONTEXT_BLOCKS_REMOVE: 'context-blocks:remove',

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
  SELECTOR_PASTE_CONTEXT: 'selector:paste-context',

  // Auto-Update
  AUTOUPDATE_CHECK: 'autoupdate:check',
  AUTOUPDATE_GET_VERSION: 'autoupdate:get-version',

  // Backup
  BACKUP_EXPORT: 'backup:export',
  BACKUP_IMPORT: 'backup:import',

  // Window Controls
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized'
} as const;

export const DEFAULT_SETTINGS = {
  launchAtLogin: false,
  administratorMode: false,
  hotkeysEnabled: true,
  startHidden: false,
  theme: 'dark'
} as const;

export const MAX_SLOTS = 10;
