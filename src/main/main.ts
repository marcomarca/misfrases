import { AppLifecycleService } from './lifecycle/AppLifecycleService';

const lifecycle = new AppLifecycleService();

lifecycle.bootstrap().catch((err) => {
  console.error('Fatal error during application startup:', err);
});
