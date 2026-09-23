function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export interface CarInputState {
  throttle: number;      // -1 (reverse) to +1 (forward)
  steer: number;         // -1 (left) to +1 (right)
  pitch: number;         // -1 (down) to +1 (up)
  yaw: number;           // -1 (left) to +1 (right)
  roll: number;          // -1 (roll left) to +1 (roll right)
  jump: boolean;         // Held
  jumpJustPressed: boolean; // Just pressed this frame
  boost: boolean;        // Held
  handbrake: boolean;    // Drift / Handbrake
  toggleCamera: boolean; // Toggle Ball Cam
  usePowerup: boolean;   // Activate Rumble Powerup
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

  // Track previous gamepad button states for single-frame triggers
  private prevGpButtonsP1: boolean[] = [];
  private prevGpButtonsP2: boolean[] = [];

  constructor() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    window.addEventListener('blur', () => this.clear());
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onKeyDown(e: KeyboardEvent): void {
    const key = e.code;
    if (!this.keys.get(key)) {
      this.justPressedKeys.add(key);
    }
    this.keys.set(key, true);

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Numpad0'].includes(e.code)) {
      e.preventDefault();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.set(e.code, false);
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseBoost = true;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseBoost = false;
    }
  }

  public clear(): void {
    this.keys.clear();
    this.justPressedKeys.clear();
    this.mouseBoost = false;
  }

  public isHeld(code: string): boolean {
    return !!this.keys.get(code);
  }

  public isJustPressed(code: string): boolean {
    return this.justPressedKeys.has(code);
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
        // Vibration not supported on this platform
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
    // PLAYER 1 KEYBOARD CONTROLS
    // -------------------------------------------------------------
    const p1W = this.isHeld('KeyW');
    const p1S = this.isHeld('KeyS');
    const p1A = this.isHeld('KeyA');
    const p1D = this.isHeld('KeyD');
    const p1Q = this.isHeld('KeyQ');
    const p1E = this.isHeld('KeyE');

    let p1Throttle = (p1W ? 1 : 0) - (p1S ? 1 : 0);
    let p1Steer = (p1D ? 1 : 0) - (p1A ? 1 : 0);
    let p1Pitch = (p1S ? 1 : 0) - (p1W ? 1 : 0);
    let p1Yaw = p1Steer;
    let p1Roll = (p1E ? 1 : 0) - (p1Q ? 1 : 0);

    let p1Jump = this.isHeld('Space');
    let p1JumpJustPressed = this.isJustPressed('Space');
    let p1Boost = this.isHeld('ShiftLeft') || this.isHeld('KeyF') || this.mouseBoost;
    let p1Handbrake = this.isHeld('KeyX');
    let p1ToggleCam = this.isJustPressed('KeyC');
    let p1UsePowerup = this.isJustPressed('KeyR');

    // -------------------------------------------------------------
    // PLAYER 1 GAMEPAD OVERLAY (Gamepad 0)
    // -------------------------------------------------------------
    const gp1 = gamepads[0];
    if (gp1) {
      const deadzone = 0.14;
      const stickX = Math.abs(gp1.axes[0]) > deadzone ? gp1.axes[0] : 0;
      const stickY = Math.abs(gp1.axes[1]) > deadzone ? gp1.axes[1] : 0;

      // Triggers for throttle (RT = 7, LT = 6)
      const rtVal = gp1.buttons[7] ? (typeof gp1.buttons[7] === 'number' ? gp1.buttons[7] : gp1.buttons[7].value) : 0;
      const ltVal = gp1.buttons[6] ? (typeof gp1.buttons[6] === 'number' ? gp1.buttons[6] : gp1.buttons[6].value) : 0;

      if (rtVal > 0.05 || ltVal > 0.05) {
        p1Throttle = rtVal - ltVal;
      }
      if (Math.abs(stickX) > 0) {
        p1Steer = stickX;
        p1Yaw = stickX;
      }
      if (Math.abs(stickY) > 0) {
        p1Pitch = stickY;
      }

      // Buttons
      const btnA = gp1.buttons[0]?.pressed;
      const btnB = gp1.buttons[1]?.pressed;
      const btnX = gp1.buttons[2]?.pressed;
      const btnY = gp1.buttons[3]?.pressed;
      const btnLB = gp1.buttons[4]?.pressed;
      const btnRB = gp1.buttons[5]?.pressed;
      const btnL3 = gp1.buttons[10]?.pressed || gp1.buttons[11]?.pressed;

      if (btnA) p1Jump = true;
      if (btnA && !this.prevGpButtonsP1[0]) p1JumpJustPressed = true;
      if (btnB) p1Boost = true;
      if (btnX) p1Handbrake = true;
      if (btnY && !this.prevGpButtonsP1[3]) p1ToggleCam = true;
      if (btnLB) p1Roll = -1;
      if (btnRB) p1Roll = 1;
      if (btnL3 && !this.prevGpButtonsP1[10]) p1UsePowerup = true;

      this.prevGpButtonsP1 = gp1.buttons.map((b) => b.pressed);
    }

    // -------------------------------------------------------------
    // PLAYER 2 KEYBOARD CONTROLS
    // -------------------------------------------------------------
    const p2Up = this.isHeld('ArrowUp');
    const p2Down = this.isHeld('ArrowDown');
    const p2Left = this.isHeld('ArrowLeft');
    const p2Right = this.isHeld('ArrowRight');
    const p2RollL = this.isHeld('BracketLeft') || this.isHeld('Numpad7') || this.isHeld('KeyU');
    const p2RollR = this.isHeld('BracketRight') || this.isHeld('Numpad9') || this.isHeld('KeyO');

    let p2Throttle = (p2Up ? 1 : 0) - (p2Down ? 1 : 0);
    let p2Steer = (p2Right ? 1 : 0) - (p2Left ? 1 : 0);
    let p2Pitch = (p2Down ? 1 : 0) - (p2Up ? 1 : 0);
    let p2Yaw = p2Steer;
    let p2Roll = (p2RollR ? 1 : 0) - (p2RollL ? 1 : 0);

    let p2Jump = this.isHeld('Numpad0') || this.isHeld('Enter') || this.isHeld('ControlRight') || this.isHeld('Slash');
    let p2JumpJustPressed = this.isJustPressed('Numpad0') || this.isJustPressed('Enter') || this.isJustPressed('ControlRight') || this.isJustPressed('Slash');
    let p2Boost = this.isHeld('ShiftRight') || this.isHeld('Numpad1') || this.isHeld('Quote') || this.isHeld('KeyL');
    let p2Handbrake = this.isHeld('Numpad2') || this.isHeld('Period');
    let p2ToggleCam = this.isJustPressed('NumpadDecimal') || this.isJustPressed('KeyM');
    let p2UsePowerup = this.isJustPressed('Numpad3') || this.isJustPressed('Enter');

    // -------------------------------------------------------------
    // PLAYER 2 GAMEPAD OVERLAY (Gamepad 1)
    // -------------------------------------------------------------
    const gp2 = gamepads[1];
    if (gp2) {
      const deadzone = 0.14;
      const stickX = Math.abs(gp2.axes[0]) > deadzone ? gp2.axes[0] : 0;
      const stickY = Math.abs(gp2.axes[1]) > deadzone ? gp2.axes[1] : 0;

      const rtVal = gp2.buttons[7] ? (typeof gp2.buttons[7] === 'number' ? gp2.buttons[7] : gp2.buttons[7].value) : 0;
      const ltVal = gp2.buttons[6] ? (typeof gp2.buttons[6] === 'number' ? gp2.buttons[6] : gp2.buttons[6].value) : 0;

      if (rtVal > 0.05 || ltVal > 0.05) {
        p2Throttle = rtVal - ltVal;
      }
      if (Math.abs(stickX) > 0) {
        p2Steer = stickX;
        p2Yaw = stickX;
      }
      if (Math.abs(stickY) > 0) {
        p2Pitch = stickY;
      }

      const btnA = gp2.buttons[0]?.pressed;
      const btnB = gp2.buttons[1]?.pressed;
      const btnX = gp2.buttons[2]?.pressed;
      const btnY = gp2.buttons[3]?.pressed;
      const btnLB = gp2.buttons[4]?.pressed;
      const btnRB = gp2.buttons[5]?.pressed;
      const btnL3 = gp2.buttons[10]?.pressed || gp2.buttons[11]?.pressed;

      if (btnA) p2Jump = true;
      if (btnA && !this.prevGpButtonsP2[0]) p2JumpJustPressed = true;
      if (btnB) p2Boost = true;
      if (btnX) p2Handbrake = true;
      if (btnY && !this.prevGpButtonsP2[3]) p2ToggleCam = true;
      if (btnLB) p2Roll = -1;
      if (btnRB) p2Roll = 1;
      if (btnL3 && !this.prevGpButtonsP2[10]) p2UsePowerup = true;

      this.prevGpButtonsP2 = gp2.buttons.map((b) => b.pressed);
    }

    // -------------------------------------------------------------
    // SYSTEM CONTROLS
    // -------------------------------------------------------------
    const resetKickoff = this.isJustPressed('KeyT') || (gp1?.buttons[8]?.pressed && !this.prevGpButtonsP1[8]);
    const togglePause = this.isJustPressed('Escape') || this.isJustPressed('KeyP') || (gp1?.buttons[9]?.pressed && !this.prevGpButtonsP1[9]);
    const toggleControls = this.isJustPressed('KeyH');

    // Flush single-frame triggers
    this.justPressedKeys.clear();

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
