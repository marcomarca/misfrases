import { clipboard } from 'electron';
import type { ClipboardSnapshot } from '../../shared/types';

export interface IClipboardGuard {
  canSnapshotSafely(): boolean;
  snapshot(): ClipboardSnapshot;
  setTemporaryText(text: string): void;
  restore(snapshot: ClipboardSnapshot): void;
}

export class ClipboardGuard implements IClipboardGuard {
  private lastSetText: string | null = null;

  public canSnapshotSafely(): boolean {
    try {
      const formats = clipboard.availableFormats();
      // If clipboard is empty, it's safe
      if (formats.length === 0) {
        return true;
      }

      // Safe formats: pure text/plain or basic html
      const safeFormats = new Set(['text/plain', 'text/html', 'UTF8_STRING', 'TEXT']);
      return formats.every((fmt) => safeFormats.has(fmt));
    } catch {
      return false;
    }
  }

  public snapshot(): ClipboardSnapshot {
    try {
      const formats = clipboard.availableFormats();
      const hasText = formats.includes('text/plain') || formats.includes('TEXT') || formats.includes('UTF8_STRING');
      const hasHtml = formats.includes('text/html');
      const hasImage = formats.includes('image/png') || formats.includes('image/jpeg');

      const text = hasText ? clipboard.readText() : undefined;
      const html = hasHtml ? clipboard.readHTML() : undefined;

      return {
        hasText,
        text,
        hasHtml,
        html,
        hasImage,
        formats
      };
    } catch {
      return {
        hasText: false,
        hasHtml: false,
        hasImage: false,
        formats: []
      };
    }
  }

  public setTemporaryText(text: string): void {
    this.lastSetText = text;
    clipboard.writeText(text);
  }

  public restore(snapshot: ClipboardSnapshot): void {
    try {
      // Check if clipboard still contains what we placed
      const currentText = clipboard.readText();
      if (this.lastSetText !== null && currentText !== this.lastSetText) {
        // User copied new content during paste operation, do not overwrite!
        return;
      }

      clipboard.clear();

      if (snapshot.text || snapshot.html) {
        clipboard.write({
          text: snapshot.text || '',
          html: snapshot.html
        });
      }
    } catch (err) {
      console.error('Failed to restore clipboard snapshot:', err);
    } finally {
      this.lastSetText = null;
    }
  }
}
