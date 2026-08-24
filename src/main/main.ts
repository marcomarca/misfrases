import { AppLifecycleService } from './lifecycle/AppLifecycleService';
import { LoggerService } from './logging/LoggerService';

const logger = LoggerService.getInstance();

process.on('uncaughtException', (error) => {
  logger.error('uncaught exception', error.message, { stack: error.stack });
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('unhandled rejection', reason?.message || String(reason), {
    stack: reason?.stack
  });
});

const lifecycle = new AppLifecycleService();

lifecycle.bootstrap().catch((err) => {
  logger.error('fatal startup error', err.message, { stack: err.stack });
});
