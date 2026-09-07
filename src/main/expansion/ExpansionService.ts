import type { AppState, ContextBlock, Snippet, WindowHandle } from '../../shared/types';
import type { IWindowsInputService } from '../windows/WindowsInputService';
import type { IClipboardGuard } from '../windows/ClipboardGuard';
import type { StatisticsService } from '../statistics/StatisticsService';
import type { SnippetRepository } from '../database/repositories/SnippetRepository';
import type { SelectorWindowService } from '../popup/SelectorWindowService';
import { LoggerService } from '../logging/LoggerService';

import { TemplateEngine } from './TemplateEngine';

export class ExpansionService {
  private logger = LoggerService.getInstance();
  private state: AppState = 'READY';

  constructor(
    private windowsInput: IWindowsInputService,
    private clipboardGuard: IClipboardGuard,
    private statsService: StatisticsService,
    private snippetRepo: SnippetRepository,
    private selectorService: SelectorWindowService,
    private contextBlockRepo?: {
      getAllAsMap(): Record<string, string>;
      listAll?(): ContextBlock[];
      getById?(id: string): ContextBlock | null;
    }
  ) {
    this.selectorService.setCallbacks(
      (snippet, targetHwnd) => {
        this.expand(targetHwnd, snippet);
      },
      () => {
        this.setState('READY');
      },
      async (blockId, targetHwnd) => {
        if (!this.contextBlockRepo || !this.contextBlockRepo.getById) {
          return false;
        }
        const block = this.contextBlockRepo.getById(blockId);
        if (!block) return false;
        const textToPaste = block.content.endsWith('\n') ? block.content : `${block.content}\n`;
        return this.expandDirectText(targetHwnd, textToPaste);
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
    const contextBlocks = this.contextBlockRepo && this.contextBlockRepo.listAll
      ? this.contextBlockRepo.listAll()
      : [];
    this.selectorService.open(targetHwnd, snippets, contextBlocks);
  }

  public async expandDirectText(targetHwnd: WindowHandle, text: string): Promise<boolean> {
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

      // 1. Snapshot previous clipboard state
      const snapshot = this.clipboardGuard.snapshot();

      // 2. Set text in clipboard
      this.clipboardGuard.setTemporaryText(text);

      // 3. Synchronization pause so the OS clipboard buffer commits before Ctrl+V
      await new Promise((resolve) => setTimeout(resolve, 35));

      // 4. Send paste (Ctrl+V) via Win32 SendInput (with keybd_event fallback)
      const dispatched = this.windowsInput.sendPaste();

      if (dispatched) {
        // Allow target application to process and read the paste message before restoring clipboard
        await new Promise((resolve) => setTimeout(resolve, 85));
      } else {
        this.logger.warn('expansion', 'SendInput Ctrl+V paste failed');
      }

      // 5. Always restore original clipboard snapshot immediately to avoid leaving residual text
      this.clipboardGuard.restore(snapshot);

      return dispatched;
    } catch (err: any) {
      this.logger.error('expansion failure', 'Unexpected error during text expansion', err);
      return false;
    } finally {
      this.windowsInput.forceReleaseModifiers();
    }
  }

  public async expand(targetHwnd: WindowHandle, snippet: Snippet): Promise<boolean> {
    this.setState('EXPANDING');

    try {
      let clipboardTextForTemplate = '';
      if (this.clipboardGuard.canSnapshotSafely()) {
        const snapshot = this.clipboardGuard.snapshot();
        clipboardTextForTemplate = snapshot.text || '';
      }

      // Render dynamic variables ({{date}}, {{time}}, {{clipboard}}, context blocks, etc.)
      const contextBlocks = this.contextBlockRepo ? this.contextBlockRepo.getAllAsMap() : {};
      const contentToInsert = TemplateEngine.render(snippet.content, {
        clipboardText: clipboardTextForTemplate,
        contextBlocks
      });

      const dispatched = await this.expandDirectText(targetHwnd, contentToInsert);

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
