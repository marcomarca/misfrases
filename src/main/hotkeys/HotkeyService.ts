import { globalShortcut } from 'electron';
import type { HotkeyRepository } from '../database/repositories/HotkeyRepository';
import type { SnippetRepository } from '../database/repositories/SnippetRepository';
import { HotkeyNormalizer } from './HotkeyNormalizer';
import type { ValidateHotkeyResult } from '../../shared/types';

export class HotkeyService {
  private registeredAccelerators = new Set<string>();
  private isSuspendedState = false;
  private triggerCallback: ((accelerator: string) => void) | null = null;

  constructor(
    private hotkeyRepo: HotkeyRepository,
    private snippetRepo: SnippetRepository
  ) {}

  public setTriggerCallback(callback: (accelerator: string) => void): void {
    this.triggerCallback = callback;
  }

  public validateHotkey(rawAccelerator: string): ValidateHotkeyResult {
    const normalized = HotkeyNormalizer.normalize(rawAccelerator);
    const validCheck = HotkeyNormalizer.isValid(normalized);

    if (!validCheck.valid) {
      return {
        valid: false,
        normalized,
        error: validCheck.reason
      };
    }

    // Check if it's already registered by our app
    if (this.registeredAccelerators.has(normalized)) {
      return {
        valid: true,
        normalized,
        conflict: 'APP_EXISTS'
      };
    }

    // Test register with OS to check external conflict
    try {
      const ok = globalShortcut.register(normalized, () => {});
      if (!ok) {
        return {
          valid: false,
          normalized,
          error: `No se pudo registrar ${normalized}. Windows u otra aplicación ya está usando esta combinación.`,
          conflict: 'EXTERNAL'
        };
      }
      globalShortcut.unregister(normalized);
      return {
        valid: true,
        normalized,
        conflict: null
      };
    } catch {
      return {
        valid: false,
        normalized,
        error: `Error al probar el atajo ${normalized}.`,
        conflict: 'EXTERNAL'
      };
    }
  }

  public register(accelerator: string): boolean {
    const normalized = HotkeyNormalizer.normalize(accelerator);
    if (this.registeredAccelerators.has(normalized)) {
      return true;
    }

    try {
      const success = globalShortcut.register(normalized, () => {
        if (!this.isSuspendedState && this.triggerCallback) {
          this.triggerCallback(normalized);
        }
      });

      if (success) {
        this.registeredAccelerators.add(normalized);
      }
      return success;
    } catch (err) {
      console.error(`Error registering hotkey ${normalized}:`, err);
      return false;
    }
  }

  public unregister(accelerator: string): void {
    const normalized = HotkeyNormalizer.normalize(accelerator);
    if (this.registeredAccelerators.has(normalized)) {
      try {
        globalShortcut.unregister(normalized);
      } catch (err) {
        console.error(`Error unregistering hotkey ${normalized}:`, err);
      }
      this.registeredAccelerators.delete(normalized);
    }
  }

  public unregisterAll(): void {
    try {
      globalShortcut.unregisterAll();
    } catch (err) {
      console.error('Error in unregisterAll:', err);
    }
    this.registeredAccelerators.clear();
  }

  public setSuspended(suspended: boolean): void {
    this.isSuspendedState = suspended;
    // Electron supports globalShortcut.setSuspended in newer versions if available, or we gate in callback
    if (typeof (globalShortcut as any).setSuspended === 'function') {
      try {
        (globalShortcut as any).setSuspended(suspended);
      } catch (err) {
        console.error('Error in globalShortcut.setSuspended:', err);
      }
    }
  }

  public isSuspended(): boolean {
    return this.isSuspendedState;
  }

  public rebuildAll(): void {
    this.unregisterAll();

    const groups = this.hotkeyRepo.listAll();
    for (const group of groups) {
      const enabledSnippets = this.snippetRepo.listEnabledByAccelerator(group.accelerator);
      if (enabledSnippets.length > 0) {
        this.register(group.accelerator);
      }
    }
  }
}
