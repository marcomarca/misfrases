import { app, dialog } from 'electron';
import { updateElectronApp, UpdateSourceType, type IUpdateInfo } from 'update-electron-app';
import { LoggerService } from '../logging/LoggerService';

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
}
