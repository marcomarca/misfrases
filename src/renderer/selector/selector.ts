import type { AppApi } from '../../preload/preload';
import type { ContextBlock, Snippet } from '../../shared/types';

declare global {
  interface Window {
    appApi: AppApi;
  }
}

interface MemoryMappingItem {
  block: ContextBlock;
  assignedKey: string;
  element: HTMLElement;
  labelEl: HTMLElement;
  originalLabel: string;
}

const MEMORY_SHORTCUT_KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];

class SelectorApp {
  private snippets: Snippet[] = [];
  private contextBlocks: ContextBlock[] = [];
  private selectorList!: HTMLElement;
  private selectorHotkey!: HTMLElement;
  private selectorMemoryBar!: HTMLElement;
  private memoryMapping = new Map<string, MemoryMappingItem>();

  constructor() {
    this.selectorList = document.getElementById('selector-list')!;
    this.selectorHotkey = document.getElementById('selector-hotkey')!;
    this.selectorMemoryBar = document.getElementById('selector-memory-bar')!;

    this.initEventListeners();
    this.loadData();
  }

  private async loadData(): Promise<void> {
    const payload = await window.appApi.selector.getData();
    this.snippets = payload.snippets || [];
    this.contextBlocks = payload.contextBlocks || [];

    if (this.snippets.length > 0 && this.snippets[0].accelerator) {
      this.selectorHotkey.textContent = this.snippets[0].accelerator;
    }

    this.renderMemoryBar();
    this.renderSnippets();
  }

  private renderMemoryBar(): void {
    this.selectorMemoryBar.innerHTML = '';
    this.memoryMapping.clear();

    if (this.contextBlocks.length === 0) {
      this.selectorMemoryBar.style.display = 'none';
      return;
    }

    this.selectorMemoryBar.style.display = 'flex';

    // Map up to available shortcut keys (defaults: Q, W, E, R...)
    const blocksToDisplay = this.contextBlocks.slice(0, MEMORY_SHORTCUT_KEYS.length);

    for (let i = 0; i < blocksToDisplay.length; i++) {
      const block = blocksToDisplay[i];
      const assignedKey = MEMORY_SHORTCUT_KEYS[i];
      const labelText = this.getShortLabel(block);

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'memory-chip-btn';
      chip.dataset.key = assignedKey;
      chip.dataset.id = block.id;

      const previewExcerpt = block.content.length > 120 ? `${block.content.slice(0, 120)}...` : block.content;
      chip.setAttribute('title', `[${assignedKey}] ${block.title}\n${previewExcerpt}\n(Haz clic o pulsa [${assignedKey}] para pegar)`);

      chip.innerHTML = `
        <span class="memory-key-badge">${assignedKey}</span>
        <span class="memory-chip-label">${this.escapeHtml(labelText)}</span>
      `;

      const labelEl = chip.querySelector('.memory-chip-label') as HTMLElement;

      const mappingItem: MemoryMappingItem = {
        block,
        assignedKey,
        element: chip,
        labelEl,
        originalLabel: labelText
      };

      this.memoryMapping.set(assignedKey, mappingItem);

      chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerMemoryBlock(mappingItem);
      });

      this.selectorMemoryBar.appendChild(chip);
    }
  }

  private renderSnippets(): void {
    this.selectorList.innerHTML = '';

    for (const snippet of this.snippets) {
      const item = document.createElement('div');
      item.className = 'selector-item';
      item.dataset.slot = snippet.slot.toString();

      const tooltipText = snippet.description
        ? `${snippet.title}\n${snippet.description}`
        : snippet.title;
      item.setAttribute('title', tooltipText);

      const displayKey = snippet.slot === 10 ? '0' : snippet.slot.toString();
      const descHtml = snippet.description
        ? `<div class="item-description">${this.escapeHtml(snippet.description)}</div>`
        : '';

      item.innerHTML = `
        <div class="key-badge">${displayKey}</div>
        <div class="item-body">
          <div class="item-title">${this.escapeHtml(snippet.title)}</div>
          ${descHtml}
        </div>
        <div class="item-usage">${snippet.usageCount} usos</div>
      `;

      item.addEventListener('click', () => {
        this.selectSlot(snippet.slot);
      });

      this.selectorList.appendChild(item);
    }
  }

  private initEventListeners(): void {
    window.addEventListener('blur', () => {
      // If window loses focus, close selector to avoid stuck popups
      window.appApi.selector.cancel();
    });

    window.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        window.appApi.selector.cancel();
        return;
      }

      // Prevent Space or Enter from triggering synthetic click events on focused elements
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault();
        return;
      }

      // If modifier keys are held (Ctrl, Alt, Meta/Win), do NOT trigger any slot or memory key
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      // Check numbers 1..9
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const slot = parseInt(e.key, 10);
        this.selectSlot(slot);
        return;
      }

      // Key 0 maps to slot 10
      if (e.key === '0') {
        e.preventDefault();
        this.selectSlot(10);
        return;
      }

      // Check quick memory keys (Q, W, E, R, T, etc.)
      const upperKey = e.key.toUpperCase();
      const memoryItem = this.memoryMapping.get(upperKey);
      if (memoryItem) {
        e.preventDefault();
        await this.triggerMemoryBlock(memoryItem);
        return;
      }
    });
  }

  private async triggerMemoryBlock(item: MemoryMappingItem): Promise<void> {
    item.element.classList.add('pasting');
    item.labelEl.textContent = '✓ Pegado';

    try {
      await window.appApi.selector.pasteContextBlock(item.block.id);
    } finally {
      setTimeout(() => {
        item.element.classList.remove('pasting');
        item.labelEl.textContent = item.originalLabel;
      }, 750);
    }
  }

  private selectSlot(slot: number): void {
    const exists = this.snippets.some((s) => s.slot === slot);
    if (exists) {
      window.appApi.selector.select(slot);
    }
  }

  private getShortLabel(block: ContextBlock): string {
    const key = block.key.toLowerCase();
    if (key.includes('perfil')) return 'Perfil';
    if (key.includes('stack_software') || key.includes('software')) return 'Stack Sw';
    if (key.includes('stack_hardware') || key.includes('hardware')) return 'Stack Hw';
    if (key.includes('arquitectura')) return 'Arquitectura';
    if (block.title.length <= 12) return block.title;
    return block.key.slice(0, 10);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SelectorApp();
  });
} else {
  new SelectorApp();
}
