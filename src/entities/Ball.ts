import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { SoundManager } from '../core/SoundManager';
import { ParticleManager } from '../effects/ParticleManager';

export class Ball {
  public mesh: THREE.Group;
  public body: RAPIER.RigidBody;
  public collider: RAPIER.Collider;
  public readonly radius: number = 1.825; // Calibrated official Rocket League ball radius scale

  private scene: THREE.Scene;
  private soundManager: SoundManager;
  private particleManager: ParticleManager;
  private groundDecal: THREE.Group;
  private ballMat: THREE.MeshStandardMaterial;
  private trailPoints: THREE.Vector3[] = [];
  private trailLine: THREE.Line;
  private trailColors: Float32Array;

  // Aerodynamic constants
  private readonly magnusCoeff: number = 0.0035; // Aerodynamic spin curve
  private readonly maxBallSpeed: number = 80.0;   // ~288 km/h max terminal ball speed

  constructor(
    scene: THREE.Scene,
    world: RAPIER.World,
    soundManager: SoundManager,
    particleManager: ParticleManager
  ) {
    this.scene = scene;
    this.soundManager = soundManager;
    this.particleManager = particleManager;

    // 1. Visual 3D Mesh
    this.mesh = new THREE.Group();

    // High-Resolution Glowing Futuristic Soccer Sphere Texture
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Base carbon background
    ctx.fillStyle = '#080d1a';
    ctx.fillRect(0, 0, 2048, 1024);

    // Glowing energy grid & metallic pentagon/hexagon plating
    const step = 256;
    for (let x = 0; x <= 2048; x += step) {
      for (let y = 0; y <= 1024; y += step) {
        const isLight = (x + y) % (step * 2) === 0;

        // Plate fill
        ctx.fillStyle = isLight ? '#131e36' : '#f0f4f8';
        ctx.beginPath();
        ctx.arc(x + step / 2, y + step / 2, step * 0.38, 0, Math.PI * 2);
        ctx.fill();

        // Neon energy contour
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 14;
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 18;
        ctx.stroke();

        // Inner glowing core dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + step / 2, y + step / 2, 12, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const ballTexture = new THREE.CanvasTexture(canvas);
    ballTexture.anisotropy = 16;

    const ballGeo = new THREE.SphereGeometry(this.radius, 48, 48);
    this.ballMat = new THREE.MeshStandardMaterial({
      map: ballTexture,
      roughness: 0.18,
      metalness: 0.5,
      emissive: 0x00d2ff,
      emissiveIntensity: 0.5
    });

    const ballMeshInner = new THREE.Mesh(ballGeo, this.ballMat);
    ballMeshInner.castShadow = true;
    this.mesh.add(ballMeshInner);

    this.scene.add(this.mesh);

    // 2. Rapier Physics RigidBody (Standard Rocket League ball dynamics)
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 3.0, 0)
      .setLinearDamping(0.005)
      .setAngularDamping(0.015)
      .setCcdEnabled(true);

    this.body = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.ball(this.radius)
      .setMass(30.0) // Calibrated 30kg tournament ball mass
      .setRestitution(0.70)
      .setFriction(0.35);

    this.collider = world.createCollider(colliderDesc, this.body);

    // 3. Ground Indicator Decal (Landing spot projection with altitude indicator)
    this.groundDecal = new THREE.Group();

    const ringGeo = new THREE.RingGeometry(0.8, 2.4, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    this.groundDecal.add(ringMesh);

    // Inner crosshair center
    const dotGeo = new THREE.CircleGeometry(0.35, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const dotMesh = new THREE.Mesh(dotGeo, dotMat);
    dotMesh.rotation.x = -Math.PI / 2;
    this.groundDecal.add(dotMesh);

    this.groundDecal.position.y = 0.05;
    this.scene.add(this.groundDecal);

    // 4. High-Speed Dynamic Color Ribbon Trail
    const maxTrail = 32;
    const trailPositions = new Float32Array(maxTrail * 3);
    this.trailColors = new Float32Array(maxTrail * 3);

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(this.trailColors, 3));

    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      linewidth: 4
    });
    this.trailLine = new THREE.Line(trailGeo, trailMat);
    this.scene.add(this.trailLine);
  }

  public reset(kickoffPosition: THREE.Vector3 = new THREE.Vector3(0, 3.0, 0)): void {
    this.body.setTranslation(kickoffPosition, true);
    this.body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
    this.body.setAngvel(new RAPIER.Vector3(0, 0, 0), true);
    this.mesh.position.copy(kickoffPosition);
    this.trailPoints = [];
  }

  public triggerGoalShockwave(impactPos: THREE.Vector3, teamColor: number): void {
    const ballPos = this.body.translation();
    const blastDir = new THREE.Vector3(
      ballPos.x - impactPos.x,
      Math.max(ballPos.y - impactPos.y, 4.0),
      ballPos.z - impactPos.z
    ).normalize();

    this.body.applyImpulse(
      new RAPIER.Vector3(blastDir.x * 260, blastDir.y * 220, blastDir.z * 260),
      true
    );

    this.particleManager.emitGoalExplosion(new THREE.Vector3(ballPos.x, ballPos.y, ballPos.z), teamColor);
    this.soundManager.playGoal();
  }

  public update(dt: number = 1 / 120): void {
    const pos = this.body.translation();
    const rot = this.body.rotation();
    const vel = this.body.linvel();
    const angvel = this.body.angvel();

    let speed = Math.hypot(vel.x, vel.y, vel.z);

    // Terminal velocity clamp
    if (speed > this.maxBallSpeed) {
      const scale = this.maxBallSpeed / speed;
      this.body.setLinvel(new RAPIER.Vector3(vel.x * scale, vel.y * scale, vel.z * scale), true);
      speed = this.maxBallSpeed;
    }

    // Aerodynamic Magnus Effect (Spin Curve in Air)
    if (pos.y > this.radius + 0.5 && speed > 8.0) {
      const v = new THREE.Vector3(vel.x, vel.y, vel.z);
      const w = new THREE.Vector3(angvel.x, angvel.y, angvel.z);
      const magnusForce = new THREE.Vector3().crossVectors(w, v).multiplyScalar(this.magnusCoeff * this.body.mass());
      this.body.applyImpulse(
        new RAPIER.Vector3(magnusForce.x * dt, magnusForce.y * dt, magnusForce.z * dt),
        true
      );
    }

    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    // Dynamic Emissive Glow based on speed
    const speedRatio = Math.min(1.0, speed / 38.0);
    this.ballMat.emissiveIntensity = 0.4 + speedRatio * 1.8;
    if (speedRatio > 0.6) {
      this.ballMat.emissive.setHex(0xff00ff); // Hot purple supersonic glow
    } else {
      this.ballMat.emissive.setHex(0x00e5ff); // Cool cyan standard glow
    }

    // Ground indicator projection
    this.groundDecal.position.x = pos.x;
    this.groundDecal.position.z = pos.z;

    const altitude = Math.max(0, pos.y - this.radius);
    const scale = Math.max(0.6, Math.min(2.8, 1.0 + altitude * 0.12));
    this.groundDecal.scale.set(scale, scale, 1);
    const opacity = Math.max(0.18, 0.85 - altitude * 0.035);
    const ringMesh = this.groundDecal.children[0] as THREE.Mesh;
    if (ringMesh) {
      (ringMesh.material as THREE.MeshBasicMaterial).opacity = opacity;
    }

    // Update Dynamic Trail
    const currentPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    this.trailPoints.unshift(currentPos);
    if (this.trailPoints.length > 32) {
      this.trailPoints.pop();
    }

    const posAttr = this.trailLine.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = this.trailLine.geometry.attributes.color as THREE.BufferAttribute;

    const baseColor = speedRatio > 0.6 ? new THREE.Color(0xff00cc) : new THREE.Color(0x00e5ff);

    for (let i = 0; i < 32; i++) {
      const pt = this.trailPoints[i] || currentPos;
      posAttr.setXYZ(i, pt.x, pt.y, pt.z);

      const fade = Math.max(0, 1 - i / 32) * (speed / 14.0);
      const c = baseColor.clone().multiplyScalar(Math.min(1.5, fade));
      colAttr.setXYZ(i, c.r, c.g, c.b);
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  public getPosition(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  public getVelocity(): THREE.Vector3 {
    const v = this.body.linvel();
    return new THREE.Vector3(v.x, v.y, v.z);
  }

  public getSpeedKmh(): number {
    const v = this.body.linvel();
    return Math.round(Math.hypot(v.x, v.y, v.z) * 3.6);
  }
}
