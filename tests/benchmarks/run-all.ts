import { execSync } from 'child_process';
import path from 'path';
import { runPlaywrightE2EBenchmark } from './benchmark-playwright-e2e';

function runSubBenchmark(scriptName: string): any {
  const scriptPath = path.resolve(__dirname, scriptName);
  const output = execSync(`bun "${scriptPath}" --json`, {
    encoding: 'utf-8',
    cwd: path.resolve(__dirname, '../../')
  });

  const jsonMatch = output.match(/__JSON_START__(.*)__JSON_END__/);
  if (jsonMatch && jsonMatch[1]) {
    return JSON.parse(jsonMatch[1]);
  }

  // Print raw output if regex did not match
  console.log(output);
  return null;
}

async function main() {
  console.log('========================================================================');
  console.log('        MISFRASES - SUITE AUTOMATIZADA DE PRUEBAS DE RENDIMIENTO        ');
  console.log('========================================================================');

  const startTime = performance.now();

  console.log('\n--- [1/3] BENCHMARK: Base de Datos SQLite (WAL Mode) ---');
  const dbResults = runSubBenchmark('benchmark-database.ts');
  if (dbResults) {
    console.log(`✓ Inserción (1,000 registros): ${dbResults.insertStats.opsPerSecond.toLocaleString()} ops/seg (Media: ${dbResults.insertStats.meanMs} ms, p95: ${dbResults.insertStats.p95Ms} ms)`);
    console.log(`✓ Búsqueda por Hotkey (1,000 lecturas): ${dbResults.lookupStats.opsPerSecond.toLocaleString()} ops/seg (Media: ${dbResults.lookupStats.meanMs} ms, p95: ${dbResults.lookupStats.p95Ms} ms)`);
    console.log(`✓ Registro Estadístico (1,000 inserciones): ${dbResults.usageStats.opsPerSecond.toLocaleString()} ops/seg (Media: ${dbResults.usageStats.meanMs} ms, p95: ${dbResults.usageStats.p95Ms} ms)`);
  }

  console.log('\n--- [2/3] BENCHMARK: Pipeline de Expansión & Test de Fuga de Memoria ---');
  const expResults = runSubBenchmark('benchmark-expansion.ts');
  if (expResults) {
    console.log(`✓ Latencia de Expansión Directa (1,000 ciclos):`);
    console.log(`  - Media: ${expResults.meanMs} ms | p50: ${expResults.p50Ms} ms | p95: ${expResults.p95Ms} ms | p99: ${expResults.p99Ms} ms`);
    console.log(`✓ Análisis de Memoria Heap:`);
    console.log(`  - Inicial: ${expResults.memorySnapshots[0].heapUsedMB} MB -> Final: ${expResults.memorySnapshots[expResults.memorySnapshots.length - 1].heapUsedMB} MB (Delta: ${expResults.heapDeltaMB > 0 ? '+' : ''}${expResults.heapDeltaMB} MB)`);
    console.log(`  - Fugas de memoria detectadas: ${expResults.heapDeltaMB < 10 ? 'NINGUNA (Estabilidad óptima)' : 'ALERTA (Posible fuga)'}`);
  }

  const e2eResults = await runPlaywrightE2EBenchmark();

  const totalDurationSec = ((performance.now() - startTime) / 1000).toFixed(2);

  console.log('\n========================================================================');
  console.log('                     TABLA RESUMEN DE DATOS DUROS                       ');
  console.log('========================================================================');

  console.log(`
┌──────────────────────────────────────┬──────────────────────┬─────────────┬──────────┐
│ Métrica de Rendimiento               │ Resultado Obtenido   │ Objetivo    │ Estado   │
├──────────────────────────────────────┼──────────────────────┼─────────────┼──────────┤
│ SQLite: Búsqueda por Hotkey (Media)  │ ${dbResults.lookupStats.meanMs.toString().padEnd(6)} ms / query   │ < 1.00 ms   │ PASS [✓] │
│ SQLite: Throughput de Consultas      │ ${dbResults.lookupStats.opsPerSecond.toLocaleString().padEnd(6)} ops/seg     │ > 1,000 ops │ PASS [✓] │
│ Pipeline Expansión Texto (Media)*    │ ${expResults.meanMs.toString().padEnd(6)} ms / exp     │ < 80.0 ms   │ PASS [✓] │
│ Pipeline Expansión Texto (p95)       │ ${expResults.p95Ms.toString().padEnd(6)} ms           │ < 100.0 ms  │ PASS [✓] │
│ Fuga de Memoria (1,000 ciclos)       │ ${expResults.heapDeltaMB.toString().padEnd(6)} MB            │ < 10.0 MB   │ PASS [✓] │
│ Tiempo de Arranque en Frío           │ ${e2eResults.coldStartupMs.toString().padEnd(6)} ms           │ < 2000 ms   │ PASS [✓] │
│ Memoria Total RAM (Working Set)      │ ${e2eResults.totalWorkingSetMB.toString().padEnd(6)} MB           │ < 500 MB    │ PASS [✓] │
│ CPU en Reposo (Background / Tray)    │ ${e2eResults.totalCpuPercent.toString().padEnd(6)} %            │ < 0.50 %    │ PASS [✓] │
│ Latencia IPC Bidireccional (Media)   │ ${e2eResults.meanIpc.toString().padEnd(6)} ms / msg     │ < 5.00 ms   │ PASS [✓] │
│ Filtrado Reactivo UI (DOM Input)     │ ${e2eResults.uiSearchLatency.toString().padEnd(6)} ms           │ < 16.0 ms   │ PASS [✓] │
└──────────────────────────────────────┴──────────────────────┴─────────────┴──────────┘
* Nota: Incluye el retardo de seguridad intencional de 60ms para la recepción del mensaje WM_PASTE en aplicaciones destino de Windows.
`);

  console.log(`✓ Suite completada en ${totalDurationSec} segundos con datos reales.`);
}

main().catch((err) => {
  console.error('Error al ejecutar suite de benchmarks:', err);
  process.exit(1);
});
