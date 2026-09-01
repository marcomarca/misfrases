import { app, dialog } from 'electron';
import { updateElectronApp, UpdateSourceType, type IUpdateInfo } from 'update-electron-app';
import { LoggerService } from '../logging/LoggerService';
import type { UpdateCheckResult } from '../../shared/types';

export class AutoUpdateService {
  private static logger = LoggerService.getInstance();
  private static isInitialized = false;

  /**
   * Initializes automatic background updates for the application.
   * - Only active in production builds (app.isPackaged).
   * - Checks GitHub Releases periodically (every 2 hours).
   * - Downloads delta packages silently in the background.
   * - Prompts the user with a localized dialog when ready to restart.
   */
  public static init(): void {
    if (this.isInitialized) {
      return;
    }

    if (!app.isPackaged || process.env.NODE_ENV === 'test') {
      this.logger.info('autoupdate', 'Auto-update bypassed: Running in development or test environment');
      return;
    }

    try {
      updateElectronApp({
        updateSource: {
          type: UpdateSourceType.ElectronPublicUpdateService,
          repo: 'marcomarca/misfrases'
        },
        updateInterval: '2 hours',
        logger: {
          log: (msg: string) => this.logger.info('autoupdate', msg),
          info: (msg: string) => this.logger.info('autoupdate', msg),
          warn: (msg: string) => this.logger.warn('autoupdate', msg),
          error: (msg: string) => this.logger.error('autoupdate', msg)
        },
        notifyUser: true,
        onNotifyUser: (info: IUpdateInfo) => {
          this.logger.info('autoupdate', `Update ready: ${info.releaseName || 'nueva versión'}`);
          
          dialog
            .showMessageBox({
              type: 'info',
              buttons: ['Reiniciar y actualizar', 'Más tarde'],
              defaultId: 0,
              cancelId: 1,
              title: 'Actualización disponible',
              message: 'Una nueva versión de Mis Frases ha sido descargada.',
              detail: `La versión ${info.releaseName || ''} está lista para aplicarse.\n¿Deseas reiniciar la aplicación ahora para completar la actualización?`
            })
            .then((returnValue) => {
              if (returnValue.response === 0) {
                this.logger.info('autoupdate', 'User accepted restart. Quitting and installing update.');
                const { autoUpdater } = require('electron');
                autoUpdater.quitAndInstall();
              } else {
                this.logger.info('autoupdate', 'User deferred restart. Update will apply on next app restart.');
              }
            })
            .catch((err) => {
              this.logger.error('autoupdate', 'Error displaying update dialog', err as Error);
            });
        }
      });

      this.isInitialized = true;
      this.logger.info('autoupdate', 'Servicio de actualización automática inicializado correctamente');
    } catch (err) {
      this.logger.error('autoupdate', 'Error al inicializar el servicio de actualización', err as Error);
    }
  }

  /**
   * Checks if the app was launched from a Squirrel.Windows installed location.
   */
  public static isSquirrelInstalled(): boolean {
    if (process.platform !== 'win32') return false;
    try {
      const path = require('node:path');
      const fs = require('node:fs');
      const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
      return fs.existsSync(updateExe);
    } catch {
      return false;
    }
  }

  /**
   * Manually checks for updates and returns the status result.
   */
  public static async checkForUpdatesManual(): Promise<UpdateCheckResult> {
    const currentVersion = app.getVersion();

    // If Squirrel is not installed (e.g. running unpacked folder, portable zip, or dev mode),
    // query GitHub Releases directly without triggering the 'Can not find Squirrel' error.
    if (!this.isSquirrelInstalled()) {
      return this.checkGitHubReleasesFallback(currentVersion);
    }

    try {
      const { autoUpdater } = require('electron');

      return new Promise<UpdateCheckResult>((resolve) => {
        let isResolved = false;

        const cleanup = () => {
          autoUpdater.removeListener('update-available', onAvailable);
          autoUpdater.removeListener('update-not-available', onNotAvailable);
          autoUpdater.removeListener('error', onError);
        };

        const onAvailable = () => {
          if (isResolved) return;
          isResolved = true;
          cleanup();
          resolve({
            status: 'downloading',
            currentVersion,
            message: 'Hay una nueva versión disponible y se está descargando en segundo plano.'
          });
        };

        const onNotAvailable = () => {
          if (isResolved) return;
          isResolved = true;
          cleanup();
          resolve({
            status: 'up_to_date',
            currentVersion,
            message: 'Ya tienes instalada la versión más reciente de Mis Frases.'
          });
        };

        const onError = async (err: Error) => {
          if (isResolved) return;
          isResolved = true;
          cleanup();
          // If Squirrel throws an error, fallback to GitHub check
          const fallback = await AutoUpdateService.checkGitHubReleasesFallback(currentVersion);
          resolve(fallback);
        };

        autoUpdater.once('update-available', onAvailable);
        autoUpdater.once('update-not-available', onNotAvailable);
        autoUpdater.once('error', onError);

        // Fallback safety timeout after 8s
        setTimeout(async () => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            const fallback = await AutoUpdateService.checkGitHubReleasesFallback(currentVersion);
            resolve(fallback);
          }
        }, 8000);

        autoUpdater.checkForUpdates();
      });
    } catch {
      return this.checkGitHubReleasesFallback(currentVersion);
    }
  }

  /**
   * Directly queries the GitHub Releases API to verify updates when Squirrel is not available.
   */
  private static async checkGitHubReleasesFallback(currentVersion: string): Promise<UpdateCheckResult> {
    try {
      const https = require('node:https');
      const url = 'https://api.github.com/repos/marcomarca/misfrases/releases/latest';

      const data: any = await new Promise((resolve, reject) => {
        const req = https.get(
          url,
          { headers: { 'User-Agent': 'MisFrases-App' } },
          (res: any) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              return reject(new Error(`HTTP ${res.statusCode}`));
            }
            let raw = '';
            res.on('data', (chunk: any) => (raw += chunk));
            res.on('end', () => {
              try {
                resolve(JSON.parse(raw));
              } catch (e) {
                reject(e);
              }
            });
          }
        );
        req.on('error', reject);
        req.setTimeout(6000, () => req.destroy(new Error('Timeout')));
      });

      const latestTag: string = data.tag_name || '';
      const latestVersion = latestTag.replace(/^v/, '');

      const isNewer = this.compareSemver(latestVersion, currentVersion) > 0;

      if (isNewer) {
        return {
          status: 'update_available',
          currentVersion,
          latestVersion: latestTag,
          message: `Nueva versión ${latestTag} disponible en GitHub.`
        };
      }

      return {
        status: 'up_to_date',
        currentVersion,
        latestVersion: latestTag,
        message: 'Ya tienes instalada la versión más reciente de Mis Frases.'
      };
    } catch {
      return {
        status: 'up_to_date',
        currentVersion,
        message: 'No se encontraron actualizaciones pendientes.'
      };
    }
  }

  private static compareSemver(v1: string, v2: string): number {
    const clean1 = v1.replace(/^v/, '').split('.').map(Number);
    const clean2 = v2.replace(/^v/, '').split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const num1 = clean1[i] || 0;
      const num2 = clean2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }
}

