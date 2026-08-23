import koffi from 'koffi';
import type { WindowHandle } from '../../shared/types';

export interface IWindowsInputService {
  getForegroundWindow(): WindowHandle;
  restoreForegroundWindow(hwnd: WindowHandle): Promise<boolean>;
  waitForModifiersReleased(timeoutMs?: number): Promise<void>;
  sendPaste(): boolean;
  sendUnicode(text: string): boolean;
  isWindow(hwnd: WindowHandle): boolean;
}

const VK_SHIFT = 0x10;
const VK_CONTROL = 0x11;
const VK_MENU = 0x12; // Alt
const VK_LWIN = 0x5B;
const VK_RWIN = 0x5C;
const VK_V = 0x56;

const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_UNICODE = 0x0004;

export class WindowsInputService implements IWindowsInputService {
  private user32: any = null;
  private isAvailable = false;

  private GetForegroundWindowFunc: any;
  private SetForegroundWindowFunc: any;
  private IsWindowFunc: any;
  private GetAsyncKeyStateFunc: any;
  private SendInputFunc: any;

  private INPUT_STRUCT: any;

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

    // Win32 INPUT structure:
    // typedef struct tagINPUT {
    //   DWORD type;
    //   union {
    //     MOUSEINPUT    mi;
    //     KEYBDINPUT    ki;
    //     HARDWAREINPUT hi;
    //   } DUMMYUNIONNAME;
    // } INPUT, *PINPUT, *LPINPUT;

    // KEYBDINPUT:
    // typedef struct tagKEYBDINPUT {
    //   WORD      wVk;
    //   WORD      wScan;
    //   DWORD     dwFlags;
    //   DWORD     time;
    //   ULONG_PTR dwExtraInfo;
    // } KEYBDINPUT;

    const KEYBDINPUT = koffi.struct('KEYBDINPUT', {
      wVk: 'uint16',
      wScan: 'uint16',
      dwFlags: 'uint32',
      time: 'uint32',
      dwExtraInfo: 'uintptr_t'
    });

    const INPUT_UNION = koffi.union('INPUT_UNION', {
      ki: KEYBDINPUT,
      // padding to ensure 64-bit alignment matching largest union member (MOUSEINPUT is 32 bytes on x64)
      dummy: koffi.array('uint8', 32)
    });

    this.INPUT_STRUCT = koffi.struct('INPUT', {
      type: 'uint32',
      u: INPUT_UNION
    });

    this.SendInputFunc = this.user32.func('SendInput', 'uint32', [
      'uint32',
      koffi.pointer(this.INPUT_STRUCT),
      'int'
    ]);
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
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  public sendPaste(): boolean {
    if (!this.isAvailable || !this.SendInputFunc) {
      return false;
    }

    // Sequence: Ctrl Down, V Down, V Up, Ctrl Up
    const inputs = [
      {
        type: INPUT_KEYBOARD,
        u: { ki: { wVk: VK_CONTROL, wScan: 0, dwFlags: 0, time: 0, dwExtraInfo: 0 } }
      },
      {
        type: INPUT_KEYBOARD,
        u: { ki: { wVk: VK_V, wScan: 0, dwFlags: 0, time: 0, dwExtraInfo: 0 } }
      },
      {
        type: INPUT_KEYBOARD,
        u: { ki: { wVk: VK_V, wScan: 0, dwFlags: KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0 } }
      },
      {
        type: INPUT_KEYBOARD,
        u: { ki: { wVk: VK_CONTROL, wScan: 0, dwFlags: KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0 } }
      }
    ];

    const structSize = koffi.sizeof(this.INPUT_STRUCT);
    const sent = this.SendInputFunc(inputs.length, inputs, structSize);
    return sent === inputs.length;
  }

  public sendUnicode(text: string): boolean {
    if (!this.isAvailable || !this.SendInputFunc || !text) {
      return false;
    }

    const inputs: any[] = [];

    // Normalize CRLF
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);

      if (normalized[i] === '\n') {
        // VK_RETURN down & up
        inputs.push({
          type: INPUT_KEYBOARD,
          u: { ki: { wVk: 0x0D, wScan: 0, dwFlags: 0, time: 0, dwExtraInfo: 0 } }
        });
        inputs.push({
          type: INPUT_KEYBOARD,
          u: { ki: { wVk: 0x0D, wScan: 0, dwFlags: KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0 } }
        });
      } else {
        // Send KEYEVENTF_UNICODE
        inputs.push({
          type: INPUT_KEYBOARD,
          u: { ki: { wVk: 0, wScan: charCode, dwFlags: KEYEVENTF_UNICODE, time: 0, dwExtraInfo: 0 } }
        });
        inputs.push({
          type: INPUT_KEYBOARD,
          u: { ki: { wVk: 0, wScan: charCode, dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0 } }
        });
      }
    }

    const structSize = koffi.sizeof(this.INPUT_STRUCT);

    // Send in chunks of 100 inputs to prevent buffer limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < inputs.length; i += CHUNK_SIZE) {
      const chunk = inputs.slice(i, i + CHUNK_SIZE);
      const sent = this.SendInputFunc(chunk.length, chunk, structSize);
      if (sent !== chunk.length) {
        return false;
      }
    }

    return true;
  }
}
