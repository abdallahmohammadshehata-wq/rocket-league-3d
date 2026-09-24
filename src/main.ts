import * as THREE from 'three';
import { Engine } from './core/Engine';
import { InputManager } from './input/InputManager';
import { Stadium } from './arena/Stadium';
import { Car } from './entities/Car';
import { Ball } from './entities/Ball';
import { CameraController } from './camera/CameraController';
import { HUD, GameMode } from './ui/HUD';
import { ParticleManager } from './effects/ParticleManager';
import { BotAI, BotDifficulty } from './ai/BotAI';
import { RumbleManager } from './game/RumbleManager';
import { CarCustomization } from './entities/CarModelPresets';

class Game {
  private engine!: Engine;
  private input!: InputManager;
  private stadium!: Stadium;
  private particleManager!: ParticleManager;
  private playerCar!: Car;
  private botCar!: Car;
  private botAI!: BotAI;
  private ball!: Ball;
  private cameraController!: CameraController;
  private hud!: HUD;
  private rumbleManager!: RumbleManager;

  // Match Mode & State
  private currentGameMode: GameMode = 'VS_AI';
  private blueScore: number = 0;
  private orangeScore: number = 0;
  private matchTimeRemaining: number = 300; // 5:00 match
  private isKickoffInProgress: boolean = false;
  private kickoffTimer: number = 0;
  private isGoalReplay: boolean = false;
  private goalReplayTimer: number = 0;

  // Stats / Event Detection
  private lastShotNotificationTime: number = 0;

  public async start(): Promise<void> {
    const container = document.getElementById('canvas-container')!;

    // 1. Initialize Engine & Systems
    this.engine = new Engine();
    await this.engine.init(container);

    this.input = new InputManager();
    this.hud = new HUD();
    this.particleManager = new ParticleManager(this.engine.scene);

    // 2. Build Stadium, Ball, and Player Cars
    this.stadium = new Stadium(this.engine.scene, this.engine.world);
    this.ball = new Ball(this.engine.scene, this.engine.world, this.engine.soundManager, this.particleManager);

    // Player 1 (Blue Team)
    this.playerCar = new Car(this.engine.scene, this.engine.world, this.engine.soundManager, this.particleManager, true);

    // Player 2 / AI Bot (Orange Team)
    this.botCar = new Car(this.engine.scene, this.engine.world, this.engine.soundManager, this.particleManager, false);
    this.botAI = new BotAI(this.botCar, this.ball, this.stadium, 'PRO');

    // 3. Initialize Rumble Powerups Manager
    this.rumbleManager = new RumbleManager(
      this.engine.scene,
      this.playerCar,
      this.botCar,
      this.ball,
      this.particleManager,
      this.engine.soundManager
    );

    // 4. Dual-Camera Controller
    this.cameraController = new CameraController(window.innerWidth / window.innerHeight);

    // Assign custom renderer handler
    this.engine.customRender = (renderer, scene) => {
      this.cameraController.render(renderer, scene);
    };

    // 5. Connect HUD & UI Callbacks
    this.setupHUDCallbacks();

    // 6. Register Physics Update Loop (60Hz fixed timestep)
    this.engine.onPhysicsStep((dt) => this.physicsStep(dt));

    // 7. Register Render Update Loop
    this.engine.onRenderStep((_alpha, dt) => this.renderStep(dt));

    // 8. Start Initial Mode
    this.setGameMode('VS_AI');

    // 9. Launch Game Loop
    this.engine.start();
  }

  private setupHUDCallbacks(): void {
    this.hud.onModeChange = (mode: GameMode) => {
      this.setGameMode(mode);
    };

    this.hud.onDifficultyChange = (diff: BotDifficulty) => {
      this.botAI.difficulty = diff;
      if (this.currentGameMode === 'VS_AI' || this.currentGameMode === 'RUMBLE') {
        this.botCar.mesh.visible = diff !== 'OFF';
        if (diff === 'OFF') {
          this.botCar.body.setTranslation(new THREE.Vector3(0, -100, 0), true);
        } else {
          this.botCar.reset(new THREE.Vector3(0, 1.5, 32), false);
        }
      }
      this.hud.showEvent(`BOT LEVEL: ${diff}`);
    };

    this.hud.onRestartMatch = () => {
      this.blueScore = 0;
      this.orangeScore = 0;
      this.matchTimeRemaining = 300;
      this.startKickoff();
      this.hud.showEvent('MATCH RESTARTED (5:00)');
    };

    this.hud.onCamDistanceChange = (val: number) => {
      this.cameraController.settings.distance = val;
    };

    this.hud.onCamFovChange = (val: number) => {
      this.cameraController.settings.fov = val;
    };

    this.hud.onCustomizationChange = (custom: Partial<CarCustomization>) => {
      this.playerCar.setCustomization(custom);
    };
  }

  public setGameMode(mode: GameMode): void {
    this.currentGameMode = mode;
    this.hud.setMode(mode);
    this.rumbleManager.reset();

    if (mode === 'VS_AI') {
      this.cameraController.isSplitScreen = false;
      this.botCar.mesh.visible = true;
      this.hud.showEvent('1P VS COMPUTER AI MODE');
    } else if (mode === 'RUMBLE') {
      this.cameraController.isSplitScreen = false;
      this.botCar.mesh.visible = true;
      this.hud.showEvent('⚡ RUMBLE POWERUPS ACTIVATED!');
    } else if (mode === 'TWO_PLAYERS') {
      this.cameraController.isSplitScreen = true;
      this.botCar.mesh.visible = true;
      this.hud.showEvent('2 PLAYERS SPLIT-SCREEN ACTIVATED');
    } else if (mode === 'FREEPLAY') {
      this.cameraController.isSplitScreen = false;
      this.botCar.mesh.visible = false;
      this.botCar.body.setTranslation(new THREE.Vector3(0, -100, 0), true);
      this.hud.showEvent('SOLO FREEPLAY TRAINING');
    }

    this.startKickoff();
  }

  private startKickoff(): void {
    this.isKickoffInProgress = this.currentGameMode !== 'FREEPLAY';
    this.kickoffTimer = this.currentGameMode !== 'FREEPLAY' ? 2.2 : 0;
    this.isGoalReplay = false;
    this.hud.hideGoal();

    // Reset Ball to arena center
    this.ball.reset(new THREE.Vector3(0, 3.0, 0));

    // Reset Player 1 Car (Blue Team at -32 facing +Z)
    this.playerCar.reset(new THREE.Vector3(0, 1.5, -32), true);

    // Reset Orange Car (Orange Team at +32 facing -Z)
    if (this.currentGameMode === 'FREEPLAY') {
      this.botCar.mesh.visible = false;
      this.botCar.body.setTranslation(new THREE.Vector3(0, -100, 0), true);
    } else {
      this.botCar.mesh.visible = true;
      this.botCar.reset(new THREE.Vector3(0, 1.5, 32), false);
    }

    // Snap cameras directly behind cars on kickoff
    this.cameraController.snap(this.playerCar, this.botCar, this.ball);

    if (this.isKickoffInProgress) {
      this.engine.soundManager.playCountdown(false);
    }
  }

  private physicsStep(dt: number): void {
    // 1. Handle Kickoff Countdown & Match Timer
    if (this.isKickoffInProgress) {
      this.kickoffTimer -= dt;

      if (this.kickoffTimer > 1.5) {
        this.hud.showCountdown('3');
      } else if (this.kickoffTimer > 0.8) {
        this.hud.showCountdown('2');
      } else if (this.kickoffTimer > 0.0) {
        this.hud.showCountdown('1');
      } else {
        this.hud.showCountdown('GO!');
        this.engine.soundManager.playCountdown(true);
        setTimeout(() => this.hud.hideCountdown(), 700);
        this.isKickoffInProgress = false;
      }
    } else if (!this.isGoalReplay && this.currentGameMode !== 'FREEPLAY') {
      this.matchTimeRemaining = Math.max(0, this.matchTimeRemaining - dt);
    }

    // 2. Process Player Inputs
    const globalInput = this.input.update();
    this.hud.updateGamepadStatus(globalInput.gamepadsConnected);

    if (globalInput.p1.toggleCamera) {
      this.cameraController.toggleModeP1();
    }
    if (globalInput.p2.toggleCamera) {
      this.cameraController.toggleModeP2();
    }
    if (globalInput.resetKickoff) {
      this.startKickoff();
    }
    if (globalInput.toggleControls) {
      this.hud.toggleControlsPanel();
    }

    // Handle Rumble Powerup Activations
    if (this.currentGameMode === 'RUMBLE') {
      if (globalInput.p1.usePowerup) {
        this.rumbleManager.activatePowerup(true);
      }
      if (globalInput.p2.usePowerup) {
        this.rumbleManager.activatePowerup(false);
      }
      this.rumbleManager.update(dt);
    }

    // Lock car motion during kickoff countdown or goal replay
    const isLocked = this.isKickoffInProgress || this.isGoalReplay;

    const p1Input = isLocked
      ? { ...globalInput.p1, throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, jumpJustPressed: false, boost: false, handbrake: false }
      : globalInput.p1;

    this.playerCar.update(dt, p1Input);

    // 3. Orange Car Control (AI vs Human Player 2)
    if (this.currentGameMode === 'VS_AI' || this.currentGameMode === 'RUMBLE') {
      if (this.botAI.difficulty !== 'OFF') {
        const botInput = this.botAI.update(dt, this.isKickoffInProgress, this.isGoalReplay);
        this.botCar.update(dt, botInput);

        // In Rumble mode, AI randomly activates powerups when available
        if (this.currentGameMode === 'RUMBLE' && Math.random() < 0.05) {
          this.rumbleManager.activatePowerup(false);
        }
      }
    } else if (this.currentGameMode === 'TWO_PLAYERS') {
      const p2Input = isLocked
        ? { ...globalInput.p2, throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, jumpJustPressed: false, boost: false, handbrake: false }
        : globalInput.p2;
      this.botCar.update(dt, p2Input);
    }

    // 4. Car vs Ball Collision Energy Transfer & Power Shots
    this.playerCar.checkBallHit(this.ball);
    if (this.currentGameMode !== 'FREEPLAY') {
      this.botCar.checkBallHit(this.ball);
    }

    // 5. Update Ball, Stadium, and Particle Effects
    this.ball.update(dt);
    this.stadium.update(dt);
    this.particleManager.update(dt);

    // Dynamic Crowd Ambient Excitement
    const bPos = this.ball.getPosition();
    const bVel = this.ball.getVelocity();
    const distToGoal = Math.min(Math.abs(bPos.z - (-50)), Math.abs(bPos.z - 50));
    const urgency = Math.max(0, 1.0 - distToGoal / 35.0);
    const speedRatio = Math.min(1.0, bVel.length() / 28.0);
    this.engine.soundManager.updateCrowdExcitement(urgency * 0.7 + speedRatio * 0.3);


    // 6. Check Boost Pad Pickups for Both Players
    this.checkBoostPickups(this.playerCar);
    if (this.currentGameMode !== 'FREEPLAY') {
      this.checkBoostPickups(this.botCar);
    }

    // 7. Check Shot On Goal & Epic Save Notifications
    this.checkShotAndSaveEvents();

    // 8. Check Goal Line Collisions
    this.checkGoalEvents();

    // 9. Handle Post-Goal Celebration Timer
    if (this.isGoalReplay) {
      this.goalReplayTimer -= dt;
      if (this.goalReplayTimer <= 0) {
        this.startKickoff();
      }
    }
  }

  private checkShotAndSaveEvents(): void {
    const now = performance.now();
    if (now - this.lastShotNotificationTime < 4000 || this.isGoalReplay) return;

    const bPos = this.ball.getPosition();
    const bVel = this.ball.getVelocity();

    // Shot on Orange Goal (+Z)
    if (bPos.z > 25 && bVel.z > 14 && Math.abs(bPos.x) < 14) {
      this.lastShotNotificationTime = now;
      this.hud.showEvent('SHOT ON GOAL! +30');
      this.hud.addQuickChat('P1 BLUE', 'Nice shot!', 'BLUE');
      this.cameraController.addScreenShake(0.35);
      this.input.playHaptic(0, 200, 0.4, 0.7);
    }

    // Epic Save near Blue Goal (-Z)
    const pPos = this.playerCar.getPosition();
    if (bPos.z < -38 && bVel.z < -10 && pPos.distanceTo(bPos) < 6.5) {
      this.lastShotNotificationTime = now;
      this.hud.showEvent('EPIC SAVE! +50');
      this.hud.addQuickChat('P1 BLUE', 'What a save!', 'BLUE');
      setTimeout(() => this.hud.addQuickChat('ORANGE BOT', 'Close one!', 'ORANGE'), 600);
      this.cameraController.addScreenShake(0.5);
      this.input.playHaptic(0, 300, 0.6, 0.9);
    }
  }

  private checkBoostPickups(car: Car): void {
    const carPos = car.getPosition();

    this.stadium.boostPads.forEach((pad) => {
      if (pad.active && carPos.distanceTo(pad.position) < (pad.isBig ? 3.2 : 2.2)) {
        pad.active = false;
        pad.mesh.visible = false;
        pad.timer = pad.respawnTime;
        car.collectBoost(pad.amount);
        this.particleManager.spawnShockwaveRing(pad.position, 0xffaa00, 1.0, 12.0);
      }
    });
  }

  private checkGoalEvents(): void {
    if (this.isGoalReplay) return;

    // 1. Drain physics sensor collision events
    this.engine.eventQueue.drainCollisionEvents((handle1: number, handle2: number, started: boolean) => {
      if (!started || this.isGoalReplay) return;

      const isBall1 = handle1 === this.ball.collider.handle;
      const isBall2 = handle2 === this.ball.collider.handle;

      if (!isBall1 && !isBall2) return;

      const isBlueSensor =
        handle1 === this.stadium.blueGoalSensorCollider.handle ||
        handle2 === this.stadium.blueGoalSensorCollider.handle;

      const isOrangeSensor =
        handle1 === this.stadium.orangeGoalSensorCollider.handle ||
        handle2 === this.stadium.orangeGoalSensorCollider.handle;

      if (isBlueSensor) {
        this.triggerGoal('ORANGE');
      } else if (isOrangeSensor) {
        this.triggerGoal('BLUE');
      }
    });

    // 2. Geometric Fail-Safe Goal Check
    if (!this.isGoalReplay) {
      const bPos = this.ball.getPosition();
      const inGoalX = Math.abs(bPos.x) < this.stadium.goalWidth / 2;
      const inGoalY = bPos.y < this.stadium.goalHeight && bPos.y > 0;

      if (inGoalX && inGoalY) {
        if (bPos.z < -this.stadium.length / 2 - 0.8) {
          this.triggerGoal('ORANGE');
        } else if (bPos.z > this.stadium.length / 2 + 0.8) {
          this.triggerGoal('BLUE');
        }
      }
    }
  }

  private triggerGoal(scoringTeam: 'BLUE' | 'ORANGE'): void {
    this.isGoalReplay = true;
    this.goalReplayTimer = 2.8;

    if (scoringTeam === 'BLUE') {
      this.blueScore++;
      this.hud.addQuickChat('P1 BLUE', 'GOAL!', 'BLUE');
      setTimeout(() => this.hud.addQuickChat('ORANGE BOT', 'What a save!', 'ORANGE'), 500);
    } else {
      this.orangeScore++;
      this.hud.addQuickChat('ORANGE BOT', 'Calculated.', 'ORANGE');
      setTimeout(() => this.hud.addQuickChat('P1 BLUE', 'No problem.', 'BLUE'), 500);
    }

    const ballVel = this.ball.getVelocity();
    const speedKmh = Math.round(ballVel.length() * 3.6);

    const goalPos = scoringTeam === 'BLUE' ? new THREE.Vector3(0, 3.5, 50) : new THREE.Vector3(0, 3.5, -50);
    const teamColor = scoringTeam === 'BLUE' ? 0x00d2ff : 0xff7700;

    // Trigger shockwave & explosion particles
    this.ball.triggerGoalShockwave(goalPos, teamColor);
    this.cameraController.addScreenShake(1.4);
    this.input.playHaptic(0, 600, 0.8, 1.0);

    // Blast cars outward safely
    const pPos = this.playerCar.getPosition();
    const blastDir = new THREE.Vector3().subVectors(pPos, goalPos).normalize().multiplyScalar(800);
    this.playerCar.body.applyImpulse({ x: blastDir.x, y: 400, z: blastDir.z }, true);

    if (this.currentGameMode !== 'FREEPLAY') {
      const oPos = this.botCar.getPosition();
      const oBlastDir = new THREE.Vector3().subVectors(oPos, goalPos).normalize().multiplyScalar(800);
      this.botCar.body.applyImpulse({ x: oBlastDir.x, y: 400, z: oBlastDir.z }, true);
    }

    this.hud.showGoal(scoringTeam, speedKmh);
  }


  private renderStep(dt: number): void {
    // 1. Update Cameras
    this.cameraController.update(dt, this.playerCar, this.botCar, this.ball);

    // 2. Update HUD
    this.hud.updateScoreboard(this.blueScore, this.orangeScore, this.matchTimeRemaining);
    this.hud.updateP1(
      this.playerCar.currentSpeedKmh,
      this.playerCar.boostAmount,
      this.cameraController.isBallCamP1,
      this.playerCar.isSupersonic
    );

    if (this.currentGameMode === 'TWO_PLAYERS') {
      this.hud.updateP2(
        this.botCar.currentSpeedKmh,
        this.botCar.boostAmount,
        this.cameraController.isBallCamP2
      );
    }

    if (this.currentGameMode === 'RUMBLE') {
      this.hud.updateRumble(this.rumbleManager.p1State);
    }
  }
}

// Start Game reliably
function initGame(): void {
  const game = new Game();
  game.start().catch((err) => {
    console.error('Failed to initialize Rocket League 3D:', err);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
