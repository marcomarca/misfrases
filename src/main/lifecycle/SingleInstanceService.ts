import { app } from 'electron';

export class SingleInstanceService {
  public static acquireLock(onSecondInstance: () => void): boolean {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
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
