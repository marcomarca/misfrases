import { execSync } from 'node:child_process';

if (process.platform === 'win32') {
  try {
    execSync('taskkill /F /IM mis-frases.exe', { stdio: 'ignore' });
  } catch {
    // Process was not running, ignore
  }
}
