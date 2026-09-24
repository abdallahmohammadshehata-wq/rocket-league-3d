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
  public isGrounded: boolean = true;
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
  private isJumpHolding: boolean = false;
  private jumpHoldTimer: number = 0;
  private readonly maxJumpHoldTime: number = 0.20;

  // Mesh & Visual Components
  private bodyMesh!: THREE.Mesh;
  private wheels: THREE.Mesh[] = [];
  private wheelHubs: THREE.Group[] = [];
  private thrusterGroup!: THREE.Group;
  private supersonicTrails: THREE.Mesh[] = [];
  private taillightMat!: THREE.MeshBasicMaterial;
  private underglowMesh!: THREE.Mesh;
  private topperGroup!: THREE.Group;

  // Ground check ray offsets
  private readonly rayOffsets = [
    new THREE.Vector3(-0.95, 0.0, -1.5),
    new THREE.Vector3(0.95, 0.0, -1.5),
    new THREE.Vector3(-0.95, 0.0, 1.5),
    new THREE.Vector3(0.95, 0.0, 1.5)
  ];
  private readonly rayLength: number = 1.45;
  private contactNormal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

  // Ball hit cooldown
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

    // 1. Build 3D Car Model
    this.rebuildMesh();

    // 2. Rapier RigidBody
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 1.2, isBlueTeam ? -32 : 32)
      .setLinearDamping(0.05)
      .setAngularDamping(2.5)
      .setCcdEnabled(true);

    this.body = world.createRigidBody(bodyDesc);

    // Chassis Box Collider (0 friction to eliminate ground dragging/sticking)
    const colliderDesc = RAPIER.ColliderDesc.cuboid(1.05, 0.48, 1.95)
      .setMass(120.0)
      .setFriction(0.0)
      .setRestitution(0.1);

    this.collider = world.createCollider(colliderDesc, this.body);

    // Initial rotation
    const initRotY = isBlueTeam ? Math.PI : 0;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), initRotY);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.mesh.position.set(0, 1.2, isBlueTeam ? -32 : 32);
    this.mesh.quaternion.copy(q);
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
    this.mesh.position.copy(kickoffPosition);
    this.mesh.quaternion.copy(q);

    this.boostAmount = 33;
    this.isDodging = false;
    this.isGrounded = true;
    this.isSupersonic = false;
    this.isJumpHolding = false;
    this.jumpHoldTimer = 0;
    this.airTime = 0;
    this.jumpsRemaining = 2;
    if (this.thrusterGroup) this.thrusterGroup.visible = false;
  }

  public update(dt: number, input: InputState): void {
    // 1. Sync Mesh with RigidBody first
    const pos = this.body.translation();
    const rot = this.body.rotation();
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    // 2. Ground & Surface Normal Check
    this.checkGroundContact();

    // 3. Process Driving, Airborne, Dodge, & Boost Physics
    this.handlePhysics(dt, input);

    // 4. Re-sync Mesh after physics impulses
    const finalPos = this.body.translation();
    const finalRot = this.body.rotation();
    this.mesh.position.set(finalPos.x, finalPos.y, finalPos.z);
    this.mesh.quaternion.set(finalRot.x, finalRot.y, finalRot.z, finalRot.w);

    // 5. Update Wheels, Supersonic FX, & Audio
    const linvel = this.body.linvel();
    const speed = Math.hypot(linvel.x, linvel.y, linvel.z);
    this.currentSpeedKmh = Math.round(speed * 3.6);

    // Supersonic Threshold (> 145 km/h with active boost or dodge)
    const wasSupersonic = this.isSupersonic;
    this.isSupersonic = this.currentSpeedKmh >= 145 || (this.currentSpeedKmh > 125 && (this.isBoosting || this.isDodging));
    if (this.isSupersonic && !wasSupersonic) {
      this.soundManager.playSonicBoom();
      this.particleManager.spawnShockwaveRing(this.getPosition(), this.customization.accentColor, 1.8, 28.0);
    }

    this.supersonicTrails.forEach((t) => (t.visible = this.isSupersonic));

    // Animate wheels rotation
    this.wheels.forEach((w) => {
      w.rotation.x += speed * dt * (input.throttle >= 0 ? 2.5 : -2.5);
    });

    // Steer front wheel hubs
    if (this.wheelHubs.length >= 2) {
      const frontSteer = -input.steer * 0.42;
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

    // Fail-safe floor detection: stadium floor is strictly at y = 0.0
    // If the car's center is at y <= 1.35, the car is physically grounded on the pitch!
    if (carPos.y <= 1.35) {
      this.isGrounded = true;
      this.contactNormal.set(0, 1, 0);
      this.airTime = 0;
      this.jumpsRemaining = 2;
      return;
    }

    // Wall & Ramp Raycasting for climbing 45° ramps and vertical arena walls
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
        this.collider, // Exclude own collider
        this.body      // Exclude own body
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
    const r = this.body.rotation();
    const carQuat = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(carQuat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(carQuat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(carQuat);

    const linvel = this.body.linvel();
    const currentVel = new THREE.Vector3(linvel.x, linvel.y, linvel.z);
    const speed = currentVel.length();
    const mass = this.body.mass();

    // ==========================================
    // 1. ROCKET BOOST
    // ==========================================
    if (input.boost && this.boostAmount > 0) {
      this.isBoosting = true;
      this.boostAmount = Math.max(0, this.boostAmount - dt * 33.3);

      const maxBoostSpeed = 46.0; // ~165.6 km/h
      const forwardSpeed = currentVel.dot(forward);

      if (forwardSpeed < maxBoostSpeed) {
        const boostAcc = this.isGrounded ? 25.0 : 26.0;
        const boostForce = forward.clone().multiplyScalar(boostAcc * mass);
        this.body.applyImpulse(
          new RAPIER.Vector3(boostForce.x * dt, boostForce.y * dt, boostForce.z * dt),
          true
        );
      }

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

    // 2A. Active Dodge / Flip Rotation & Impulse
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
    } else {
      // 2B. Variable Jump Hold Bonus
      if (this.isJumpHolding) {
        if (input.jump && this.jumpHoldTimer < this.maxJumpHoldTime) {
          this.jumpHoldTimer += dt;
          const holdForce = up.clone().multiplyScalar(30.0 * mass);
          this.body.applyImpulse(
            new RAPIER.Vector3(holdForce.x * dt, holdForce.y * dt, holdForce.z * dt),
            true
          );
        } else {
          this.isJumpHolding = false;
        }
      }

      // 2C. Jump Button Pressed Trigger
      if (input.jumpJustPressed) {
        if (this.isGrounded) {
          // Ground Jump: crisp initial pop off surface
          const jumpImpulse = up.clone().multiplyScalar(6.5 * mass);
          this.body.applyImpulse(
            new RAPIER.Vector3(jumpImpulse.x, jumpImpulse.y, jumpImpulse.z),
            true
          );
          this.jumpsRemaining = 1;
          this.isJumpHolding = true;
          this.jumpHoldTimer = 0;
          this.soundManager.playJump();
        } else if (this.jumpsRemaining > 0 && this.airTime < 1.45) {
          const hasDirection = Math.abs(input.throttle) > 0.1 || Math.abs(input.steer) > 0.1;

          if (hasDirection) {
            this.isDodging = true;
            this.dodgeTimer = 0;
            this.dodgeStartRotation.copy(carQuat);

            const dodgeDir = new THREE.Vector3();
            if (input.throttle > 0.1) dodgeDir.add(forward.clone().multiplyScalar(input.throttle));
            if (input.throttle < -0.1) dodgeDir.add(forward.clone().multiplyScalar(input.throttle));
            if (input.steer > 0.1) dodgeDir.add(right.clone().multiplyScalar(input.steer));
            if (input.steer < -0.1) dodgeDir.add(right.clone().multiplyScalar(input.steer));
            dodgeDir.normalize();

            this.dodgeAxis.crossVectors(up, dodgeDir).normalize();

            const curV = this.body.linvel();
            this.body.setLinvel(new RAPIER.Vector3(curV.x, Math.max(curV.y, 0) + 1.2, curV.z), true);

            const dodgeImpulse = dodgeDir.multiplyScalar(11.5 * mass);
            this.body.applyImpulse(
              new RAPIER.Vector3(dodgeImpulse.x, dodgeImpulse.y, dodgeImpulse.z),
              true
            );

            this.soundManager.playDodge();
            this.particleManager.spawnShockwaveRing(this.getPosition(), this.customization.accentColor, 1.8, 24.0);
          } else {
            const doubleJumpImpulse = up.clone().multiplyScalar(6.2 * mass);
            this.body.applyImpulse(
              new RAPIER.Vector3(doubleJumpImpulse.x, doubleJumpImpulse.y, doubleJumpImpulse.z),
              true
            );
            this.soundManager.playJump();
          }

          this.jumpsRemaining = 0;
        }
      }
    }

    // ==========================================
    // 3. GROUNDED DRIVING & REVERSE
    // ==========================================
    if (this.isGrounded && !this.isDodging) {
      // 3A. Sticky Downforce
      const stickyForce = this.contactNormal.clone().multiplyScalar(-6.0 * mass);
      this.body.applyImpulse(
        new RAPIER.Vector3(stickyForce.x * dt, stickyForce.y * dt, stickyForce.z * dt),
        true
      );

      // 3B. Surface Normal Alignment Torque
      const currentUp = up.clone();
      const alignAxis = new THREE.Vector3().crossVectors(currentUp, this.contactNormal);
      const alignAngle = currentUp.angleTo(this.contactNormal);
      if (alignAngle > 0.03) {
        const alignTorque = alignAxis.normalize().multiplyScalar(alignAngle * 14.0 * mass);
        this.body.applyTorqueImpulse(
          new RAPIER.Vector3(alignTorque.x * dt, alignTorque.y * dt, alignTorque.z * dt),
          true
        );
      }

      const forwardVel = currentVel.dot(forward);
      const maxDriveSpeed = 28.5; // ~102 km/h
      const maxReverseSpeed = -18.0; // ~65 km/h

      // 3C. Instant Responsive Acceleration Curve (Forward & Reverse)
      if (input.throttle > 0) {
        if (forwardVel < -0.2) {
          // Instantly brake and cancel reverse momentum
          const brakeForce = forward.clone().multiplyScalar(80.0 * mass);
          this.body.applyImpulse(new RAPIER.Vector3(brakeForce.x * dt, brakeForce.y * dt, brakeForce.z * dt), true);
        } else if (forwardVel < maxDriveSpeed) {
          // Strong 42.0 m/s² initial acceleration from dead stop!
          const driveAcc = 42.0 * Math.max(0.22, 1.0 - forwardVel / maxDriveSpeed);
          const driveForce = forward.clone().multiplyScalar(driveAcc * mass * input.throttle);
          this.body.applyImpulse(new RAPIER.Vector3(driveForce.x * dt, driveForce.y * dt, driveForce.z * dt), true);
        }
      } else if (input.throttle < 0) {
        if (forwardVel > 0.2) {
          // Brake from forward
          const brakeForce = forward.clone().multiplyScalar(-80.0 * mass);
          this.body.applyImpulse(new RAPIER.Vector3(brakeForce.x * dt, brakeForce.y * dt, brakeForce.z * dt), true);
        } else if (forwardVel > maxReverseSpeed) {
          // Reverse Drive
          const reverseForce = forward.clone().multiplyScalar(28.0 * mass * input.throttle);
          this.body.applyImpulse(new RAPIER.Vector3(reverseForce.x * dt, reverseForce.y * dt, reverseForce.z * dt), true);
        }
      } else {
        // Rolling resistance
        if (Math.abs(forwardVel) > 0.1) {
          const coastForce = forward.clone().multiplyScalar(-Math.sign(forwardVel) * 8.0 * mass);
          this.body.applyImpulse(new RAPIER.Vector3(coastForce.x * dt, coastForce.y * dt, coastForce.z * dt), true);
        }
      }

      // 3D. Steering & Direct Angular Yaw Control (Need For Speed / Rocket League responsive handling)
      if (input.steer !== 0) {
        const isReversing = forwardVel < -0.3;
        const steerDir = isReversing ? 1 : -1;
        const speedRatio = Math.min(1.0, Math.abs(forwardVel) / 28.5);
        // Instant crisp yaw rate at all speeds: pivot turn when stopped, snappy high-speed turning
        const baseTurnRate = Math.abs(forwardVel) < 0.6 ? 5.2 : (4.8 - speedRatio * 1.3);
        const turnMultiplier = this.isDrifting ? 1.85 : 1.0;
        const desiredYaw = input.steer * steerDir * baseTurnRate * turnMultiplier;

        const curAng = this.body.angvel();
        this.body.setAngvel(new RAPIER.Vector3(curAng.x, desiredYaw, curAng.z), true);
      } else if (this.isGrounded) {
        // Smoothly stabilize rotation when steering key is released
        const curAng = this.body.angvel();
        this.body.setAngvel(new RAPIER.Vector3(curAng.x, curAng.y * 0.45, curAng.z), true);
      }

      // 3E. Velocity Heading Redirection & Lateral Grip
      this.isDrifting = input.handbrake && Math.abs(input.steer) > 0.05;
      this.soundManager.setDriftActive(this.isDrifting && speed > 5);

      if (Math.abs(forwardVel) > 0.15) {
        const curLinvel = this.body.linvel();
        const horizSpeed = Math.hypot(curLinvel.x, curLinvel.z);
        const targetForward = forward.clone().setY(0).normalize();
        const targetLinvel = targetForward.multiplyScalar(Math.sign(forwardVel) * horizSpeed);

        // Responsive tire grip aligns momentum with car heading instantly
        const steerGripRate = this.isDrifting ? 7.0 : 26.0;
        const blend = Math.min(1.0, dt * steerGripRate);
        const newVx = THREE.MathUtils.lerp(curLinvel.x, targetLinvel.x, blend);
        const newVz = THREE.MathUtils.lerp(curLinvel.z, targetLinvel.z, blend);

        this.body.setLinvel(new RAPIER.Vector3(newVx, curLinvel.y, newVz), true);
      }
    } else {
      this.soundManager.setDriftActive(false);
    }

    // ==========================================
    // 4. IN-AIR ATTITUDE CONTROL (PITCH, YAW, ROLL)
    // ==========================================
    if (!this.isGrounded && !this.isDodging) {
      if (input.throttle !== 0) {
        const airThrottleForce = forward.clone().multiplyScalar(input.throttle * 2.5 * mass);
        this.body.applyImpulse(
          new RAPIER.Vector3(airThrottleForce.x * dt, airThrottleForce.y * dt, airThrottleForce.z * dt),
          true
        );
      }

      const pitchTorque = right.clone().multiplyScalar(input.pitch * 13.5 * mass);
      const yawTorque = up.clone().multiplyScalar(-input.yaw * 10.5 * mass);
      const rollTorque = forward.clone().multiplyScalar(-input.roll * 38.0 * mass);

      const totalTorque = pitchTorque.add(yawTorque).add(rollTorque);
      this.body.applyTorqueImpulse(
        new RAPIER.Vector3(totalTorque.x * dt, totalTorque.y * dt, totalTorque.z * dt),
        true
      );

      const angvel = this.body.angvel();
      const currentAngSpeed = Math.hypot(angvel.x, angvel.y, angvel.z);
      if (currentAngSpeed > 5.5) {
        const scale = 5.5 / currentAngSpeed;
        this.body.setAngvel(new RAPIER.Vector3(angvel.x * scale, angvel.y * scale, angvel.z * scale), true);
      }

      if (input.pitch === 0 && input.yaw === 0 && input.roll === 0) {
        const dampFactor = Math.max(0, 1.0 - dt * 3.5);
        this.body.setAngvel(
          new RAPIER.Vector3(angvel.x * dampFactor, angvel.y * dampFactor, angvel.z * dampFactor),
          true
        );
      }
    }
  }

  public checkBallHit(ball: Ball): void {
    const now = performance.now();
    if (now - this.lastBallHitTime < 80) return;

    const carPos = this.getPosition();
    const ballPos = ball.getPosition();
    const dist = carPos.distanceTo(ballPos);

    if (dist < 3.65) {
      this.lastBallHitTime = now;

      const carVel = this.getVelocity();
      const ballVel = ball.getVelocity();
      const carSpeed = carVel.length();
      const forward = this.getForward();
      const up = this.getUp();

      const hitDir = new THREE.Vector3().subVectors(ballPos, carPos).normalize();
      const frontAlignment = hitDir.dot(forward);
      const underbellyAlignment = hitDir.dot(up);

      // Flip Reset
      if (!this.isGrounded && underbellyAlignment < -0.32) {
        this.jumpsRemaining = 1;
        this.airTime = 0;
        this.isJumpHolding = false;
        this.soundManager.playBoostPickup();
        this.particleManager.spawnShockwaveRing(carPos, 0x00ff88, 1.6, 20.0);
      }

      const isPowerShot = frontAlignment > 0.35;
      const isRoofTouch = underbellyAlignment > 0.35;
      const isUnderbellyTouch = underbellyAlignment < -0.32;

      const isNearWallOrFloor = Math.abs(ballPos.x) > 37.5 || Math.abs(ballPos.z) > 47.0 || ballPos.y < 2.1;
      const isPinch = isNearWallOrFloor && carSpeed > 14.0 && isPowerShot;

      const relVel = new THREE.Vector3().subVectors(carVel, ballVel);
      const relSpeed = Math.max(0, relVel.dot(hitDir));

      let hitMultiplier = 1.0;
      let baseImpulse = 160.0;

      if (isPinch) {
        hitMultiplier = 4.2;
        baseImpulse = 750.0 + carSpeed * 22.0;
      } else if (isPowerShot) {
        hitMultiplier = 1.45;
        baseImpulse = 320.0 + carSpeed * 14.0;
        if (this.isSupersonic) baseImpulse += 180.0;
        if (this.isDodging) baseImpulse += 140.0;
      } else if (isRoofTouch) {
        hitMultiplier = 1.05;
        baseImpulse = 200.0 + carSpeed * 9.0;
      } else if (isUnderbellyTouch) {
        hitMultiplier = 0.45;
        baseImpulse = 80.0 + carSpeed * 4.0;
      } else {
        hitMultiplier = 0.95;
        baseImpulse = 180.0 + carSpeed * 8.0;
      }

      if (isPowerShot && !isPinch) {
        hitDir.y = Math.max(hitDir.y, 0.22);
        hitDir.normalize();
      }

      const totalImpulseMag = (baseImpulse + relSpeed * 8.5 * hitMultiplier);
      const ballImpulse = hitDir.clone().multiplyScalar(totalImpulseMag);

      ball.body.applyImpulse(new RAPIER.Vector3(ballImpulse.x, ballImpulse.y, ballImpulse.z), true);

      const carRecoil = hitDir.clone().multiplyScalar(-totalImpulseMag * 0.12);
      this.body.applyImpulse(new RAPIER.Vector3(carRecoil.x, carRecoil.y, carRecoil.z), true);

      const contactPoint = carPos.clone().add(ballPos).multiplyScalar(0.5);
      const intensity = isPinch ? 2.8 : isPowerShot ? 1.9 : Math.max(0.7, carSpeed / 12.0);
      this.soundManager.playBallHit(intensity);
      this.particleManager.emitBallHitSparks(contactPoint, intensity);

      if (isPinch) {
        this.soundManager.playSonicBoom();
        this.particleManager.spawnShockwaveRing(contactPoint, 0xff00ff, 2.4, 38.0);
      } else if (isPowerShot) {
        this.particleManager.spawnShockwaveRing(contactPoint, this.customization.accentColor, 1.5, 20.0);
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
    const r = this.body.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    return new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  }

  public getUp(): THREE.Vector3 {
    const r = this.body.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    return new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  }

  public getRight(): THREE.Vector3 {
    const r = this.body.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    return new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  }
}
