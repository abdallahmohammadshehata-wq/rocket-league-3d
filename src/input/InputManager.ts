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
      // Allow right click to toggle ball cam if clicking inside canvas
      if ((e.target as HTMLElement)?.tagName === 'CANVAS') {
        e.preventDefault();
        this.mouseCamToggle = true;
      }
    });

    this.setupTouchListeners();
  }

  private onKeyDown(e: KeyboardEvent): void {
    const key = e.code;
    if (!this.keys.get(key)) {
      this.justPressedKeys.add(key);
    }
    this.keys.set(key, true);

    // Prevent default scrolling for game keys
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Numpad0'].includes(e.code)) {
      e.preventDefault();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.set(e.code, false);
  }

  private onMouseDown(e: MouseEvent): void {
    // Only register canvas clicks, avoid UI elements/modals
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

  public isHeld(code: string): boolean {
    return !!this.keys.get(code) || !!this.touchState.get(code);
  }

  public isJustPressed(code: string): boolean {
    return this.justPressedKeys.has(code) || this.touchJustPressed.has(code);
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
        // Haptic feedback not supported on this platform
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
    // 1. PLAYER 1 KEYBOARD & MOUSE CONTROLS
    // -------------------------------------------------------------
    const p1W = this.isHeld('KeyW') || this.isHeld('ArrowUp');
    const p1S = this.isHeld('KeyS') || this.isHeld('ArrowDown');
    const p1A = this.isHeld('KeyA') || this.isHeld('ArrowLeft');
    const p1D = this.isHeld('KeyD') || this.isHeld('ArrowRight');
    const p1Q = this.isHeld('KeyQ');
    const p1E = this.isHeld('KeyE');

    let p1Throttle = (p1W ? 1 : 0) - (p1S ? 1 : 0);
    let p1Steer = (p1D ? 1 : 0) - (p1A ? 1 : 0);
    let p1Pitch = (p1S ? 1 : 0) - (p1W ? 1 : 0); // S = Nose Up (+), W = Nose Down (-)
    let p1Yaw = p1Steer;
    let p1Roll = (p1E ? 1 : 0) - (p1Q ? 1 : 0);

    let p1Jump = this.isHeld('Space') || this.isHeld('Numpad0') || this.isHeld('KeyJ');
    let p1JumpJustPressed = this.isJustPressed('Space') || this.isJustPressed('Numpad0') || this.isJustPressed('KeyJ');

    let p1Boost =
      this.isHeld('ShiftLeft') ||
      this.isHeld('ShiftRight') ||
      this.isHeld('KeyF') ||
      this.isHeld('KeyE') ||
      this.isHeld('KeyK') ||
      this.isHeld('KeyL') ||
      this.mouseBoost;

    let p1Handbrake =
      this.isHeld('KeyX') ||
      this.isHeld('KeyQ') ||
      this.isHeld('ControlLeft') ||
      this.isHeld('Numpad2');

    let p1ToggleCam =
      this.isJustPressed('KeyC') ||
      this.isJustPressed('Tab') ||
      this.isJustPressed('KeyM') ||
      this.mouseCamToggle;

    let p1UsePowerup =
      this.isJustPressed('KeyR') ||
      this.isJustPressed('Enter') ||
      this.isJustPressed('Numpad3');

    // Reset single-frame mouse trigger
    this.mouseCamToggle = false;

    // -------------------------------------------------------------
    // 2. PLAYER 1 GAMEPAD (Gamepad Index 0)
    // -------------------------------------------------------------
    const gp1 = gamepads[0];
    if (gp1) {
      const deadzone = 0.12;

      // Analog Sticks
      const stickX = Math.abs(gp1.axes[0] ?? 0) > deadzone ? gp1.axes[0] : 0;
      const stickY = Math.abs(gp1.axes[1] ?? 0) > deadzone ? gp1.axes[1] : 0;

      // Triggers for Throttle (RT = 7) and Brake/Reverse (LT = 6)
      const getBtnValue = (btn: GamepadButton | undefined): number => {
        if (!btn) return 0;
        return typeof btn === 'number' ? btn : (btn.value ?? (btn.pressed ? 1.0 : 0.0));
      };

      const rtVal = getBtnValue(gp1.buttons[7]);
      const ltVal = getBtnValue(gp1.buttons[6]);

      // If triggers pressed, use them for throttle
      if (rtVal > 0.05 || ltVal > 0.05) {
        p1Throttle = rtVal - ltVal;
      } else if (Math.abs(stickY) > deadzone) {
        // Fallback stick throttle if triggers are idle (Stick up = Forward, Stick down = Reverse)
        p1Throttle = -stickY;
      }

      if (Math.abs(stickX) > 0) {
        p1Steer = stickX;
        p1Yaw = stickX;
      }

      if (Math.abs(stickY) > 0) {
        p1Pitch = stickY; // Stick Down = Nose Up (+), Stick Up = Nose Down (-)
      }

      // D-Pad Input support (Buttons 12=Up, 13=Down, 14=Left, 15=Right)
      if (gp1.buttons[14]?.pressed) { p1Steer = -1; p1Yaw = -1; }
      if (gp1.buttons[15]?.pressed) { p1Steer = 1; p1Yaw = 1; }
      if (gp1.buttons[12]?.pressed && p1Throttle === 0) p1Throttle = 1;
      if (gp1.buttons[13]?.pressed && p1Throttle === 0) p1Throttle = -1;

      // Face Buttons & Bumpers
      const btnA = !!gp1.buttons[0]?.pressed; // Bottom button (Jump)
      const btnB = !!gp1.buttons[1]?.pressed; // Right button (Boost)
      const btnX = !!gp1.buttons[2]?.pressed; // Left button (Handbrake / Air Roll)
      const btnY = !!gp1.buttons[3]?.pressed; // Top button (Ball Cam)
      const btnLB = !!gp1.buttons[4]?.pressed; // Left Bumper (Air Roll Left / Handbrake)
      const btnRB = !!gp1.buttons[5]?.pressed; // Right Bumper (Boost / Air Roll Right)
      const btnL3 = !!gp1.buttons[10]?.pressed; // Left Stick Click (Rumble Powerup)
      const btnR3 = !!gp1.buttons[11]?.pressed; // Right Stick Click (Ball Cam)

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
    // 3. PLAYER 2 KEYBOARD CONTROLS (Split-Screen)
    // -------------------------------------------------------------
    const p2Up = this.isHeld('ArrowUp') || this.isHeld('KeyI');
    const p2Down = this.isHeld('ArrowDown') || this.isHeld('KeyK');
    const p2Left = this.isHeld('ArrowLeft') || this.isHeld('KeyJ');
    const p2Right = this.isHeld('ArrowRight') || this.isHeld('KeyL');
    const p2RollL = this.isHeld('BracketLeft') || this.isHeld('Numpad7') || this.isHeld('KeyU');
    const p2RollR = this.isHeld('BracketRight') || this.isHeld('Numpad9') || this.isHeld('KeyO');

    let p2Throttle = (p2Up ? 1 : 0) - (p2Down ? 1 : 0);
    let p2Steer = (p2Right ? 1 : 0) - (p2Left ? 1 : 0);
    let p2Pitch = (p2Down ? 1 : 0) - (p2Up ? 1 : 0);
    let p2Yaw = p2Steer;
    let p2Roll = (p2RollR ? 1 : 0) - (p2RollL ? 1 : 0);

    let p2Jump = this.isHeld('Numpad0') || this.isHeld('Enter') || this.isHeld('ControlRight') || this.isHeld('Slash');
    let p2JumpJustPressed =
      this.isJustPressed('Numpad0') ||
      this.isJustPressed('Enter') ||
      this.isJustPressed('ControlRight') ||
      this.isJustPressed('Slash');

    let p2Boost = this.isHeld('ShiftRight') || this.isHeld('Numpad1') || this.isHeld('Quote') || this.isHeld('KeyP');
    let p2Handbrake = this.isHeld('Numpad2') || this.isHeld('Period') || this.isHeld('Semicolon');
    let p2ToggleCam = this.isJustPressed('NumpadDecimal') || this.isJustPressed('KeyM');
    let p2UsePowerup = this.isJustPressed('Numpad3') || this.isJustPressed('Backslash');

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
    // 5. SYSTEM CONTROLS (Kickoff Reset, Pause, Controls Toggle)
    // -------------------------------------------------------------
    const resetKickoff =
      this.isJustPressed('KeyT') ||
      this.isJustPressed('Backspace') ||
      (gp1?.buttons[8]?.pressed && !this.prevGpButtonsP1[8]);

    const togglePause =
      this.isJustPressed('Escape') ||
      this.isJustPressed('KeyP') ||
      (gp1?.buttons[9]?.pressed && !this.prevGpButtonsP1[9]);

    const toggleControls = this.isJustPressed('KeyH');

    // Flush single-frame triggers for keyboard & touch
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
