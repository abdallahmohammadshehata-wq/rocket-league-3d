import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export class ParticleManager {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private particleGeometry: THREE.BufferGeometry;
  private particleMaterial: THREE.PointsMaterial;
  private particlePoints: THREE.Points;

  private maxParticles: number = 2000;
  private positions: Float32Array;
  private colors: Float32Array;

  // Expanding shockwave rings (Goal explosions, dodges)
  private shockwaves: Array<{ mesh: THREE.Mesh; scaleSpeed: number; fadeSpeed: number }> = [];

  // Tire skid tracks
  private skidSegments: THREE.LineSegments;
  private skidPositions: Float32Array;
  private skidIndex: number = 0;
  private readonly maxSkidPoints: number = 1000;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Particle System Setup
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    this.particleGeometry = new THREE.BufferGeometry();
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    // Custom circle canvas sprite for soft glowing particles
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const particleTex = new THREE.CanvasTexture(canvas);

    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      map: particleTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particlePoints = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.scene.add(this.particlePoints);

    // 2. Tire Skidmarks Line System
    this.skidPositions = new Float32Array(this.maxSkidPoints * 3);
    const skidGeo = new THREE.BufferGeometry();
    skidGeo.setAttribute('position', new THREE.BufferAttribute(this.skidPositions, 3));
    const skidMat = new THREE.LineBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.45,
      linewidth: 3
    });
    this.skidSegments = new THREE.LineSegments(skidGeo, skidMat);
    this.scene.add(this.skidSegments);
  }

  public emitBoostSparks(origin: THREE.Vector3, direction: THREE.Vector3, isSupersonic: boolean): void {
    const count = isSupersonic ? 8 : 4;
    const baseColor = isSupersonic ? new THREE.Color(0xcc00ff) : new THREE.Color(0xffaa00);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.4
      );

      const vel = direction.clone().multiplyScalar(-18 - Math.random() * 12).add(spread);
      const color = baseColor.clone().offsetHSL((Math.random() - 0.5) * 0.1, 0, (Math.random() - 0.5) * 0.2);

      this.particles.push({
        position: origin.clone().add(spread),
        velocity: vel,
        color,
        size: isSupersonic ? 1.2 : 0.7,
        alpha: 1.0,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25
      });
    }
  }

  public emitDriftSmoke(position: THREE.Vector3): void {
    if (this.particles.length >= this.maxParticles) return;

    for (let i = 0; i < 3; i++) {
      const spread = new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.1, (Math.random() - 0.5) * 0.6);
      this.particles.push({
        position: position.clone().add(spread),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 2.0, 1.5 + Math.random() * 2.0, (Math.random() - 0.5) * 2.0),
        color: new THREE.Color(0xaaaaaa),
        size: 1.4,
        alpha: 0.6,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.3
      });
    }
  }

  public addSkidPoint(p1: THREE.Vector3, p2: THREE.Vector3): void {
    const arr = (this.skidSegments.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const idx = (this.skidIndex % (this.maxSkidPoints / 2)) * 6;

    arr[idx] = p1.x;
    arr[idx + 1] = 0.04;
    arr[idx + 2] = p1.z;

    arr[idx + 3] = p2.x;
    arr[idx + 4] = 0.04;
    arr[idx + 5] = p2.z;

    this.skidIndex++;
    this.skidSegments.geometry.attributes.position.needsUpdate = true;
  }

  public emitBallHitSparks(position: THREE.Vector3, intensity: number): void {
    const count = Math.min(60, Math.floor(intensity * 30));
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.5) * Math.PI;
      const speed = 10 + Math.random() * 25 * intensity;

      const vel = new THREE.Vector3(
        Math.cos(angle) * Math.cos(elevation) * speed,
        Math.sin(elevation) * speed + 5,
        Math.sin(angle) * Math.cos(elevation) * speed
      );

      this.particles.push({
        position: position.clone(),
        velocity: vel,
        color: new THREE.Color(0x00ffff),
        size: 0.9,
        alpha: 1.0,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.4
      });
    }

    // Spawn expanding shockwave ring
    this.spawnShockwaveRing(position, 0x00d2ff, 1.5, 45.0);
  }

  public emitGoalExplosion(goalPos: THREE.Vector3, teamColor: number): void {
    const count = 350;
    const colorObj = new THREE.Color(teamColor);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 15 + Math.random() * 45;

      const vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.abs(Math.cos(phi)) * speed + 10,
        Math.sin(phi) * Math.sin(theta) * speed
      );

      this.particles.push({
        position: goalPos.clone(),
        velocity: vel,
        color: colorObj.clone().offsetHSL((Math.random() - 0.5) * 0.15, 0, (Math.random() - 0.5) * 0.2),
        size: 1.8 + Math.random() * 1.5,
        alpha: 1.0,
        life: 0,
        maxLife: 1.2 + Math.random() * 0.8
      });
    }

    // Multiple massive shockwave rings
    this.spawnShockwaveRing(goalPos, teamColor, 4.0, 70.0);
    setTimeout(() => this.spawnShockwaveRing(goalPos, 0xffffff, 3.0, 85.0), 120);
  }

  public spawnShockwaveRing(position: THREE.Vector3, color: number, initialRadius: number, expandSpeed: number): void {
    const ringGeo = new THREE.RingGeometry(initialRadius, initialRadius + 1.2, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(position);
    ringMesh.position.y = Math.max(0.1, position.y);
    ringMesh.rotation.x = -Math.PI / 2;
    this.scene.add(ringMesh);

    this.shockwaves.push({
      mesh: ringMesh,
      scaleSpeed: expandSpeed,
      fadeSpeed: 1.6
    });
  }

  public update(dt: number): void {
    // 1. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= 15.0 * dt; // Gravity
      p.alpha = 1.0 - p.life / p.maxLife;
    }

    // Sync buffer attributes
    for (let i = 0; i < this.maxParticles; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        this.positions[i * 3] = p.position.x;
        this.positions[i * 3 + 1] = p.position.y;
        this.positions[i * 3 + 2] = p.position.z;

        this.colors[i * 3] = p.color.r * p.alpha;
        this.colors[i * 3 + 1] = p.color.g * p.alpha;
        this.colors[i * 3 + 2] = p.color.b * p.alpha;
      } else {
        this.positions[i * 3] = 0;
        this.positions[i * 3 + 1] = -1000;
        this.positions[i * 3 + 2] = 0;
      }
    }

    this.particleGeometry.attributes.position.needsUpdate = true;
    this.particleGeometry.attributes.color.needsUpdate = true;

    // 2. Update Expanding Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.mesh.scale.addScalar(sw.scaleSpeed * dt);
      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity -= sw.fadeSpeed * dt;

      if (mat.opacity <= 0.01) {
        this.scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        mat.dispose();
        this.shockwaves.splice(i, 1);
      }
    }
  }
}
