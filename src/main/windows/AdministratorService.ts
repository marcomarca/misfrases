import { execSync, spawn } from 'node:child_process';
import { app } from 'electron';

export class AdministratorService {
  public static isElevated(): boolean {
    if (process.platform !== 'win32') {
      return false;
    }
    try {
      // 'net session' exits with 0 if elevated, non-zero otherwise
      execSync('net session', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  public static relaunchAsAdmin(): boolean {
    if (process.platform !== 'win32') {
      return false;
    }

    const execPath = process.execPath;
    const cwd = process.cwd();
    const args = process.argv.slice(1).map((a) => (a === '.' ? `"${cwd}"` : `"${a}"`));

    const argList = args.length > 0 ? `-ArgumentList '${args.join(', ')}'` : '';
    const psCommand = `Start-Process -FilePath "${execPath}" ${argList} -WorkingDirectory "${cwd}" -Verb RunAs`;

    try {
      spawn('powershell.exe', ['-NoProfile', '-Command', psCommand], {
        detached: true,
        stdio: 'ignore'
      }).unref();

      app.exit(0);
      return true;
    } catch (err) {
      console.error('Failed to relaunch as administrator:', err);
      return false;
    }
  }
}
