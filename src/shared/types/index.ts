export type SlotNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface HotkeyGroup {
  id: string;
  accelerator: string;
  createdAt: number;
  updatedAt: number;
}

export interface Snippet {
  id: string;
  hotkeyGroupId: string;
  title: string;
  content: string;
  slot: SlotNumber;
  enabled: boolean;
  usageCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  // Computed or joined fields
  accelerator?: string;
}

export interface UsageEvent {
  id: number;
  snippetId: string;
  usedAt: number;
}

export interface AppSettings {
  launchAtLogin: boolean;
  administratorMode: boolean;
  hotkeysEnabled: boolean;
  startHidden: boolean;
}

export type AppState = 'STARTING' | 'READY' | 'PAUSED' | 'SELECTOR_OPEN' | 'EXPANDING' | 'SHUTTING_DOWN';

export type WindowHandle = number | bigint;

export interface ClipboardSnapshot {
  hasText: boolean;
  text?: string;
  hasHtml: boolean;
  html?: string;
  hasImage: boolean;
  formats: string[];
  sequenceNumber?: number;
}

export interface StatsSummary {
  totalExpansions: number;
  todayExpansions: number;
  last7DaysExpansions: number;
  last30DaysExpansions: number;
}

export interface SnippetStats {
  id: string;
  title: string;
  accelerator: string;
  slot: SlotNumber;
  totalUsage: number;
  usage7Days: number;
  usage30Days: number;
  lastUsedAt: number | null;
}

export interface CreateSnippetInput {
  title: string;
  content: string;
  accelerator: string;
  slot?: SlotNumber;
  enabled?: boolean;
}

export interface UpdateSnippetInput {
  id: string;
  title?: string;
  content?: string;
  accelerator?: string;
  slot?: SlotNumber;
  enabled?: boolean;
}

export interface ReorderSnippetsInput {
  hotkeyGroupId: string;
  orderedSnippetIds: string[];
}

export interface ValidateHotkeyResult {
  valid: boolean;
  normalized?: string;
  error?: string;
  conflict?: 'EXTERNAL' | 'APP_EXISTS' | null;
}
