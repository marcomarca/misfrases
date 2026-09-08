import { describe, expect, test } from 'bun:test';
import { WindowsInputService } from '../../src/main/windows/WindowsInputService';

describe('WindowsInputService - Modifier Sanitization', () => {
  test('forceReleaseModifiers never attempts to release Windows keys (VK_LWIN / VK_RWIN)', () => {
    const service = new WindowsInputService();

    const releasedKeys: number[] = [];
    (service as any).isAvailable = true;
    (service as any).keybd_eventFunc = (vk: number) => {
      releasedKeys.push(vk);
    };
    // Simulate all keys being physically pressed
    (service as any).GetAsyncKeyStateFunc = () => -32768; // 0x8000

    service.forceReleaseModifiers();

    // Must NOT contain 0x5B (VK_LWIN) or 0x5C (VK_RWIN)
    expect(releasedKeys).not.toContain(0x5b);
    expect(releasedKeys).not.toContain(0x5c);

    // Should only contain paste modifiers: VK_V (0x56), VK_CONTROL (0x11), VK_MENU (0x12), VK_SHIFT (0x10)
    expect(releasedKeys).toContain(0x56);
    expect(releasedKeys).toContain(0x11);
    expect(releasedKeys).toContain(0x12);
    expect(releasedKeys).toContain(0x10);
  });

  test('forceReleaseModifiers does not send KEYUP when keys are not held down', () => {
    const service = new WindowsInputService();

    const releasedKeys: number[] = [];
    (service as any).isAvailable = true;
    (service as any).keybd_eventFunc = (vk: number) => {
      releasedKeys.push(vk);
    };
    // Simulate keys NOT being held down (bit 15 = 0)
    (service as any).GetAsyncKeyStateFunc = () => 0;

    service.forceReleaseModifiers();

    // Nothing should be released
    expect(releasedKeys.length).toBe(0);
  });

  test('forceReleaseModifiers only releases the specific key that is pressed', () => {
    const service = new WindowsInputService();

    const releasedKeys: number[] = [];
    (service as any).isAvailable = true;
    (service as any).keybd_eventFunc = (vk: number) => {
      releasedKeys.push(vk);
    };
    // Only VK_CONTROL (0x11) is pressed
    (service as any).GetAsyncKeyStateFunc = (vk: number) => {
      return vk === 0x11 ? -32768 : 0;
    };

    service.forceReleaseModifiers();

    expect(releasedKeys).toEqual([0x11]);
  });
});
