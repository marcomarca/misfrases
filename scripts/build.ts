import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

console.log('Compiling TypeScript...');
execSync('tsc', { stdio: 'inherit' });

console.log('Bundling preload script for Electron sandbox...');
const preloadEntry = path.join(__dirname, '../src/preload/preload.ts');
const preloadOutDir = path.join(__dirname, '../dist/preload');
fs.mkdirSync(preloadOutDir, { recursive: true });

await Bun.build({
  entrypoints: [preloadEntry],
  outdir: preloadOutDir,
  naming: 'preload.js',
  target: 'browser',
  format: 'cjs',
  external: ['electron']
});

console.log('Bundling renderer scripts for browser...');
const mainRendererEntry = path.join(__dirname, '../src/renderer/main/app.ts');
const selectorRendererEntry = path.join(__dirname, '../src/renderer/selector/selector.ts');

const mainOutDir = path.join(__dirname, '../dist/renderer/main');
const selectorOutDir = path.join(__dirname, '../dist/renderer/selector');

// Ensure output directories exist
fs.mkdirSync(mainOutDir, { recursive: true });
fs.mkdirSync(selectorOutDir, { recursive: true });

// Bundle with Bun.build
await Bun.build({
  entrypoints: [mainRendererEntry],
  outdir: mainOutDir,
  naming: 'app.js',
  target: 'browser',
  format: 'iife'
});

await Bun.build({
  entrypoints: [selectorRendererEntry],
  outdir: selectorOutDir,
  naming: 'selector.js',
  target: 'browser',
  format: 'iife'
});

console.log('Copying renderer HTML and CSS assets...');
const srcRenderer = path.join(__dirname, '../src/renderer');
const distRenderer = path.join(__dirname, '../dist/renderer');

if (fs.existsSync(srcRenderer)) {
  fs.cpSync(srcRenderer, distRenderer, {
    recursive: true,
    force: true,
    filter: (src) => !src.endsWith('.ts')
  });
}

console.log('Build completed successfully.');
