export class HotkeyNormalizer {
  private static MODIFIER_MAP: Record<string, string> = {
    ctrl: 'Control',
    control: 'Control',
    alt: 'Alt',
    option: 'Alt',
    shift: 'Shift',
    cmd: 'CommandOrControl',
    command: 'CommandOrControl',
    meta: 'Super',
    super: 'Super',
    win: 'Super',
    windows: 'Super'
  };

  public static normalize(input: string): string {
    if (!input || !input.trim()) {
      return '';
    }

    const parts = input
      .split('+')
      .map((p) => p.trim())
      .filter(Boolean);

    const modifiers: string[] = [];
    let key = '';

    for (const part of parts) {
      const lower = part.toLowerCase();
      if (this.MODIFIER_MAP[lower]) {
        const mod = this.MODIFIER_MAP[lower];
        if (!modifiers.includes(mod)) {
          modifiers.push(mod);
        }
      } else {
        key = this.normalizeKey(part);
      }
    }

    // Sort modifiers deterministically: Control, Alt, Shift, Super/CommandOrControl
    const sortOrder = ['Control', 'CommandOrControl', 'Alt', 'Shift', 'Super'];
    modifiers.sort((a, b) => sortOrder.indexOf(a) - sortOrder.indexOf(b));

    if (key) {
      modifiers.push(key);
    }

    return modifiers.join('+');
  }

  private static normalizeKey(key: string): string {
    const upper = key.toUpperCase();

    // Check function keys F1-F24
    if (/^F([1-9]|1[0-9]|2[0-4])$/.test(upper)) {
      return upper;
    }

    // Special keys
    const specialKeys: Record<string, string> = {
      ESC: 'Escape',
      ESCAPE: 'Escape',
      SPACE: 'Space',
      SPACEBAR: 'Space',
      TAB: 'Tab',
      ENTER: 'Return',
      RETURN: 'Return',
      BACKSPACE: 'Backspace',
      DELETE: 'Delete',
      DEL: 'Delete',
      INSERT: 'Insert',
      INS: 'Insert',
      HOME: 'Home',
      END: 'End',
      PAGEUP: 'PageUp',
      PAGEDOWN: 'PageDown',
      UP: 'Up',
      DOWN: 'Down',
      LEFT: 'Left',
      RIGHT: 'Right'
    };

    if (specialKeys[upper]) {
      return specialKeys[upper];
    }

    // Single character letters / numbers
    if (key.length === 1) {
      return key.toUpperCase();
    }

    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  public static isValid(accelerator: string): { valid: boolean; reason?: string } {
    if (!accelerator || !accelerator.trim()) {
      return { valid: false, reason: 'El atajo no puede estar vacío.' };
    }

    const parts = accelerator.split('+').map((p) => p.trim());
    if (parts.length === 0) {
      return { valid: false, reason: 'Atajo inválido.' };
    }

    const modifiers = parts.slice(0, -1);
    const key = parts[parts.length - 1];

    // Check if key is F1-F24 (allowed alone)
    const isFunctionKey = /^F([1-9]|1[0-9]|2[0-4])$/i.test(key);

    if (modifiers.length === 0 && !isFunctionKey) {
      return {
        valid: false,
        reason: 'Se requiere al menos un modificador (Ctrl, Alt, Shift) para teclas que no sean F1-F24.'
      };
    }

    return { valid: true };
  }
}
