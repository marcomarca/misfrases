import { AppDatabase } from '../../src/main/database/Database';
import { HotkeyRepository } from '../../src/main/database/repositories/HotkeyRepository';
import { SnippetRepository } from '../../src/main/database/repositories/SnippetRepository';
import { UsageRepository } from '../../src/main/database/repositories/UsageRepository';
import { StatisticsService } from '../../src/main/statistics/StatisticsService';
import { ExpansionService } from '../../src/main/expansion/ExpansionService';
import type { IWindowsInputService } from '../../src/main/windows/WindowsInputService';
import type { IClipboardGuard } from '../../src/main/windows/ClipboardGuard';
import type { SelectorWindowService } from '../../src/main/popup/SelectorWindowService';
import type { ClipboardSnapshot, WindowHandle } from '../../src/shared/types';

class MockWindowsInput implements IWindowsInputService {
  public getForegroundWindow(): WindowHandle {
    return 1001;
  }
  public isWindow(_hwnd: WindowHandle): boolean {
    return true;
  }
  public async restoreForegroundWindow(_hwnd: WindowHandle): Promise<boolean> {
    return true;
  }
  public async waitForModifiersReleased(): Promise<void> {
    return;
  }
  public sendPaste(): boolean {
    return true;
  }
  public sendUnicode(_text: string): boolean {
    return true;
  }
}

class MockClipboardGuard implements IClipboardGuard {
  public canSnapshotSafely(): boolean {
    return true;
  }
  public snapshot(): ClipboardSnapshot {
    return {
      hasText: true,
      text: 'Texto previo del usuario',
      hasHtml: false,
      hasImage: false,
      formats: ['text/plain']
    };
  }
  public setTemporaryText(_text: string): void {
    return;
  }
  public restoreSnapshot(_snapshot: ClipboardSnapshot): void {
    return;
  }
}

class MockSelectorService {
  public setCallbacks(_onSelect: any, _onCancel: any): void {}
  public open(_targetHwnd: any, _snippets: any): void {}
  public close(): void {}
  public isOpen(): boolean {
    return false;
  }
}

export async function runExpansionBenchmark() {
  console.log('\n--- [2/3] BENCHMARK: Pipeline de Expansión & Test de Fuga de Memoria ---');
  const db = new AppDatabase(':memory:');
  const hotkeyRepo = new HotkeyRepository(db.getRawDb());
  const snippetRepo = new SnippetRepository(db.getRawDb());
  const usageRepo = new UsageRepository(db.getRawDb());
  const statsService = new StatisticsService(usageRepo);

  const mockInput = new MockWindowsInput();
  const mockClipboard = new MockClipboardGuard();
  const mockSelector = new MockSelectorService() as unknown as SelectorWindowService;

  const expansionService = new ExpansionService(
    mockInput,
    mockClipboard,
    statsService,
    snippetRepo,
    mockSelector
  );

  // Create sample snippets
  const group = hotkeyRepo.create('Ctrl+Alt+M');
  const snippet1 = snippetRepo.create({
    hotkeyGroupId: group.id,
    title: 'Plantilla de Correo',
    description: 'Plantilla rápida de email',
    content: 'Hola {nombre}, te escribo para dar seguimiento a la propuesta.'
  });

  const ITERATIONS = 1000;
  const latencies: number[] = [];

  // Measure initial memory
  if (global.gc) {
    global.gc();
  }
  const initialMem = process.memoryUsage();

  const memorySnapshots: { iteration: number; heapUsedMB: number }[] = [];
  memorySnapshots.push({
    iteration: 0,
    heapUsedMB: Number((initialMem.heapUsed / 1024 / 1024).toFixed(2))
  });

  for (let i = 1; i <= ITERATIONS; i++) {
    const t0 = performance.now();
    await expansionService.handleHotkeyTrigger('Ctrl+Alt+M');
    const t1 = performance.now();
    latencies.push(t1 - t0);

    if (i % 250 === 0) {
      const currentMem = process.memoryUsage();
      memorySnapshots.push({
        iteration: i,
        heapUsedMB: Number((currentMem.heapUsed / 1024 / 1024).toFixed(2))
      });
    }
  }

  if (global.gc) {
    global.gc();
  }
  const finalMem = process.memoryUsage();
  const heapDeltaMB = Number(((finalMem.heapUsed - initialMem.heapUsed) / 1024 / 1024).toFixed(2));

  const sorted = [...latencies].sort((a, b) => a - b);
  const totalMs = sorted.reduce((sum, v) => sum + v, 0);
  const meanMs = Number((totalMs / ITERATIONS).toFixed(4));
  const p50Ms = Number(sorted[Math.floor(ITERATIONS * 0.5)].toFixed(4));
  const p95Ms = Number(sorted[Math.floor(ITERATIONS * 0.95)].toFixed(4));
  const p99Ms = Number(sorted[Math.floor(ITERATIONS * 0.99)].toFixed(4));

  console.log(`✓ Latencia de Expansión Directa (${ITERATIONS} ciclos):`);
  console.log(`  - Media: ${meanMs} ms | p50: ${p50Ms} ms | p95: ${p95Ms} ms | p99: ${p99Ms} ms`);
  console.log(`  - Throughput: ${Math.round((ITERATIONS / totalMs) * 1000).toLocaleString()} expansiones/seg`);
  console.log(`✓ Análisis de Memoria Heap:`);
  console.log(`  - Inicial: ${memorySnapshots[0].heapUsedMB} MB -> Final: ${(finalMem.heapUsed / 1024 / 1024).toFixed(2)} MB (Delta: ${heapDeltaMB > 0 ? '+' : ''}${heapDeltaMB} MB)`);
  console.log(`  - Fugas de memoria detectadas: ${heapDeltaMB < 10 ? 'NINGUNA (Estabilidad óptima)' : 'ALERTA (Posible fuga)'}`);

  db.close();

  return {
    iterations: ITERATIONS,
    meanMs,
    p50Ms,
    p95Ms,
    p99Ms,
    heapDeltaMB,
    memorySnapshots
  };
}

if (import.meta.main || process.argv[1]?.includes('benchmark-expansion')) {
  runExpansionBenchmark().then((res) => {
    if (process.argv.includes('--json')) {
      console.log('__JSON_START__' + JSON.stringify(res) + '__JSON_END__');
    }
  });
}
