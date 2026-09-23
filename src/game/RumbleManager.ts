import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Car } from '../entities/Car';
import { Ball } from '../entities/Ball';
import { ParticleManager } from '../effects/ParticleManager';
import { SoundManager } from '../core/SoundManager';

export type PowerupType =
  | 'NONE'
  | 'HAYMAKER'
  | 'GRAPPLING_HOOK'
  | 'PLUNGER'
  | 'MAGNET'
  | 'FREEZE'
  | 'BOOT'
  | 'SPIKES';

export interface PowerupInfo {
  name: string;
  type: PowerupType;
  icon: string;
  color: string;
  description: string;
}

export const POWERUP_LIST: PowerupInfo[] = [
  { name: 'Haymaker', type: 'HAYMAKER', icon: '🥊', color: '#ff0055', description: 'Punch the ball at supersonic speed' },
  { name: 'Grappling Hook', type: 'GRAPPLING_HOOK', icon: '🪝', color: '#00ffff', description: 'Tow your car directly into the ball' },
  { name: 'Plunger', type: 'PLUNGER', icon: '🪠', color: '#ffaa00', description: 'Yank the ball backward on a bungee cord' },
  { name: 'Magnetizer', type: 'MAGNET', icon: '🧲', color: '#9d00ff', description: 'Pull the ball into orbit around your car' },
  { name: 'Freezer', type: 'FREEZE', icon: '❄️', color: '#00d2ff', description: 'Freeze the ball instantly in solid ice' },
  { name: 'The Boot', type: 'BOOT', icon: '🥾', color: '#ff3300', description: 'Launch opponent car into outer space' },
  { name: 'Spikes', type: 'SPIKES', icon: '⚡', color: '#ffff00', description: 'Stick the ball directly to your car roof' }
];

export class RumblePlayerState {
  public currentPowerup: PowerupType = 'NONE';
  public cooldownRemaining: number = 10.0; // 10s countdown to next powerup
  public isPowerupReady: boolean = false;
  public activeEffectTimer: number = 0;
  public isSpikesActive: boolean = false;
  public isMagnetActive: boolean = false;
  public isGrappling: boolean = false;
  public isPlunging: boolean = false;
}

export class RumbleManager {
  private scene: THREE.Scene;
  private p1Car: Car;
  private p2Car: Car;
  private ball: Ball;
  private particles: ParticleManager;
  private sound: SoundManager;

  public p1State: RumblePlayerState = new RumblePlayerState();
  public p2State: RumblePlayerState = new RumblePlayerState();

  // Active Visual meshes
  private iceBlockMesh: THREE.Mesh;
  private isBallFrozen: boolean = false;
  private freezeTimer: number = 0;

  // Cables / Lasers
  private p1CableLine!: THREE.Line;
  private p2CableLine!: THREE.Line;

  // Punching Glove Mesh
  private gloveMesh: THREE.Group;
  private isPunching: boolean = false;
  private punchProgress: number = 0;
  private punchStartPos: THREE.Vector3 = new THREE.Vector3();
  private punchTargetPos: THREE.Vector3 = new THREE.Vector3();

  // Spikes Mesh for Cars
  private p1SpikesGroup: THREE.Group = new THREE.Group();
  private p2SpikesGroup: THREE.Group = new THREE.Group();

  constructor(
    scene: THREE.Scene,
    p1Car: Car,
    p2Car: Car,
    ball: Ball,
    particles: ParticleManager,
    sound: SoundManager
  ) {
    this.scene = scene;
    this.p1Car = p1Car;
    this.p2Car = p2Car;
    this.ball = ball;
    this.particles = particles;
    this.sound = sound;

    // 1. Ice Cube Mesh for Freeze
    const iceGeo = new THREE.BoxGeometry(3.6, 3.6, 3.6);
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0x99eeff,
      transmission: 0.8,
      opacity: 0.88,
      transparent: true,
      roughness: 0.1,
      metalness: 0.1,
      emissive: 0x00aaff,
      emissiveIntensity: 0.4,
      ior: 1.31
    });
    this.iceBlockMesh = new THREE.Mesh(iceGeo, iceMat);
    this.iceBlockMesh.visible = false;
    this.scene.add(this.iceBlockMesh);

    // 2. Cables / Hook Lines
    const cableMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 3 });
    const cableGeo1 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.p1CableLine = new THREE.Line(cableGeo1, cableMat);
    this.p1CableLine.visible = false;
    this.scene.add(this.p1CableLine);

    const cableGeo2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.p2CableLine = new THREE.Line(cableGeo2, cableMat.clone());
    this.p2CableLine.visible = false;
    this.scene.add(this.p2CableLine);

    // 3. Boxing Glove Model
    this.gloveMesh = new THREE.Group();
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0xff0044, metalness: 0.4, roughness: 0.3 });
    const fist = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), gloveMat);
    fist.scale.set(1.0, 1.2, 1.4);
    this.gloveMesh.add(fist);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.8, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    cuff.rotation.x = Math.PI / 2;
    cuff.position.z = 1.0;
    this.gloveMesh.add(cuff);
    this.gloveMesh.visible = false;
    this.scene.add(this.gloveMesh);

    // 4. Car Spikes Models
    this.buildSpikesMesh(this.p1SpikesGroup);
    this.buildSpikesMesh(this.p2SpikesGroup);
    this.p1Car.mesh.add(this.p1SpikesGroup);
    this.p2Car.mesh.add(this.p2SpikesGroup);
  }

  private buildSpikesMesh(group: THREE.Group): void {
    group.visible = false;
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffaa00, emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.1 });
    const positions = [
      new THREE.Vector3(-0.6, 0.9, -0.6),
      new THREE.Vector3(0.6, 0.9, -0.6),
      new THREE.Vector3(-0.6, 0.9, 0.6),
      new THREE.Vector3(0.6, 0.9, 0.6),
      new THREE.Vector3(0, 1.1, 0),
      new THREE.Vector3(-0.7, 0.8, 0),
      new THREE.Vector3(0.7, 0.8, 0)
    ];

    positions.forEach((p) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 8), spikeMat);
      cone.position.copy(p);
      group.add(cone);
    });
  }

  public reset(): void {
    this.p1State = new RumblePlayerState();
    this.p2State = new RumblePlayerState();
    this.isBallFrozen = false;
    this.iceBlockMesh.visible = false;
    this.p1CableLine.visible = false;
    this.p2CableLine.visible = false;
    this.gloveMesh.visible = false;
    this.p1SpikesGroup.visible = false;
    this.p2SpikesGroup.visible = false;
  }

  public update(dt: number): void {
    // 1. Update Powerup Cooldowns & Rolling
    this.updatePlayerState(dt, this.p1State, this.p1Car, true);
    this.updatePlayerState(dt, this.p2State, this.p2Car, false);

    // 2. Process Freeze state
    if (this.isBallFrozen) {
      this.freezeTimer -= dt;
      const bPos = this.ball.getPosition();
      this.iceBlockMesh.position.copy(bPos);
      this.iceBlockMesh.rotation.y += dt * 0.5;

      // Lock ball in place
      this.ball.body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
      this.ball.body.setAngvel(new RAPIER.Vector3(0, 0, 0), true);

      // Check if car crashed into frozen ball
      const d1 = this.p1Car.getPosition().distanceTo(bPos);
      const d2 = this.p2Car.getPosition().distanceTo(bPos);
      if (this.freezeTimer <= 0 || (d1 < 3.2 && this.freezeTimer < 3.2) || (d2 < 3.2 && this.freezeTimer < 3.2)) {
        this.unfreezeBall();
      }
    }

    // 3. Process Active Glove Punch Animation
    if (this.isPunching) {
      this.punchProgress += dt * 4.0; // Fast 0.25s punch
      if (this.punchProgress >= 1.0) {
        this.isPunching = false;
        this.gloveMesh.visible = false;
      } else {
        const cur = new THREE.Vector3().lerpVectors(this.punchStartPos, this.punchTargetPos, this.punchProgress);
        this.gloveMesh.position.copy(cur);
        this.gloveMesh.lookAt(this.punchTargetPos);
      }
    }

    // 4. Process Continuous Effects (Magnet, Spikes, Grapple, Plunger)
    this.processContinuousEffects(dt, this.p1State, this.p1Car, this.p1CableLine);
    this.processContinuousEffects(dt, this.p2State, this.p2Car, this.p2CableLine);
  }

  private updatePlayerState(dt: number, state: RumblePlayerState, _car: Car, _isP1: boolean): void {
    if (!state.isPowerupReady && state.currentPowerup === 'NONE') {
      state.cooldownRemaining -= dt;
      if (state.cooldownRemaining <= 0) {
        state.cooldownRemaining = 0;
        state.isPowerupReady = true;
        // Pick random powerup
        const randIdx = Math.floor(Math.random() * POWERUP_LIST.length);
        state.currentPowerup = POWERUP_LIST[randIdx].type;
        this.sound.playPowerupReady();
      }
    }
  }

  public activatePowerup(isP1: boolean): boolean {
    const state = isP1 ? this.p1State : this.p2State;
    const userCar = isP1 ? this.p1Car : this.p2Car;
    const oppCar = isP1 ? this.p2Car : this.p1Car;

    if (!state.isPowerupReady || state.currentPowerup === 'NONE') {
      return false;
    }

    const type = state.currentPowerup;
    const ballPos = this.ball.getPosition();
    const carPos = userCar.getPosition();
    const distToBall = carPos.distanceTo(ballPos);

    switch (type) {
      case 'HAYMAKER': {
        // Punch ball toward opponent goal
        const targetGoalZ = isP1 ? 52 : -52;
        const shootDir = new THREE.Vector3(0, 4, targetGoalZ).sub(ballPos).normalize();

        this.punchStartPos.copy(carPos);
        this.punchTargetPos.copy(ballPos);
        this.punchProgress = 0;
        this.isPunching = true;
        this.gloveMesh.visible = true;

        setTimeout(() => {
          this.ball.body.setLinvel(
            new RAPIER.Vector3(shootDir.x * 65, shootDir.y * 30 + 10, shootDir.z * 65),
            true
          );
          this.sound.playGoalExplosion();
          this.particles.spawnShockwaveRing(ballPos, 0xff0044, 2.0, 25.0);
        }, 120);
        break;
      }

      case 'GRAPPLING_HOOK': {
        state.isGrappling = true;
        state.activeEffectTimer = 2.5;
        this.sound.playSonicBoom();
        break;
      }

      case 'PLUNGER': {
        state.isPlunging = true;
        state.activeEffectTimer = 2.0;
        this.sound.playPowerupReady();
        break;
      }

      case 'MAGNET': {
        state.isMagnetActive = true;
        state.activeEffectTimer = 5.0;
        this.sound.playPowerupReady();
        break;
      }

      case 'FREEZE': {
        this.freezeBall();
        break;
      }

      case 'BOOT': {
        // Launch opponent car
        const dir = oppCar.getPosition().sub(carPos).normalize();
        oppCar.body.setLinvel(new RAPIER.Vector3(dir.x * 45, 30, dir.z * 45), true);
        oppCar.body.setAngvel(new RAPIER.Vector3(15, 20, 10), true);
        this.sound.playSonicBoom();
        this.particles.spawnShockwaveRing(oppCar.getPosition(), 0xff3300, 2.0, 20.0);
        break;
      }

      case 'SPIKES': {
        state.isSpikesActive = true;
        state.activeEffectTimer = 4.5;
        if (isP1) this.p1SpikesGroup.visible = true;
        else this.p2SpikesGroup.visible = true;
        this.sound.playPowerupReady();
        break;
      }
    }

    // Reset powerup state
    state.currentPowerup = 'NONE';
    state.isPowerupReady = false;
    state.cooldownRemaining = 10.0;
    return true;
  }

  private freezeBall(): void {
    this.isBallFrozen = true;
    this.freezeTimer = 3.5;
    this.iceBlockMesh.visible = true;
    this.iceBlockMesh.position.copy(this.ball.getPosition());
    this.sound.playFreeze();
    this.particles.spawnShockwaveRing(this.ball.getPosition(), 0x00d2ff, 1.5, 18.0);
  }

  private unfreezeBall(): void {
    this.isBallFrozen = false;
    this.iceBlockMesh.visible = false;
    this.sound.playGoalExplosion();
    this.particles.spawnShockwaveRing(this.ball.getPosition(), 0x99eeff, 2.5, 22.0);
  }

  private processContinuousEffects(
    dt: number,
    state: RumblePlayerState,
    car: Car,
    cableLine: THREE.Line
  ): void {
    if (state.activeEffectTimer > 0) {
      state.activeEffectTimer -= dt;
      const carPos = car.getPosition();
      const ballPos = this.ball.getPosition();

      // 1. Grappling Hook: pull car to ball
      if (state.isGrappling) {
        const toBall = ballPos.clone().sub(carPos);
        const dist = toBall.length();

        cableLine.visible = true;
        const positions = (cableLine.geometry.attributes.position as THREE.BufferAttribute);
        positions.setXYZ(0, carPos.x, carPos.y + 0.5, carPos.z);
        positions.setXYZ(1, ballPos.x, ballPos.y, ballPos.z);
        positions.needsUpdate = true;

        if (dist > 2.5) {
          const pullDir = toBall.normalize();
          car.body.setLinvel(new RAPIER.Vector3(pullDir.x * 55, pullDir.y * 55 + 5, pullDir.z * 55), true);
        } else {
          state.isGrappling = false;
          cableLine.visible = false;
        }
      }

      // 2. Plunger: yank ball to behind car
      if (state.isPlunging) {
        cableLine.visible = true;
        const positions = (cableLine.geometry.attributes.position as THREE.BufferAttribute);
        positions.setXYZ(0, carPos.x, carPos.y + 0.5, carPos.z);
        positions.setXYZ(1, ballPos.x, ballPos.y, ballPos.z);
        positions.needsUpdate = true;

        const behindCar = carPos.clone().add(car.getForward().multiplyScalar(-6));
        const yankDir = behindCar.sub(ballPos).normalize();
        this.ball.body.applyImpulse(new RAPIER.Vector3(yankDir.x * 800, yankDir.y * 500 + 300, yankDir.z * 800), true);
      }

      // 3. Magnet: attract ball into orbit
      if (state.isMagnetActive) {
        const dist = carPos.distanceTo(ballPos);
        if (dist < 22) {
          const magnetForce = carPos.clone().add(car.getForward().multiplyScalar(2.0)).sub(ballPos).normalize();
          const power = Math.max(300, (22 - dist) * 75);
          this.ball.body.applyImpulse(new RAPIER.Vector3(magnetForce.x * power, magnetForce.y * power * 0.5, magnetForce.z * power), true);
        }
      }

      // 4. Spikes: stick ball to car roof
      if (state.isSpikesActive) {
        const dist = carPos.distanceTo(ballPos);
        if (dist < 3.2) {
          const roofPos = carPos.clone().add(new THREE.Vector3(0, 1.6, 0).applyQuaternion(car.mesh.quaternion));
          this.ball.body.setTranslation(new RAPIER.Vector3(roofPos.x, roofPos.y, roofPos.z), true);
          this.ball.body.setLinvel(car.body.linvel(), true);
          this.ball.body.setAngvel(car.body.angvel(), true);
        }
      }
    } else {
      // Effect expired
      state.isGrappling = false;
      state.isPlunging = false;
      state.isMagnetActive = false;
      state.isSpikesActive = false;
      cableLine.visible = false;
      this.p1SpikesGroup.visible = false;
      this.p2SpikesGroup.visible = false;
    }
  }

  public getPowerupInfo(type: PowerupType): PowerupInfo | null {
    return POWERUP_LIST.find((p) => p.type === type) || null;
  }
}
