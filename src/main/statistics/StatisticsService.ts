import type { UsageRepository } from '../database/repositories/UsageRepository';
import type { SnippetStats, StatsSummary } from '../../shared/types';

export class StatisticsService {
  constructor(private usageRepo: UsageRepository) {}

  public getSummary(): StatsSummary {
    return this.usageRepo.getSummary();
  }

  public getStatsBySnippet(): SnippetStats[] {
    return this.usageRepo.getStatsBySnippet();
  }

  public recordUsage(snippetId: string): void {
    this.usageRepo.recordUsage(snippetId);
  }
}
