import type { AppApi } from '../../preload/preload';
import type { Snippet } from '../../shared/types';

declare global {
  interface Window {
    appApi: AppApi;
  }
}

class SelectorApp {
  private snippets: Snippet[] = [];
  private selectorList!: HTMLElement;
  private selectorHotkey!: HTMLElement;

  constructor() {
    this.selectorList = document.getElementById('selector-list')!;
    this.selectorHotkey = document.getElementById('selector-hotkey')!;

    this.initEventListeners();
    this.loadData();
  }

  private async loadData(): Promise<void> {
    this.snippets = await window.appApi.selector.getData();
    if (this.snippets.length > 0 && this.snippets[0].accelerator) {
      this.selectorHotkey.textContent = this.snippets[0].accelerator;
    }
    this.render();
  }

  private render(): void {
    this.selectorList.innerHTML = '';

    for (const snippet of this.snippets) {
      const item = document.createElement('div');
      item.className = 'selector-item';
      item.dataset.slot = snippet.slot.toString();

      const displayKey = snippet.slot === 10 ? '0' : snippet.slot.toString();

      item.innerHTML = `
        <div class="key-badge">${displayKey}</div>
        <div class="item-title">${this.escapeHtml(snippet.title)}</div>
        <div class="item-usage">${snippet.usageCount} usos</div>
      `;

      item.addEventListener('click', () => {
        this.selectSlot(snippet.slot);
      });

      this.selectorList.appendChild(item);
    }
  }

  private initEventListeners(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        window.appApi.selector.cancel();
        return;
      }

      // Check keys 1..9
      if (e.key >= '1' && e.key <= '9') {
        const slot = parseInt(e.key, 10);
        this.selectSlot(slot);
        return;
      }

      // Key 0 maps to slot 10
      if (e.key === '0') {
        this.selectSlot(10);
        return;
      }
    });
  }

  private selectSlot(slot: number): void {
    const exists = this.snippets.some((s) => s.slot === slot);
    if (exists) {
      window.appApi.selector.select(slot);
    }
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
