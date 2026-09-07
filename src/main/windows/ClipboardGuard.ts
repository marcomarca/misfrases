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
    return true;
  }

  public snapshot(): ClipboardSnapshot {
    try {
      const formats = clipboard.availableFormats();
      const hasText = formats.some(
        (f) => f.includes('text') || f === 'TEXT' || f === 'UTF8_STRING' || f === 'CF_UNICODETEXT'
      );
      const hasHtml = formats.includes('text/html');
      const hasImage = formats.some((f) => f.includes('image') || f === 'image/png' || f === 'image/jpeg');

      const text = clipboard.readText();
      const html = hasHtml ? clipboard.readHTML() : undefined;
      const image = hasImage ? clipboard.readImage() : undefined;

      return {
        hasText: Boolean(text),
        text: text || '',
        hasHtml,
        html,
        hasImage,
        image,
        formats
      };
    } catch {
      return {
        hasText: false,
        text: '',
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
      // Check if clipboard still contains what we placed (normalize line endings for Windows)
      const currentText = clipboard.readText().replace(/\r\n/g, '\n');
      const expectedText = (this.lastSetText ?? '').replace(/\r\n/g, '\n');

      if (this.lastSetText !== null && currentText !== expectedText) {
        // User copied new content during paste operation, do not overwrite!
        return;
      }

      if (snapshot.hasImage && snapshot.image && !snapshot.image.isEmpty()) {
        clipboard.writeImage(snapshot.image);
        return;
      }

      if (snapshot.hasHtml && snapshot.html && snapshot.text) {
        clipboard.write({
          text: snapshot.text,
          html: snapshot.html
        });
        return;
      }

      if (snapshot.text) {
        clipboard.writeText(snapshot.text);
      } else {
        clipboard.clear();
      }
    } catch (err) {
      console.error('Failed to restore clipboard snapshot:', err);
    } finally {
      this.lastSetText = null;
    }
  }
}
