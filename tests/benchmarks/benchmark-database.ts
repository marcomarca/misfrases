import { AppDatabase } from '../../src/main/database/Database';
import { HotkeyRepository } from '../../src/main/database/repositories/HotkeyRepository';
import { SnippetRepository } from '../../src/main/database/repositories/SnippetRepository';
import { UsageRepository } from '../../src/main/database/repositories/UsageRepository';
import type { CreateSnippetInput } from '../../src/shared/types';

export interface BenchmarkStats {
  operations: number;
  totalTimeMs: number;
  opsPerSecond: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

function calculateStats(latencies: number[]): BenchmarkStats {
  const sorted = [...latencies].sort((a, b) => a - b);
  const totalTimeMs = sorted.reduce((sum, val) => sum + val, 0);
  const operations = sorted.length;
  const p50Index = Math.floor(operations * 0.5);
  const p95Index = Math.floor(operations * 0.95);
  const p99Index = Math.floor(operations * 0.99);

  return {
    operations,
    totalTimeMs: Number(totalTimeMs.toFixed(2)),
    opsPerSecond: Math.round((operations / totalTimeMs) * 1000),
    minMs: Number(sorted[0].toFixed(4)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(4)),
    meanMs: Number((totalTimeMs / operations).toFixed(4)),
    p50Ms: Number(sorted[p50Index].toFixed(4)),
    p95Ms: Number(sorted[p95Index].toFixed(4)),
    p99Ms: Number(sorted[p99Index].toFixed(4))
  };
}

export async function runDatabaseBenchmark() {
  console.log('\n--- [1/3] BENCHMARK: Base de Datos SQLite (WAL Mode) ---');
  const db = new AppDatabase(':memory:');
  const hotkeyRepo = new HotkeyRepository(db.getRawDb());
  const snippetRepo = new SnippetRepository(db.getRawDb());
  const usageRepo = new UsageRepository(db.getRawDb());

  // 1. Benchmark Insertions (1,000 snippets in 100 hotkey groups)
  const INSERT_COUNT = 1000;
  const insertLatencies: number[] = [];

  for (let i = 1; i <= INSERT_COUNT; i++) {
    const groupIndex = Math.floor((i - 1) / 10) + 1;
    const group = hotkeyRepo.getOrCreate(`Ctrl+Alt+Key${groupIndex}`);

    const input = {
      hotkeyGroupId: group.id,
      title: `Prompt Template #${i}`,
      description: `Descripción para benchmark #${i}`,
      content: `Contenido de plantilla rápida para testing #${i} con parámetros {var}.`
    };

    const t0 = performance.now();
    snippetRepo.create(input);
    const t1 = performance.now();
    insertLatencies.push(t1 - t0);
  }

  const insertStats = calculateStats(insertLatencies);
  console.log(`✓ Inserción (${INSERT_COUNT} registros): ${insertStats.opsPerSecond.toLocaleString()} ops/seg (Media: ${insertStats.meanMs} ms, p95: ${insertStats.p95Ms} ms)`);

  // 2. Benchmark Hotkey Lookups (1,000 consultas complejas con JOIN)
  const LOOKUP_COUNT = 1000;
  const lookupLatencies: number[] = [];

  for (let i = 0; i < LOOKUP_COUNT; i++) {
    const targetHotkey = `Ctrl+Alt+Key${(i % 100) + 1}`;
    const t0 = performance.now();
    snippetRepo.listEnabledByAccelerator(targetHotkey);
    const t1 = performance.now();
    lookupLatencies.push(t1 - t0);
  }

  const lookupStats = calculateStats(lookupLatencies);
  console.log(`✓ Búsqueda por Hotkey (${LOOKUP_COUNT} lecturas): ${lookupStats.opsPerSecond.toLocaleString()} ops/seg (Media: ${lookupStats.meanMs} ms, p95: ${lookupStats.p95Ms} ms)`);

  // 3. Benchmark Usage Logging (1,000 registros de auditoría transaccional)
  const snippets = snippetRepo.listAll();
  const sampleId = snippets[0].id;
  const usageLatencies: number[] = [];

  for (let i = 0; i < 1000; i++) {
    const t0 = performance.now();
    usageRepo.recordUsage(sampleId);
    const t1 = performance.now();
    usageLatencies.push(t1 - t0);
  }

  const usageStats = calculateStats(usageLatencies);
  console.log(`✓ Registro Estadístico (1,000 inserciones): ${usageStats.opsPerSecond.toLocaleString()} ops/seg (Media: ${usageStats.meanMs} ms, p95: ${usageStats.p95Ms} ms)`);

  db.close();

  return {
    insertStats,
    lookupStats,
    usageStats
  };
}

if (import.meta.main || process.argv[1]?.includes('benchmark-database')) {
  runDatabaseBenchmark().then((res) => {
    if (process.argv.includes('--json')) {
      console.log('__JSON_START__' + JSON.stringify(res) + '__JSON_END__');
    }
  });
}
