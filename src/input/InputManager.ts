function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export interface CarInputState {
  throttle: number;         // -1 (reverse) to +1 (forward)
  steer: number;            // -1 (left) to +1 (right)
  pitch: number;            // -1 (down) to +1 (up)
  yaw: number;              // -1 (left) to +1 (right)
  roll: number;             // -1 (roll left) to +1 (roll right)
  jump: boolean;            // Held
  jumpJustPressed: boolean; // Single-frame trigger
  boost: boolean;           // Held
  handbrake: boolean;       // Drift / Powerslide
  toggleCamera: boolean;    // Single-frame trigger for Ball Cam
  usePowerup: boolean;      // Single-frame trigger for Rumble
}

export type InputState = CarInputState;

export interface GlobalInputState {
  p1: CarInputState;
  p2: CarInputState;
  resetKickoff: boolean;
  togglePause: boolean;
  toggleControls: boolean;
  gamepadsConnected: number;
}

export class InputManager {
  private keys: Map<string, boolean> = new Map();
  private justPressedKeys: Set<string> = new Set();
  private mouseBoost: boolean = false;
  private mouseCamToggle: boolean = false;

  // Track previous gamepad button states for single-frame triggers
  private prevGpButtonsP1: boolean[] = [];
  private prevGpButtonsP2: boolean[] = [];

  // Dedicated touch button states
  private touchState: Map<string, boolean> = new Map();
  private touchJustPressed: Set<string> = new Set();

  constructor() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    window.addEventListener('blur', () => this.clear());
    window.addEventListener('contextmenu', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'CANVAS') {
        e.preventDefault();
        this.mouseCamToggle = true;
      }
    });

    this.setupTouchListeners();
  }

  private onKeyDown(e: KeyboardEvent): void {
    const code = e.code;
    const key = e.key;

    if (code) {
      if (!this.keys.get(code)) this.justPressedKeys.add(code);
      this.keys.set(code, true);
    }
    if (key) {
      if (!this.keys.get(key)) this.justPressedKeys.add(key);
      this.keys.set(key, true);
      const lower = key.toLowerCase();
      if (!this.keys.get(lower)) this.justPressedKeys.add(lower);
      this.keys.set(lower, true);
    }

    // Prevent default scrolling for game keys
    if (
      ['Space', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Numpad0'].includes(code) ||
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)
    ) {
      e.preventDefault();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.code) this.keys.set(e.code, false);
    if (e.key) {
      this.keys.set(e.key, false);
      this.keys.set(e.key.toLowerCase(), false);
    }
  }

  private onMouseDown(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target) return;
    const isCanvas = target.tagName === 'CANVAS' || target.id === 'canvas-container';
    if (!isCanvas) return;

    if (e.button === 0) {
      this.mouseBoost = true;
    } else if (e.button === 2) {
      this.mouseCamToggle = true;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseBoost = false;
    }
  }

  private setupTouchListeners(): void {
    const attachTouch = () => {
      const touchBtns = document.querySelectorAll<HTMLElement>('.touch-btn, .touch-action-btn');
      touchBtns.forEach((btn) => {
        const key = btn.getAttribute('data-key');
        if (!key) return;

        const handleDown = (e: Event) => {
          e.preventDefault();
          if (!this.touchState.get(key)) {
            this.touchJustPressed.add(key);
          }
          this.touchState.set(key, true);
        };

        const handleUp = (e: Event) => {
          e.preventDefault();
          this.touchState.set(key, false);
        };

        btn.addEventListener('pointerdown', handleDown, { passive: false });
        btn.addEventListener('pointerup', handleUp, { passive: false });
        btn.addEventListener('pointercancel', handleUp, { passive: false });
        btn.addEventListener('pointerleave', handleUp, { passive: false });
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachTouch);
    } else {
      attachTouch();
    }
  }

  public clear(): void {
    this.keys.clear();
    this.justPressedKeys.clear();
    this.touchState.clear();
    this.touchJustPressed.clear();
    this.mouseBoost = false;
    this.mouseCamToggle = false;
  }

  public isHeld(...codes: string[]): boolean {
    for (const code of codes) {
      if (this.keys.get(code) || this.touchState.get(code)) return true;
    }
    return false;
  }

  public isJustPressed(...codes: string[]): boolean {
    for (const code of codes) {
      if (this.justPressedKeys.has(code) || this.touchJustPressed.has(code)) return true;
    }
    return false;
  }

  public playHaptic(gamepadIndex: number, durationMs: number = 150, weak: number = 0.5, strong: number = 0.5): void {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[gamepadIndex];
    if (gp && (gp as any).vibrationActuator) {
      try {
        (gp as any).vibrationActuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: durationMs,
          weakMagnitude: weak,
          strongMagnitude: strong
        });
      } catch (_e) {
        // Vibration not supported
      }
    }
  }

  public update(): GlobalInputState {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gamepadsCount = 0;
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) gamepadsCount++;
    }

    // -------------------------------------------------------------
    // 1. PLAYER 1 (MAIN USER) KEYBOARD & MOUSE CONTROLS
    // Supports BOTH Keyboard Arrows AND WASD simultaneously!
    // -------------------------------------------------------------
    const p1Forward = this.isHeld('ArrowUp', 'KeyW', 'w', 'W', 'Up');
    const p1Reverse = this.isHeld('ArrowDown', 'KeyS', 's', 'S', 'Down');
    const p1Left = this.isHeld('ArrowLeft', 'KeyA', 'a', 'A', 'Left');
    const p1Right = this.isHeld('ArrowRight', 'KeyD', 'd', 'D', 'Right');
    const p1RollL = this.isHeld('KeyQ', 'q', 'Q', 'BracketLeft');
    const p1RollR = this.isHeld('KeyE', 'e', 'E', 'BracketRight');

    let p1Throttle = (p1Forward ? 1 : 0) - (p1Reverse ? 1 : 0);
    let p1Steer = (p1Right ? 1 : 0) - (p1Left ? 1 : 0);
    let p1Pitch = (p1Reverse ? 1 : 0) - (p1Forward ? 1 : 0); // Reverse/Down = Nose Up (+), Forward/Up = Nose Down (-)
    let p1Yaw = p1Steer;
    let p1Roll = (p1RollR ? 1 : 0) - (p1RollL ? 1 : 0);

    let p1Jump = this.isHeld('Space', ' ', 'Numpad0', 'KeyJ', 'j', 'Enter', 'ControlRight');
    let p1JumpJustPressed = this.isJustPressed('Space', ' ', 'Numpad0', 'KeyJ', 'j', 'Enter', 'ControlRight');

    let p1Boost =
      this.isHeld('ShiftLeft', 'ShiftRight', 'Shift', 'KeyF', 'f', 'KeyE', 'e', 'KeyK', 'k', 'KeyL', 'l', 'AltLeft', 'AltRight', 'Alt') ||
      this.mouseBoost;

    let p1Handbrake =
      this.isHeld('KeyX', 'x', 'KeyQ', 'q', 'ControlLeft', 'ControlRight', 'Control', 'Numpad2');

    let p1ToggleCam =
      this.isJustPressed('KeyC', 'c', 'Tab', 'KeyM', 'm') ||
      this.mouseCamToggle;

    let p1UsePowerup =
      this.isJustPressed('KeyR', 'r', 'Enter', 'Numpad3');

    // Reset single-frame mouse trigger
    this.mouseCamToggle = false;

    // -------------------------------------------------------------
    // 2. PLAYER 1 GAMEPAD (Gamepad Index 0)
    // -------------------------------------------------------------
    const gp1 = gamepads[0];
    if (gp1) {
      const deadzone = 0.12;

      const stickX = Math.abs(gp1.axes[0] ?? 0) > deadzone ? gp1.axes[0] : 0;
      const stickY = Math.abs(gp1.axes[1] ?? 0) > deadzone ? gp1.axes[1] : 0;

      const getBtnValue = (btn: GamepadButton | undefined): number => {
        if (!btn) return 0;
        return typeof btn === 'number' ? btn : (btn.value ?? (btn.pressed ? 1.0 : 0.0));
      };

      const rtVal = getBtnValue(gp1.buttons[7]);
      const ltVal = getBtnValue(gp1.buttons[6]);

      if (rtVal > 0.05 || ltVal > 0.05) {
        p1Throttle = rtVal - ltVal;
      } else if (Math.abs(stickY) > deadzone && p1Throttle === 0) {
        p1Throttle = -stickY;
      }

      if (Math.abs(stickX) > 0) {
        p1Steer = stickX;
        p1Yaw = stickX;
      }

      if (Math.abs(stickY) > 0) {
        p1Pitch = stickY;
      }

      if (gp1.buttons[14]?.pressed) { p1Steer = -1; p1Yaw = -1; }
      if (gp1.buttons[15]?.pressed) { p1Steer = 1; p1Yaw = 1; }
      if (gp1.buttons[12]?.pressed && p1Throttle === 0) p1Throttle = 1;
      if (gp1.buttons[13]?.pressed && p1Throttle === 0) p1Throttle = -1;

      const btnA = !!gp1.buttons[0]?.pressed;
      const btnB = !!gp1.buttons[1]?.pressed;
      const btnX = !!gp1.buttons[2]?.pressed;
      const btnY = !!gp1.buttons[3]?.pressed;
      const btnLB = !!gp1.buttons[4]?.pressed;
      const btnRB = !!gp1.buttons[5]?.pressed;
      const btnL3 = !!gp1.buttons[10]?.pressed;
      const btnR3 = !!gp1.buttons[11]?.pressed;

      if (btnA) p1Jump = true;
      if (btnA && !this.prevGpButtonsP1[0]) p1JumpJustPressed = true;

      if (btnB || btnRB) p1Boost = true;
      if (btnX || btnLB) p1Handbrake = true;

      if (btnY && !this.prevGpButtonsP1[3]) p1ToggleCam = true;
      if (btnR3 && !this.prevGpButtonsP1[11]) p1ToggleCam = true;

      if (btnLB && !btnRB) p1Roll = -1;
      if (btnRB && !btnLB) p1Roll = 1;

      if (btnL3 && !this.prevGpButtonsP1[10]) p1UsePowerup = true;

      this.prevGpButtonsP1 = gp1.buttons.map((b) => !!b?.pressed);
    }

    // -------------------------------------------------------------
    // 3. PLAYER 2 KEYBOARD CONTROLS (Split-Screen Mode)
    // -------------------------------------------------------------
    const p2Up = this.isHeld('KeyI', 'i');
    const p2Down = this.isHeld('KeyK', 'k');
    const p2Left = this.isHeld('KeyJ', 'j');
    const p2Right = this.isHeld('KeyL', 'l');
    const p2RollL = this.isHeld('KeyU', 'u', 'Numpad7');
    const p2RollR = this.isHeld('KeyO', 'o', 'Numpad9');

    let p2Throttle = (p2Up ? 1 : 0) - (p2Down ? 1 : 0);
    let p2Steer = (p2Right ? 1 : 0) - (p2Left ? 1 : 0);
    let p2Pitch = (p2Down ? 1 : 0) - (p2Up ? 1 : 0);
    let p2Yaw = p2Steer;
    let p2Roll = (p2RollR ? 1 : 0) - (p2RollL ? 1 : 0);

    let p2Jump = this.isHeld('Numpad0', 'Slash', '/');
    let p2JumpJustPressed = this.isJustPressed('Numpad0', 'Slash', '/');

    let p2Boost = this.isHeld('Numpad1', 'KeyP', 'p');
    let p2Handbrake = this.isHeld('Numpad2', 'Period', '.');
    let p2ToggleCam = this.isJustPressed('NumpadDecimal', 'KeyM', 'm');
    let p2UsePowerup = this.isJustPressed('Numpad3', 'Backslash', '\\');

    // -------------------------------------------------------------
    // 4. PLAYER 2 GAMEPAD (Gamepad Index 1)
    // -------------------------------------------------------------
    const gp2 = gamepads[1];
    if (gp2) {
      const deadzone = 0.12;
      const stickX = Math.abs(gp2.axes[0] ?? 0) > deadzone ? gp2.axes[0] : 0;
      const stickY = Math.abs(gp2.axes[1] ?? 0) > deadzone ? gp2.axes[1] : 0;

      const getBtnValue = (btn: GamepadButton | undefined): number => {
        if (!btn) return 0;
        return typeof btn === 'number' ? btn : (btn.value ?? (btn.pressed ? 1.0 : 0.0));
      };

      const rtVal = getBtnValue(gp2.buttons[7]);
      const ltVal = getBtnValue(gp2.buttons[6]);

      if (rtVal > 0.05 || ltVal > 0.05) {
        p2Throttle = rtVal - ltVal;
      } else if (Math.abs(stickY) > deadzone) {
        p2Throttle = -stickY;
      }

      if (Math.abs(stickX) > 0) {
        p2Steer = stickX;
        p2Yaw = stickX;
      }

      if (Math.abs(stickY) > 0) {
        p2Pitch = stickY;
      }

      if (gp2.buttons[14]?.pressed) { p2Steer = -1; p2Yaw = -1; }
      if (gp2.buttons[15]?.pressed) { p2Steer = 1; p2Yaw = 1; }
      if (gp2.buttons[12]?.pressed && p2Throttle === 0) p2Throttle = 1;
      if (gp2.buttons[13]?.pressed && p2Throttle === 0) p2Throttle = -1;

      const btnA = !!gp2.buttons[0]?.pressed;
      const btnB = !!gp2.buttons[1]?.pressed;
      const btnX = !!gp2.buttons[2]?.pressed;
      const btnY = !!gp2.buttons[3]?.pressed;
      const btnLB = !!gp2.buttons[4]?.pressed;
      const btnRB = !!gp2.buttons[5]?.pressed;
      const btnL3 = !!gp2.buttons[10]?.pressed;
      const btnR3 = !!gp2.buttons[11]?.pressed;

      if (btnA) p2Jump = true;
      if (btnA && !this.prevGpButtonsP2[0]) p2JumpJustPressed = true;

      if (btnB || btnRB) p2Boost = true;
      if (btnX || btnLB) p2Handbrake = true;

      if (btnY && !this.prevGpButtonsP2[3]) p2ToggleCam = true;
      if (btnR3 && !this.prevGpButtonsP2[11]) p2ToggleCam = true;

      if (btnLB && !btnRB) p2Roll = -1;
      if (btnRB && !btnLB) p2Roll = 1;

      if (btnL3 && !this.prevGpButtonsP2[10]) p2UsePowerup = true;

      this.prevGpButtonsP2 = gp2.buttons.map((b) => !!b?.pressed);
    }

    // -------------------------------------------------------------
    // 5. SYSTEM CONTROLS
    // -------------------------------------------------------------
    const resetKickoff =
      this.isJustPressed('KeyT', 't', 'Backspace') ||
      (gp1?.buttons[8]?.pressed && !this.prevGpButtonsP1[8]);

    const togglePause =
      this.isJustPressed('Escape', 'KeyP', 'p') ||
      (gp1?.buttons[9]?.pressed && !this.prevGpButtonsP1[9]);

    const toggleControls = this.isJustPressed('KeyH', 'h');

    // Flush single-frame triggers
    this.justPressedKeys.clear();
    this.touchJustPressed.clear();

    return {
      p1: {
        throttle: clamp(p1Throttle, -1, 1),
        steer: clamp(p1Steer, -1, 1),
        pitch: clamp(p1Pitch, -1, 1),
        yaw: clamp(p1Yaw, -1, 1),
        roll: clamp(p1Roll, -1, 1),
        jump: p1Jump,
        jumpJustPressed: p1JumpJustPressed,
        boost: p1Boost,
        handbrake: p1Handbrake,
        toggleCamera: p1ToggleCam,
        usePowerup: p1UsePowerup
      },
      p2: {
        throttle: clamp(p2Throttle, -1, 1),
        steer: clamp(p2Steer, -1, 1),
        pitch: clamp(p2Pitch, -1, 1),
        yaw: clamp(p2Yaw, -1, 1),
        roll: clamp(p2Roll, -1, 1),
        jump: p2Jump,
        jumpJustPressed: p2JumpJustPressed,
        boost: p2Boost,
        handbrake: p2Handbrake,
        toggleCamera: p2ToggleCam,
        usePowerup: p2UsePowerup
      },
      resetKickoff: !!resetKickoff,
      togglePause: !!togglePause,
      toggleControls: !!toggleControls,
      gamepadsConnected: gamepadsCount
    };
  }
}
