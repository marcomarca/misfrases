import koffi from 'koffi';
import type { WindowHandle } from '../../shared/types';

export interface IWindowsInputService {
  getForegroundWindow(): WindowHandle;
  restoreForegroundWindow(hwnd: WindowHandle): Promise<boolean>;
  waitForModifiersReleased(timeoutMs?: number): Promise<void>;
  forceReleaseModifiers(): void;
  sendPaste(): boolean;
  isWindow(hwnd: WindowHandle): boolean;
}

const VK_SHIFT = 0x10;
const VK_CONTROL = 0x11;
const VK_MENU = 0x12; // Alt
const VK_RETURN = 0x0D;
const VK_LWIN = 0x5B;
const VK_RWIN = 0x5C;
const VK_V = 0x56;

const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_UNICODE = 0x0004;

// Win32 tagINPUT size on x64 is 40 bytes:
// offset 0: DWORD type = 1
// offset 4: 4 bytes padding (align union to 8 bytes)
// offset 8: WORD wVk
// offset 10: WORD wScan
// offset 12: DWORD dwFlags
// offset 16: DWORD time
// offset 20: 4 bytes padding (align dwExtraInfo to 8 bytes)
// offset 24: ULONG_PTR dwExtraInfo
// offset 32: 8 bytes padding (union total size 32 bytes)
const INPUT_SIZE_X64 = 40;

export class WindowsInputService implements IWindowsInputService {
  private user32: any = null;
  private isAvailable = false;

  private GetForegroundWindowFunc: any;
  private SetForegroundWindowFunc: any;
  private IsWindowFunc: any;
  private GetAsyncKeyStateFunc: any;
  private SendInputFunc: any;
  private keybd_eventFunc: any;

  constructor() {
    if (process.platform === 'win32') {
      try {
        this.initKoffi();
        this.isAvailable = true;
      } catch (err) {
        console.error('Failed to initialize Win32 FFI with Koffi:', err);
      }
    }
  }

  private initKoffi(): void {
    this.user32 = koffi.load('user32.dll');

    this.GetForegroundWindowFunc = this.user32.func('GetForegroundWindow', 'intptr_t', []);
    this.SetForegroundWindowFunc = this.user32.func('SetForegroundWindow', 'bool', ['intptr_t']);
    this.IsWindowFunc = this.user32.func('IsWindow', 'bool', ['intptr_t']);
    this.GetAsyncKeyStateFunc = this.user32.func('GetAsyncKeyState', 'short', ['int']);
    this.keybd_eventFunc = this.user32.func('keybd_event', 'void', ['uint8', 'uint8', 'uint32', 'uintptr_t']);
    this.SendInputFunc = this.user32.func('SendInput', 'uint32', ['uint32', 'void *', 'int']);
  }

  private writeKeyboardInput(buffer: Buffer, offset: number, vk: number, scan: number, flags: number): void {
    buffer.writeUInt32LE(INPUT_KEYBOARD, offset + 0);
    buffer.writeUInt32LE(0, offset + 4);
    buffer.writeUInt16LE(vk, offset + 8);
    buffer.writeUInt16LE(scan, offset + 10);
    buffer.writeUInt32LE(flags, offset + 12);
    buffer.writeUInt32LE(0, offset + 16);
    buffer.writeUInt32LE(0, offset + 20);
    buffer.writeBigUInt64LE(0n, offset + 24);
    buffer.writeBigUInt64LE(0n, offset + 32);
  }

  public getForegroundWindow(): WindowHandle {
    if (!this.isAvailable || !this.GetForegroundWindowFunc) {
      return 0;
    }
    const handle = this.GetForegroundWindowFunc();
    return handle || 0;
  }

  public isWindow(hwnd: WindowHandle): boolean {
    if (!this.isAvailable || !this.IsWindowFunc || !hwnd) {
      return false;
    }
    return Boolean(this.IsWindowFunc(hwnd));
  }

  public async restoreForegroundWindow(hwnd: WindowHandle): Promise<boolean> {
    if (!this.isAvailable || !hwnd) {
      return false;
    }

    if (!this.isWindow(hwnd)) {
      return false;
    }

    // Try setting foreground window
    const ok = Boolean(this.SetForegroundWindowFunc(hwnd));

    // Wait a brief tick for OS focus transition
    await new Promise((resolve) => setTimeout(resolve, 50));
    return ok;
  }

  public forceReleaseModifiers(): void {
    if (!this.isAvailable) {
      return;
    }

    // Only release modifiers used during paste injection; NEVER release VK_LWIN/VK_RWIN
    // as standalone KEYUP on Win triggers the Windows Start Menu.
    const keysToRelease = [VK_V, VK_CONTROL, VK_MENU, VK_SHIFT];

    // Use keybd_event only for keys that are actually logically or physically pressed
    if (this.keybd_eventFunc) {
      for (const vk of keysToRelease) {
        try {
          if (this.GetAsyncKeyStateFunc && (this.GetAsyncKeyStateFunc(vk) & 0x8000) === 0) {
            continue;
          }
          this.keybd_eventFunc(vk, 0, KEYEVENTF_KEYUP, 0);
        } catch {
          // Ignore key release error
        }
      }
    }
  }

  public async waitForModifiersReleased(timeoutMs = 1000): Promise<void> {
    if (!this.isAvailable || !this.GetAsyncKeyStateFunc) {
      return;
    }

    const start = Date.now();
    const isPressed = (vKey: number) => (this.GetAsyncKeyStateFunc(vKey) & 0x8000) !== 0;

    while (Date.now() - start < timeoutMs) {
      const ctrl = isPressed(VK_CONTROL);
      const alt = isPressed(VK_MENU);
      const shift = isPressed(VK_SHIFT);
      const lwin = isPressed(VK_LWIN);
      const rwin = isPressed(VK_RWIN);

      if (!ctrl && !alt && !shift && !lwin && !rwin) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    // Explicitly unlatch any logical modifier state in the OS input queue
    this.forceReleaseModifiers();
  }

  public sendPaste(): boolean {
    if (!this.isAvailable) {
      return false;
    }

    // Pre-sanitize modifier states to avoid dirty combinations
    this.forceReleaseModifiers();

    let success = false;

    // 1. Attempt Win32 SendInput with contiguous buffer
    if (this.SendInputFunc) {
      try {
        const buffer = Buffer.alloc(4 * INPUT_SIZE_X64);
        this.writeKeyboardInput(buffer, 0 * INPUT_SIZE_X64, VK_CONTROL, 0, 0);
        this.writeKeyboardInput(buffer, 1 * INPUT_SIZE_X64, VK_V, 0, 0);
        this.writeKeyboardInput(buffer, 2 * INPUT_SIZE_X64, VK_V, 0, KEYEVENTF_KEYUP);
        this.writeKeyboardInput(buffer, 3 * INPUT_SIZE_X64, VK_CONTROL, 0, KEYEVENTF_KEYUP);

        const sent = this.SendInputFunc(4, buffer, INPUT_SIZE_X64);
        if (sent === 4) {
          success = true;
        }
      } catch (err) {
        console.error('SendInput paste error:', err);
      }
    }

    // 2. Resilient fallback to keybd_event if SendInput failed or was blocked by UIPI
    if (!success && this.keybd_eventFunc) {
      try {
        this.keybd_eventFunc(VK_CONTROL, 0, 0, 0);
        this.keybd_eventFunc(VK_V, 0, 0, 0);
        this.keybd_eventFunc(VK_V, 0, KEYEVENTF_KEYUP, 0);
        this.keybd_eventFunc(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
        success = true;
      } catch (err) {
        console.error('keybd_event paste fallback error:', err);
      }
    }

    // Post-sanitize: ensure neither V nor Ctrl remains held down in any queue
    this.forceReleaseModifiers();

    return success;
  }
}
