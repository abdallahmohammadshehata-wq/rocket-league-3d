import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { InputState } from '../input/InputManager';
import { SoundManager } from '../core/SoundManager';
import { ParticleManager } from '../effects/ParticleManager';
import { Ball } from './Ball';
import {
  CarChassisBuilder,
  CarCustomization,
  DEFAULT_P1_CUSTOMIZATION,
  DEFAULT_P2_CUSTOMIZATION
} from './CarModelPresets';

export class Car {
  public mesh: THREE.Group;
  public body: RAPIER.RigidBody;
  public collider: RAPIER.Collider;

  public boostAmount: number = 33;
  public isGrounded: boolean = false;
  public isBoosting: boolean = false;
  public isDrifting: boolean = false;
  public isSupersonic: boolean = false;
  public currentSpeedKmh: number = 0;

  private scene: THREE.Scene;
  private world: RAPIER.World;
  private soundManager: SoundManager;
  private particleManager: ParticleManager;
  public readonly isBlueTeam: boolean;
  public customization: CarCustomization;

  // Jump & Dodge State
  private airTime: number = 0;
  private jumpsRemaining: number = 2;
  private isDodging: boolean = false;
  private dodgeTimer: number = 0;
  private readonly dodgeDuration: number = 0.5;
  private dodgeAxis: THREE.Vector3 = new THREE.Vector3();
  private dodgeStartRotation: THREE.Quaternion = new THREE.Quaternion();

  // Mesh & Visual Components
  private bodyMesh!: THREE.Mesh;
  private wheels: THREE.Mesh[] = [];
  private wheelHubs: THREE.Group[] = [];
  private thrusterGroup!: THREE.Group;
  private supersonicTrails: THREE.Mesh[] = [];
  private taillightMat!: THREE.MeshBasicMaterial;
  private underglowMesh!: THREE.Mesh;
  private topperGroup!: THREE.Group;

  // Raycast ground contact points (Calibrated for 4.0m length x 2.1m width chassis)
  private readonly rayOffsets = [
    new THREE.Vector3(-0.95, -0.1, -1.6), // Front Left
    new THREE.Vector3(0.95, -0.1, -1.6),  // Front Right
    new THREE.Vector3(-0.95, -0.1, 1.6),  // Rear Left
    new THREE.Vector3(0.95, -0.1, 1.6)    // Rear Right
  ];
  private readonly rayLength: number = 1.35;
  private contactNormal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

  // Ball hit cooldown to avoid multi-hits on a single contact
  private lastBallHitTime: number = 0;

  constructor(
    scene: THREE.Scene,
    world: RAPIER.World,
    soundManager: SoundManager,
    particleManager: ParticleManager,
    isBlueTeam: boolean = true,
    customization?: CarCustomization
  ) {
    this.scene = scene;
    this.world = world;
    this.soundManager = soundManager;
    this.particleManager = particleManager;
    this.isBlueTeam = isBlueTeam;
    this.customization = customization || (isBlueTeam ? { ...DEFAULT_P1_CUSTOMIZATION } : { ...DEFAULT_P2_CUSTOMIZATION });

    this.mesh = new THREE.Group();
    this.scene.add(this.mesh);

    // 1. Build 3D Car Model based on customization
    this.rebuildMesh();

    // 2. Rapier RigidBody
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 2.0, isBlueTeam ? -32 : 32)
      .setLinearDamping(0.12)
      .setAngularDamping(2.5)
      .setCcdEnabled(true);

    this.body = world.createRigidBody(bodyDesc);

    // Chassis Box Collider (Width: 2.1m, Height: 1.1m, Length: 4.0m)
    const colliderDesc = RAPIER.ColliderDesc.cuboid(1.05, 0.55, 2.0)
      .setMass(120.0) // Calibrated 120kg mass for perfect impulse scaling
      .setFriction(0.65)
      .setRestitution(0.12);

    this.collider = world.createCollider(colliderDesc, this.body);

    // Set initial team orientation
    const initRotY = isBlueTeam ? Math.PI : 0;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), initRotY);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  }

  public rebuildMesh(): void {
    const parts = CarChassisBuilder.buildChassis(this.mesh, this.customization, this.isBlueTeam);
    this.bodyMesh = parts.bodyMesh;
    this.wheels = parts.wheels;
    this.wheelHubs = parts.wheelHubs;
    this.thrusterGroup = parts.thrusterGroup;
    this.supersonicTrails = parts.supersonicTrails;
    this.taillightMat = parts.taillightMat;
    this.underglowMesh = parts.underglowMesh;
    this.topperGroup = parts.topperGroup;
  }

  public setCustomization(custom: Partial<CarCustomization>): void {
    this.customization = { ...this.customization, ...custom };
    this.rebuildMesh();
  }

  public reset(kickoffPosition: THREE.Vector3, isBlueTeam: boolean = true): void {
    this.body.setTranslation(kickoffPosition, true);
    this.body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
    this.body.setAngvel(new RAPIER.Vector3(0, 0, 0), true);

    const rotY = isBlueTeam ? Math.PI : 0;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);

    this.boostAmount = 33;
    this.isDodging = false;
    this.isGrounded = true;
    this.isSupersonic = false;
    this.airTime = 0;
    this.jumpsRemaining = 2;
    if (this.thrusterGroup) this.thrusterGroup.visible = false;
  }

  public update(dt: number, input: InputState): void {
    // 1. Raycast Ground Contact Check
    this.checkGroundContact();

    // 2. Process Driving, Airborne, Dodge, & Boost Physics
    this.handlePhysics(dt, input);

    // 3. Sync Three.js Mesh with Rapier RigidBody
    const pos = this.body.translation();
    const rot = this.body.rotation();
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    // 4. Update Wheels, Supersonic FX, & Audio
    const linvel = this.body.linvel();
    const speed = Math.hypot(linvel.x, linvel.y, linvel.z);
    this.currentSpeedKmh = Math.round(speed * 3.6);

    // Supersonic Threshold (> 80 km/h with active boost or dodge)
    const wasSupersonic = this.isSupersonic;
    this.isSupersonic = this.currentSpeedKmh > 78 && (this.isBoosting || this.isDodging || speed > 22.5);
    if (this.isSupersonic && !wasSupersonic) {
      this.soundManager.playSonicBoom();
      this.particleManager.spawnShockwaveRing(this.getPosition(), this.customization.accentColor, 1.8, 26.0);
    }

    this.supersonicTrails.forEach((t) => (t.visible = this.isSupersonic));

    // Animate wheels rotation
    this.wheels.forEach((w) => {
      w.rotation.x += speed * dt * (input.throttle >= 0 ? 2.0 : -2.0);
    });

    // Steer front wheel hubs
    if (this.wheelHubs.length >= 2) {
      const frontSteer = -input.steer * 0.45;
      this.wheelHubs[0].rotation.y = frontSteer;
      this.wheelHubs[1].rotation.y = frontSteer;
    }

    // Thruster flame flicker & particle sparks
    if (this.isBoosting && this.thrusterGroup) {
      const flicker = 0.85 + Math.random() * 0.35;
      this.thrusterGroup.scale.set(1, 1, flicker);
      const exhaustPos = this.getPosition().add(this.getForward().multiplyScalar(-1.8));
      this.particleManager.emitBoostSparks(exhaustPos, this.getForward(), this.isSupersonic);
    }

    // Taillight bright brake glow
    if (this.taillightMat) {
      if (input.throttle < 0) {
        this.taillightMat.color.setHex(0xff0022);
      } else {
        this.taillightMat.color.setHex(0x880018);
      }
    }

    // Drift smoke & tire skid marks
    if (this.isGrounded && this.isDrifting && speed > 5) {
      this.wheelHubs.forEach((hub) => {
        const worldPos = new THREE.Vector3();
        hub.getWorldPosition(worldPos);
        this.particleManager.emitDriftSmoke(worldPos);
      });

      if (this.wheelHubs.length >= 4) {
        const rlPos = new THREE.Vector3();
        const rrPos = new THREE.Vector3();
        this.wheelHubs[2].getWorldPosition(rlPos);
        this.wheelHubs[3].getWorldPosition(rrPos);
        this.particleManager.addSkidPoint(rlPos, rrPos);
      }
    }

    this.soundManager.updateEngine(this.currentSpeedKmh, input.throttle);
  }

  private checkGroundContact(): void {
    const carPos = this.mesh.position;
    const carQuat = this.mesh.quaternion;

    let hits = 0;
    const avgNormal = new THREE.Vector3(0, 0, 0);
    const downLocal = new THREE.Vector3(0, -1, 0).applyQuaternion(carQuat);

    for (const offset of this.rayOffsets) {
      const origin = offset.clone().applyQuaternion(carQuat).add(carPos);
      const ray = new RAPIER.Ray(
        new RAPIER.Vector3(origin.x, origin.y, origin.z),
        new RAPIER.Vector3(downLocal.x, downLocal.y, downLocal.z)
      );

      const hit = this.world.castRayAndGetNormal(
        ray,
        this.rayLength,
        true,
        undefined,
        undefined,
        undefined,
        this.body
      );

      if (hit && hit.timeOfImpact <= this.rayLength) {
        hits++;
        avgNormal.add(new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z));
      }
    }

    if (hits > 0) {
      this.isGrounded = true;
      this.contactNormal.copy(avgNormal.normalize());
      this.airTime = 0;
      this.jumpsRemaining = 2;
    } else {
      this.isGrounded = false;
    }
  }

  private handlePhysics(dt: number, input: InputState): void {
    const carQuat = this.mesh.quaternion;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(carQuat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(carQuat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(carQuat);

    const linvel = this.body.linvel();
    const currentVel = new THREE.Vector3(linvel.x, linvel.y, linvel.z);
    const mass = this.body.mass();

    // ==========================================
    // 1. ROCKET BOOST
    // ==========================================
    if (input.boost && this.boostAmount > 0) {
      this.isBoosting = true;
      this.boostAmount = Math.max(0, this.boostAmount - dt * 33.3);

      const boostForce = forward.clone().multiplyScalar(42.0 * mass);
      this.body.applyImpulse(
        new RAPIER.Vector3(boostForce.x * dt, boostForce.y * dt, boostForce.z * dt),
        true
      );

      if (this.thrusterGroup) this.thrusterGroup.visible = true;
      this.soundManager.setBoostActive(true);
    } else {
      this.isBoosting = false;
      if (this.thrusterGroup) this.thrusterGroup.visible = false;
      this.soundManager.setBoostActive(false);
    }

    // ==========================================
    // 2. JUMP & DODGE (FLIP) SYSTEM
    // ==========================================
    if (!this.isGrounded) {
      this.airTime += dt;
    }

    if (this.isDodging) {
      this.dodgeTimer += dt;
      const progress = Math.min(this.dodgeTimer / this.dodgeDuration, 1.0);

      const flipAngle = progress * Math.PI * 2;
      const flipQuat = new THREE.Quaternion().setFromAxisAngle(this.dodgeAxis, flipAngle);
      const targetQuat = this.dodgeStartRotation.clone().multiply(flipQuat);

      this.body.setRotation({ x: targetQuat.x, y: targetQuat.y, z: targetQuat.z, w: targetQuat.w }, true);

      if (progress >= 1.0) {
        this.isDodging = false;
      }
    } else if (input.jumpJustPressed) {
      if (this.isGrounded) {
        // Ground Jump: crisp pop off surface
        const jumpImpulse = up.clone().multiplyScalar(8.2 * mass);
        this.body.applyImpulse(
          new RAPIER.Vector3(jumpImpulse.x, jumpImpulse.y, jumpImpulse.z),
          true
        );
        this.jumpsRemaining = 1;
        this.soundManager.playJump();
      } else if (this.jumpsRemaining > 0 && this.airTime < 1.6) {
        // Airborne Flip / Dodge
        const hasDirection = Math.abs(input.throttle) > 0.1 || Math.abs(input.steer) > 0.1;

        if (hasDirection) {
          this.isDodging = true;
          this.dodgeTimer = 0;
          this.dodgeStartRotation.copy(this.mesh.quaternion);

          const dodgeDir = new THREE.Vector3();
          if (input.throttle > 0.1) dodgeDir.add(forward);
          if (input.throttle < -0.1) dodgeDir.add(forward.clone().negate());
          if (input.steer > 0.1) dodgeDir.add(right);
          if (input.steer < -0.1) dodgeDir.add(right.clone().negate());
          dodgeDir.normalize();

          this.dodgeAxis.crossVectors(up, dodgeDir).normalize();

          // Cancel downward vertical velocity
          const curV = this.body.linvel();
          this.body.setLinvel(new RAPIER.Vector3(curV.x, Math.max(curV.y, 1.0), curV.z), true);

          // Powerful directional dodge impulse
          const dodgeImpulse = dodgeDir.multiplyScalar(16.0 * mass);
          this.body.applyImpulse(
            new RAPIER.Vector3(dodgeImpulse.x, dodgeImpulse.y, dodgeImpulse.z),
            true
          );

          this.soundManager.playDodge();
          this.particleManager.spawnShockwaveRing(this.getPosition(), this.customization.accentColor, 1.8, 22.0);
        } else {
          // Neutral Double Jump
          const doubleJumpImpulse = up.clone().multiplyScalar(7.5 * mass);
          this.body.applyImpulse(
            new RAPIER.Vector3(doubleJumpImpulse.x, doubleJumpImpulse.y, doubleJumpImpulse.z),
            true
          );
          this.soundManager.playJump();
        }

        this.jumpsRemaining = 0;
      }
    }

    // ==========================================
    // 3. GROUNDED DRIVING & REVERSE
    // ==========================================
    if (this.isGrounded && !this.isDodging) {
      // Sticky Downforce (keeps car glued to floor & curved walls)
      const downforce = this.contactNormal.clone().multiplyScalar(-22.0 * mass);
      this.body.applyImpulse(
        new RAPIER.Vector3(downforce.x * dt, downforce.y * dt, downforce.z * dt),
        true
      );

      // Smooth surface normal alignment
      const currentUp = up.clone();
      const alignAxis = new THREE.Vector3().crossVectors(currentUp, this.contactNormal);
      const alignAngle = currentUp.angleTo(this.contactNormal);
      if (alignAngle > 0.04) {
        const alignTorque = alignAxis.normalize().multiplyScalar(alignAngle * 12.0 * mass);
        this.body.applyTorqueImpulse(
          new RAPIER.Vector3(alignTorque.x * dt, alignTorque.y * dt, alignTorque.z * dt),
          true
        );
      }

      const forwardVel = currentVel.dot(forward);
      const maxForwardSpeed = 38.0; // ~137 km/h without boost
      const maxReverseSpeed = -20.0; // ~72 km/h

      // Acceleration & Braking
      if (input.throttle > 0) {
        if (forwardVel < -0.5) {
          // Braking while in reverse
          const brakeForce = forward.clone().multiplyScalar(45.0 * mass);
          this.body.applyImpulse(new RAPIER.Vector3(brakeForce.x * dt, brakeForce.y * dt, brakeForce.z * dt), true);
        } else if (forwardVel < maxForwardSpeed) {
          // Drive Forward
          const driveForce = forward.clone().multiplyScalar(32.0 * mass * input.throttle);
          this.body.applyImpulse(new RAPIER.Vector3(driveForce.x * dt, driveForce.y * dt, driveForce.z * dt), true);
        }
      } else if (input.throttle < 0) {
        if (forwardVel > 0.5) {
          // Braking while driving forward
          const brakeForce = forward.clone().multiplyScalar(-45.0 * mass);
          this.body.applyImpulse(new RAPIER.Vector3(brakeForce.x * dt, brakeForce.y * dt, brakeForce.z * dt), true);
        } else if (forwardVel > maxReverseSpeed) {
          // Reverse
          const reverseForce = forward.clone().multiplyScalar(22.0 * mass * input.throttle);
          this.body.applyImpulse(new RAPIER.Vector3(reverseForce.x * dt, reverseForce.y * dt, reverseForce.z * dt), true);
        }
      } else {
        // Natural rolling resistance
        if (Math.abs(forwardVel) > 0.2) {
          const frictionForce = forward.clone().multiplyScalar(-forwardVel * 2.2 * mass);
          this.body.applyImpulse(new RAPIER.Vector3(frictionForce.x * dt, frictionForce.y * dt, frictionForce.z * dt), true);
        }
      }

      // Handbrake / Drift vs Lateral Grip
      this.isDrifting = input.handbrake && Math.abs(input.steer) > 0.1;
      this.soundManager.setDriftActive(this.isDrifting && currentVel.length() > 5);

      const lateralVel = currentVel.dot(right);
      const gripFactor = this.isDrifting ? 0.35 : 0.94;
      const lateralImpulse = right.clone().multiplyScalar(-lateralVel * gripFactor * mass * dt);
      this.body.applyImpulse(
        new RAPIER.Vector3(lateralImpulse.x, lateralImpulse.y, lateralImpulse.z),
        true
      );

      // Steering: Smooth & Direct Angular Velocity Control
      if (input.steer !== 0) {
        const isReversing = forwardVel < -0.4;
        const steerDir = isReversing ? 1 : -1;
        
        let targetYawSpeed: number;
        if (Math.abs(forwardVel) < 1.0) {
          targetYawSpeed = 3.6; // Stationary turn
        } else {
          const speedRatio = Math.min(1.0, Math.abs(forwardVel) / 26.0);
          targetYawSpeed = 4.2 - speedRatio * 1.4; // 4.2 -> 2.8 at max speed
        }

        if (this.isDrifting) {
          targetYawSpeed *= 1.5; // Wider drift rotation
        }

        const angvel = this.body.angvel();
        const desiredYaw = input.steer * steerDir * targetYawSpeed;
        const yawImpulse = (desiredYaw - angvel.y) * 0.45 * mass;

        this.body.applyTorqueImpulse(new RAPIER.Vector3(0, yawImpulse, 0), true);
      }
    } else {
      this.soundManager.setDriftActive(false);
    }

    // ==========================================
    // 4. IN-AIR ATTITUDE CONTROL (PITCH, YAW, ROLL)
    // ==========================================
    if (!this.isGrounded && !this.isDodging) {
      const pitchTorque = right.clone().multiplyScalar(input.pitch * 9.5 * mass);
      const yawTorque = up.clone().multiplyScalar(-input.yaw * 9.0 * mass);
      const rollTorque = forward.clone().multiplyScalar(-input.roll * 11.0 * mass);

      const totalTorque = pitchTorque.add(yawTorque).add(rollTorque);
      this.body.applyTorqueImpulse(
        new RAPIER.Vector3(totalTorque.x * dt, totalTorque.y * dt, totalTorque.z * dt),
        true
      );
    }
  }

  public checkBallHit(ball: Ball): void {
    const now = performance.now();
    if (now - this.lastBallHitTime < 100) return;

    const carPos = this.getPosition();
    const ballPos = ball.getPosition();
    const dist = carPos.distanceTo(ballPos);

    // Collision boundary: ball radius 2.0 + car half-extent ~1.7 = 3.7
    if (dist < 3.7) {
      this.lastBallHitTime = now;

      const carVel = this.getVelocity();
      const carSpeed = carVel.length();
      const forward = this.getForward();
      const hitDir = new THREE.Vector3().subVectors(ballPos, carPos).normalize();

      // Front bumper alignment check for power shots
      const frontAlignment = hitDir.dot(forward);
      const isPowerShot = frontAlignment > 0.4 && (carSpeed > 10 || this.isBoosting || this.isDodging);

      // Calibrated hit magnitude for the 8kg ball
      let forceMagnitude = 180; // Base hit
      if (isPowerShot) {
        forceMagnitude = 350 + carSpeed * 12;
        if (this.isSupersonic) forceMagnitude += 150;
        if (this.isDodging) forceMagnitude += 120;
      } else {
        forceMagnitude += carSpeed * 8;
      }

      // Add slight vertical lift to shots
      hitDir.y = Math.max(hitDir.y, 0.18);
      hitDir.normalize();

      const impulse = hitDir.multiplyScalar(forceMagnitude);
      ball.body.applyImpulse(new RAPIER.Vector3(impulse.x, impulse.y, impulse.z), true);

      // Screen shake, sparks, and sound
      const contactPoint = carPos.clone().add(ballPos).multiplyScalar(0.5);
      const intensity = isPowerShot ? 1.8 : Math.max(0.8, carSpeed / 12.0);
      this.soundManager.playBallHit(intensity);
      this.particleManager.emitBallHitSparks(contactPoint, intensity);

      if (isPowerShot) {
        this.particleManager.spawnShockwaveRing(contactPoint, this.customization.accentColor, 1.4, 18.0);
      }
    }
  }

  public collectBoost(amount: number): void {
    this.boostAmount = Math.min(100, this.boostAmount + amount);
    this.soundManager.playBoostPickup();
  }

  public getPosition(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  public getVelocity(): THREE.Vector3 {
    const v = this.body.linvel();
    return new THREE.Vector3(v.x, v.y, v.z);
  }

  public getForward(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
  }

  public getUp(): THREE.Vector3 {
    return new THREE.Vector3(0, 1, 0).applyQuaternion(this.mesh.quaternion);
  }

  public getRight(): THREE.Vector3 {
    return new THREE.Vector3(1, 0, 0).applyQuaternion(this.mesh.quaternion);
  }
}
