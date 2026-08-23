import { app } from 'electron';

export class SingleInstanceService {
  public static acquireLock(onSecondInstance: () => void): boolean {
    const gotSingleInstanceLock = app.requestSingleInstanceLock();

    if (!gotSingleInstanceLock) {
      app.quit();
      return false;
    }

    app.on('second-instance', () => {
      onSecondInstance();
    });

    return true;
  }
}
