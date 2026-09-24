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

  // Jump & Dodge State (Calibrated to official Rocket League timing)
  private airTime: number = 0;
  private jumpsRemaining: number = 2;
  private isDodging: boolean = false;
  private dodgeTimer: number = 0;
  private readonly dodgeDuration: number = 0.5; // 500ms dodge duration
  private dodgeAxis: THREE.Vector3 = new THREE.Vector3();
  private dodgeStartRotation: THREE.Quaternion = new THREE.Quaternion();
  private isJumpHolding: boolean = false;
  private jumpHoldTimer: number = 0;
  private readonly maxJumpHoldTime: number = 0.20; // 200ms jump hold bonus window

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
  private readonly rayLength: number = 1.38;
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
      .setLinearDamping(0.08)
      .setAngularDamping(2.2)
      .setCcdEnabled(true);

    this.body = world.createRigidBody(bodyDesc);

    // Chassis Box Collider (Width: 2.1m, Height: 1.1m, Length: 4.0m)
    const colliderDesc = RAPIER.ColliderDesc.cuboid(1.05, 0.55, 2.0)
      .setMass(120.0) // Calibrated 120kg mass for realistic impulse transfer
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
    this.isJumpHolding = false;
    this.jumpHoldTimer = 0;
    this.airTime = 0;
    this.jumpsRemaining = 2;
    if (this.thrusterGroup) this.thrusterGroup.visible = false;
  }

  public update(dt: number, input: InputState): void {
    // 1. Raycast Ground / Wall / Ceiling Contact Check
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

    // Supersonic Threshold (> 150 km/h / ~42 m/s with active boost or dodge)
    const wasSupersonic = this.isSupersonic;
    this.isSupersonic = this.currentSpeedKmh >= 150 || (this.currentSpeedKmh > 130 && (this.isBoosting || this.isDodging));
    if (this.isSupersonic && !wasSupersonic) {
      this.soundManager.playSonicBoom();
      this.particleManager.spawnShockwaveRing(this.getPosition(), this.customization.accentColor, 1.8, 28.0);
    }

    this.supersonicTrails.forEach((t) => (t.visible = this.isSupersonic));

    // Animate wheels rotation
    this.wheels.forEach((w) => {
      w.rotation.x += speed * dt * (input.throttle >= 0 ? 2.2 : -2.2);
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
    const speed = currentVel.length();
    const mass = this.body.mass();

    // ==========================================
    // 1. ROCKET BOOST (Authentic RL Acceleration)
    // ==========================================
    if (input.boost && this.boostAmount > 0) {
      this.isBoosting = true;
      this.boostAmount = Math.max(0, this.boostAmount - dt * 33.3); // 3 seconds of full boost from 100

      // In RL, boost provides ~20 m/s² (1058 uu/s²) forward thrust
      const maxBoostSpeed = 46.0; // ~165 km/h max boost terminal speed
      const forwardSpeed = currentVel.dot(forward);

      if (forwardSpeed < maxBoostSpeed) {
        const boostAcc = this.isGrounded ? 21.0 : 22.5;
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
      // 2B. Variable Jump Hold Bonus (Upward acceleration during the first 200ms of jump)
      if (this.isJumpHolding) {
        if (input.jump && this.jumpHoldTimer < this.maxJumpHoldTime) {
          this.jumpHoldTimer += dt;
          // RL Jump Hold provides +29.16 m/s² (1458.33 uu/s²) upward acceleration
          const holdForce = up.clone().multiplyScalar(29.2 * mass);
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
          // Ground Jump: crisp initial pop off surface (~5.85 m/s)
          const jumpImpulse = up.clone().multiplyScalar(5.85 * mass);
          this.body.applyImpulse(
            new RAPIER.Vector3(jumpImpulse.x, jumpImpulse.y, jumpImpulse.z),
            true
          );
          this.jumpsRemaining = 1;
          this.isJumpHolding = true;
          this.jumpHoldTimer = 0;
          this.soundManager.playJump();
        } else if (this.jumpsRemaining > 0 && this.airTime < 1.45) {
          // In-Air Second Action: Directional Dodge or Neutral Double Jump
          const hasDirection = Math.abs(input.throttle) > 0.1 || Math.abs(input.steer) > 0.1;

          if (hasDirection) {
            // Directional Flip / Dodge
            this.isDodging = true;
            this.dodgeTimer = 0;
            this.dodgeStartRotation.copy(this.mesh.quaternion);

            const dodgeDir = new THREE.Vector3();
            if (input.throttle > 0.1) dodgeDir.add(forward.clone().multiplyScalar(input.throttle));
            if (input.throttle < -0.1) dodgeDir.add(forward.clone().multiplyScalar(input.throttle));
            if (input.steer > 0.1) dodgeDir.add(right.clone().multiplyScalar(input.steer));
            if (input.steer < -0.1) dodgeDir.add(right.clone().multiplyScalar(input.steer));
            dodgeDir.normalize();

            // Rotation axis perpendicular to Up and dodge direction
            this.dodgeAxis.crossVectors(up, dodgeDir).normalize();

            // Cancel falling vertical velocity and give slight upward cushion
            const curV = this.body.linvel();
            this.body.setLinvel(new RAPIER.Vector3(curV.x, Math.max(curV.y, 0) + 1.2, curV.z), true);

            // Explosive directional dodge impulse (+10.5 m/s / ~500 uu/s in RL)
            const dodgeImpulse = dodgeDir.multiplyScalar(10.5 * mass);
            this.body.applyImpulse(
              new RAPIER.Vector3(dodgeImpulse.x, dodgeImpulse.y, dodgeImpulse.z),
              true
            );

            this.soundManager.playDodge();
            this.particleManager.spawnShockwaveRing(this.getPosition(), this.customization.accentColor, 1.8, 24.0);
          } else {
            // Neutral Double Jump (+5.85 m/s upward pop)
            const doubleJumpImpulse = up.clone().multiplyScalar(5.85 * mass);
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
      // 3A. Sticky Downforce (keeps car glued to floor & curved 45° ramps/walls)
      // RL applies 6.5 m/s² sticky normal force towards the surface
      const stickyForce = this.contactNormal.clone().multiplyScalar(-6.5 * mass);
      this.body.applyImpulse(
        new RAPIER.Vector3(stickyForce.x * dt, stickyForce.y * dt, stickyForce.z * dt),
        true
      );

      // 3B. Surface Normal Alignment Torque (smoothly orient car with wall/ramp slope)
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
      const maxDriveSpeed = 28.2; // ~101.5 km/h (1410 uu/s in RL)
      const maxReverseSpeed = -18.0; // ~65 km/h

      // 3C. Authentic Non-Linear Drive Acceleration Curve
      if (input.throttle > 0) {
        if (forwardVel < -0.5) {
          // Braking while reversing (strong 70 m/s² braking deceleration)
          const brakeForce = forward.clone().multiplyScalar(70.0 * mass);
          this.body.applyImpulse(new RAPIER.Vector3(brakeForce.x * dt, brakeForce.y * dt, brakeForce.z * dt), true);
        } else if (forwardVel < maxDriveSpeed) {
          // RL Drive Force Curve: a(v) = 16.0 * (1.0 - v / 28.2) m/s²
          const driveAcc = 16.0 * Math.max(0.12, 1.0 - forwardVel / maxDriveSpeed);
          const driveForce = forward.clone().multiplyScalar(driveAcc * mass * input.throttle);
          this.body.applyImpulse(new RAPIER.Vector3(driveForce.x * dt, driveForce.y * dt, driveForce.z * dt), true);
        }
      } else if (input.throttle < 0) {
        if (forwardVel > 0.5) {
          // Braking while going forward (strong 70 m/s² braking deceleration)
          const brakeForce = forward.clone().multiplyScalar(-70.0 * mass);
          this.body.applyImpulse(new RAPIER.Vector3(brakeForce.x * dt, brakeForce.y * dt, brakeForce.z * dt), true);
        } else if (forwardVel > maxReverseSpeed) {
          // Reverse Drive (15 m/s² acceleration)
          const reverseForce = forward.clone().multiplyScalar(15.0 * mass * input.throttle);
          this.body.applyImpulse(new RAPIER.Vector3(reverseForce.x * dt, reverseForce.y * dt, reverseForce.z * dt), true);
        }
      } else {
        // Natural rolling resistance (10.5 m/s² coasting deceleration)
        if (Math.abs(forwardVel) > 0.15) {
          const coastForce = forward.clone().multiplyScalar(-Math.sign(forwardVel) * 10.5 * mass);
          this.body.applyImpulse(new RAPIER.Vector3(coastForce.x * dt, coastForce.y * dt, coastForce.z * dt), true);
        }
      }

      // 3D. Lateral Grip & Powerslide / Drift Handling
      this.isDrifting = input.handbrake && Math.abs(input.steer) > 0.05;
      this.soundManager.setDriftActive(this.isDrifting && speed > 5);

      const lateralVel = currentVel.dot(right);
      // High lateral grip (0.95) for crisp steering, low grip (0.22) during drift powerslide
      const gripFactor = this.isDrifting ? 0.22 : 0.95;
      const lateralImpulse = right.clone().multiplyScalar(-lateralVel * gripFactor * mass * dt * 60.0);
      this.body.applyImpulse(
        new RAPIER.Vector3(lateralImpulse.x, lateralImpulse.y, lateralImpulse.z),
        true
      );

      // 3E. Speed-Dependent Steering Curvature
      if (input.steer !== 0) {
        const isReversing = forwardVel < -0.3;
        const steerDir = isReversing ? 1 : -1;

        let targetYawRate: number;
        if (Math.abs(forwardVel) < 1.0) {
          targetYawRate = 3.8; // Pivot turn when nearly stopped
        } else {
          // Tighter turning radius at slow speeds, smoothly widening at max speed
          const speedFactor = Math.min(1.0, Math.abs(forwardVel) / 28.2);
          targetYawRate = 4.4 - speedFactor * 1.6; // 4.4 rad/s -> 2.8 rad/s at max speed
        }

        if (this.isDrifting) {
          targetYawRate *= 1.85; // Snappy rotation during powerslide
        }

        const angvel = this.body.angvel();
        const desiredYaw = input.steer * steerDir * targetYawRate;
        const yawImpulse = (desiredYaw - angvel.y) * 0.55 * mass;

        this.body.applyTorqueImpulse(new RAPIER.Vector3(0, yawImpulse, 0), true);
      }
    } else {
      this.soundManager.setDriftActive(false);
    }

    // ==========================================
    // 4. IN-AIR ATTITUDE CONTROL (PITCH, YAW, ROLL)
    // ==========================================
    if (!this.isGrounded && !this.isDodging) {
      // 4A. Air Throttle (gentle forward acceleration in air when holding throttle)
      if (input.throttle !== 0) {
        const airThrottleForce = forward.clone().multiplyScalar(input.throttle * 2.0 * mass);
        this.body.applyImpulse(
          new RAPIER.Vector3(airThrottleForce.x * dt, airThrottleForce.y * dt, airThrottleForce.z * dt),
          true
        );
      }

      // 4B. Calibrated Rocket League Aerial Torques
      // Pitch: 12.46 rad/s², Yaw: 9.11 rad/s², Roll: 38.34 rad/s²
      const pitchTorque = right.clone().multiplyScalar(input.pitch * 12.5 * mass);
      const yawTorque = up.clone().multiplyScalar(-input.yaw * 9.5 * mass);
      const rollTorque = forward.clone().multiplyScalar(-input.roll * 38.0 * mass);

      const totalTorque = pitchTorque.add(yawTorque).add(rollTorque);
      this.body.applyTorqueImpulse(
        new RAPIER.Vector3(totalTorque.x * dt, totalTorque.y * dt, totalTorque.z * dt),
        true
      );

      // 4C. Angular Velocity Clamp (Max 5.5 rad/s in RL)
      const angvel = this.body.angvel();
      const currentAngSpeed = Math.hypot(angvel.x, angvel.y, angvel.z);
      if (currentAngSpeed > 5.5) {
        const scale = 5.5 / currentAngSpeed;
        this.body.setAngvel(new RAPIER.Vector3(angvel.x * scale, angvel.y * scale, angvel.z * scale), true);
      }

      // 4D. Auto-stabilizing air damping when rotational inputs are released
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
    if (now - this.lastBallHitTime < 80) return; // 80ms hit cooldown to avoid multi-touches

    const carPos = this.getPosition();
    const ballPos = ball.getPosition();
    const dist = carPos.distanceTo(ballPos);

    // Collision boundary: ball radius ~1.82 + car half-extent ~1.75 = 3.6m
    if (dist < 3.65) {
      this.lastBallHitTime = now;

      const carVel = this.getVelocity();
      const ballVel = ball.getVelocity();
      const carSpeed = carVel.length();
      const forward = this.getForward();
      const up = this.getUp();

      // Hit direction vector from car center of mass to ball center of mass
      const hitDir = new THREE.Vector3().subVectors(ballPos, carPos).normalize();

      // Surface zone alignment checks
      const frontAlignment = hitDir.dot(forward);
      const underbellyAlignment = hitDir.dot(up);

      // ==========================================
      // 1. FLIP RESET (Hitting underbelly on ball)
      // ==========================================
      if (!this.isGrounded && underbellyAlignment < -0.32) {
        this.jumpsRemaining = 1;
        this.airTime = 0;
        this.isJumpHolding = false;
        this.soundManager.playBoostPickup();
        this.particleManager.spawnShockwaveRing(carPos, 0x00ff88, 1.6, 20.0);
      }

      // ==========================================
      // 2. ROCKET LEAGUE HIT FORCE CALCULATIONS
      // ==========================================
      const isPowerShot = frontAlignment > 0.35;
      const isRoofTouch = underbellyAlignment > 0.35;
      const isUnderbellyTouch = underbellyAlignment < -0.32;

      // Pinch Shot Detection (Ball compressed against stadium wall or ground)
      const isNearWallOrFloor = Math.abs(ballPos.x) > 37.5 || Math.abs(ballPos.z) > 47.0 || ballPos.y < 2.1;
      const isPinch = isNearWallOrFloor && carSpeed > 14.0 && isPowerShot;

      // Relative collision velocity: Δv = v_car - v_ball
      const relVel = new THREE.Vector3().subVectors(carVel, ballVel);
      const relSpeed = Math.max(0, relVel.dot(hitDir));

      let hitMultiplier = 1.0;
      let baseImpulse = 160.0;

      if (isPinch) {
        // Supersonic Pinch: Massive kinetic multiplier (>140 km/h)
        hitMultiplier = 4.2;
        baseImpulse = 750.0 + carSpeed * 22.0;
      } else if (isPowerShot) {
        // Front Bumper Power Shot: 1.45x multiplier
        hitMultiplier = 1.45;
        baseImpulse = 320.0 + carSpeed * 14.0;
        if (this.isSupersonic) baseImpulse += 180.0;
        if (this.isDodging) baseImpulse += 140.0;
      } else if (isRoofTouch) {
        // Roof Hit: 1.05x multiplier
        hitMultiplier = 1.05;
        baseImpulse = 200.0 + carSpeed * 9.0;
      } else if (isUnderbellyTouch) {
        // Wheels / Underbelly Soft Touch (cushions the ball for dribbles & air dribbles)
        hitMultiplier = 0.45;
        baseImpulse = 80.0 + carSpeed * 4.0;
      } else {
        // Side bumper hit
        hitMultiplier = 0.95;
        baseImpulse = 180.0 + carSpeed * 8.0;
      }

      // Add gentle vertical lift to power shots
      if (isPowerShot && !isPinch) {
        hitDir.y = Math.max(hitDir.y, 0.22);
        hitDir.normalize();
      }

      const totalImpulseMag = (baseImpulse + relSpeed * 8.5 * hitMultiplier);
      const ballImpulse = hitDir.clone().multiplyScalar(totalImpulseMag);

      // Apply impulse to Ball
      ball.body.applyImpulse(new RAPIER.Vector3(ballImpulse.x, ballImpulse.y, ballImpulse.z), true);

      // Apply realistic minor recoil to Car (Newton's 3rd Law asymmetry in RL)
      const carRecoil = hitDir.clone().multiplyScalar(-totalImpulseMag * 0.12);
      this.body.applyImpulse(new RAPIER.Vector3(carRecoil.x, carRecoil.y, carRecoil.z), true);

      // Visual & Audio Hit Feedback
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
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
  }

  public getUp(): THREE.Vector3 {
    return new THREE.Vector3(0, 1, 0).applyQuaternion(this.mesh.quaternion);
  }

  public getRight(): THREE.Vector3 {
    return new THREE.Vector3(1, 0, 0).applyQuaternion(this.mesh.quaternion);
  }
}
