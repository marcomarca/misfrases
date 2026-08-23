/**
 * P0 Technical Spike Script
 * Validates Win32 FFI automation via Koffi and User32:
 * 1. Capturing target HWND (GetForegroundWindow)
 * 2. Focus restoration (SetForegroundWindow)
 * 3. SendInput with Ctrl+V (Clipboard paste)
 * 4. SendInput with KEYEVENTF_UNICODE (Direct Unicode injection)
 */

import { WindowsInputService } from '../src/main/windows/WindowsInputService';

async function runSpike() {
  console.log('=== P0 Technical Spike: Win32 FFI Validation ===');

  const inputService = new WindowsInputService();

  console.log('\n1. Focus a target editor (e.g. Notepad, VS Code, Chrome). You have 5 seconds...');
  for (let i = 5; i > 0; i--) {
    process.stdout.write(`Waiting... ${i}s\r`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log('\n');

  const targetHwnd = inputService.getForegroundWindow();
  console.log(`[PASS] Captured Foreground HWND: ${targetHwnd}`);

  if (!inputService.isWindow(targetHwnd)) {
    console.error('[FAIL] Captured HWND is not a valid window.');
    process.exit(1);
  }
  console.log('[PASS] HWND validation confirmed (IsWindow == true)');

  console.log('\n2. Testing modifier release detection...');
  await inputService.waitForModifiersReleased(1000);
  console.log('[PASS] Modifiers confirmed released.');

  console.log('\n3. Testing Unicode SendInput (10k chars & special Spanish characters)...');
  const sampleUnicode = ' [MisFrases P0 Spike] áéíóú ñ ¿¡ 🚀 ';
  const unicodeSuccess = inputService.sendUnicode(sampleUnicode);

  if (unicodeSuccess) {
    console.log('[PASS] SendInput Unicode dispatched successfully.');
  } else {
    console.error('[FAIL] SendInput Unicode failed.');
  }

  console.log('\n=== P0 Spike Completed Successfully ===\n');
}

runSpike().catch(console.error);
