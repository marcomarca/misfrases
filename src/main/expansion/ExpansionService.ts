import type { AppState, Snippet, WindowHandle } from '../../shared/types';
import type { IWindowsInputService } from '../windows/WindowsInputService';
import type { IClipboardGuard } from '../windows/ClipboardGuard';
import type { StatisticsService } from '../statistics/StatisticsService';
import type { SnippetRepository } from '../database/repositories/SnippetRepository';
import type { SelectorWindowService } from '../popup/SelectorWindowService';
import { LoggerService } from '../logging/LoggerService';

export class ExpansionService {
  private logger = LoggerService.getInstance();
  private state: AppState = 'READY';

  constructor(
    private windowsInput: IWindowsInputService,
    private clipboardGuard: IClipboardGuard,
    private statsService: StatisticsService,
    private snippetRepo: SnippetRepository,
    private selectorService: SelectorWindowService
  ) {
    this.selectorService.setCallbacks(
      (snippet, targetHwnd) => {
        this.expand(targetHwnd, snippet);
      },
      () => {
        this.setState('READY');
      }
    );
  }

  public getState(): AppState {
    return this.state;
  }

  public setState(newState: AppState): void {
    this.state = newState;
  }

  public async handleHotkeyTrigger(accelerator: string): Promise<void> {
    if (this.state !== 'READY') {
      return;
    }

    const targetHwnd = this.windowsInput.getForegroundWindow();
    const snippets = this.snippetRepo.listEnabledByAccelerator(accelerator);

    if (snippets.length === 0) {
      return;
    }

    if (snippets.length === 1) {
      await this.expand(targetHwnd, snippets[0]);
      return;
    }

    // 2-10 snippets -> open selector popup
    this.setState('SELECTOR_OPEN');
    this.selectorService.open(targetHwnd, snippets);
  }

  public async expand(targetHwnd: WindowHandle, snippet: Snippet): Promise<boolean> {
    this.setState('EXPANDING');

    try {
      if (targetHwnd && this.windowsInput.isWindow(targetHwnd)) {
        const restored = await this.windowsInput.restoreForegroundWindow(targetHwnd);
        if (!restored) {
          this.logger.error('focus restoration failure', 'Could not restore focus to target window', undefined, {
            targetHwnd: String(targetHwnd)
          });
        }
      }

      await this.windowsInput.waitForModifiersReleased(1000);

      let dispatched = false;

      // Strategy selection: Safe clipboard paste vs Direct Unicode input
      if (this.clipboardGuard.canSnapshotSafely()) {
        const snapshot = this.clipboardGuard.snapshot();
        this.clipboardGuard.setTemporaryText(snippet.content);

        // Brief synchronization pause so the OS clipboard buffer commits before Ctrl+V
        await new Promise((resolve) => setTimeout(resolve, 30));

        dispatched = this.windowsInput.sendPaste();

        if (dispatched) {
          // Allow target application to process and read the paste message before restoring clipboard
          await new Promise((resolve) => setTimeout(resolve, 80));
        } else {
          this.logger.error('expansion failure', 'SendInput Ctrl+V paste failed', undefined, {
            snippetId: snippet.id
          });
        }

        // Always restore original clipboard snapshot
        this.clipboardGuard.restore(snapshot);
      } else {
        // Unsafe format (e.g. image or complex binary): leave clipboard intact and use Unicode SendInput
        dispatched = this.windowsInput.sendUnicode(snippet.content);
        if (!dispatched) {
          this.logger.error('expansion failure', 'SendInput Unicode fallback failed', undefined, {
            snippetId: snippet.id
          });
        }
      }

      if (dispatched) {
        this.statsService.recordUsage(snippet.id);
      } else {
        this.logger.error('expansion failure', 'Text insertion could not be dispatched', undefined, {
          snippetId: snippet.id
        });
      }

      return dispatched;
    } catch (err) {
      this.logger.error('expansion failure', 'Unexpected error during expansion', err, {
        snippetId: snippet.id
      });
      return false;
    } finally {
      this.setState('READY');
    }
  }
}
