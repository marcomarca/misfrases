import { app } from 'electron';

export class LoginItemService {
  /**
   * Configures Windows startup (Run registry) settings.
   * - In development (!app.isPackaged), prevents registering raw electron.exe without app parameters.
   * - When packaged (app.isPackaged), registers the app with '--hidden' so it starts minimized to tray in background.
   */
  public static apply(settings: { launchAtLogin: boolean; startHidden?: boolean }): void {
    try {
      if (!app.isPackaged) {
        app.setLoginItemSettings({
          openAtLogin: false
        });
        return;
      }

      app.setLoginItemSettings({
        openAtLogin: settings.launchAtLogin,
        path: process.execPath,
        args: ['--hidden']
      });
    } catch (err) {
      console.warn('Could not apply login item settings:', err);
    }
  }
}
