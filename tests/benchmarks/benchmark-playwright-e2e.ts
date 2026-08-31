import { _electron as electron } from 'playwright';
import path from 'path';

export interface ProcessMetricSummary {
  type: string;
  pid: number;
  cpuPercent: number;
  memoryWorkingSetKB: number;
  memoryPrivateKB: number;
}

export async function runPlaywrightE2EBenchmark() {
  console.log('\n--- [3/3] BENCHMARK: Electron E2E & Métricas de Procesos en Vivo (Playwright) ---');

  const mainPath = path.resolve(__dirname, '../../dist/main/main.js');
  const t0 = performance.now();

  const electronApp = await electron.launch({
    args: [mainPath],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });

  // 1. Cold Startup Latency
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  const coldStartupMs = Number((performance.now() - t0).toFixed(2));
  console.log(`✓ Cold Startup Latency (Arranque en frío): ${coldStartupMs} ms`);

  // 2. Electron Real Process Resource Metrics
  // Wait a moment for processes to settle into idle
  await new Promise((r) => setTimeout(r, 1000));

  const rawMetrics = await electronApp.evaluate(async ({ app }) => {
    return app.getAppMetrics().map((m) => ({
      type: m.type,
      pid: m.pid,
      cpuPercent: m.cpu.percentCPUUsage,
      memoryWorkingSetKB: m.memory.workingSetSize,
      memoryPrivateKB: m.memory.privateBytes
    }));
  });

  let totalWorkingSetMB = 0;
  let totalPrivateMB = 0;
  let totalCpuPercent = 0;

  console.log('✓ Métricas de Procesos Electron en Tiempo Real:');
  for (const m of rawMetrics) {
    const wsMB = Number((m.memoryWorkingSetKB / 1024).toFixed(2));
    const privMB = Number((m.memoryPrivateKB / 1024).toFixed(2));
    totalWorkingSetMB += wsMB;
    totalPrivateMB += privMB;
    totalCpuPercent += m.cpuPercent;
    console.log(`  - [${m.type.toUpperCase()}] PID ${m.pid}: RAM Working Set: ${wsMB} MB | Privada: ${privMB} MB | CPU: ${m.cpuPercent.toFixed(1)}%`);
  }
  console.log(`  -> TOTAL RAM (Working Set): ${totalWorkingSetMB.toFixed(2)} MB | CPU en Reposo: ${totalCpuPercent.toFixed(2)}%`);

  // 3. IPC Roundtrip Latency (100 roundtrips from Renderer to Main)
  const ipcLatencies = await window.evaluate(async () => {
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const tStart = performance.now();
      await (window as any).appApi.snippets.list();
      times.push(performance.now() - tStart);
    }
    return times;
  });

  const sortedIpc = [...ipcLatencies].sort((a, b) => a - b);
  const meanIpc = Number((sortedIpc.reduce((a, b) => a + b, 0) / 100).toFixed(3));
  const p50Ipc = Number(sortedIpc[50].toFixed(3));
  const p95Ipc = Number(sortedIpc[95].toFixed(3));
  console.log(`✓ Latencia IPC Bidireccional (100 llamadas Renderer -> Main):`);
  console.log(`  - Media: ${meanIpc} ms | p50: ${p50Ipc} ms | p95: ${p95Ipc} ms | Throughput: ${Math.round(1000 / meanIpc).toLocaleString()} llamadas/seg`);

  // 4. UI DOM Filtering Latency
  const uiSearchLatency = await window.evaluate(async () => {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (!searchInput) return 0;
    const tStart = performance.now();
    searchInput.value = 'Plantilla';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    return performance.now() - tStart;
  });
  console.log(`✓ Latencia de Filtrado Reactivo en UI: ${uiSearchLatency.toFixed(2)} ms`);

  await electronApp.close();

  return {
    coldStartupMs,
    totalWorkingSetMB: Number(totalWorkingSetMB.toFixed(2)),
    totalPrivateMB: Number(totalPrivateMB.toFixed(2)),
    totalCpuPercent: Number(totalCpuPercent.toFixed(2)),
    meanIpc,
    p95Ipc,
    uiSearchLatency: Number(uiSearchLatency.toFixed(2))
  };
}

if (process.argv[1]?.includes('benchmark-playwright-e2e') || (import.meta as any).main) {
  runPlaywrightE2EBenchmark().catch(console.error);
}
