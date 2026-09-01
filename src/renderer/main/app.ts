import type { AppApi } from '../../preload/preload';
import type { AppSettings, Snippet, SnippetStats, StatsSummary } from '../../shared/types';

declare global {
  interface Window {
    appApi: AppApi;
  }
}

class MainApp {
  private snippets: Snippet[] = [];
  private currentTab = 'snippets';
  private isRecordingHotkey = false;

  // DOM elements
  private navButtons!: NodeListOf<HTMLButtonElement>;
  private tabPanes!: NodeListOf<HTMLElement>;
  private snippetsTbody!: HTMLElement;
  private snippetsEmpty!: HTMLElement;
  private searchInput!: HTMLInputElement;
  private filterGroupSelect!: HTMLSelectElement;

  // Modal elements
  private modal!: HTMLElement;
  private modalTitle!: HTMLElement;
  private snippetForm!: HTMLFormElement;
  private formSnippetId!: HTMLInputElement;
  private formTitle!: HTMLInputElement;
  private formDescription!: HTMLTextAreaElement;
  private formContent!: HTMLTextAreaElement;
  private formAccelerator!: HTMLInputElement;
  private formSlot!: HTMLSelectElement;
  private formEnabled!: HTMLInputElement;
  private hotkeyDisplay!: HTMLElement;
  private hotkeyFeedback!: HTMLElement;
  private btnRecordHotkey!: HTMLButtonElement;

  // Reorder elements
  private reorderHotkeySelect!: HTMLSelectElement;
  private reorderList!: HTMLElement;
  private btnSaveReorder!: HTMLButtonElement;
  private reorderItemsState: Snippet[] = [];

  // Stats elements
  private statTotal!: HTMLElement;
  private statToday!: HTMLElement;
  private stat7d!: HTMLElement;
  private stat30d!: HTMLElement;
  private statsTbody!: HTMLElement;

  // Settings elements
  private settingLaunchAtLogin!: HTMLInputElement;
  private settingAdminMode!: HTMLInputElement;
  private settingHotkeysEnabled!: HTMLInputElement;
  private settingStartHidden!: HTMLInputElement;
  private settingTheme!: HTMLSelectElement;
  private btnExportBackup!: HTMLButtonElement;
  private btnImportBackup!: HTMLButtonElement;
  private btnCheckUpdates!: HTMLButtonElement;
  private updateStatusText!: HTMLElement;
  private statusIndicator!: HTMLElement;
  private statusText!: HTMLElement;

  constructor() {
    this.initDOMElements();
    this.initEventListeners();
    this.loadInitialData();
  }

  private initDOMElements(): void {
    this.navButtons = document.querySelectorAll('.nav-item');
    this.tabPanes = document.querySelectorAll('.tab-pane');
    this.snippetsTbody = document.getElementById('snippets-tbody')!;
    this.snippetsEmpty = document.getElementById('snippets-empty')!;
    this.searchInput = document.getElementById('search-input') as HTMLInputElement;
    this.filterGroupSelect = document.getElementById('filter-group-select') as HTMLSelectElement;

    this.modal = document.getElementById('snippet-modal')!;
    this.modalTitle = document.getElementById('modal-title')!;
    this.snippetForm = document.getElementById('snippet-form') as HTMLFormElement;
    this.formSnippetId = document.getElementById('form-snippet-id') as HTMLInputElement;
    this.formTitle = document.getElementById('form-title') as HTMLInputElement;
    this.formDescription = document.getElementById('form-description') as HTMLTextAreaElement;
    this.formContent = document.getElementById('form-content') as HTMLTextAreaElement;
    this.formAccelerator = document.getElementById('form-accelerator') as HTMLInputElement;
    this.formSlot = document.getElementById('form-slot') as HTMLSelectElement;
    this.formEnabled = document.getElementById('form-enabled') as HTMLInputElement;
    this.hotkeyDisplay = document.getElementById('hotkey-display')!;
    this.hotkeyFeedback = document.getElementById('hotkey-feedback')!;
    this.btnRecordHotkey = document.getElementById('btn-record-hotkey') as HTMLButtonElement;

    this.reorderHotkeySelect = document.getElementById('reorder-hotkey-select') as HTMLSelectElement;
    this.reorderList = document.getElementById('reorder-list')!;
    this.btnSaveReorder = document.getElementById('btn-save-reorder') as HTMLButtonElement;

    this.statTotal = document.getElementById('stat-total')!;
    this.statToday = document.getElementById('stat-today')!;
    this.stat7d = document.getElementById('stat-7d')!;
    this.stat30d = document.getElementById('stat-30d')!;
    this.statsTbody = document.getElementById('stats-tbody')!;

    this.settingLaunchAtLogin = document.getElementById('setting-launch-at-login') as HTMLInputElement;
    this.settingAdminMode = document.getElementById('setting-admin-mode') as HTMLInputElement;
    this.settingHotkeysEnabled = document.getElementById('setting-hotkeys-enabled') as HTMLInputElement;
    this.settingStartHidden = document.getElementById('setting-start-hidden') as HTMLInputElement;
    this.settingTheme = document.getElementById('setting-theme') as HTMLSelectElement;
    this.btnExportBackup = document.getElementById('btn-export-backup') as HTMLButtonElement;
    this.btnImportBackup = document.getElementById('btn-import-backup') as HTMLButtonElement;
    this.btnCheckUpdates = document.getElementById('btn-check-updates') as HTMLButtonElement;
    this.updateStatusText = document.getElementById('update-status-text')!;
    this.statusIndicator = document.getElementById('status-indicator')!;
    this.statusText = document.getElementById('status-text')!;
  }

  private initEventListeners(): void {
    // Navigation
    this.navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) {
          this.switchTab(tab);
        }
      });
    });

    // Tray navigation subscription
    window.appApi.onNavigateTab((tab) => {
      this.switchTab(tab);
    });

    // Snippets Toolbar
    document.getElementById('btn-new-snippet')?.addEventListener('click', () => this.openCreateModal());
    this.searchInput?.addEventListener('input', () => this.renderSnippets());
    this.filterGroupSelect?.addEventListener('change', () => this.renderSnippets());

    // Modal
    document.getElementById('btn-close-modal')?.addEventListener('click', () => this.closeModal());
    document.getElementById('btn-cancel-modal')?.addEventListener('click', () => this.closeModal());
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });
    this.snippetForm?.addEventListener('submit', (e) => this.handleSaveSnippet(e));

    // Hotkey recorder
    this.btnRecordHotkey?.addEventListener('click', () => this.startRecordingHotkey());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isRecordingHotkey) {
          this.isRecordingHotkey = false;
          this.hotkeyDisplay.classList.remove('recording');
          this.hotkeyFeedback.textContent = 'Grabación cancelada.';
          this.hotkeyFeedback.className = 'form-hint';
          window.appApi.hotkeys.stopRecording();
          e.preventDefault();
          return;
        }
        if (!this.modal.classList.contains('hidden')) {
          this.closeModal();
          e.preventDefault();
          return;
        }
      }
      this.handleKeyDown(e);
    });

    // Reorder
    this.reorderHotkeySelect?.addEventListener('change', () => this.handleReorderHotkeyChange());
    this.btnSaveReorder?.addEventListener('click', () => this.handleSaveReorder());

    // Settings switches
    this.settingLaunchAtLogin?.addEventListener('change', async () => {
      const checked = this.settingLaunchAtLogin.checked;
      await window.appApi.settings.update({ launchAtLogin: checked });
      this.showToast(
        checked ? 'Inicio con Windows activado' : 'Inicio con Windows desactivado',
        'info'
      );
    });
    this.settingAdminMode?.addEventListener('change', async () => {
      const checked = this.settingAdminMode.checked;
      await window.appApi.settings.update({ administratorMode: checked });
      this.showToast(
        checked ? 'Modo Administrador activado' : 'Modo Administrador desactivado',
        'info'
      );
    });
    this.settingHotkeysEnabled?.addEventListener('change', async () => {
      const enabled = this.settingHotkeysEnabled.checked;
      await window.appApi.settings.update({ hotkeysEnabled: enabled });
      this.updateStatusBadge(enabled);
      this.showToast(
        enabled ? 'Hotkeys globales activados' : 'Hotkeys globales pausados',
        enabled ? 'success' : 'warning'
      );
    });
    this.settingStartHidden?.addEventListener('change', async () => {
      const checked = this.settingStartHidden.checked;
      await window.appApi.settings.update({ startHidden: checked });
      this.showToast(
        checked ? 'Inicio minimizado en bandeja activado' : 'Inicio minimizado desactivado',
        'info'
      );
    });

    // Theme selector
    this.settingTheme?.addEventListener('change', async () => {
      const theme = this.settingTheme.value as 'dark' | 'light' | 'system';
      await window.appApi.settings.update({ theme });
      this.applyTheme(theme);
      this.showToast(`Tema ${theme} aplicado`, 'info');
    });

    // Variable Chips in snippet modal
    document.querySelectorAll('.chip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const varTag = btn.getAttribute('data-var');
        if (varTag && this.formContent) {
          const start = this.formContent.selectionStart;
          const end = this.formContent.selectionEnd;
          const text = this.formContent.value;
          this.formContent.value = text.substring(0, start) + varTag + text.substring(end);
          this.formContent.focus();
          this.formContent.selectionStart = this.formContent.selectionEnd = start + varTag.length;
        }
      });
    });

    // Backup & Restore
    this.btnExportBackup?.addEventListener('click', async () => {
      this.btnExportBackup.disabled = true;
      try {
        const res = await window.appApi.backup.export();
        if (res.success) {
          this.showToast(`Copia de seguridad guardada (${res.snippetCount} frases)`, 'success');
        } else if (!res.canceled) {
          this.showToast(`Error al exportar: ${res.error || 'Error desconocido'}`, 'error');
        }
      } finally {
        this.btnExportBackup.disabled = false;
      }
    });

    this.btnImportBackup?.addEventListener('click', async () => {
      this.btnImportBackup.disabled = true;
      try {
        const res = await window.appApi.backup.import('merge');
        if (res.success) {
          this.showToast(`${res.importedCount} frases importadas correctamente`, 'success');
          await this.loadSnippets();
        } else if (!res.canceled) {
          this.showToast(`Error al importar: ${res.error || 'Error desconocido'}`, 'error');
        }
      } finally {
        this.btnImportBackup.disabled = false;
      }
    });

    // Manual Updates Check
    this.btnCheckUpdates?.addEventListener('click', async () => {
      this.btnCheckUpdates.disabled = true;
      const originalText = this.btnCheckUpdates.textContent;
      this.btnCheckUpdates.textContent = 'Buscando...';
      if (this.updateStatusText) {
        this.updateStatusText.textContent = 'Comprobando versiones en GitHub Releases...';
      }

      try {
        const res = await window.appApi.autoupdate.check();
        if (res.status === 'up_to_date') {
          this.showToast('Ya tienes la versión más reciente instalada', 'success');
          if (this.updateStatusText) {
            this.updateStatusText.textContent = `Tu versión (${res.currentVersion}) está actualizada.`;
          }
        } else if (res.status === 'downloading') {
          this.showToast('Descargando nueva versión en segundo plano...', 'info');
          if (this.updateStatusText) {
            this.updateStatusText.textContent = res.message || 'Descargando actualización...';
          }
        } else if (res.status === 'dev_mode') {
          this.showToast(res.message || 'Modo desarrollo activo', 'info');
          if (this.updateStatusText) {
            this.updateStatusText.textContent = res.message || 'Modo desarrollo: Actualizaciones omitidas.';
          }
        } else {
          this.showToast(res.message || 'Error al comprobar actualización', 'error');
          if (this.updateStatusText) {
            this.updateStatusText.textContent = res.message || 'Error al conectar con el servidor de actualizaciones.';
          }
        }
      } catch (err: any) {
        this.showToast(`Error: ${err.message || err}`, 'error');
      } finally {
        this.btnCheckUpdates.disabled = false;
        this.btnCheckUpdates.textContent = originalText || '🔄 Comprobar actualizaciones ahora';
      }
    });
  }

  private switchTab(tab: string): void {
    this.currentTab = tab;
    this.navButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    this.tabPanes.forEach((pane) => {
      pane.classList.toggle('active', pane.id === `tab-${tab}`);
    });

    if (tab === 'snippets') {
      this.loadSnippets();
    } else if (tab === 'reorder') {
      this.loadReorderView();
    } else if (tab === 'stats') {
      this.loadStats();
    } else if (tab === 'settings') {
      this.loadSettings();
    }
  }

  private async loadInitialData(): Promise<void> {
    await this.loadSettings();
    await this.loadSnippets();
  }

  // SNIPPETS
  public async loadSnippets(): Promise<void> {
    this.snippets = await window.appApi.snippets.list();
    this.populateFilterSelect();
    this.renderSnippets();
  }

  private populateFilterSelect(): void {
    const accelerators = Array.from(new Set(this.snippets.map((s) => s.accelerator).filter(Boolean)));
    const currentVal = this.filterGroupSelect.value;

    this.filterGroupSelect.innerHTML = '<option value="all">Todos los atajos</option>';
    for (const acc of accelerators) {
      const opt = document.createElement('option');
      opt.value = acc as string;
      opt.textContent = acc as string;
      this.filterGroupSelect.appendChild(opt);
    }

    if (accelerators.includes(currentVal)) {
      this.filterGroupSelect.value = currentVal;
    }
  }

  private renderSnippets(): void {
    const query = this.searchInput.value.toLowerCase().trim();
    const filterGroup = this.filterGroupSelect.value;

    const filtered = this.snippets.filter((s) => {
      const matchQuery =
        !query ||
        s.title.toLowerCase().includes(query) ||
        (s.description && s.description.toLowerCase().includes(query)) ||
        s.content.toLowerCase().includes(query) ||
        (s.accelerator && s.accelerator.toLowerCase().includes(query));

      const matchGroup = filterGroup === 'all' || s.accelerator === filterGroup;

      return matchQuery && matchGroup;
    });

    this.snippetsTbody.innerHTML = '';

    if (filtered.length === 0) {
      this.snippetsEmpty.classList.remove('hidden');
      return;
    }

    this.snippetsEmpty.classList.add('hidden');

    for (const snippet of filtered) {
      const tr = document.createElement('tr');

      const descHtml = snippet.description
        ? `<div class="snippet-description">${this.escapeHtml(snippet.description)}</div>`
        : '';

      tr.innerHTML = `
        <td><span class="slot-badge">${snippet.slot === 10 ? '0' : snippet.slot}</span></td>
        <td><span class="hotkey-tag">${snippet.accelerator || '-'}</span></td>
        <td>
          <div class="title-cell-container">
            <strong>${this.escapeHtml(snippet.title)}</strong>
            ${descHtml}
          </div>
        </td>
        <td><div class="content-preview">${this.escapeHtml(snippet.content)}</div></td>
        <td style="text-align: center;">${snippet.usageCount.toLocaleString()}</td>
        <td style="text-align: center;">
          <label class="switch" style="transform: scale(0.75);">
            <input type="checkbox" ${snippet.enabled ? 'checked' : ''} data-toggle-id="${snippet.id}">
            <span class="slider"></span>
          </label>
        </td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon" data-edit-id="${snippet.id}" title="Editar">✏️</button>
            <button class="btn-icon" data-duplicate-id="${snippet.id}" title="Duplicar">📋</button>
            <button class="btn-icon danger" data-delete-id="${snippet.id}" title="Eliminar">🗑️</button>
          </div>
        </td>
      `;

      this.snippetsTbody.appendChild(tr);
    }

    // Attach row events
    this.snippetsTbody.querySelectorAll('[data-toggle-id]').forEach((el) => {
      el.addEventListener('change', async (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-toggle-id')!;
        const checked = (e.target as HTMLInputElement).checked;
        const current = this.snippets.find((s) => s.id === id);
        const title = current ? current.title : 'Frase';
        await window.appApi.snippets.update({ id, enabled: checked });
        this.showToast(
          checked ? `Frase activada: "${title}"` : `Frase desactivada: "${title}"`,
          checked ? 'success' : 'warning'
        );
        await this.loadSnippets();
      });
    });

    this.snippetsTbody.querySelectorAll('[data-edit-id]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-edit-id')!;
        this.openEditModal(id);
      });
    });

    this.snippetsTbody.querySelectorAll('[data-duplicate-id]').forEach((el) => {
      el.addEventListener('click', async () => {
        const id = el.getAttribute('data-duplicate-id')!;
        const dup = await window.appApi.snippets.duplicate(id);
        this.showToast(`Frase duplicada: "${dup.title}"`, 'success');
        await this.loadSnippets();
      });
    });

    this.snippetsTbody.querySelectorAll('[data-delete-id]').forEach((el) => {
      el.addEventListener('click', async () => {
        const id = el.getAttribute('data-delete-id')!;
        const current = this.snippets.find((s) => s.id === id);
        const title = current ? current.title : 'Frase';
        if (confirm(`¿Deseas eliminar la frase "${title}"?`)) {
          await window.appApi.snippets.remove(id);
          this.showToast(`Frase eliminada: "${title}"`, 'info');
          await this.loadSnippets();
        }
      });
    });
  }

  // MODAL
  private openCreateModal(): void {
    this.modalTitle.textContent = 'Nueva Frase';
    this.formSnippetId.value = '';
    this.formTitle.value = '';
    this.formDescription.value = '';
    this.formContent.value = '';
    this.formContent.style.height = '';
    this.formContent.style.width = '';
    this.formDescription.style.height = '';
    this.formDescription.style.width = '';
    this.formAccelerator.value = 'Control+Alt+P';
    this.hotkeyDisplay.textContent = 'Control+Alt+P';
    this.formSlot.value = '';
    this.formEnabled.checked = true;
    this.hotkeyFeedback.textContent = 'Pulsa "Grabar atajo" y luego presiona la combinación deseada.';
    this.hotkeyFeedback.className = 'form-hint';
    this.modal.classList.remove('hidden');
    this.formTitle.focus();
  }

  private async openEditModal(id: string): Promise<void> {
    const snippet = await window.appApi.snippets.getById(id);
    if (!snippet) return;

    this.modalTitle.textContent = 'Editar Frase';
    this.formSnippetId.value = snippet.id;
    this.formTitle.value = snippet.title;
    this.formDescription.value = snippet.description || '';
    this.formContent.value = snippet.content;
    this.formContent.style.height = '';
    this.formContent.style.width = '';
    this.formDescription.style.height = '';
    this.formDescription.style.width = '';
    this.formAccelerator.value = snippet.accelerator || 'Control+Alt+P';
    this.hotkeyDisplay.textContent = snippet.accelerator || 'Control+Alt+P';
    this.formSlot.value = snippet.slot.toString();
    this.formEnabled.checked = snippet.enabled;
    this.hotkeyFeedback.textContent = '';
    this.hotkeyFeedback.className = 'form-hint';
    this.modal.classList.remove('hidden');
  }

  private closeModal(): void {
    this.modal.classList.add('hidden');
    if (this.isRecordingHotkey) {
      this.isRecordingHotkey = false;
      this.hotkeyDisplay.classList.remove('recording');
      window.appApi.hotkeys.stopRecording();
    }
    this.formContent.style.height = '';
    this.formContent.style.width = '';
    this.formDescription.style.height = '';
    this.formDescription.style.width = '';
  }

  private async startRecordingHotkey(): Promise<void> {
    this.isRecordingHotkey = true;
    this.hotkeyDisplay.classList.add('recording');
    this.hotkeyDisplay.textContent = 'Presiona teclas...';
    this.hotkeyFeedback.textContent = 'Presiona la combinación deseada (ej. Ctrl+Alt+P o F1-F24)...';
    this.hotkeyFeedback.className = 'form-hint';
    await window.appApi.hotkeys.startRecording();
  }

  private async handleKeyDown(e: KeyboardEvent): Promise<void> {
    if (!this.isRecordingHotkey) return;

    e.preventDefault();
    e.stopPropagation();

    // Ignore single modifier presses
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      return;
    }

    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Control');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Super');

    let key = e.key;
    if (key.length === 1) {
      key = key.toUpperCase();
    } else if (key.startsWith('Arrow')) {
      key = key.replace('Arrow', '');
    }

    parts.push(key);

    const accelerator = parts.join('+');
    this.formAccelerator.value = accelerator;
    this.hotkeyDisplay.textContent = accelerator;

    // Validate in real time
    const res = await window.appApi.hotkeys.validate(accelerator);
    if (!res.valid) {
      this.hotkeyFeedback.textContent = `❌ ${res.error || 'Atajo inválido'}`;
      this.hotkeyFeedback.className = 'form-hint error';
    } else {
      this.hotkeyFeedback.textContent = '✅ Atajo válido';
      this.hotkeyFeedback.className = 'form-hint success';
      this.isRecordingHotkey = false;
      this.hotkeyDisplay.classList.remove('recording');
      window.appApi.hotkeys.stopRecording();
    }
  }

  private async handleSaveSnippet(e: Event): Promise<void> {
    e.preventDefault();

    const id = this.formSnippetId.value;
    const title = this.formTitle.value.trim();
    const description = this.formDescription.value.trim();
    const content = this.formContent.value;
    const accelerator = this.formAccelerator.value.trim();
    const slot = this.formSlot.value ? (parseInt(this.formSlot.value, 10) as any) : undefined;
    const enabled = this.formEnabled.checked;

    try {
      if (id) {
        await window.appApi.snippets.update({
          id,
          title,
          description,
          content,
          accelerator,
          slot,
          enabled
        });
        this.showToast(`Frase "${title}" actualizada correctamente`, 'success');
      } else {
        await window.appApi.snippets.create({
          title,
          description,
          content,
          accelerator,
          slot,
          enabled
        });
        this.showToast(`Nueva frase "${title}" guardada exitosamente`, 'success');
      }

      this.closeModal();
      await this.loadSnippets();
    } catch (err: any) {
      this.showToast(`Error al guardar frase: ${err.message || err}`, 'error');
    }
  }

  // REORDER
  private async loadReorderView(): Promise<void> {
    this.snippets = await window.appApi.snippets.list();
    const groups = Array.from(
      new Map(this.snippets.map((s) => [s.hotkeyGroupId, s.accelerator])).entries()
    );

    this.reorderHotkeySelect.innerHTML = '';
    for (const [groupId, acc] of groups) {
      const opt = document.createElement('option');
      opt.value = groupId;
      opt.textContent = acc || 'Sin atajo';
      this.reorderHotkeySelect.appendChild(opt);
    }

    this.handleReorderHotkeyChange();
  }

  private handleReorderHotkeyChange(): void {
    const selectedGroupId = this.reorderHotkeySelect.value;
    if (!selectedGroupId) {
      this.reorderList.innerHTML = '<p class="form-hint">No hay atajos para ordenar.</p>';
      return;
    }

    this.reorderItemsState = this.snippets
      .filter((s) => s.hotkeyGroupId === selectedGroupId)
      .sort((a, b) => a.slot - b.slot);

    this.renderReorderList();
  }

  private draggedReorderIndex: number | null = null;

  private renderReorderList(): void {
    this.reorderList.innerHTML = '';

    this.reorderItemsState.forEach((snippet, index) => {
      const div = document.createElement('div');
      div.className = 'reorder-item';
      div.setAttribute('draggable', 'true');
      div.dataset.index = index.toString();

      const descHtml = snippet.description
        ? `<div class="reorder-desc">${this.escapeHtml(snippet.description)}</div>`
        : '';

      div.innerHTML = `
        <div class="reorder-drag-handle" title="Arrastrar para mover">⋮⋮</div>
        <span class="slot-badge">${index + 1 === 10 ? '0' : index + 1}</span>
        <div class="reorder-info">
          <div class="reorder-title">${this.escapeHtml(snippet.title)}</div>
          ${descHtml}
          <div class="reorder-stats">${snippet.usageCount} usos</div>
        </div>
        <div class="reorder-buttons">
          <button class="btn-icon" data-move-up="${index}" ${index === 0 ? 'disabled' : ''} title="Subir">▲</button>
          <button class="btn-icon" data-move-down="${index}" ${index === this.reorderItemsState.length - 1 ? 'disabled' : ''} title="Bajar">▼</button>
        </div>
      `;

      // Drag and Drop Events
      div.addEventListener('dragstart', (e) => {
        this.draggedReorderIndex = index;
        div.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', index.toString());
        }
      });

      div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
        this.reorderList.querySelectorAll('.reorder-item').forEach((el) => {
          el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        this.draggedReorderIndex = null;
      });

      div.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (this.draggedReorderIndex === null || this.draggedReorderIndex === index) return;

        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }

        const rect = div.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (e.clientY < midY) {
          div.classList.add('drag-over-top');
          div.classList.remove('drag-over-bottom');
        } else {
          div.classList.add('drag-over-bottom');
          div.classList.remove('drag-over-top');
        }
      });

      div.addEventListener('dragleave', () => {
        div.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      div.addEventListener('drop', (e) => {
        e.preventDefault();
        div.classList.remove('drag-over-top', 'drag-over-bottom');

        if (this.draggedReorderIndex === null || this.draggedReorderIndex === index) return;

        const rect = div.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        let targetIndex = index;

        if (e.clientY >= midY && this.draggedReorderIndex < index) {
          targetIndex = index;
        } else if (e.clientY < midY && this.draggedReorderIndex > index) {
          targetIndex = index;
        }

        const [movedItem] = this.reorderItemsState.splice(this.draggedReorderIndex, 1);
        this.reorderItemsState.splice(targetIndex, 0, movedItem);

        this.showToast(`Frase "${movedItem.title}" reubicada al slot ${targetIndex + 1}`, 'info', 1800);
        this.renderReorderList();
      });

      this.reorderList.appendChild(div);
    });

    this.reorderList.querySelectorAll('[data-move-up]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-move-up')!, 10);
        if (idx > 0) {
          const temp = this.reorderItemsState[idx];
          this.reorderItemsState[idx] = this.reorderItemsState[idx - 1];
          this.reorderItemsState[idx - 1] = temp;
          this.showToast(`Frase "${temp.title}" movida al slot ${idx}`, 'info', 1800);
          this.renderReorderList();
        }
      });
    });

    this.reorderList.querySelectorAll('[data-move-down]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-move-down')!, 10);
        if (idx < this.reorderItemsState.length - 1) {
          const temp = this.reorderItemsState[idx];
          this.reorderItemsState[idx] = this.reorderItemsState[idx + 1];
          this.reorderItemsState[idx + 1] = temp;
          this.showToast(`Frase "${temp.title}" movida al slot ${idx + 2}`, 'info', 1800);
          this.renderReorderList();
        }
      });
    });
  }

  private async handleSaveReorder(): Promise<void> {
    const groupId = this.reorderHotkeySelect.value;
    if (!groupId || this.reorderItemsState.length === 0) return;

    try {
      const orderedSnippetIds = this.reorderItemsState.map((s) => s.id);
      await window.appApi.snippets.reorder({
        hotkeyGroupId: groupId,
        orderedSnippetIds
      });

      this.showToast('Nuevo orden de slots guardado exitosamente', 'success');
      await this.loadSnippets();
      this.handleReorderHotkeyChange();
    } catch (err: any) {
      this.showToast(`Error al guardar orden: ${err.message || err}`, 'error');
    }
  }

  // STATS
  private async loadStats(): Promise<void> {
    const summary: StatsSummary = await window.appApi.stats.summary();
    const snippetStats: SnippetStats[] = await window.appApi.stats.bySnippet();

    this.statTotal.textContent = summary.totalExpansions.toLocaleString();
    this.statToday.textContent = summary.todayExpansions.toLocaleString();
    this.stat7d.textContent = summary.last7DaysExpansions.toLocaleString();
    this.stat30d.textContent = summary.last30DaysExpansions.toLocaleString();

    this.statsTbody.innerHTML = '';
    for (const item of snippetStats) {
      const tr = document.createElement('tr');
      const lastUsed = item.lastUsedAt
        ? new Date(item.lastUsedAt).toLocaleDateString()
        : 'Nunca';

      tr.innerHTML = `
        <td><strong>${this.escapeHtml(item.title)}</strong></td>
        <td><span class="hotkey-tag">${item.accelerator}</span></td>
        <td><span class="slot-badge">${item.slot === 10 ? '0' : item.slot}</span></td>
        <td style="text-align: right; font-weight: 600;">${item.totalUsage.toLocaleString()}</td>
        <td style="text-align: right;">${item.usage7Days.toLocaleString()}</td>
        <td style="text-align: right;">${item.usage30Days.toLocaleString()}</td>
        <td style="text-align: right; color: var(--text-muted);">${lastUsed}</td>
      `;

      this.statsTbody.appendChild(tr);
    }
  }

  // SETTINGS
  private async loadSettings(): Promise<void> {
    const settings: AppSettings = await window.appApi.settings.get();
    this.settingLaunchAtLogin.checked = settings.launchAtLogin;
    this.settingAdminMode.checked = settings.administratorMode;
    this.settingHotkeysEnabled.checked = settings.hotkeysEnabled;
    this.settingStartHidden.checked = settings.startHidden;

    if (this.settingTheme) {
      this.settingTheme.value = settings.theme || 'dark';
    }
    this.applyTheme(settings.theme || 'dark');

    this.updateStatusBadge(settings.hotkeysEnabled);
  }

  private applyTheme(theme: 'dark' | 'light' | 'system'): void {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    } else {
      document.documentElement.dataset.theme = theme;
    }
  }

  private updateStatusBadge(enabled: boolean): void {
    if (enabled) {
      this.statusIndicator.className = 'status-indicator ready';
      this.statusText.textContent = 'Hotkeys activos';
    } else {
      this.statusIndicator.className = 'status-indicator paused';
      this.statusText.textContent = 'Hotkeys pausados';
    }
  }

  private showToast(
    message: string,
    type: 'success' | 'info' | 'warning' | 'error' = 'info',
    durationMs = 3000
  ): void {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons: Record<string, string> = {
      success: '✓',
      info: 'ℹ',
      warning: '⚠️',
      error: '✕'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ'}</span>
      <span class="toast-message">${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-hide');
      setTimeout(() => {
        toast.remove();
      }, 250);
    }, durationMs);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new MainApp();
  });
} else {
  new MainApp();
}
