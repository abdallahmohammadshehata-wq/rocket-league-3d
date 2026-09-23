import { CarCustomization, CarChassisType, CarDecalType, CarTopperType } from '../entities/CarModelPresets';
import { RumblePlayerState, POWERUP_LIST } from '../game/RumbleManager';

export type GameMode = 'VS_AI' | 'RUMBLE' | 'TWO_PLAYERS' | 'FREEPLAY';

export class HUD {
  // Score & Timer
  private blueScoreEl: HTMLElement;
  private orangeScoreEl: HTMLElement;
  private timerEl: HTMLElement;
  private p1NameLblEl: HTMLElement;
  private p2NameLblEl: HTMLElement;

  // Game Mode Switcher
  private modeBtns: NodeListOf<HTMLElement>;
  private splitDividerEl: HTMLElement;

  // P1 Gauges
  private speedValEl: HTMLElement;
  private boostValEl: HTMLElement;
  private boostCircleEl: HTMLElement;
  private camModeTextEl: HTMLElement;
  private camDotEl: HTMLElement;

  // P2 Gauges (Split-Screen)
  private p2HudEl: HTMLElement;
  private p2SpeedValEl: HTMLElement;
  private p2BoostValEl: HTMLElement;
  private p2BoostBarEl: HTMLElement;
  private p2CamDotEl: HTMLElement;
  private p2CamModeTextEl: HTMLElement;

  // Rumble Powerup HUD
  private rumbleHudEl: HTMLElement;
  private powerupIconEl: HTMLElement;
  private powerupNameEl: HTMLElement;
  private powerupCooldownEl: HTMLElement;
  private powerupReadyPromptEl: HTMLElement;

  // Notifications & Modals
  private countdownEl: HTMLElement;
  private goalBannerEl: HTMLElement;
  private goalTextEl: HTMLElement;
  private goalSubEl: HTMLElement;
  private controlsPanelEl: HTMLElement;
  private eventPopupEl: HTMLElement;
  private eventTextEl: HTMLElement;
  private gamepadStatusEl: HTMLElement;

  // Garage Modal Elements
  private garageModalEl: HTMLElement;
  private openGarageBtn: HTMLElement;
  private closeGarageBtn: HTMLElement;

  // Settings Modal Elements
  private settingsModalEl: HTMLElement;
  private openSettingsBtn: HTMLElement;
  private closeModalBtn: HTMLElement;
  private restartMatchBtn: HTMLElement;
  private difficultyBtns: NodeListOf<HTMLElement>;
  private camDistanceSlider: HTMLInputElement;
  private camFovSlider: HTMLInputElement;

  private readonly circleCircumference: number = 2 * Math.PI * 65; // ~408.4
  private eventTimeout: number = 0;

  // Callbacks
  public onModeChange?: (mode: GameMode) => void;
  public onDifficultyChange?: (diff: 'ROOKIE' | 'PRO' | 'ALL_STAR' | 'OFF') => void;
  public onRestartMatch?: () => void;
  public onCamDistanceChange?: (val: number) => void;
  public onCamFovChange?: (val: number) => void;
  public onCustomizationChange?: (custom: Partial<CarCustomization>) => void;

  constructor() {
    this.blueScoreEl = document.getElementById('blue-score')!;
    this.orangeScoreEl = document.getElementById('orange-score')!;
    this.timerEl = document.getElementById('match-timer')!;
    this.p1NameLblEl = document.getElementById('p1-name-lbl')!;
    this.p2NameLblEl = document.getElementById('p2-name-lbl')!;

    this.modeBtns = document.querySelectorAll('.mode-btn');
    this.splitDividerEl = document.getElementById('split-divider')!;

    // P1 Elements
    this.speedValEl = document.getElementById('speed-val')!;
    this.boostValEl = document.getElementById('boost-val')!;
    this.boostCircleEl = document.getElementById('boost-circle')!;
    this.camModeTextEl = document.getElementById('cam-mode-text')!;
    this.camDotEl = document.getElementById('cam-dot')!;

    // P2 Elements
    this.p2HudEl = document.getElementById('p2-hud')!;
    this.p2SpeedValEl = document.getElementById('p2-speed-val')!;
    this.p2BoostValEl = document.getElementById('p2-boost-val')!;
    this.p2BoostBarEl = document.getElementById('p2-boost-bar')!;
    this.p2CamDotEl = document.getElementById('p2-cam-dot')!;
    this.p2CamModeTextEl = document.getElementById('p2-cam-mode-text')!;

    // Rumble Elements
    this.rumbleHudEl = document.getElementById('rumble-hud')!;
    this.powerupIconEl = document.getElementById('powerup-icon')!;
    this.powerupNameEl = document.getElementById('powerup-name')!;
    this.powerupCooldownEl = document.getElementById('powerup-cooldown')!;
    this.powerupReadyPromptEl = document.getElementById('powerup-ready-prompt')!;

    // Center & Event Popups
    this.countdownEl = document.getElementById('countdown-banner')!;
    this.goalBannerEl = document.getElementById('goal-banner')!;
    this.goalTextEl = document.getElementById('goal-text')!;
    this.goalSubEl = document.getElementById('goal-sub')!;
    this.controlsPanelEl = document.getElementById('controls-panel')!;
    this.eventPopupEl = document.getElementById('event-popup')!;
    this.eventTextEl = document.getElementById('event-text')!;
    this.gamepadStatusEl = document.getElementById('gamepad-status')!;

    // Garage Modal
    this.garageModalEl = document.getElementById('garage-modal')!;
    this.openGarageBtn = document.getElementById('open-garage-btn')!;
    this.closeGarageBtn = document.getElementById('close-garage-btn')!;

    // Settings Modal
    this.settingsModalEl = document.getElementById('settings-modal')!;
    this.openSettingsBtn = document.getElementById('open-settings-btn')!;
    this.closeModalBtn = document.getElementById('close-modal-btn')!;
    this.restartMatchBtn = document.getElementById('restart-match-btn')!;
    this.difficultyBtns = document.querySelectorAll('#difficulty-btns .btn-pill');
    this.camDistanceSlider = document.getElementById('cam-distance-slider') as HTMLInputElement;
    this.camFovSlider = document.getElementById('cam-fov-slider') as HTMLInputElement;

    if (this.boostCircleEl) {
      this.boostCircleEl.style.strokeDasharray = `${this.circleCircumference}`;
    }

    this.setupListeners();
    this.setupGarageListeners();
  }

  private setupListeners(): void {
    // Mode Buttons
    this.modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode') as GameMode;
        this.setMode(mode);
        if (this.onModeChange) this.onModeChange(mode);
      });
    });

    // Settings
    if (this.openSettingsBtn) {
      this.openSettingsBtn.addEventListener('click', () => this.toggleSettingsModal(true));
    }
    if (this.closeModalBtn) {
      this.closeModalBtn.addEventListener('click', () => this.toggleSettingsModal(false));
    }
    if (this.restartMatchBtn) {
      this.restartMatchBtn.addEventListener('click', () => {
        this.toggleSettingsModal(false);
        if (this.onRestartMatch) this.onRestartMatch();
      });
    }

    this.difficultyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.difficultyBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const diff = btn.getAttribute('data-diff') as 'ROOKIE' | 'PRO' | 'ALL_STAR' | 'OFF';
        if (this.onDifficultyChange) this.onDifficultyChange(diff);
      });
    });

    if (this.camDistanceSlider) {
      this.camDistanceSlider.addEventListener('input', () => {
        if (this.onCamDistanceChange) this.onCamDistanceChange(parseFloat(this.camDistanceSlider.value));
      });
    }

    if (this.camFovSlider) {
      this.camFovSlider.addEventListener('input', () => {
        if (this.onCamFovChange) this.onCamFovChange(parseFloat(this.camFovSlider.value));
      });
    }

    // Garage
    if (this.openGarageBtn) {
      this.openGarageBtn.addEventListener('click', () => this.toggleGarageModal(true));
    }
    if (this.closeGarageBtn) {
      this.closeGarageBtn.addEventListener('click', () => this.toggleGarageModal(false));
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.toggleSettingsModal(false);
        this.toggleGarageModal(false);
      }
    });
  }

  private setupGarageListeners(): void {
    // Chassis Model Pills
    const chassisBtns = document.querySelectorAll('.chassis-btn');
    chassisBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        chassisBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const chassis = btn.getAttribute('data-chassis') as CarChassisType;
        if (this.onCustomizationChange) this.onCustomizationChange({ chassis });
        this.showEvent(`CHASSIS EQUIPPED: ${chassis}`);
      });
    });

    // Decal Pills
    const decalBtns = document.querySelectorAll('.decal-btn');
    decalBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        decalBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const decal = btn.getAttribute('data-decal') as CarDecalType;
        if (this.onCustomizationChange) this.onCustomizationChange({ decal });
      });
    });

    // Topper Pills
    const topperBtns = document.querySelectorAll('.topper-btn');
    topperBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        topperBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const topper = btn.getAttribute('data-topper') as CarTopperType;
        if (this.onCustomizationChange) this.onCustomizationChange({ topper });
      });
    });

    // Color Swatches
    const colorSwatches = document.querySelectorAll('.color-swatch');
    colorSwatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        const hex = parseInt(swatch.getAttribute('data-color') || '0x0088ff', 16);
        const type = swatch.getAttribute('data-type');
        if (type === 'primary') {
          if (this.onCustomizationChange) this.onCustomizationChange({ primaryColor: hex });
        } else if (type === 'accent') {
          if (this.onCustomizationChange) this.onCustomizationChange({ accentColor: hex, underglowColor: hex, boostColor: hex });
        }
      });
    });
  }

  public setMode(mode: GameMode): void {
    this.modeBtns.forEach((b) => {
      if (b.getAttribute('data-mode') === mode) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    if (mode === 'VS_AI' || mode === 'RUMBLE') {
      this.p1NameLblEl.innerText = 'P1 BLUE';
      this.p2NameLblEl.innerText = mode === 'RUMBLE' ? 'RUMBLE BOT' : 'ORANGE BOT';
      this.splitDividerEl.style.display = 'none';
      this.p2HudEl.style.display = 'none';
      if (this.rumbleHudEl) this.rumbleHudEl.style.display = mode === 'RUMBLE' ? 'flex' : 'none';
    } else if (mode === 'TWO_PLAYERS') {
      this.p1NameLblEl.innerText = 'P1 BLUE';
      this.p2NameLblEl.innerText = 'P2 ORANGE';
      this.splitDividerEl.style.display = 'block';
      this.p2HudEl.style.display = 'flex';
      if (this.rumbleHudEl) this.rumbleHudEl.style.display = 'none';
    } else if (mode === 'FREEPLAY') {
      this.p1NameLblEl.innerText = 'P1 BLUE';
      this.p2NameLblEl.innerText = 'FREEPLAY';
      this.splitDividerEl.style.display = 'none';
      this.p2HudEl.style.display = 'none';
      if (this.rumbleHudEl) this.rumbleHudEl.style.display = 'none';
    }
  }

  public updateP1(speedKmh: number, boost: number, isBallCam: boolean, isSupersonic: boolean): void {
    this.speedValEl.innerText = `${speedKmh}`;
    this.boostValEl.innerText = `${Math.round(boost)}`;

    const offset = this.circleCircumference * (1 - boost / 100);
    this.boostCircleEl.style.strokeDashoffset = `${offset}`;

    if (isSupersonic) {
      this.boostCircleEl.style.stroke = '#ff00ff';
    } else if (boost > 50) {
      this.boostCircleEl.style.stroke = '#00d2ff';
    } else if (boost > 20) {
      this.boostCircleEl.style.stroke = '#ffaa00';
    } else {
      this.boostCircleEl.style.stroke = '#ff3344';
    }

    if (isBallCam) {
      this.camModeTextEl.innerText = 'BALL CAM';
      this.camDotEl.style.background = '#00ff88';
      this.camDotEl.style.boxShadow = '0 0 8px #00ff88';
    } else {
      this.camModeTextEl.innerText = 'CAR CAM';
      this.camDotEl.style.background = 'rgba(255, 255, 255, 0.4)';
      this.camDotEl.style.boxShadow = 'none';
    }
  }

  public updateP2(speedKmh: number, boost: number, isBallCam: boolean): void {
    if (this.p2SpeedValEl) this.p2SpeedValEl.innerText = `${speedKmh}`;
    if (this.p2BoostValEl) this.p2BoostValEl.innerText = `${Math.round(boost)}`;
    if (this.p2BoostBarEl) this.p2BoostBarEl.style.width = `${boost}%`;

    if (this.p2CamModeTextEl && this.p2CamDotEl) {
      if (isBallCam) {
        this.p2CamModeTextEl.innerText = 'BALL CAM';
        this.p2CamDotEl.style.background = '#ff7700';
        this.p2CamDotEl.style.boxShadow = '0 0 8px #ff7700';
      } else {
        this.p2CamModeTextEl.innerText = 'CAR CAM';
        this.p2CamDotEl.style.background = 'rgba(255, 255, 255, 0.4)';
        this.p2CamDotEl.style.boxShadow = 'none';
      }
    }
  }

  private getPowerupSvg(type: string): string {
    switch (type) {
      case 'HAYMAKER':
        return '<svg viewBox="0 0 24 24" width="30" height="30" fill="#ff0055"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 5.57 14.14 14.14 22.71 17.71 19.14l-1.43-1.43 1.43-1.43 1.43 1.43 1.43-1.43-1.43-1.42 1.43-1.43z"/></svg>';
      case 'GRAPPLING_HOOK':
        return '<svg viewBox="0 0 24 24" width="30" height="30" fill="#00ffff"><path d="M12 2a3 3 0 0 0-3 3c0 1.3.84 2.4 2 2.82V11H7a5 5 0 0 0-5 5v1h2v-1a3 3 0 0 1 3-3h4v6.18A3 3 0 0 0 9 22h6a3 3 0 0 0-2-2.82V13h4a3 3 0 0 1 3 3v1h2v-1a5 5 0 0 0-5-5h-4V7.82c1.16-.42 2-1.52 2-2.82a3 3 0 0 0-3-3zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>';
      case 'PLUNGER':
        return '<svg viewBox="0 0 24 24" width="30" height="30" fill="#ffaa00"><path d="M11 2h2v11.08c2.83.48 5 2.94 5 5.92H6c0-2.98 2.17-5.44 5-5.92V2zm-3 19h8v1H8v-1z"/></svg>';
      case 'MAGNET':
        return '<svg viewBox="0 0 24 24" width="30" height="30" fill="#9d00ff"><path d="M3 7v6c0 4.97 4.03 9 9 9s9-4.03 9-9V7h-4v6c0 2.76-2.24 5-5 5s-5-2.24-5-5V7H3zm0-5h4v3H3V2zm14 0h4v3h-4V2z"/></svg>';
      case 'FREEZE':
        return '<svg viewBox="0 0 24 24" width="30" height="30" fill="#00d2ff"><path d="M11 2v4.07l-2.54-1.46-1 1.73L10 7.8V11H6.8l-1.46-2.54-1.73 1L5.07 12l-1.46 2.54 1.73 1L6.8 13H10v3.2l-2.54 1.46 1 1.73 2.54-1.46V22h2v-4.07l2.54 1.46 1-1.73L14 16.2V13h3.2l1.46 2.54 1.73-1L18.93 12l1.46-2.54-1.73-1L17.2 11H14V7.8l2.54-1.46-1-1.73L13 6.07V2h-2z"/></svg>';
      case 'BOOT':
        return '<svg viewBox="0 0 24 24" width="30" height="30" fill="#ff3300"><path d="M18 17h-2.5l-4-4H8V4h6v6h2l2 7zM4 19h16v3H4v-3z"/></svg>';
      case 'SPIKES':
        return '<svg viewBox="0 0 24 24" width="30" height="30" fill="#ffff00"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>';
      default:
        return '<svg viewBox="0 0 24 24" width="30" height="30" fill="#ffea00"><path d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zM12 11.5l-4-4V4h8v3.5l-4 4z"/></svg>';
    }
  }

  public updateRumble(state: RumblePlayerState): void {
    if (!this.rumbleHudEl) return;

    if (state.isPowerupReady && state.currentPowerup !== 'NONE') {
      const info = POWERUP_LIST.find((p) => p.type === state.currentPowerup);
      if (info) {
        this.powerupIconEl.innerHTML = this.getPowerupSvg(state.currentPowerup);
        this.powerupNameEl.innerText = info.name.toUpperCase();
        this.powerupCooldownEl.innerText = 'READY!';
        this.powerupReadyPromptEl.style.display = 'block';
        this.rumbleHudEl.classList.add('ready-glow');
      }
    } else {
      this.powerupIconEl.innerHTML = this.getPowerupSvg('ROLLING');
      this.powerupNameEl.innerText = 'ROLLING...';
      this.powerupCooldownEl.innerText = `${Math.ceil(state.cooldownRemaining)}s`;
      this.powerupReadyPromptEl.style.display = 'none';
      this.rumbleHudEl.classList.remove('ready-glow');
    }
  }

  public updateGamepadStatus(count: number): void {
    if (this.gamepadStatusEl) {
      if (count > 0) {
        this.gamepadStatusEl.style.display = 'flex';
        this.gamepadStatusEl.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg> <span>${count} CONTROLLER${count > 1 ? 'S' : ''} CONNECTED</span>`;
      } else {
        this.gamepadStatusEl.style.display = 'none';
      }
    }
  }

  public updateScoreboard(blue: number, orange: number, secondsRemaining: number): void {
    this.blueScoreEl.innerText = `${blue}`;
    this.orangeScoreEl.innerText = `${orange}`;

    const mins = Math.floor(secondsRemaining / 60);
    const secs = Math.floor(secondsRemaining % 60);
    this.timerEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  public showCountdown(text: string): void {
    this.countdownEl.innerText = text;
    this.countdownEl.style.display = 'block';
    this.countdownEl.style.animation = 'none';
    void this.countdownEl.offsetWidth; // trigger reflow
    this.countdownEl.style.animation = 'countdownPop 0.75s ease-out forwards';
  }

  public hideCountdown(): void {
    this.countdownEl.style.display = 'none';
  }

  public showGoal(team: 'BLUE' | 'ORANGE', speedKmh?: number): void {
    this.goalBannerEl.style.display = 'block';
    this.goalTextEl.innerText = `${team} GOAL!`;
    this.goalTextEl.style.color = team === 'BLUE' ? '#00d2ff' : '#ff7700';
    this.goalTextEl.style.textShadow = team === 'BLUE' ? '0 0 30px #00d2ff' : '0 0 30px #ff7700';
    this.goalSubEl.innerText = speedKmh ? `POWER SHOT: ${speedKmh} KM/H` : 'WHAT A PLAY!';
  }

  public hideGoal(): void {
    this.goalBannerEl.style.display = 'none';
  }

  public showEvent(text: string): void {
    this.eventTextEl.innerText = text;
    this.eventPopupEl.style.display = 'block';
    clearTimeout(this.eventTimeout);
    this.eventTimeout = window.setTimeout(() => {
      this.eventPopupEl.style.display = 'none';
    }, 2500);
  }

  public toggleControlsPanel(): void {
    const isVis = this.controlsPanelEl.style.display === 'block';
    this.controlsPanelEl.style.display = isVis ? 'none' : 'block';
  }

  public toggleSettingsModal(show?: boolean): void {
    const current = this.settingsModalEl.style.display === 'flex';
    const next = show !== undefined ? show : !current;
    this.settingsModalEl.style.display = next ? 'flex' : 'none';
  }

  public toggleGarageModal(show?: boolean): void {
    const current = this.garageModalEl.style.display === 'flex';
    const next = show !== undefined ? show : !current;
    this.garageModalEl.style.display = next ? 'flex' : 'none';
  }
}
