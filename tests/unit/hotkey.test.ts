import { describe, expect, test } from 'bun:test';
import { HotkeyNormalizer } from '../../src/main/hotkeys/HotkeyNormalizer';

describe('HotkeyNormalizer', () => {
  test('normalizes modifiers into canonical Electron format', () => {
    expect(HotkeyNormalizer.normalize('ctrl+alt+p')).toBe('Control+Alt+P');
    expect(HotkeyNormalizer.normalize('alt+ctrl+p')).toBe('Control+Alt+P');
    expect(HotkeyNormalizer.normalize('shift+control+alt+k')).toBe('Control+Alt+Shift+K');
    expect(HotkeyNormalizer.normalize('cmd+shift+f')).toBe('CommandOrControl+Shift+F');
    expect(HotkeyNormalizer.normalize('win+alt+1')).toBe('Alt+Super+1');
  });

  test('normalizes special keys', () => {
    expect(HotkeyNormalizer.normalize('ctrl+space')).toBe('Control+Space');
    expect(HotkeyNormalizer.normalize('alt+enter')).toBe('Alt+Return');
    expect(HotkeyNormalizer.normalize('ctrl+esc')).toBe('Control+Escape');
    expect(HotkeyNormalizer.normalize('f5')).toBe('F5');
    expect(HotkeyNormalizer.normalize('f12')).toBe('F12');
  });

  test('validates that bare letters/numbers without modifiers are rejected', () => {
    expect(HotkeyNormalizer.isValid('A').valid).toBe(false);
    expect(HotkeyNormalizer.isValid('5').valid).toBe(false);
    expect(HotkeyNormalizer.isValid('').valid).toBe(false);
  });

  test('validates that function keys F1-F24 alone are allowed', () => {
    expect(HotkeyNormalizer.isValid('F1').valid).toBe(true);
    expect(HotkeyNormalizer.isValid('F12').valid).toBe(true);
    expect(HotkeyNormalizer.isValid('F24').valid).toBe(true);
  });

  test('validates that combinations with modifiers are allowed', () => {
    expect(HotkeyNormalizer.isValid('Control+Alt+P').valid).toBe(true);
    expect(HotkeyNormalizer.isValid('Control+Shift+1').valid).toBe(true);
    expect(HotkeyNormalizer.isValid('Alt+Super+X').valid).toBe(true);
  });
});
