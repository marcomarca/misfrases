import type { HotkeyRepository } from '../database/repositories/HotkeyRepository';
import type { SnippetRepository } from '../database/repositories/SnippetRepository';
import type { HotkeyService } from '../hotkeys/HotkeyService';
import { HotkeyNormalizer } from '../hotkeys/HotkeyNormalizer';
import type {
  CreateSnippetInput,
  ReorderSnippetsInput,
  Snippet,
  UpdateSnippetInput
} from '../../shared/types';

export class SnippetService {
  constructor(
    private snippetRepo: SnippetRepository,
    private hotkeyRepo: HotkeyRepository,
    private hotkeyService: HotkeyService
  ) {}

  public listAll(): Snippet[] {
    return this.snippetRepo.listAll();
  }

  public getById(id: string): Snippet | null {
    return this.snippetRepo.findById(id);
  }

  public create(input: CreateSnippetInput): Snippet {
    const normalizedAccelerator = HotkeyNormalizer.normalize(input.accelerator);
    const valid = HotkeyNormalizer.isValid(normalizedAccelerator);
    if (!valid.valid) {
      throw new Error(valid.reason || 'Atajo de teclado inválido');
    }

    // Get or create hotkey group
    const group = this.hotkeyRepo.getOrCreate(normalizedAccelerator);

    // Create snippet in repository
    const snippet = this.snippetRepo.create({
      hotkeyGroupId: group.id,
      title: input.title,
      description: input.description,
      content: input.content,
      slot: input.slot,
      enabled: input.enabled !== undefined ? input.enabled : true
    });

    // Rebuild/register hotkey if enabled
    if (snippet.enabled) {
      this.hotkeyService.register(normalizedAccelerator);
    }

    return snippet;
  }

  public update(input: UpdateSnippetInput): Snippet {
    const current = this.snippetRepo.findById(input.id);
    if (!current) {
      throw new Error('Snippet no encontrado');
    }

    let targetGroupId = current.hotkeyGroupId;
    let newAccelerator: string | null = null;
    let oldAccelerator: string | null = current.accelerator || null;

    if (input.accelerator) {
      newAccelerator = HotkeyNormalizer.normalize(input.accelerator);
      const valid = HotkeyNormalizer.isValid(newAccelerator);
      if (!valid.valid) {
        throw new Error(valid.reason || 'Atajo de teclado inválido');
      }

      const group = this.hotkeyRepo.getOrCreate(newAccelerator);
      targetGroupId = group.id;
    }

    const updated = this.snippetRepo.update({
      id: input.id,
      hotkeyGroupId: targetGroupId,
      title: input.title,
      description: input.description,
      content: input.content,
      slot: input.slot,
      enabled: input.enabled
    });

    // Clean up old group if changed
    if (oldAccelerator && newAccelerator && oldAccelerator !== newAccelerator) {
      this.hotkeyRepo.deleteIfEmpty(current.hotkeyGroupId);
    }

    this.hotkeyService.rebuildAll();

    return updated;
  }

  public remove(id: string): void {
    const snippet = this.snippetRepo.findById(id);
    if (!snippet) {
      return;
    }

    this.snippetRepo.softDelete(id);
    this.hotkeyRepo.deleteIfEmpty(snippet.hotkeyGroupId);
    this.hotkeyService.rebuildAll();
  }

  public duplicate(id: string): Snippet {
    const original = this.snippetRepo.findById(id);
    if (!original || !original.accelerator) {
      throw new Error('Snippet no encontrado');
    }

    return this.create({
      title: `${original.title} (Copia)`,
      description: original.description,
      content: original.content,
      accelerator: original.accelerator,
      enabled: original.enabled
    });
  }

  public reorder(input: ReorderSnippetsInput): void {
    this.snippetRepo.reorderSlots(input.hotkeyGroupId, input.orderedSnippetIds);
  }
}
