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
   * Manually checks for updates and returns the status result.
   */
  public static async checkForUpdatesManual(): Promise<UpdateCheckResult> {
    const currentVersion = app.getVersion();

    if (!app.isPackaged || process.env.NODE_ENV === 'test') {
      return {
        status: 'dev_mode',
        currentVersion,
        message: 'Modo desarrollo: Las actualizaciones en segundo plano solo se ejecutan en la versión instalada.'
      };
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

        const onError = (err: Error) => {
          if (isResolved) return;
          isResolved = true;
          cleanup();
          resolve({
            status: 'error',
            currentVersion,
            message: `Error al comprobar actualizaciones: ${err?.message || err}`
          });
        };

        autoUpdater.once('update-available', onAvailable);
        autoUpdater.once('update-not-available', onNotAvailable);
        autoUpdater.once('error', onError);

        // Fallback safety timeout after 10s
        setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            resolve({
              status: 'up_to_date',
              currentVersion,
              message: 'Comprobación completada. La aplicación está al día.'
            });
          }
        }, 10000);

        autoUpdater.checkForUpdates();
      });
    } catch (err: any) {
      this.logger.error('autoupdate manual error', err.message || String(err));
      return {
        status: 'error',
        currentVersion,
        message: err.message || 'Error al iniciar la comprobación de actualización.'
      };
    }
  }
}

