import type { IDatabase } from '../Database';
import type { AppSettings } from '../../../shared/types';
import { DEFAULT_SETTINGS } from '../../../shared/constants';

export class SettingsRepository {
  private static SETTINGS_KEY = 'app_settings';

  constructor(private db: IDatabase) {}

  public getSettings(): AppSettings {
    const row = this.db
      .prepare('SELECT value_json FROM settings WHERE key = ?')
      .get(SettingsRepository.SETTINGS_KEY) as { value_json: string } | undefined;

    if (!row) {
      return { ...DEFAULT_SETTINGS };
    }

    try {
      const parsed = JSON.parse(row.value_json);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  public saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated: AppSettings = {
      ...current,
      ...settings
    };

    const now = Date.now();
    this.db
      .prepare(`
        INSERT INTO settings (key, value_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = excluded.updated_at
      `)
      .run(SettingsRepository.SETTINGS_KEY, JSON.stringify(updated), now);

    return updated;
  }
}
