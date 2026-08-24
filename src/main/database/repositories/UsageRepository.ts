import type { IDatabase } from '../Database';
import type { SlotNumber, SnippetStats, StatsSummary } from '../../../shared/types';

export class UsageRepository {
  constructor(private db: IDatabase) {}

  public recordUsage(snippetId: string, timestamp = Date.now()): void {
    const tx = this.db.transaction(() => {
      this.db
        .prepare('INSERT INTO usage_events (snippet_id, used_at) VALUES (?, ?)')
        .run(snippetId, timestamp);

      this.db
        .prepare(`
          UPDATE snippets
          SET usage_count = usage_count + 1,
              last_used_at = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .run(timestamp, timestamp, snippetId);
    });

    tx();
  }

  public getSummary(): StatsSummary {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTs = startOfToday.getTime();
    const sevenDaysAgoTs = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoTs = now - 30 * 24 * 60 * 60 * 1000;

    const totalRow = this.db
      .prepare('SELECT COUNT(*) as count FROM usage_events')
      .get() as { count: number };

    const todayRow = this.db
      .prepare('SELECT COUNT(*) as count FROM usage_events WHERE used_at >= ?')
      .get(todayTs) as { count: number };

    const sevenDaysRow = this.db
      .prepare('SELECT COUNT(*) as count FROM usage_events WHERE used_at >= ?')
      .get(sevenDaysAgoTs) as { count: number };

    const thirtyDaysRow = this.db
      .prepare('SELECT COUNT(*) as count FROM usage_events WHERE used_at >= ?')
      .get(thirtyDaysAgoTs) as { count: number };

    return {
      totalExpansions: totalRow.count,
      todayExpansions: todayRow.count,
      last7DaysExpansions: sevenDaysRow.count,
      last30DaysExpansions: thirtyDaysRow.count
    };
  }

  public getStatsBySnippet(): SnippetStats[] {
    const now = Date.now();
    const sevenDaysAgoTs = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoTs = now - 30 * 24 * 60 * 60 * 1000;

    const query = `
      SELECT
        s.id,
        s.title,
        s.description,
        s.slot,
        s.usage_count as totalUsage,
        s.last_used_at as lastUsedAt,
        hg.accelerator,
        (
          SELECT COUNT(*)
          FROM usage_events ue
          WHERE ue.snippet_id = s.id AND ue.used_at >= ?
        ) as usage7Days,
        (
          SELECT COUNT(*)
          FROM usage_events ue
          WHERE ue.snippet_id = s.id AND ue.used_at >= ?
        ) as usage30Days
      FROM snippets s
      JOIN hotkey_groups hg ON s.hotkey_group_id = hg.id
      WHERE s.deleted_at IS NULL
      ORDER BY s.usage_count DESC, s.title ASC
    `;

    interface Row {
      id: string;
      title: string;
      description: string;
      slot: number;
      totalUsage: number;
      lastUsedAt: number | null;
      accelerator: string;
      usage7Days: number;
      usage30Days: number;
    }

    const rows = this.db.prepare(query).all(sevenDaysAgoTs, thirtyDaysAgoTs) as Row[];

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description || '',
      accelerator: r.accelerator,
      slot: r.slot as SlotNumber,
      totalUsage: r.totalUsage,
      usage7Days: r.usage7Days,
      usage30Days: r.usage30Days,
      lastUsedAt: r.lastUsedAt
    }));
  }
}
